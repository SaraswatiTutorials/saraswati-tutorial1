import mongoose from "mongoose";

export const FEEDBACK_SOURCES = ["parent-enquiry", "tutor-registration"];

// Kind of issue the visitor is reporting (labels live in the frontend)
export const FEEDBACK_CATEGORIES = ["form", "upload", "location", "error", "fees", "suggestion", "other"];

const feedbackSchema = new mongoose.Schema(
  {
    // Which form the feedback was sent from
    source: {
      type: String,
      enum: FEEDBACK_SOURCES,
      required: true,
    },

    category: {
      type: String,
      enum: FEEDBACK_CATEGORIES,
      default: "other",
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    // Optional — pre-filled from the form when the visitor has typed them already
    name: {
      type: String,
      default: "",
      trim: true,
    },

    phone: {
      type: String,
      default: "",
      trim: true,
    },

    // Form step the visitor was on when they sent it
    step: {
      type: Number,
      default: 0,
    },

    ipAddress: {
      type: String,
      default: "",
    },

    userAgent: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

feedbackSchema.index({ createdAt: -1 });
feedbackSchema.index({ source: 1 });

export default mongoose.model("Feedback", feedbackSchema);
