import express from "express";
import mongoose from "mongoose";
import Assignment from "../models/Assignment.js";
import ParentEnquiry from "../models/ParentEnquiry.js";
import Tutor from "../models/Tutor.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { canAccessStudent } from "../utils/portalAccess.js";
import { parseAssignmentInput, assignmentProblem, settleStatus } from "../utils/assignments.js";
import { receivePhoto, storePhoto } from "../utils/photoUpload.js";

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
    const tutor = await Tutor.findById(req.user.id).select("name tutorCode photo");
    if (!tutor) return res.status(404).json({ message: "Tutor not found." });
    res.json({ success: true, tutor: { id: tutor._id, name: tutor.name, tutorCode: tutor.tutorCode || "", photo: tutor.photo || "" } });
  } catch (error) {
    console.error("Tutor profile error:", error);
    res.status(500).json({ message: error.message });
  }
});

router.post("/tutor/photo", verifyToken(["tutor"]), receivePhoto, async (req, res) => {
  try {
    const tutor = await Tutor.findById(req.user.id);
    if (!tutor) return res.status(404).json({ message: "Tutor not found." });
    tutor.photo = await storePhoto(req.file, "saraswati-tutors/profile");
    await tutor.save({ validateBeforeSave: false });
    res.json({ success: true, photo: tutor.photo });
  } catch (error) {
    console.error("Tutor photo upload error:", error);
    res.status(500).json({ message: "Couldn't upload the photo. Please try again." });
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
    const tutor = await Tutor.findById(tutorId).select("name");

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
