import mongoose from "mongoose";

const wardSchema = new mongoose.Schema(
  {
    studentName: {
      type: String,
      required: true,
      trim: true,
    },

    schoolName: {
      type: String,
      required: false,
      trim: true,
    },

    classGrade: {
      type: String,
      required: false,
      trim: true,
    },

    curriculum: {
      type: String,
      required: false,
      trim: true,
    },

    subjectsNeeded: {
      type: [String],
      required: false,
      default: [],
    },

    currentPerformance: {
      type: String,
      default: "",
      trim: true,
    },

    specialNeeds: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

const parentEnquirySchema = new mongoose.Schema(
  {
    parentName: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: false,
      trim: true,
      lowercase: true,
    },


    address: {
      type: String,
      required: false,
      trim: true,
    },

    area: {
      type: String,
      default: "",
      trim: true,
    },

    pincode: {
      type: String,
      default: "",
      trim: true,
    },

    startTime: {
      type: String,
      default: "",
      trim: true,
    },

    endTime: {
      type: String,
      default: "",
      trim: true,
    },

    preferredMode: {
      type: String,
      required: false,
      trim: true,
    },

    preferredGender: {
      type: String,
      required: false,
      trim: true,
    },

    preferredDays: {
      type: [String],
      required: false,
      default: [],
    },

    preferredTime: {
      type: String,
      required: false,
      trim: true,
    },

     classDuration: {
      type: String,
      default: "",
      trim: true,
    },

    classTimingType: {
      type: String,
      default: "",
      trim: true,
    },

    classTimingSlot: {
      type: String,
      default: "",
      trim: true,
    },

    pricingConsent: {
      type: Boolean,
      default: false,
    },

    wards: {
      type: [wardSchema],
      required: false,
      default: [],
    },

    planType: {
      type: String,
      default: "",
      trim: true,
    },

    daysPerWeek: {
      type: Number,
      default: null,
    },

    hoursPerDay: {
      type: Number,
      default: null,
    },

    monthlyFees: {
      type: Number,
      default: null,
    },

    siblingDiscount: {
      type: Number,
      default: 0,
    },

    siblingConcessionPercent: {
      type: Number,
      default: 0,
    },

    totalBaseFee: {
      type: Number,
      default: null,
    },

    studentFees: {
      type: [Number],
      default: [],
    },

    finalPrice: {
      type: Number,
      default: null,
    },

    odooLeadId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    requirementId: {
      type: String,
      default: "",
    },

    websiteStudentId: {
      type: String,
      default: "",
      trim: true,
    },

    geoInfo: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    ipAddress: {
      type: String,
      default: "",
    },

    visitor_id: {
      type: String,
      default: "",
    },

    session_id: {
      type: String,
      default: "",
    },

    utm_source: {
      type: String,
      default: "",
    },

    utm_medium: {
      type: String,
      default: "",
    },

    utm_campaign: {
      type: String,
      default: "",
    },

    utm_content: {
      type: String,
      default: "",
    },

    utm_term: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: [
        "New Lead",
        "Fees Finalized",
        "Demo Scheduled",
        "Demo Cancelled",
        "Feedback Pending",
        "Enrolled",
        "Won",
        "Rejected",
        "Lost",
      ],
      default: "New Lead",
    },

    adminNotes: {
      type: String,
      default: "",
    },

    nextFollowUpDate: {
      type: String,
      default: "",
    },

    assignedTutor: {
      type: String,
      default: "",
    },

    assignedTutorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tutor",
      default: null,
    },

    demoDate: {
      type: String,
      default: "",
    },

    demoTime: {
      type: String,
      default: "",
    },

    feesFinalized: {
      type: Boolean,
      default: false,
    },

    finalFees: {
      type: Number,
      default: null,
    },

    lostReason: {
      type: String,
      default: "",
    },

    totalClasses: {
      type: Number,
      default: null,
    },

    completedClasses: {
      type: Number,
      default: 0,
    },

    currentPackageCycle: {
      type: Number,
      default: 1,
    },

    packageStatus: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
    },

    packageHistory: {
      type: [
        {
          cycle: Number,
          totalClasses: Number,
          completedClasses: Number,
          completedAt: Date,
          // Set when a fully completed cycle auto-starts the next one, until the renewal reminder goes out
          renewalReminderPending: Boolean,
        },
      ],
      default: [],
    },

    packageAlertSentForTotal: {
      type: Number,
      default: 0,
    },

    renewalReminderSentForTotal: {
      type: Number,
      default: 0,
    },

    classSchedule: {
      type: String,
      default: "",
    },

    lastReminderSentDate: {
      type: String,
      default: "",
    },

    // Date ("YYYY-MM-DD", India time) the tutor was last warned about missing two classes in a row
    missWarningSentDate: {
      type: String,
      default: "",
    },

    odooSyncStatus: {
      type: String,
      enum: ["synced", "failed", "pending", "retrying"],
      default: "pending",
    },

    odooSyncError: {
      type: String,
      default: "",
    },

    odooLastSyncAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexing for scalability and performance
parentEnquirySchema.index({ assignedTutor: 1 });
parentEnquirySchema.index({ assignedTutorId: 1 });
parentEnquirySchema.index({ status: 1 });
parentEnquirySchema.index({ createdAt: -1 });

// Synchronized Schema
export default mongoose.model("ParentEnquiry", parentEnquirySchema);