import mongoose from "mongoose";

const tutorSchema = new mongoose.Schema(
  {
    // Core identity
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true },
    whatsapp: { type: String, default: "", trim: true },

    // Unique tutor code (e.g. TUT0001) — synced from Odoo x_master_tutors
    tutorCode: { type: String, default: "", trim: true },

    // Profile details
    gender: { type: String, default: "" },
    dob: { type: String, default: "" },
    photo: { type: String, default: "" },
    about: { type: String, default: "" },
    tagline: { type: String, default: "" },
    languages: { type: [String], default: [] },

    // Location
    city: { type: String, default: "" },
    area: { type: String, default: "" },
    fullAddress: { type: String, default: "" },
    pincode: { type: String, default: "" },
    location: { type: String, default: "" }, // legacy single-location field

    // GPS coordinates for distance-based ranking
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },

    // Multiple service areas the tutor can travel to
    locations: { type: [String], default: [] },
    maxTravelDistance: { type: String, default: "" },

    // Teaching profile
    qualification: { type: String, default: "" },
    experience: { type: String, default: "" },
    occupation: { type: String, default: "" },
    subject: { type: String, default: "" }, // legacy single-subject field
    expertise: { type: [String], default: [] },
    grades: { type: [String], default: [] },
    boards: { type: [String], default: [] },
    subjects: { type: [String], default: [] },
    timings: { type: [String], default: [] },

    // Mode of teaching
    mode: { type: String, default: "Online & Offline" },
    category: { type: String, default: "Academic Tutors" },

    // Logistics
    hasVehicle: { type: String, enum: ["yes", "no"], default: "no" },
    vehicleNumber: { type: String, default: "" },
    hasOccupation: { type: String, enum: ["yes", "no"], default: "no" },

    // Documents
    documents: {
      idProof: { type: String, default: "" },
      expCert: { type: String, default: "" },
      otherDoc: { type: String, default: "" },
    },

    // Admin review
    agreement: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    adminComment: { type: String, default: "" },

    // Availability & operational status
    availabilityStatus: {
      type: String,
      enum: [
        "Available",
        "Busy",
        "Inactive",
        "Not Active",  // 3+ months without activity
        "Blocked",     // banned from broadcasts
        "Archived",    // soft-deleted / retired
      ],
      default: "Available",
    },
    availability: { type: [String], default: [] }, // legacy field

    // Performance (cached — recomputed from ParentEnquiry on demand)
    price: { type: Number, default: 0 },
    rating: { type: Number, default: 4.5 },
    averageRating: { type: Number, default: null },
    reviews: { type: Number, default: 0 },
    students: { type: Number, default: 0 },
    responseTime: { type: String, default: "30 mins" },

    // Odoo sync
    odooLeadId: { type: mongoose.Schema.Types.Mixed, default: null },
    verified: { type: Boolean, default: false },
    odooSyncStatus: {
      type: String,
      enum: ["synced", "failed", "pending"],
      default: "pending",
    },
    odooSyncError: { type: String, default: "" },

    // Onboarding workflow
    // Set to true by admin after tutor signs the Tutor Agreement in Odoo.
    // When true, the tutor receives Requirement Notifications (Workflow 2).
    // When false, the tutor receives the Tutor Authorisation message (Workflow 1, once only).
    onboardingCompleted: { type: Boolean, default: false },

    // Timestamp of first onboarding WhatsApp message.
    // Prevents sending the onboarding message more than once per tutor.
    onboardingMessageSentAt: { type: Date, default: null },

    // Set when a partial tutor completed their profile from the tutor portal.
    // They could already log in as a partial tutor, so they still can while
    // this registration waits for approval.
    fromPartialTutorId: { type: mongoose.Schema.Types.ObjectId, ref: "PartialTutor", default: null },

  },
  { timestamps: true }
);

// Indexing for scalability and performance
tutorSchema.index({ name: 1 });
tutorSchema.index({ status: 1 });
tutorSchema.index({ phone: 1 });
tutorSchema.index({ tutorCode: 1 });
tutorSchema.index({ grades: 1 });
tutorSchema.index({ boards: 1 });
tutorSchema.index({ subjects: 1 });
tutorSchema.index({ locations: 1 });
tutorSchema.index({ gender: 1 });
tutorSchema.index({ timings: 1 });
tutorSchema.index({ pincode: 1 });
tutorSchema.index({ area: 1 });
tutorSchema.index({ city: 1 });
tutorSchema.index({ availabilityStatus: 1 });
tutorSchema.index({ latitude: 1, longitude: 1 });

export default mongoose.model("Tutor", tutorSchema);
