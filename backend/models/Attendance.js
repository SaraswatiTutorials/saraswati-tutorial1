import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    parentEnquiryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParentEnquiry",
      required: true,
    },
    studentName: {
      type: String,
      required: true,
      trim: true,
    },
    requirementId: {
      type: String,
      required: true,
      trim: true,
    },
    tutorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tutor",
      required: true,
    },
    tutorName: {
      type: String,
      required: true,
      trim: true,
    },
    packageCycle: {
      type: Number,
      default: 1,
    },
    sessionNumber: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ["Done", "Missed"],
      required: true,
    },
    topicsCovered: {
      type: String,
      default: "",
    },
    missedReason: {
      type: String,
      default: "",
    },
    customReason: {
      type: String,
      default: "",
    },
    date: {
      type: String,
      required: true,
    },
    // Class time chosen by the tutor, "HH:mm" (24-hour). Empty on records made before this field existed.
    classStartTime: {
      type: String,
      default: "",
      trim: true,
    },
    classEndTime: {
      type: String,
      default: "",
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    odooAttendanceId: {
      type: Number,
      default: null,
    },
    odooSyncStatus: {
      type: String,
      enum: ["pending", "synced", "failed", "retrying"],
      default: "pending",
    },
    odooSyncedAt: {
      type: Date,
      default: null,
    },
    odooLastSyncAt: {
      type: Date,
      default: null,
    },
    websiteStudentId: {
      type: String,
      default: "",
      trim: true,
    },
    externalAttendanceId: {
      type: String,
      default: "",
      trim: true,
    },
    odooSyncError: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Pre-save hook: Ensure immutable stable externalAttendanceId (ATT-<MongoDB ObjectId>)
attendanceSchema.pre("save", function (next) {
  if (!this.externalAttendanceId && this._id) {
    this.externalAttendanceId = `ATT-${this._id}`;
  }
  next();
});

// Indexes for fast querying & uniqueness
attendanceSchema.index({ parentEnquiryId: 1, packageCycle: 1, date: 1, status: 1 });
attendanceSchema.index({ parentEnquiryId: 1, packageCycle: 1, sessionNumber: 1 });
attendanceSchema.index({ tutorId: 1 });
attendanceSchema.index({ externalAttendanceId: 1 }, { sparse: true });

export default mongoose.model("Attendance", attendanceSchema);
