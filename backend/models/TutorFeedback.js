import mongoose from "mongoose";

/**
 * A parent's feedback about the tutor sent to them for a demo.
 *
 * One record per enquiry and tutor: Panel 2's "Send feedback link" step makes
 * it (with a private link token) for whoever is assigned to the enquiry at
 * that moment. If the parent then moves to another tutor, sending again makes
 * a second record for that tutor, so each tutor's feedback is kept apart.
 * The parent opens /tutor-feedback/<token> and answers once.
 */
const sendSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    status: { type: String, enum: ["Sent", "Failed"], required: true },
    failureReason: { type: String, default: "" },
    whatsappMessageId: { type: String, default: "" },
    usedTemplate: { type: Boolean, default: false },
  },
  { _id: false }
);

const tutorFeedbackSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true },

    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "ParentEnquiry", required: true },
    requirementId: { type: String, default: "" },
    parentName: { type: String, default: "" },
    parentPhone: { type: String, default: "" },
    studentName: { type: String, default: "" },

    // The tutor the feedback is about (a registered tutor, or a partial sign-up)
    tutorId: { type: mongoose.Schema.Types.ObjectId, default: null },
    tutorSource: { type: String, enum: ["tutor", "partial", ""], default: "" },
    tutorName: { type: String, default: "" },
    tutorCode: { type: String, default: "" },

    sends: { type: [sendSchema], default: [] },
    lastSentAt: { type: Date, default: null },
    openedAt: { type: Date, default: null },

    // The parent's answers, once submitted
    submittedAt: { type: Date, default: null },
    demoHappened: { type: String, default: "" },
    overall: { type: Number, min: 1, max: 5, default: null },
    ratings: {
      teaching: { type: Number, min: 1, max: 5, default: null },
      knowledge: { type: Number, min: 1, max: 5, default: null },
      punctuality: { type: Number, min: 1, max: 5, default: null },
      behaviour: { type: Number, min: 1, max: 5, default: null },
      comfort: { type: Number, min: 1, max: 5, default: null },
    },
    liked: { type: [String], default: [] },
    improve: { type: [String], default: [] },
    decision: { type: String, default: "" },
    comment: { type: String, default: "", maxlength: 1000 },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true, collection: "tutor_feedbacks" }
);

tutorFeedbackSchema.index({ leadId: 1, tutorId: 1 });
tutorFeedbackSchema.index({ requirementId: 1 });
tutorFeedbackSchema.index({ tutorId: 1, submittedAt: -1 });

export default mongoose.model("TutorFeedback", tutorFeedbackSchema);
