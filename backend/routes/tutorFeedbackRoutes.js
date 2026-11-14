/**
 * The parent's side of the tutor feedback form (see utils/tutorFeedback.js).
 *
 * GET  /api/tutor-feedback/:token   what the form shows (tutor, child, options)
 * POST /api/tutor-feedback/:token   the answers, once
 *
 * No login: the token in the WhatsApp link is the key, and it is long and
 * random. Only first names and the tutor's public details are returned.
 */
import express from "express";
import mongoose from "mongoose";
import TutorFeedback from "../models/TutorFeedback.js";
import Tutor from "../models/Tutor.js";
import ParentEnquiry from "../models/ParentEnquiry.js";
import { cleanAnswers, publicView, summarise } from "../utils/tutorFeedback.js";
import { addOdooChatterMessage } from "../utils/odooService.js";

const router = express.Router();
const TOKEN = /^[A-Za-z0-9_-]{8,40}$/;

async function extrasFor(doc) {
  const [tutor, lead] = await Promise.all([
    doc.tutorId && mongoose.isValidObjectId(doc.tutorId) ? Tutor.findById(doc.tutorId, { photo: 1 }).lean() : null,
    ParentEnquiry.findById(doc.leadId, { wards: 1 }).lean(),
  ]);
  const ward = lead?.wards?.[0] || {};
  const subjects = Array.isArray(ward.subjectsNeeded) ? ward.subjectsNeeded.join(", ") : (ward.subjectsNeeded || "");
  return { photo: tutor?.photo || "", subjects, grade: ward.classGrade || "" };
}

router.get("/:token", async (req, res) => {
  try {
    const { token } = req.params;
    if (!TOKEN.test(token)) return res.status(404).json({ message: "This feedback link is not valid." });
    const doc = await TutorFeedback.findOne({ token });
    if (!doc) return res.status(404).json({ message: "This feedback link is not valid." });
    if (!doc.openedAt) {
      doc.openedAt = new Date();
      await doc.save().catch(() => {});
    }
    res.json(publicView(doc, await extrasFor(doc)));
  } catch (err) {
    console.error("[Tutor Feedback] load failed:", err.message);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

router.post("/:token", async (req, res) => {
  try {
    const { token } = req.params;
    if (!TOKEN.test(token)) return res.status(404).json({ message: "This feedback link is not valid." });
    const { answers, error } = cleanAnswers(req.body || {});
    if (error) return res.status(400).json({ message: error });

    // Only an unanswered link takes answers, so a double tap cannot overwrite them
    const doc = await TutorFeedback.findOneAndUpdate(
      { token, submittedAt: null },
      { $set: {
        ...answers,
        submittedAt: new Date(),
        ipAddress: String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim(),
        userAgent: String(req.headers["user-agent"] || "").slice(0, 300),
      } },
      { new: true },
    );
    if (!doc) {
      const exists = await TutorFeedback.exists({ token });
      return exists
        ? res.status(409).json({ message: "Thank you, your feedback for this tutor was already received." })
        : res.status(404).json({ message: "This feedback link is not valid." });
    }

    const lead = await ParentEnquiry.findById(doc.leadId, { odooLeadId: 1 }).lean().catch(() => null);
    if (lead?.odooLeadId) {
      addOdooChatterMessage(lead.odooLeadId, summarise(doc))
        .catch((err) => console.error("[Tutor Feedback] Odoo note failed:", err.message));
    }
    res.json({ ok: true, message: "Thank you for your feedback!" });
  } catch (err) {
    console.error("[Tutor Feedback] submit failed:", err.message);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

export default router;
