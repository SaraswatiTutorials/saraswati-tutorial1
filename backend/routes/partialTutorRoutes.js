import express from "express";
import mongoose from "mongoose";
import PartialTutor, { PARTIAL_TUTOR_STATUSES } from "../models/PartialTutor.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { validatePartialTutor } from "../utils/partialTutorValidation.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/partial-tutors
// Sent from the partial tutor form page. Public endpoint — no auth required.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { value, error } = validatePartialTutor(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const record = await PartialTutor.create({
      ...value,
      ipAddress: req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "",
      userAgent: req.headers["user-agent"] || "",
    });

    return res.status(201).json({ success: true, message: "Thank you! Our team will call you soon.", id: record._id });
  } catch (err) {
    console.error("[PartialTutor] Save error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/partial-tutors  (Admin only)
// Newest first, with totals per status. ?status= filters the list.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", verifyToken(["admin"]), async (req, res) => {
  try {
    const { status, limit = 500 } = req.query;
    const filter = PARTIAL_TUTOR_STATUSES.includes(status) ? { status } : {};

    const [records, totals] = await Promise.all([
      PartialTutor.find(filter).sort({ createdAt: -1 }).limit(Number(limit) || 500).lean(),
      PartialTutor.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);

    const counts = Object.fromEntries(PARTIAL_TUTOR_STATUSES.map((s) => [s, 0]));
    for (const { _id, count } of totals) counts[_id] = count;

    return res.json({
      success: true,
      total: Object.values(counts).reduce((sum, n) => sum + n, 0),
      counts,
      records,
    });
  } catch (err) {
    console.error("[PartialTutor] Fetch error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/partial-tutors/:id/status  (Admin only)
// Moves a lead between "new", "contacted" and "registered".
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/:id/status", verifyToken(["admin"]), async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid id." });
    }
    if (!PARTIAL_TUTOR_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status." });
    }

    const record = await PartialTutor.findByIdAndUpdate(req.params.id, { status }, { new: true }).lean();
    if (!record) return res.status(404).json({ success: false, message: "Not found." });

    return res.json({ success: true, record });
  } catch (err) {
    console.error("[PartialTutor] Status update error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/partial-tutors/:id  (Admin only)
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:id", verifyToken(["admin"]), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid id." });
    }
    const record = await PartialTutor.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: "Not found." });

    return res.json({ success: true });
  } catch (err) {
    console.error("[PartialTutor] Delete error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

export default router;
