import mongoose from "mongoose";

/**
 * One WhatsApp sent from Panel 2's "Verification & agreement" step:
 *   kind "profile"   — login link, so a partial tutor completes full verification
 *   kind "agreement" — the Odoo Sign agreement link
 *
 * Kept apart from BroadcastLog on purpose: tutors' replies are matched to
 * broadcast logs, and the board counts them as invitations.
 */
const verificationSendSchema = new mongoose.Schema(
  {
    requirementId: { type: String, default: "", index: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "ParentEnquiry", default: null },
    group: { type: String, enum: ["top3", "invited", "single"], default: "top3" },

    personId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    tutorSource: { type: String, enum: ["tutor", "partial"], default: "tutor" },
    tutorName: { type: String, default: "" },
    tutorCode: { type: String, default: "" },
    phone: { type: String, default: "" },

    kind: { type: String, enum: ["profile", "agreement"], required: true },
    templateName: { type: String, default: "" },
    link: { type: String, default: "" },

    status: { type: String, enum: ["Sent", "Failed"], required: true },
    failureReason: { type: String, default: "" },
    whatsappMessageId: { type: String, default: "" },
    usedTemplate: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "tutor_verification_sends" }
);

verificationSendSchema.index({ personId: 1, kind: 1, createdAt: -1 });

export default mongoose.model("VerificationSend", verificationSendSchema);
