import express from "express";
import mongoose from "mongoose";
import Assignment from "../models/Assignment.js";
import ParentEnquiry from "../models/ParentEnquiry.js";
import Tutor from "../models/Tutor.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { canAccessStudent } from "../utils/portalAccess.js";
import { parseAssignmentInput, assignmentProblem, settleStatus } from "../utils/assignments.js";
import { receivePhoto, storePhoto } from "../utils/photoUpload.js";
import { findTutorAccount } from "../utils/tutorAccount.js";
import jwt from "jsonwebtoken";
import PartialTutor from "../models/PartialTutor.js";
import Attendance from "../models/Attendance.js";
import BroadcastLog from "../models/BroadcastLog.js";
import { STILL_NEEDED, knownFromPartial, validateCompletion, registrationFromPartial } from "../utils/profileCompletion.js";
import { phonePattern } from "../utils/loginMatch.js";

// Profile photos and assignment records for the parent and tutor portals
const router = express.Router();

const NOT_YOURS = "You can only see your own students.";

// Loads the tuition named in the URL and checks the signed-in user may use it
async function loadStudent(req, res, id) {
  if (!mongoose.isValidObjectId(id)) {
    res.status(404).json({ message: "Student not found." });
    return null;
  }
  const lead = await ParentEnquiry.findById(id);
  if (!lead) {
    res.status(404).json({ message: "Student not found." });
    return null;
  }
  if (!canAccessStudent(req.user, lead)) {
    res.status(403).json({ message: NOT_YOURS });
    return null;
  }
  return lead;
}

const studentNameOf = (lead) => lead.wards?.map((w) => w.studentName).filter(Boolean).join(", ") || "";

// =============================================================
// Tutor profile (name, code, photo) for the dashboard header
// =============================================================
router.get("/tutor/me", verifyToken(["tutor"]), async (req, res) => {
  try {
    // A registered tutor, or a partial tutor (short sign-up form)
    const tutor = await findTutorAccount(req.user.id);
    if (!tutor) return res.status(404).json({ message: "Tutor not found." });
    res.json({ success: true, tutor: { id: tutor._id, name: tutor.name, tutorCode: tutor.tutorCode || "", photo: tutor.photo || "" } });
  } catch (error) {
    console.error("Tutor profile error:", error);
    res.status(500).json({ message: error.message });
  }
});

router.post("/tutor/photo", verifyToken(["tutor"]), receivePhoto, async (req, res) => {
  try {
    const tutor = await findTutorAccount(req.user.id);
    if (!tutor) return res.status(404).json({ message: "Tutor not found." });
    // A partial tutor's photo is kept on their sign-up form record
    const record = tutor.isPartial ? tutor.doc : tutor;
    record.photo = await storePhoto(req.file, "saraswati-tutors/profile");
    await record.save({ validateBeforeSave: false });
    res.json({ success: true, photo: record.photo });
  } catch (error) {
    console.error("Tutor photo upload error:", error);
    res.status(500).json({ message: "Couldn't upload the photo. Please try again." });
  }
});

// =============================================================
// A partial tutor completing the full registration from the portal
// =============================================================

/**
 * Where this tutor stands:
 *   "partial"   — signed up on the short form; `needed` is what is still asked
 *   "submitted" — a registered tutor waiting for an admin's approval: sent the
 *                 rest from here, or registered on the website's full form
 *   "relogin"   — sent the rest from another device; this session is the old one
 *   "rejected"  — turned down after logging in (they can't log in again)
 *   "full"      — an approved tutor
 */
router.get("/tutor/full-profile", verifyToken(["tutor"]), async (req, res) => {
  try {
    const account = await findTutorAccount(req.user.id);
    if (!account) return res.status(404).json({ message: "Tutor not found." });
    if (account.isPartial) {
      const p = account.doc;
      if (p.registeredTutorId) return res.json({ success: true, stage: "relogin" });
      return res.json({ success: true, stage: "partial", known: knownFromPartial(p), needed: STILL_NEEDED });
    }
    if (account.status === "pending") {
      return res.json({
        success: true,
        stage: "submitted",
        fromPartialForm: !!account.fromPartialTutorId,
        submittedAt: account.createdAt || null,
      });
    }
    if (account.status === "rejected") return res.json({ success: true, stage: "rejected" });
    res.json({ success: true, stage: "full" });
  } catch (error) {
    console.error("Full profile status error:", error);
    res.status(500).json({ message: error.message });
  }
});

router.post("/tutor/complete-profile", verifyToken(["tutor"]), async (req, res) => {
  try {
    const partial = mongoose.isValidObjectId(String(req.user.id)) ? await PartialTutor.findById(req.user.id) : null;
    if (!partial) return res.status(400).json({ message: "Your profile is already a full registration." });
    if (partial.registeredTutorId) {
      return res.status(409).json({ message: "You have already sent your details. Please log in again." });
    }

    const { value, error } = validateCompletion(req.body || {});
    if (error) return res.status(400).json({ message: error });

    // An approved tutor with this number is already registered; saving over
    // their record would put them back to "pending"
    const pattern = phonePattern(partial.whatsapp);
    const approved = pattern
      ? await Tutor.findOne({ $or: [{ phone: pattern }, { whatsapp: pattern }], status: "approved" }, { _id: 1 }).lean()
      : null;
    if (approved) {
      return res.status(409).json({ message: "You are already a registered tutor. Log in with your WhatsApp number to see your full profile." });
    }

    // Loaded here, not at the top, so this file never loads the Odoo settings
    // just to show a student's homework
    const [{ registerTutor }, { listOdooTutorCodes }, { assignPartialTutorCode }] = await Promise.all([
      import("../utils/tutorRegistration.js"),
      import("../utils/odooService.js"),
      import("../utils/tutorCodes.js"),
    ]);

    // They keep their tutor ID; one who has none yet is given it now
    if (!partial.tutorCode) {
      await assignPartialTutorCode(partial, { readOdooCodes: () => listOdooTutorCodes() });
    }

    // Same steps as the website registration: Odoo record, tutors collection
    const tutor = await registerTutor(registrationFromPartial(partial, value), {
      preferredCode: partial.tutorCode || undefined,
    });

    partial.status = "registered";
    partial.registeredTutorId = tutor._id;
    partial.registeredAt = new Date();
    await partial.save({ validateBeforeSave: false });

    // Their students, classes, homework and invitations move with them
    const from = partial._id;
    const to = tutor._id;
    await Promise.all([
      ParentEnquiry.updateMany({ assignedTutorId: from }, { $set: { assignedTutorId: to } }),
      Attendance.updateMany({ tutorId: from }, { $set: { tutorId: to } }),
      Assignment.updateMany({ tutorId: from }, { $set: { tutorId: to } }),
      BroadcastLog.updateMany({ tutorId: from }, { $set: { tutorId: to } }),
    ]);

    const token = jwt.sign(
      { id: tutor._id, name: tutor.name, role: "tutor" },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "30d" }
    );
    res.json({
      success: true,
      stage: "submitted",
      token,
      tutor: {
        id: tutor._id, name: tutor.name, tutorCode: tutor.tutorCode || "",
        email: tutor.email || "", phone: tutor.phone || "", photo: tutor.photo || "",
      },
    });
  } catch (error) {
    console.error("Complete profile error:", error);
    res.status(500).json({ message: "Couldn't send your details. Please try again." });
  }
});

// =============================================================
// Student photo, added by the parent
// =============================================================
router.post("/students/:id/photo", verifyToken(["parent", "admin"]), receivePhoto, async (req, res) => {
  try {
    const lead = await loadStudent(req, res, req.params.id);
    if (!lead) return;
    lead.studentPhoto = await storePhoto(req.file, "saraswati-students");
    await lead.save({ validateBeforeSave: false });
    res.json({ success: true, photo: lead.studentPhoto });
  } catch (error) {
    console.error("Student photo upload error:", error);
    res.status(500).json({ message: "Couldn't upload the photo. Please try again." });
  }
});

// =============================================================
// Assignments and tests
// =============================================================
router.get("/students/:id/assignments", verifyToken(["admin", "tutor", "parent"]), async (req, res) => {
  try {
    const lead = await loadStudent(req, res, req.params.id);
    if (!lead) return;
    const assignments = await Assignment.find({ parentEnquiryId: lead._id }).sort({ givenDate: -1, createdAt: -1 });
    res.json({ success: true, assignments });
  } catch (error) {
    console.error("Fetch assignments error:", error);
    res.status(500).json({ message: error.message });
  }
});

router.post("/students/:id/assignments", verifyToken(["admin", "tutor"]), async (req, res) => {
  try {
    const lead = await loadStudent(req, res, req.params.id);
    if (!lead) return;

    const { value, error } = parseAssignmentInput(req.body);
    if (error) return res.status(400).json({ message: error });
    const record = settleStatus(value, req.body.status !== undefined);
    const problem = assignmentProblem(record);
    if (problem) return res.status(400).json({ message: problem });

    // An admin adds it on behalf of the student's tutor
    const tutorId = req.user.role === "tutor" ? req.user.id : lead.assignedTutorId;
    if (!tutorId) return res.status(400).json({ message: "This student has no tutor assigned." });
    const tutor = await findTutorAccount(tutorId);

    const assignment = await Assignment.create({
      ...record,
      parentEnquiryId: lead._id,
      requirementId: lead.requirementId || "",
      studentName: studentNameOf(lead),
      tutorId,
      tutorName: tutor?.name || lead.assignedTutor || "",
      checkedAt: record.status === "Pending" ? null : new Date(),
    });
    res.status(201).json({ success: true, assignment });
  } catch (error) {
    console.error("Create assignment error:", error);
    res.status(500).json({ message: error.message });
  }
});

// Loads an assignment and checks the signed-in user may change its student's records
async function loadAssignment(req, res) {
  if (!mongoose.isValidObjectId(req.params.assignmentId)) {
    res.status(404).json({ message: "Assignment not found." });
    return null;
  }
  const assignment = await Assignment.findById(req.params.assignmentId);
  if (!assignment) {
    res.status(404).json({ message: "Assignment not found." });
    return null;
  }
  const lead = await loadStudent(req, res, String(assignment.parentEnquiryId));
  return lead ? assignment : null;
}

router.patch("/assignments/:assignmentId", verifyToken(["admin", "tutor"]), async (req, res) => {
  try {
    const assignment = await loadAssignment(req, res);
    if (!assignment) return;

    const { value, error } = parseAssignmentInput(req.body, { partial: true });
    if (error) return res.status(400).json({ message: error });

    const wasPending = assignment.status === "Pending";
    const record = settleStatus({ ...assignment.toObject(), ...value }, req.body.status !== undefined);
    const problem = assignmentProblem(record);
    if (problem) return res.status(400).json({ message: problem });

    for (const key of ["kind", "title", "subject", "details", "givenDate", "dueDate", "maxMarks", "marks", "remark", "status"]) {
      assignment[key] = record[key];
    }
    if (record.status === "Pending") assignment.checkedAt = null;
    else if (wasPending || !assignment.checkedAt) assignment.checkedAt = new Date();

    await assignment.save();
    res.json({ success: true, assignment });
  } catch (error) {
    console.error("Update assignment error:", error);
    res.status(500).json({ message: error.message });
  }
});

router.delete("/assignments/:assignmentId", verifyToken(["admin", "tutor"]), async (req, res) => {
  try {
    const assignment = await loadAssignment(req, res);
    if (!assignment) return;
    await assignment.deleteOne();
    res.json({ success: true });
  } catch (error) {
    console.error("Delete assignment error:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
