/**
 * agreementRoutes.js — tutors' Odoo Sign agreements, as stored in MongoDB by
 * utils/agreementSync.js, and full verification. Admin only.
 *
 *   GET  /api/agreements/summary              how many signed / waiting / not sent
 *   GET  /api/agreements/tutors?status=signed  tutors and partial tutors with that status
 *   POST /api/agreements/sync                 read Odoo now instead of waiting for the timer
 *   POST /api/agreements/send/:id             send one tutor the agreement or the login link again
 *        body: { kind: "agreement" | "profile", dryRun? }
 */
import express from "express";
import Tutor from "../models/Tutor.js";
import PartialTutor from "../models/PartialTutor.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { agreementSummary, syncTutorAgreements } from "../utils/agreementSync.js";
import { sendVerificationLinks, KINDS } from "../utils/verificationLinks.js";

const router = express.Router();
const STATUSES = ["signed", "sent", "refused", "cancelled", "none"];

router.get("/summary", verifyToken(["admin"]), async (req, res) => {
  try {
    res.json(await agreementSummary());
  } catch (err) {
    console.error("[Agreements] summary:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.get("/tutors", verifyToken(["admin"]), async (req, res) => {
  const status = String(req.query.status || "signed");
  if (!STATUSES.includes(status)) return res.status(400).json({ message: `status must be one of ${STATUSES.join(", ")}` });
  try {
    // People never matched in Odoo have no odooAgreement yet; they count as "none"
    const filter = status === "none"
      ? { $or: [{ "odooAgreement.status": "none" }, { "odooAgreement.status": { $exists: false } }] }
      : { "odooAgreement.status": status };
    const [tutors, partials] = await Promise.all([
      Tutor.find(filter, { name: 1, tutorCode: 1, phone: 1, email: 1, status: 1, onboardingCompleted: 1, odooAgreement: 1 }).lean(),
      // Partial tutors who completed the registration are listed as their tutor record
      PartialTutor.find({ ...filter, registeredTutorId: null }, { name: 1, tutorCode: 1, whatsapp: 1, odooAgreement: 1 }).lean(),
    ]);
    const rows = [
      ...tutors.map((t) => ({ ...t, source: "tutor", fullyVerified: true })),
      ...partials.map((p) => ({ _id: p._id, name: p.name, tutorCode: p.tutorCode, phone: p.whatsapp, email: "",
        onboardingCompleted: false, odooAgreement: p.odooAgreement, source: "partial", fullyVerified: false })),
    ];
    const at = (r) => new Date(r.odooAgreement?.signedAt || r.odooAgreement?.sentAt || 0).getTime();
    rows.sort((a, b) => at(b) - at(a) || String(a.name || "").localeCompare(String(b.name || "")));
    res.json({ status, count: rows.length, tutors: rows });
  } catch (err) {
    console.error("[Agreements] tutors:", err.message);
    res.status(500).json({ message: err.message });
  }
});

router.post("/sync", verifyToken(["admin"]), async (req, res) => {
  try {
    const result = await syncTutorAgreements();
    if (result.skipped) return res.status(409).json({ message: "A sync is already running; try again in a minute." });
    res.json(result);
  } catch (err) {
    console.error("[Agreements] sync:", err.message);
    res.status(502).json({ message: `Could not read Odoo Sign: ${err.message}` });
  }
});

router.post("/send/:id", verifyToken(["admin"]), async (req, res) => {
  const kind = String(req.body?.kind || "agreement");
  if (!KINDS.includes(kind)) return res.status(400).json({ message: `kind must be one of ${KINDS.join(", ")}` });
  try {
    const result = await sendVerificationLinks(null, {
      tutorId: req.params.id, kind, dryRun: req.body?.dryRun === true,
    });
    if (result.ok === false) return res.status(409).json(result);
    res.json(result);
  } catch (err) {
    console.error("[Agreements] send:", err.message);
    res.status(500).json({ message: err.message });
  }
});

export default router;
