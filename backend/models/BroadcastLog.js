import mongoose from "mongoose";

const broadcastLogSchema = new mongoose.Schema(
  {
    time: {
      type: Date,
      default: Date.now,
    },

    // Tutor reference
    tutorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tutor",
      required: true,
    },
    tutorName: {
      type: String,
      required: true,
    },
    tutorPhone: {
      type: String,
      default: "",
    },
    tutorCode: {
      type: String,
      default: "",
    },
    // Which list this person came from. A partial tutor is invited and
    // counted like any other, but has no tutor code, so without this the
    // board could not tell them apart from a registered tutor whose code is
    // simply missing.
    tutorSource: {
      type: String,
      enum: ["tutor", "partial"],
      default: "tutor",
    },

    // Requirement reference
    requirementId: {
      type: String,
      required: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParentEnquiry",
      required: true,
    },

    // Message details
    type: {
      type: String,
      enum: ["whatsapp", "email"],
      default: "whatsapp",
    },
    message: {
      type: String,
      default: "",
    },
    templateName: {
      type: String,
      default: "",
    },
    usedTemplate: {
      type: Boolean,
      default: false,
    },
    broadcastType: {
      type: String,
      enum: ["onboarding", "requirement"],
      default: "requirement",
    },

    // Delivery tracking
    status: {
      type: String,
      enum: [
        "Pending",
        "Sending",
        "Sent",
        "Delivered",
        "Read",
        "Replied",
        "Failed",
        "Suppressed",
      ],
      default: "Pending",
    },
    failureReason: {
      type: String,
      default: "",
      // Examples: "Invalid Number", "Template Missing", "Meta Policy Rejection",
      // "Message Body Missing", "Authentication Failed", "Rate Limited",
      // "Timeout", "Network Error", "Server Error"
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    lastRetryAt: {
      type: Date,
      default: null,
    },
    whatsappMessageId: {
      type: String,
      default: "",
    },

    // Response tracking
    responseStatus: {
      type: String,
      enum: [
        "No Response",
        "Interested",
        "Not Interested",
        "Accepted",
        "Rejected",
        "Assigned",
        "Joined",
      ],
      default: "No Response",
    },
    respondedAt: {
      type: Date,
      default: null,
    },

    // Admin who triggered the broadcast
    adminName: {
      type: String,
      default: "",
    },
    adminEmail: {
      type: String,
      default: "",
    },

    // Approximate distance at time of broadcast
    distanceKm: {
      type: Number,
      default: null,
    },
    matchPercentage: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexing for scalability and performance
broadcastLogSchema.index({ tutorId: 1 });
broadcastLogSchema.index({ leadId: 1 });
broadcastLogSchema.index({ requirementId: 1 });
broadcastLogSchema.index({ responseStatus: 1 });
broadcastLogSchema.index({ status: 1 });
broadcastLogSchema.index({ time: -1 });

// Index for quick compound queries
broadcastLogSchema.index({ requirementId: 1, tutorId: 1 });

// Compound index for deduplication check in broadcastService
broadcastLogSchema.index({ requirementId: 1, tutorId: 1, broadcastType: 1, status: 1 });

// Compound index for retry scheduler queries
broadcastLogSchema.index({ status: 1, retryCount: 1, failureReason: 1 });

// Index for dashboard date-range queries
broadcastLogSchema.index({ createdAt: -1 });

export default mongoose.model("BroadcastLog", broadcastLogSchema);
