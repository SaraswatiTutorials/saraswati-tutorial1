import express from "express";
import Feedback, { FEEDBACK_SOURCES, FEEDBACK_CATEGORIES } from "../models/Feedback.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

const MAX_MESSAGE_LENGTH = 2000;

const clip = (value, max) => String(value ?? "").trim().slice(0, max);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/feedback
// Sent from the feedback button on the parent enquiry and tutor registration forms
// when a visitor reports an issue they are facing. Public endpoint — no auth required.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { source, category, message, name, phone, step } = req.body || {};

    if (!FEEDBACK_SOURCES.includes(source)) {
      return res.status(400).json({ success: false, message: "Invalid feedback source." });
    }

    if (!FEEDBACK_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: "Please choose what the issue is about." });
    }

    const text = String(message ?? "").trim();
    if (!text) {
      return res.status(400).json({ success: false, message: "Please describe the issue." });
    }
    if (text.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Feedback must be ${MAX_MESSAGE_LENGTH} characters or fewer.`,
      });
    }

    const record = await Feedback.create({
      source,
      category,
      message: text,
      name: clip(name, 100),
      phone: clip(phone, 20),
      step: Number.isInteger(Number(step)) ? Number(step) : 0,
      ipAddress: req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "",
      userAgent: req.headers["user-agent"] || "",
    });

    return res.status(201).json({ success: true, message: "Thank you for your feedback.", id: record._id });
  } catch (err) {
    console.error("[Feedback] Save error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/feedback  (Admin only)
// Feedback records, newest first, with per-form totals. ?source= filters the list.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", verifyToken(["admin"]), async (req, res) => {
  try {
    const { source, limit = 500 } = req.query;

    const filter = FEEDBACK_SOURCES.includes(source) ? { source } : {};

    const [records, totals] = await Promise.all([
      Feedback.find(filter).sort({ createdAt: -1 }).limit(Number(limit) || 500).lean(),
      Feedback.aggregate([{ $group: { _id: "$source", count: { $sum: 1 } } }]),
    ]);

    const counts = Object.fromEntries(FEEDBACK_SOURCES.map((s) => [s, 0]));
    for (const { _id, count } of totals) counts[_id] = count;

    return res.json({
      success: true,
      total: Object.values(counts).reduce((sum, n) => sum + n, 0),
      counts,
      records,
    });
  } catch (err) {
    console.error("[Feedback] Fetch error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

export default router;
