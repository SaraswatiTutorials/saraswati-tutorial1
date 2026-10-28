import mongoose from "mongoose";
import { ASSIGNMENT_KINDS, ASSIGNMENT_STATUSES } from "../utils/assignments.js";

// Homework or a test a tutor sets for one tuition, with the marks and remark the parent sees
const assignmentSchema = new mongoose.Schema(
  {
    parentEnquiryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParentEnquiry",
      required: true,
    },
    requirementId: {
      type: String,
      default: "",
      trim: true,
    },
    studentName: {
      type: String,
      default: "",
      trim: true,
    },
    tutorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tutor",
      required: true,
    },
    tutorName: {
      type: String,
      default: "",
      trim: true,
    },
    kind: {
      type: String,
      enum: ASSIGNMENT_KINDS,
      default: "Assignment",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      default: "",
      trim: true,
    },
    details: {
      type: String,
      default: "",
      trim: true,
    },
    // "YYYY-MM-DD": the day it was set (for a test, the day it is taken)
    givenDate: {
      type: String,
      required: true,
    },
    // "YYYY-MM-DD", empty when there is no deadline
    dueDate: {
      type: String,
      default: "",
    },
    maxMarks: {
      type: Number,
      default: null,
    },
    marks: {
      type: Number,
      default: null,
    },
    remark: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ASSIGNMENT_STATUSES,
      default: "Pending",
    },
    checkedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

assignmentSchema.index({ parentEnquiryId: 1, givenDate: -1 });

export default mongoose.model("Assignment", assignmentSchema);
