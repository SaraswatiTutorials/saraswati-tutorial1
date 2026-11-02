import mongoose from "mongoose";

export const PARTIAL_TUTOR_STATUSES = ["new", "contacted", "registered"];

// Short tutor sign-up from the partial form page (name, WhatsApp, location, experience, occupation).
// A visitor who stops here is still a lead: the admin can call them and move them along.
const partialTutorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    whatsapp: { type: String, required: true, trim: true },

    experience: { type: String, default: "", trim: true },
    occupation: { type: String, default: "", trim: true },

    location: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      city: { type: String, default: "", trim: true },
      area: { type: String, default: "", trim: true },
      pincode: { type: String, default: "", trim: true },
      placeLabel: { type: String, default: "", trim: true },
      houseDetails: { type: String, default: "", trim: true },
      fullAddress: { type: String, default: "", trim: true },
    },

    // Consent checkbox on the form: the exact wording the tutor agreed to, and when
    consent: {
      accepted: { type: Boolean, default: false },
      text: { type: String, default: "" },
      acceptedAt: { type: Date, default: null },
    },

    status: {
      type: String,
      enum: PARTIAL_TUTOR_STATUSES,
      default: "new",
      index: true,
    },

    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("PartialTutor", partialTutorSchema);
