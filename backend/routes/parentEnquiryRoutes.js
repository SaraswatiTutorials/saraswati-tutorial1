import express from "express";
import ParentEnquiry from "../models/ParentEnquiry.js";
import ParentEnquiryDraft from "../models/ParentEnquiryDraft.js";
import Attendance from "../models/Attendance.js";
import AnalyticsLog from "../models/AnalyticsLog.js";
import { createLead, updateLead, updateLeadAssignment, syncTutorStats, addOdooChatterMessage } from "../utils/odooService.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { resolveGeo } from "../utils/geoLookup.js";
import { applyPricingPolicy } from "../utils/pricing/submissionValidation.js";
import { nextEnquiryIds } from "../utils/requirementId.js";
import Tutor from "../models/Tutor.js";
import TutorRegistrationDraft from "../models/TutorRegistrationDraft.js";
import Enquiry from "../models/Enquiry.js";
import Booking from "../models/Booking.js";
import BroadcastLog from "../models/BroadcastLog.js";
import {
  sendWhatsAppToTutor,
  buildBroadcastMessage,
  buildAssignmentMessage,
  buildOnboardingMessage,
  isPermanentFailure,
  getOdooUid,
  callOdooMethod,
  buildRequirementTemplateVars,
} from "../utils/whatsappService.js";
import {
  buildCentralizedQuery,
  calculateTutorScore,
  compareTutors,
  parseAddress,
} from "../utils/matchingEngine.js";
import { getRecommendations, buildParamsFromLead } from "../utils/recommendationEngine.js";
import { notifyAdminOfNewEnquiry } from "../utils/adminAlerts.js";


const router = express.Router();

function toCoordinate(value) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

// ============================================================
// HELPER: Compute tutor statistics from ParentEnquiry records
// ============================================================
async function computeTutorStats(tutor) {
  const assignedLeads = await ParentEnquiry.find({
    $or: [
      { assignedTutorId: tutor._id },
      { assignedTutor: tutor.name },
    ],
  });

  const totalAssignments = assignedLeads.length;
  const demoScheduled = assignedLeads.filter(l => l.status === "Demo Scheduled").length;
  const demoCancelled = assignedLeads.filter(l => l.status === "Demo Cancelled").length;
  const successfullyEnrolled = assignedLeads.filter(l => l.status === "Enrolled" || l.status === "Won").length;
  const activeTuitionCount = successfullyEnrolled;
  const successPercentage = totalAssignments > 0 ? Math.round((successfullyEnrolled / totalAssignments) * 100) : 0;

  return {
    totalAssignments,
    demoScheduled,
    demoCancelled,
    successfullyEnrolled,
    activeTuitionCount,
    successPercentage,
  };
}

// =============================================================
// GET all parent enquiries
// GET /api/parent-enquiries
// =============================================================
router.get("/", verifyToken(["admin"]), async (req, res) => {
  try {
    // Synchronize completedClasses and packageStatus with Attendance single source of truth.
    // Leads and the attendance counts (one aggregation for all leads) load at the same time.
    // Optional ?limit=N returns only the newest N leads (used for the dashboard's quick first batch).
    // Without it, every lead is returned exactly as before.
    const limit = Number.parseInt(req.query.limit, 10);
    const leadQuery = ParentEnquiry.find().sort({ createdAt: -1 });
    if (limit > 0) leadQuery.limit(limit);

    const [data, attendanceSummary] = await Promise.all([
      leadQuery.batchSize(1000),
      Attendance.aggregate([
        {
          $group: {
            _id: {
              parentEnquiryId: "$parentEnquiryId",
              packageCycle: "$packageCycle",
            },
            count: { $sum: { $cond: [{ $eq: ["$status", "Done"] }, 1, 0] } },
            firstDate: { $min: "$date" },
          },
        },
      ]),
    ]);

    const attendanceCounts = new Map();
    const cycleFirstDates = new Map(); // first class date per lead + cycle (a cycle's month starts there)

    for (const row of attendanceSummary) {
      const leadId = String(row._id.parentEnquiryId);
      const cycle = row._id.packageCycle == null ? 1 : row._id.packageCycle;
      const key = `${leadId}:${cycle}`;
      attendanceCounts.set(key, (attendanceCounts.get(key) || 0) + row.count);
      const earlier = cycleFirstDates.get(key);
      if (row.firstDate && (!earlier || row.firstDate < earlier)) cycleFirstDates.set(key, row.firstDate);
    }

    const synchronizedData = await Promise.all(
      data.map(async (lead) => {
        if (
          lead.status === "Enrolled" ||
          lead.assignedTutorId ||
          (lead.totalClasses && lead.totalClasses > 0)
        ) {
          const cycle = lead.currentPackageCycle || 1;
          const total = lead.totalClasses || 12;
          const leadId = String(lead._id);
          const completedCount = attendanceCounts.get(`${leadId}:${cycle}`) || 0;
          const pkgStatus = completedCount >= total && total > 0 ? "completed" : "active";

          if (lead.completedClasses !== completedCount || lead.packageStatus !== pkgStatus) {
            lead.completedClasses = completedCount;
            lead.packageStatus = pkgStatus;
            await lead.save({ validateBeforeSave: false }).catch(() => {});
          }
        }

        const currentCycleStartDate = cycleFirstDates.get(`${lead._id}:${lead.currentPackageCycle || 1}`) || "";
        return { ...lead.toJSON(), currentCycleStartDate };
      })
    );
    res.json(synchronizedData);
  } catch (error) {
    console.error("Parent enquiry fetch error:", error);
    res.status(500).json({ message: error.message });
  }
});

// =============================================================
// GET archived parent enquiries, newest archive first
// GET /api/parent-enquiries/archived
// =============================================================
router.get("/archived", verifyToken(["admin"]), async (req, res) => {
  try {
    const data = await ParentEnquiry.find({ archived: true }).sort({ archivedAt: -1 });
    res.json(data);
  } catch (error) {
    console.error("Archived enquiry fetch error:", error);
    res.status(500).json({ message: error.message });
  }
});

// =============================================================
// RESTORE an archived parent enquiry
// POST /api/parent-enquiries/:id/restore
// =============================================================
router.post("/:id/restore", verifyToken(["admin"]), async (req, res) => {
  try {
    const enquiry = await ParentEnquiry.findOne({ _id: req.params.id, archived: true });
    if (!enquiry) return res.status(404).json({ message: "Archived enquiry not found" });

    enquiry.archived = false;
    enquiry.archivedAt = null;
    enquiry.archivedBy = "";
    await enquiry.save({ validateBeforeSave: false });
    console.log(`[ParentEnquiry] ${enquiry.requirementId} restored by ${req.user?.email || "admin"}`);
    res.json({ message: "Enquiry restored", enquiry });
  } catch (error) {
    console.error("Parent enquiry restore error:", error);
    res.status(500).json({ message: error.message });
  }
});

// =============================================================
// GET all parent enquiry drafts (incomplete leads)
// GET /api/parent-enquiries/drafts
// =============================================================
router.get("/drafts", verifyToken(["admin"]), async (req, res) => {
  try {
    const drafts = await ParentEnquiryDraft.find().sort({ updatedAt: -1 });
    res.json(drafts);
  } catch (error) {
    console.error("Draft enquiry fetch error:", error);
    res.status(500).json({ message: error.message });
  }
});

// =============================================================
// GET dashboard totals (counts only — lets the admin dashboard show
// its numbers immediately while the full lists are still loading)
// GET /api/parent-enquiries/dashboard-counts
// =============================================================
router.get("/dashboard-counts", verifyToken(["admin"]), async (req, res) => {
  try {
    const [
      tutorDocs,
      leadDocs,
      drafts,
      tutorDrafts,
      enquiries,
      bookings,
    ] = await Promise.all([
      Tutor.find().select("phone name status createdAt").lean(),
      ParentEnquiry.find().select("phone wards.studentName assignedTutorId createdAt").lean(),
      ParentEnquiryDraft.countDocuments({}),
      TutorRegistrationDraft.countDocuments({}),
      Enquiry.countDocuments({}),
      Booking.countDocuments({}),
    ]);

    // The dashboard shows the same person saved more than once as ONE card, so the totals
    // are counted the same way (same rules as keepUniqueRecords in AdminDashboard.jsx):
    //   Lead  = same phone (last 10 digits) + same student name(s)
    //   Tutor = same phone (last 10 digits) + same name
    // Kept copy: the preferred one if any, otherwise the newest.
    const lastTenDigits = (value) => {
      const digits = String(value || "").replace(/\D/g, "");
      return digits.length >= 10 ? digits.slice(-10) : "";
    };
    const keepUnique = (records, getKey, isPreferred) => {
      const keepers = new Map();
      const unique = [];
      for (const record of records) {
        const key = getKey(record);
        if (!key) {
          unique.push(record);
          continue;
        }
        const current = keepers.get(key);
        const better =
          !current ||
          Number(isPreferred(record)) - Number(isPreferred(current)) ||
          new Date(record.createdAt || 0) - new Date(current.createdAt || 0);
        if (!current || better > 0) keepers.set(key, record);
      }
      return [...unique, ...keepers.values()];
    };

    const uniqueLeads = keepUnique(
      leadDocs,
      (lead) => {
        const phone = lastTenDigits(lead.phone);
        const students = (lead.wards || [])
          .map((ward) => String(ward?.studentName || "").trim().toLowerCase())
          .filter(Boolean)
          .sort()
          .join("|");
        return phone && students ? `${phone}#${students}` : "";
      },
      (lead) => Boolean(lead.assignedTutorId)
    );

    const assignedTutorIds = new Set(
      leadDocs.map((lead) => String(lead.assignedTutorId || "")).filter(Boolean)
    );
    const uniqueTutors = keepUnique(
      tutorDocs,
      (tutor) => {
        const phone = lastTenDigits(tutor.phone);
        const name = String(tutor.name || "").trim().toLowerCase();
        return phone && name ? `${phone}#${name}` : "";
      },
      (tutor) => assignedTutorIds.has(String(tutor._id))
    );

    const tutors = uniqueTutors.length;
    const approvedTutors = uniqueTutors.filter((t) => t.status === "approved").length;
    const rejectedTutors = uniqueTutors.filter((t) => t.status === "rejected").length;
    // Same rule the dashboard uses: pending = no status or status "pending"
    const pendingTutors = uniqueTutors.filter((t) => !t.status || t.status === "pending").length;
    const leads = uniqueLeads.length;

    res.json({
      tutors,
      approvedTutors,
      rejectedTutors,
      pendingTutors,
      leads,
      drafts,
      tutorDrafts,
      enquiries,
      bookings,
    });
  } catch (error) {
    console.error("Dashboard counts fetch error:", error);
    res.status(500).json({ message: error.message });
  }
});

// =============================================================
// GET all broadcast logs (with optional leadId filter)
// GET /api/parent-enquiries/broadcast-logs?leadId=xxx&requirementId=yyy
// =============================================================
router.get("/broadcast-logs", verifyToken(["admin"]), async (req, res) => {
  try {
    const { leadId, requirementId, tutorId, status } = req.query;
    const filter = {};

    if (leadId) filter.leadId = leadId;
    if (requirementId) filter.requirementId = requirementId;
    if (tutorId) filter.tutorId = tutorId;
    if (status) filter.status = status;

    // Optional ?limit=N&skip=M returns one page (used by the dashboard's logs table).
    // Without limit, every matching log is returned exactly as before.
    const limit = Number.parseInt(req.query.limit, 10);
    if (limit > 0) {
      const skip = Math.max(0, Number.parseInt(req.query.skip, 10) || 0);
      const page = await BroadcastLog.find(filter)
        .sort({ time: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
      return res.json(page);
    }

    const logs = await BroadcastLog.find(filter).sort({ time: -1 }).lean();
    res.json(logs);
  } catch (error) {
    console.error("Fetch broadcast logs error:", error);
    res.status(500).json({ message: error.message });
  }
});

// =============================================================
// AUTO-SAVE parent enquiry draft
// POST /api/parent-enquiries/draft
// =============================================================
router.post("/draft", async (req, res) => {
  try {
    const {
      emailOrPhone,
      stepReached,
      formData,
      geoInfo,
      ipAddress,
      visitor_id,
      session_id,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
    } = req.body;

    if (!emailOrPhone) {
      return res.status(400).json({ message: "emailOrPhone is required" });
    }

    let clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    if (clientIp) {
      if (clientIp.includes(",")) clientIp = clientIp.split(",")[0].trim();
      if (clientIp.startsWith("::ffff:")) clientIp = clientIp.substring(7);
    }

    let finalIp = ipAddress || clientIp;
    let finalGeo = geoInfo || {};

    // The form auto-saves every few seconds: reuse the location already on the draft
    // instead of looking the IP up again each time
    if (!finalGeo.city || finalGeo.city === "Unknown City") {
      const existing = await ParentEnquiryDraft.findOne({ emailOrPhone: emailOrPhone.trim() })
        .select("geoInfo")
        .lean();
      if (existing?.geoInfo?.city && existing.geoInfo.city !== "Unknown City") finalGeo = existing.geoInfo;
    }

    if (!finalGeo.city || finalGeo.city === "Unknown City") {
      const resolved = await resolveGeo(finalIp);
      if (resolved.city !== "Unknown City") {
        finalGeo = {
          city: resolved.city,
          region: resolved.region,
          postal: resolved.postal,
          country: resolved.country,
          ip: resolved.ip,
          org: resolved.org,
        };
      }
    }

    const draft = await ParentEnquiryDraft.findOneAndUpdate(
      { emailOrPhone: emailOrPhone.trim() },
      {
        $set: { formData, geoInfo: finalGeo, ipAddress: finalIp, visitor_id, session_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term },
        // The form auto-saves from whatever step is open; keep the furthest step reached
        $max: { stepReached: Number(stepReached) || 1 },
      },
      { new: true, upsert: true }
    );

    res.status(200).json(draft);
  } catch (error) {
    console.error("Draft enquiry save error:", error);
    res.status(400).json({ message: error.message });
  }
});

// =============================================================
// DELETE parent enquiry draft
// DELETE /api/parent-enquiries/drafts/:id
// =============================================================
router.delete("/drafts/:id", verifyToken(["admin"]), async (req, res) => {
  try {
    const draft = await ParentEnquiryDraft.findByIdAndDelete(req.params.id);
    if (!draft) return res.status(404).json({ message: "Draft not found" });
    res.json({ message: "Draft deleted successfully" });
  } catch (error) {
    console.error("Draft enquiry delete error:", error);
    res.status(500).json({ message: error.message });
  }
});

// =============================================================
// CREATE parent enquiry
// POST /api/parent-enquiries
// =============================================================
router.post("/", async (req, res) => {
  try {
    // Server-side fee check. PRICING_ENFORCEMENT defaults to "off", which saves
    // the submission exactly as before; "log" only reports problems.
    const pricing = applyPricingPolicy(req.body, process.env.PRICING_ENFORCEMENT);
    if (pricing.action === "reject") {
      return res.status(400).json({ message: pricing.message });
    }
    req.body = pricing.body;

    let clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    if (clientIp) {
      if (clientIp.includes(",")) clientIp = clientIp.split(",")[0].trim();
      if (clientIp.startsWith("::ffff:")) clientIp = clientIp.substring(7);
    }

    let finalIp = req.body.ipAddress || clientIp;
    let finalGeo = req.body.geoInfo || {};

    if (!finalGeo.city || finalGeo.city === "Unknown City") {
      const resolved = await resolveGeo(finalIp);
      if (resolved.city !== "Unknown City") {
        finalGeo = {
          city: resolved.city,
          region: resolved.region,
          postal: resolved.postal,
          country: resolved.country,
          ip: resolved.ip,
          org: resolved.org,
        };
      }
    }

    req.body.geoInfo = finalGeo;
    req.body.ipAddress = finalIp;

    // Log backend validation success
    try {
      await new AnalyticsLog({
        visitor_id: req.body.visitor_id || "unknown",
        session_id: req.body.session_id || "unknown",
        city: finalGeo.city || "Unknown City",
        region: finalGeo.region || "Unknown State",
        country: finalGeo.country || "Unknown Country",
        source: req.body.utm_source || "Direct",
        page_visited: "/parent-enquiry",
        device: req.body.device || "Desktop",
        browser: req.body.browser || "Unknown Browser",
        os: req.body.os || "Unknown OS",
        ipAddress: finalIp,
        action: "backend_validation_success",
      }).save();
    } catch (logErr) {
      console.error("Failed to log backend validation success:", logErr.message);
    }

    // â”€â”€ Step 1: Generate stable IDs before saving (MongoDB count-based) â”€â”€â”€â”€â”€â”€
    let requirementId = "";
    let websiteStudentId = "";
    try {
      ({ requirementId, websiteStudentId } = await nextEnquiryIds());
      console.log("[ParentEnquiry] Generated IDs:", requirementId, websiteStudentId);
    } catch (seqErr) {
      console.error("[ParentEnquiry] Failed to generate sequential IDs:", seqErr.message);
      const ts = String(Date.now()).slice(-5);
      requirementId = `REQ-${ts}`;
      websiteStudentId = `STU-${ts}`;
    }

    let finalTotalClasses = req.body.totalClasses;
    if ((finalTotalClasses === undefined || finalTotalClasses === null) && req.body.daysPerWeek) {
      finalTotalClasses = Number(req.body.daysPerWeek) * 4;
    }

    // â”€â”€ Step 2: Save to MongoDB FIRST (parent is never blocked by Odoo) â”€â”€â”€â”€â”€â”€â”€
    const enquiry = new ParentEnquiry({
      ...req.body,
      area: req.body.area || "",
      pincode: req.body.pincode || "",
      city: req.body.city || "",
      latitude: toCoordinate(req.body.latitude),
      longitude: toCoordinate(req.body.longitude),
      totalClasses: finalTotalClasses,
      status: req.body.status || "New Lead",
      requirementId,
      websiteStudentId,
      odooSyncStatus: "pending",
      odooSyncError: "",
      odooLastSyncAt: null,
    });

    const saved = await enquiry.save();

    // Log database saved successfully
    try {
      await new AnalyticsLog({
        visitor_id: req.body.visitor_id || "unknown",
        session_id: req.body.session_id || "unknown",
        city: finalGeo.city || "Unknown City",
        region: finalGeo.region || "Unknown State",
        country: finalGeo.country || "Unknown Country",
        source: req.body.utm_source || "Direct",
        page_visited: "/parent-enquiry",
        device: req.body.device || "Desktop",
        browser: req.body.browser || "Unknown Browser",
        os: req.body.os || "Unknown OS",
        ipAddress: finalIp,
        action: "database_saved_success",
      }).save();
    } catch (logErr) {
      console.error("Failed to log database saved success:", logErr.message);
    }

    // â”€â”€ Step 3: Clear drafts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    try {
      const email = req.body.email;
      const phone = req.body.phone;
      const queryList = [];
      if (email) queryList.push({ emailOrPhone: email.trim() });
      if (phone) queryList.push({ emailOrPhone: phone.trim() });
      if (queryList.length > 0) {
        await ParentEnquiryDraft.deleteMany({ $or: queryList });
      }
    } catch (draftErr) {
      console.error("Error clearing draft on submit:", draftErr.message);
    }

    // â”€â”€ Step 4: Trigger auto-broadcast asynchronously â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    autoBroadcastTutorsForLead(saved).catch(err => {
      console.error("[Auto-Broadcast] Trigger failed:", err.message);
    });

    // Alert the admin on WhatsApp (non-blocking)
    notifyAdminOfNewEnquiry(saved).catch(err => {
      console.error("[Admin Alert] New enquiry alert failed:", err.message);
    });

    // â”€â”€ Step 5: Sync to Odoo Community asynchronously (non-blocking) â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Parent gets HTTP 201 immediately. Odoo sync happens in background.
    setImmediate(async () => {
      try {
        const odooRes = await createLead({ ...req.body, requirementId, websiteStudentId, userType: "parent" });
        const odooLeadId = odooRes && typeof odooRes === "object" ? odooRes.id : odooRes;
        const odooReqId = (odooRes && typeof odooRes === "object" && odooRes.requirementId) || requirementId;

        await ParentEnquiry.findByIdAndUpdate(saved._id, {
          odooLeadId: odooLeadId || null,
          requirementId: odooReqId || requirementId,
          odooSyncStatus: odooLeadId ? "synced" : "failed",
          odooSyncError: odooLeadId ? "" : "Odoo returned no lead ID",
          odooLastSyncAt: new Date(),
        });

        console.log(`[Odoo Sync] âœ… Parent enquiry ${requirementId} synced to Odoo Community â†’ Lead #${odooLeadId}`);
      } catch (odooErr) {
        console.error(`[Odoo Sync] âŒ Parent enquiry ${requirementId} failed:`, odooErr.message);
        await ParentEnquiry.findByIdAndUpdate(saved._id, {
          odooSyncStatus: "failed",
          odooSyncError: odooErr.message || "Unknown Odoo error",
          odooLastSyncAt: new Date(),
        }).catch(() => {});
      }
    });

    res.status(201).json(saved);

  } catch (error) {
    console.error("Parent enquiry create error:", error);
    res.status(400).json({ message: error.message });
  }
});

// =============================================================
// UPDATE parent enquiry status/notes
// PUT /api/parent-enquiries/:id
// =============================================================
router.put("/:id", verifyToken(["admin"]), async (req, res) => {
  try {
    const allowedUpdates = {
      status: req.body.status,
      adminNotes: req.body.adminNotes,
      nextFollowUpDate: req.body.nextFollowUpDate,
      assignedTutor: req.body.assignedTutor,
      assignedTutorId: req.body.assignedTutorId,
      demoDate: req.body.demoDate,
      demoTime: req.body.demoTime,
      feesFinalized: req.body.feesFinalized,
      finalFees: req.body.finalFees,
      lostReason: req.body.lostReason,
      totalClasses: req.body.totalClasses,
      completedClasses: req.body.completedClasses,
      classSchedule: req.body.classSchedule,
      classDuration: req.body.classDuration,
    };

    if (req.body.assignedTutor !== undefined) {
      if (req.body.assignedTutor && req.body.assignedTutor.trim()) {
        const trimmedTutorName = req.body.assignedTutor.trim();
        const escapedName = trimmedTutorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const tutor = await Tutor.findOne({
          name: { $regex: new RegExp(`^${escapedName}$`, "i") }
        });
        if (tutor) {
          allowedUpdates.assignedTutorId = tutor._id;
          allowedUpdates.assignedTutor = tutor.name;
        } else if (req.body.assignedTutorId) {
          allowedUpdates.assignedTutorId = req.body.assignedTutorId;
        } else {
          allowedUpdates.assignedTutorId = null;
        }
      } else {
        allowedUpdates.assignedTutorId = null;
      }
    }

    Object.keys(allowedUpdates).forEach(key => {
      if (allowedUpdates[key] === undefined) delete allowedUpdates[key];
    });

    const enquiry = await ParentEnquiry.findByIdAndUpdate(
      req.params.id,
      allowedUpdates,
      { new: true, runValidators: true }
    );

    if (!enquiry) return res.status(404).json({ message: "Parent enquiry not found" });

    // Sync status to Odoo
    if (enquiry.odooLeadId && allowedUpdates.status) {
      try {
        await updateLead(enquiry.odooLeadId, { status: allowedUpdates.status });
      } catch (err) {
        console.error("Odoo update lead status error:", err.message);
      }
    }

    res.json(enquiry);
  } catch (error) {
    console.error("Parent enquiry update error:", error);
    res.status(500).json({ message: "Failed to update parent enquiry", error: error.message });
  }
});

// =============================================================
// RETRY / SYNC parent enquiry to Odoo Community CRM
// POST /api/parent-enquiries/:id/sync-odoo
// =============================================================
router.post("/:id/sync-odoo", verifyToken(["admin"]), async (req, res) => {
  try {
    const lead = await ParentEnquiry.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: "Parent enquiry not found" });

    // Ensure stable requirementId & websiteStudentId exist without regenerating
    let requirementId = lead.requirementId;
    let websiteStudentId = lead.websiteStudentId;
    if (!requirementId) {
      // Counting enquiries here reused IDs of other leads; take a fresh one instead
      const fresh = await nextEnquiryIds();
      requirementId = fresh.requirementId;
      lead.requirementId = requirementId;
      if (!websiteStudentId) websiteStudentId = lead.websiteStudentId = fresh.websiteStudentId;
    }
    if (!websiteStudentId) {
      const seq = requirementId.replace(/\D/g, "");
      websiteStudentId = seq ? `STU-${seq.padStart(5, "0")}` : `STU-${String(lead._id).slice(-5).toUpperCase()}`;
      lead.websiteStudentId = websiteStudentId;
    }
    await lead.save({ validateBeforeSave: false });

    const leadData = lead.toObject();
    const odooRes = await createLead({
      ...leadData,
      requirementId,
      websiteStudentId,
      userType: "parent",
    });

    const odooLeadId = odooRes && typeof odooRes === "object" ? odooRes.id : odooRes;

    lead.odooLeadId = odooLeadId || lead.odooLeadId || null;
    lead.odooSyncStatus = odooLeadId ? "synced" : "failed";
    lead.odooSyncError = odooLeadId ? "" : "Odoo returned no lead ID";
    lead.odooLastSyncAt = new Date();
    await lead.save({ validateBeforeSave: false });

    res.json({
      success: !!odooLeadId,
      odooLeadId,
      requirementId: lead.requirementId,
      websiteStudentId: lead.websiteStudentId,
      odooSyncStatus: lead.odooSyncStatus,
    });
  } catch (err) {
    const cleanError = err.message.replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, "Bearer [MASKED]");
    console.error(`[Odoo Retry Sync Error for ${req.params.id}]:`, cleanError);
    await ParentEnquiry.findByIdAndUpdate(req.params.id, {
      odooSyncStatus: "failed",
      odooSyncError: cleanError,
      odooLastSyncAt: new Date(),
    }).catch(() => {});

    res.status(500).json({ success: false, message: cleanError });
  }
});

// =============================================================
// CONFIRM parent enquiry from link
// GET /api/parent-enquiries/confirm?lead=ODOO_LEAD_ID
// =============================================================
router.get("/confirm", async (req, res) => {
  try {
    const leadId = req.query.lead;
    if (!leadId) return res.status(400).send("Lead ID is required");

    await updateLead(leadId, { x_studio_response_status: "Yes" });
    res.send("Thank you! Your interest is confirmed.");
  } catch (err) {
    console.error("Confirm parent lead error:", err.message);
    res.send("Something went wrong");
  }
});

// =============================================================
// DELETE parent enquiry
// DELETE /api/parent-enquiries/:id
// =============================================================
// Archives rather than erases: the enquiry leaves every list but can be restored
router.delete("/:id", verifyToken(["admin"]), async (req, res) => {
  try {
    const enquiry = await ParentEnquiry.findById(req.params.id);
    if (!enquiry) return res.status(404).json({ message: "Enquiry not found" });

    enquiry.archived = true;
    enquiry.archivedAt = new Date();
    enquiry.archivedBy = req.user?.email || "admin";
    await enquiry.save({ validateBeforeSave: false });
    console.log(`[ParentEnquiry] ${enquiry.requirementId} archived by ${enquiry.archivedBy}`);
    res.json({ message: "Enquiry archived", enquiry });
  } catch (error) {
    console.error("Parent enquiry delete error:", error);
    res.status(500).json({ message: error.message });
  }
});

// =============================================================
// POST broadcast to selected tutors via WhatsApp
// POST /api/parent-enquiries/:id/broadcast
//
// Body: { tutorIds: [...], adminName?: string, adminEmail?: string }
//
// Privacy: NEVER sends parent name, phone, email, exact address, map link.
// Deduplication: skips if (requirementId, tutorId) pair already exists.
// Never broadcasts to Blocked tutors.
// =============================================================
router.post("/:id/broadcast", verifyToken(["admin"]), async (req, res) => {
  try {
    const leadId = req.params.id;
    const { tutorIds, adminName = "", adminEmail = "", templateId = null } = req.body;

    if (!Array.isArray(tutorIds) || tutorIds.length === 0) {
      return res.status(400).json({ message: "At least one tutor must be selected." });
    }

    const lead = await ParentEnquiry.findById(leadId);
    if (!lead) return res.status(404).json({ message: "Lead not found." });

    const firstWard = lead.wards?.[0] || {};
    const reqId = lead.requirementId || "REQ-XXXXX";

    const results = [];

    for (const tId of tutorIds) {
      const tutor = await Tutor.findById(tId);
      if (!tutor) {
        results.push({ tutorId: tId, status: "Failed", failureReason: "Tutor not found" });
        continue;
      }

      // Never broadcast to blocked tutors
      if (tutor.availabilityStatus === "Blocked") {
        results.push({
          tutorId: tId,
          tutorName: tutor.name,
          status: "Suppressed",
          failureReason: "Tutor is Blocked",
        });
        continue;
      }

      const isApproved = tutor.status === "approved";
      const isOnboarded = tutor.onboardingCompleted === true;
      const isNewTutorWorkflow = !(isApproved && isOnboarded);

      if (isNewTutorWorkflow) {
        // Workflow 1: Send Tutor Agreement/Onboarding (once only)
        if (tutor.onboardingMessageSentAt) {
          results.push({
            tutorId: tId,
            tutorName: tutor.name,
            status: "Suppressed",
            failureReason: "Onboarding message already sent",
          });
          continue;
        }

        const messageBody = buildOnboardingMessage(tutor.name);

        const log = new BroadcastLog({
          tutorId: tutor._id,
          tutorName: tutor.name,
          tutorPhone: tutor.whatsapp || tutor.phone || "",
          tutorCode: tutor.tutorCode || "",
          requirementId: reqId,
          leadId: lead._id,
          type: "whatsapp",
          message: messageBody,
          status: "Sending",
          adminName,
          adminEmail,
          broadcastType: "onboarding",
        });
        await log.save();

        const whatsappNumber = tutor.whatsapp || tutor.phone || "";
        if (!whatsappNumber) {
          await BroadcastLog.findByIdAndUpdate(log._id, {
            status: "Failed",
            failureReason: "No WhatsApp number available",
          });
          results.push({
            tutorId: tId,
            tutorName: tutor.name,
            logId: log._id,
            status: "Failed",
            failureReason: "No WhatsApp number available",
            workflow: "onboarding",
          });
          continue;
        }

        // Retrieve the document_link from Odoo sign.request.item for this tutor's email or phone number
        let tutorSignLink = "";
        let tutorSignRequestId = null;
        try {
          const uid = await getOdooUid();
          const searchDomains = [];
          if (tutor.email) {
            searchDomains.push([["signer_email", "=", tutor.email.trim()]]);
          }
          if (tutor.whatsapp || tutor.phone) {
            const cleanPhone = String(tutor.whatsapp || tutor.phone).replace(/\D/g, "").slice(-10);
            if (cleanPhone) {
              searchDomains.push([["sms_number", "like", cleanPhone]]);
            }
          }

          for (const domain of searchDomains) {
            const signItems = await callOdooMethod(
              uid,
              "sign.request.item",
              "search_read",
              [domain],
              { fields: ["id", "sign_request_id", "document_link", "state"], limit: 1, order: "id desc" }
            );
            if (signItems && signItems.length > 0 && signItems[0].document_link) {
              tutorSignLink = signItems[0].document_link;
              tutorSignRequestId = signItems[0].sign_request_id?.[0] || null;
              console.log(`[Odoo Sign] Found sign link for tutor ${tutor.name}: ${tutorSignLink}, sign.request ID: ${tutorSignRequestId}`);
              break;
            }
          }
        } catch (signErr) {
          console.error(`[Odoo Sign] Error fetching sign request: ${signErr.message}`);
        }

        // Fallback if no specific link is found, to prevent WhatsApp parameter validation errors
        if (!tutorSignLink) {
          console.warn(`[Odoo Sign] Fallback to general sign dashboard for tutor ${tutor.name}`);
          const odooBaseUrl = (process.env.ODOO_URL || "https://odoo.saraswatitutorial.com").replace(/\/+$/, "");
          tutorSignLink = `${odooBaseUrl}/sign`;
        }

        const sendResult = await sendWhatsAppToTutor({
          phoneNumber: whatsappNumber,
          messageBody,
          templateName: "Tutor Agreement",
          templateLang: "en",
          templateVars: {
            button_dynamic_url_1: tutorSignLink,
          },
          resId: tutorSignRequestId, // Pass the sign.request record ID for correct model context
        });

        await BroadcastLog.findByIdAndUpdate(log._id, {
          status: sendResult.success ? "Sent" : "Failed",
          failureReason: sendResult.failureReason || "",
          retryCount: sendResult.retryCount || 0,
          whatsappMessageId: sendResult.messageId || "",
          usedTemplate: sendResult.usedTemplate || false,
          templateName: sendResult.usedTemplate ? "Tutor Agreement" : "",
        });

        if (sendResult.success) {
          tutor.onboardingMessageSentAt = new Date();
          await tutor.save();
        }

        results.push({
          tutorId: tId,
          tutorName: tutor.name,
          logId: log._id,
          status: sendResult.success ? "Sent" : "Failed",
          failureReason: sendResult.failureReason || "",
          usedTemplate: sendResult.usedTemplate,
          messageId: sendResult.messageId,
          workflow: "onboarding",
        });

      } else {
        // Existing Approved + Onboarded Tutor (Tuition Requirement Notification)
        // Send alert every time admin clicks (removed deduplication check)

        const distanceTier = req.body.distanceTiers?.[tId] || null;
        const distanceKm = req.body.distancesKm?.[tId] || null;
        const matchPercentage = req.body.matchPercentages?.[tId] || null;

        const messageBody = buildBroadcastMessage(tutor.name, lead, firstWard, distanceTier);

        const log = new BroadcastLog({
          tutorId: tutor._id,
          tutorName: tutor.name,
          tutorPhone: tutor.whatsapp || tutor.phone || "",
          tutorCode: tutor.tutorCode || "",
          requirementId: reqId,
          leadId: lead._id,
          type: "whatsapp",
          message: messageBody,
          status: "Sending",
          adminName,
          adminEmail,
          distanceKm,
          matchPercentage,
          broadcastType: "requirement",
        });
        await log.save();

        const whatsappNumber = tutor.whatsapp || tutor.phone || "";
        if (!whatsappNumber) {
          await BroadcastLog.findByIdAndUpdate(log._id, {
            status: "Failed",
            failureReason: "No WhatsApp number available",
          });
          results.push({
            tutorId: tId,
            tutorName: tutor.name,
            logId: log._id,
            status: "Failed",
            failureReason: "No WhatsApp number available",
            workflow: "requirement",
          });
          continue;
        }

        // Use admin-selected template ID if provided, otherwise fall back to env default name
        const templateName = templateId
          ? String(templateId)
          : (process.env.WHATSAPP_REQUIREMENT_TEMPLATE_NAME || "tutor_requirement_v3");

        const sendResult = await sendWhatsAppToTutor({
          phoneNumber: whatsappNumber,
          messageBody,
          templateName,
          templateLang: "en",
          templateVars: buildRequirementTemplateVars(tutor.name, lead, firstWard),
          ...(templateId ? { templateId: Number(templateId) } : {}),
        });

        await BroadcastLog.findByIdAndUpdate(log._id, {
          status: sendResult.success ? "Sent" : "Failed",
          failureReason: sendResult.failureReason || "",
          retryCount: sendResult.retryCount || 0,
          whatsappMessageId: sendResult.messageId || "",
          usedTemplate: sendResult.usedTemplate || false,
          templateName: sendResult.usedTemplate ? templateName : "",
        });

        results.push({
          tutorId: tId,
          tutorName: tutor.name,
          logId: log._id,
          status: sendResult.success ? "Sent" : "Failed",
          failureReason: sendResult.failureReason || "",
          usedTemplate: sendResult.usedTemplate,
          messageId: sendResult.messageId,
          workflow: "requirement",
        });
      }
    }

    const sentCount = results.filter(r => r.status === "Sent").length;
    const failedCount = results.filter(r => r.status === "Failed").length;
    const suppressedCount = results.filter(r => r.status === "Suppressed").length;

    res.json({
      message: `Broadcast complete. Sent: ${sentCount}, Failed: ${failedCount}, Suppressed: ${suppressedCount}`,
      results,
    });
  } catch (error) {
    console.error("Tutor broadcast error:", error);
    res.status(500).json({ message: error.message });
  }
});

// =============================================================
// POST assign tutor to parent lead + auto-send parent details
// POST /api/parent-enquiries/:id/assign-tutor
// =============================================================
router.post("/:id/assign-tutor", verifyToken(["admin"]), async (req, res) => {
  try {
    const leadId = req.params.id;
    const { tutorId, demoDate, demoTime } = req.body;

    const lead = await ParentEnquiry.findById(leadId);
    if (!lead) return res.status(404).json({ message: "Lead not found." });

    const tutor = await Tutor.findById(tutorId);
    if (!tutor) return res.status(404).json({ message: "Tutor not found." });

    // Update MongoDB lead
    lead.assignedTutor = tutor.name;
    lead.assignedTutorId = tutor._id;
    lead.status = "Demo Scheduled";
    if (demoDate) lead.demoDate = demoDate;
    if (demoTime) lead.demoTime = demoTime;
    await lead.save({ validateBeforeSave: false });

    // Update broadcast log response status to "Assigned"
    await BroadcastLog.updateMany(
      { leadId: lead._id, tutorId: tutor._id },
      { $set: { responseStatus: "Assigned" } }
    );

    // Update Odoo CRM lead
    if (lead.odooLeadId) {
      try {
        await updateLeadAssignment(lead.odooLeadId, {
          tutorName: tutor.name,
          tutorCode: tutor.tutorCode || "",
          tutorPhone: tutor.whatsapp || tutor.phone || "",
          demoDate,
          demoTime,
        });
      } catch (err) {
        console.error("Odoo update lead assignment error:", err.message);
      }
    }

    // Sync tutor statistics to Odoo Master Tutors
    if (tutor.odooLeadId) {
      try {
        const stats = await computeTutorStats(tutor);
        await syncTutorStats(tutor.odooLeadId, {
          assignmentsCompleted: stats.totalAssignments,
          assignmentsActive: stats.activeTuitionCount,
          demoTaken: stats.demoScheduled,
          demoCancelled: stats.demoCancelled,
          successfulEnrollments: stats.successfullyEnrolled,
          successRate: stats.successPercentage,
        });
      } catch (err) {
        console.error("Odoo sync tutor stats error:", err.message);
      }
    }

    // Auto-send parent details to tutor via WhatsApp
    const firstWard = lead.wards?.[0] || {};
    const whatsappNumber = tutor.whatsapp || tutor.phone || "";
    let parentDetailsSent = false;
    let parentDetailsError = "";

    if (whatsappNumber) {
      try {
        const assignmentMsg = buildAssignmentMessage(tutor.name, lead, firstWard, demoDate, demoTime);
        // Inside the 24h window the full message above is sent as-is. Outside it,
        // Odoo requires an approved template, and without naming one here it falls
        // back to the broadcast template — whose variables are fee/grade/schedule,
        // not an assignment. Name the assignment template instead.
        const assignmentTemplate =
          process.env.WHATSAPP_ASSIGNMENT_TEMPLATE_NAME || "Demo Assigned To Tutor";
        const assignmentSubjects = Array.isArray(firstWard.subjectsNeeded)
          ? firstWard.subjectsNeeded.join(", ")
          : (firstWard.subjectsNeeded || "");
        const sendResult = await sendWhatsAppToTutor({
          phoneNumber: whatsappNumber,
          messageBody: assignmentMsg,
          templateName: assignmentTemplate,
          // Values map to free_text_1..5, i.e. {{1}}..{{5}}, in this order.
          templateVars: {
            tutor_name: tutor.name || "",
            grade: firstWard.classGrade ? `Grade ${firstWard.classGrade}` : "",
            subjects: assignmentSubjects,
            location: [lead.area, lead.city].filter(Boolean).join(", "),
            demo_slot: [demoDate, demoTime].filter(Boolean).join(" at "),
          },
        });
        parentDetailsSent = sendResult.success;
        parentDetailsError = sendResult.failureReason || "";
      } catch (err) {
        console.error("Error sending assignment WhatsApp message:", err.message);
        parentDetailsError = err.message;
      }
    } else {
      parentDetailsError = "No WhatsApp number available for tutor";
    }

    res.json({
      message: "Tutor assigned successfully",
      lead,
      parentDetailsSent,
      parentDetailsError,
    });
  } catch (error) {
    console.error("Assign tutor error:", error);
    res.status(500).json({ message: error.message });
  }
});

// =============================================================
// POST send the shortlisted tutors to the parent to choose from
// POST /api/parent-enquiries/:id/send-tutor-options
//
// Body: { tutors: [{ name, experience, distanceKm }], dryRun? }
// Up to three are offered; the parent replies 1, 2 or 3.
//
// Pass dryRun: true to see exactly what would be sent without sending it.
// =============================================================
router.post("/:id/send-tutor-options", verifyToken(["admin"]), async (req, res) => {
  try {
    const { tutors = [], dryRun = false } = req.body;

    const lead = await ParentEnquiry.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: "Lead not found." });

    if (!Array.isArray(tutors) || tutors.length === 0) {
      return res.status(400).json({ message: "tutors is required (one to three options)." });
    }

    const phoneNumber = lead.phone || "";
    if (!phoneNumber) {
      return res.status(400).json({ message: "No phone number on this lead." });
    }

    const firstWard = lead.wards?.[0] || {};
    const grade = firstWard.classGrade ? `Grade ${firstWard.classGrade}` : "";
    const subjects = Array.isArray(firstWard.subjectsNeeded)
      ? firstWard.subjectsNeeded.join(", ")
      : (firstWard.subjectsNeeded || "");

    // "Priya Sharma - 5 year exp - 3 km away", skipping anything we do not know
    const describe = (t) => [
      t?.name,
      t?.experience ? `${t.experience} exp` : "",
      t?.distanceKm != null ? `${t.distanceKm} km away` : "",
    ].filter(Boolean).join(" - ");

    const offered = tutors.slice(0, 3);
    const templateName =
      process.env.WHATSAPP_TUTOR_OPTIONS_TEMPLATE_NAME || "Tutor Options For Parent";

    // Values map to free_text_1..6, i.e. {{1}}..{{6}}, in this order.
    const templateVars = {
      parent_name: lead.parentName || "",
      grade,
      subjects,
      option_1: offered[0] ? describe(offered[0]) : "",
      option_2: offered[1] ? describe(offered[1]) : "",
      option_3: offered[2] ? describe(offered[2]) : "",
    };

    const messageBody =
      `Hello Mr./Ms. ${lead.parentName || ""},\n\n` +
      `We have shortlisted ${offered.length} tutor(s) for your requirement.\n\n` +
      `Grade: ${grade}\nSubject(s): ${subjects}\n\n` +
      offered.map((t, i) => `${i + 1}) ${describe(t)}`).join("\n") +
      `\n\nPlease reply with the number of your preferred tutor.`;

    if (dryRun) {
      return res.json({
        message: "Dry run - nothing was sent",
        sent: false,
        dryRun: true,
        phoneNumber,
        templateName,
        templateVars,
        messageBody,
      });
    }

    const sendResult = await sendWhatsAppToTutor({
      phoneNumber,
      messageBody,
      templateName,
      templateVars,
      // The 1/2/3 choice buttons live on the template, so it must be used even
      // inside the 24-hour window — which the photo cards have just reopened.
      forceTemplate: true,
    });

    res.json({
      message: sendResult.success ? "Tutor options sent to parent" : "Send failed",
      sent: sendResult.success,
      dryRun: false,
      failureReason: sendResult.failureReason || "",
      usedTemplate: sendResult.usedTemplate,
      templateName,
      offeredCount: offered.length,
    });
  } catch (error) {
    console.error("Send tutor options error:", error);
    res.status(500).json({ message: error.message });
  }
});

// =============================================================
// POST send the top three tutors to the parent as one card each,
// so every card can carry that tutor's own profile picture.
// POST /api/parent-enquiries/:id/send-tutor-cards
// =============================================================
router.post("/:id/send-tutor-cards", verifyToken(["admin"]), async (req, res) => {
  try {
    const { tutors = [], dryRun = false } = req.body;

    const lead = await ParentEnquiry.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: "Lead not found." });

    if (!Array.isArray(tutors) || tutors.length === 0) {
      return res.status(400).json({ message: "tutors is required (one to three options)." });
    }

    const phoneNumber = lead.phone || "";
    if (!phoneNumber) {
      return res.status(400).json({ message: "No phone number on this lead." });
    }

    const offered = tutors.slice(0, 3);
    const templateName =
      process.env.WHATSAPP_TUTOR_CARD_TEMPLATE_NAME || "Tutor Option Card";

    // The caller may pass a bare name and code; the photo and the rest come
    // from the tutor's own record when they are not supplied.
    const codes = offered.map((t) => t?.tutorCode).filter(Boolean);
    const stored = codes.length
      ? await Tutor.find({ tutorCode: { $in: codes } })
          .select("tutorCode name photo experience")
          .lean()
      : [];
    const byCode = new Map(stored.map((t) => [t.tutorCode, t]));

    const cards = offered.map((t, idx) => {
      const record = byCode.get(t?.tutorCode) || {};
      return {
        position: idx + 1,
        tutorCode: t?.tutorCode || "",
        name: t?.name || record.name || "",
        photo: t?.photo || record.photo || "",
        // Values map to free_text_1..4, i.e. {{1}}..{{4}}, in this order.
        // The subject is deliberately absent: a tutor is matched on distance,
        // experience and occupation, so showing it would mislead the parent.
        templateVars: {
          position: String(idx + 1),
          tutor_name: t?.name || record.name || "",
          experience: t?.experience || record.experience || "",
          distance: t?.distanceKm != null ? `${t.distanceKm} km` : "",
        },
        messageBody:
          `Tutor option ${idx + 1} of ${offered.length}\n\n` +
          `${t?.name || record.name || ""}\n` +
          `Experience: ${t?.experience || record.experience || ""}\n` +
          `Distance: ${t?.distanceKm != null ? `${t.distanceKm} km` : ""} from your location`,
      };
    });

    if (dryRun) {
      return res.json({
        message: "Dry run - nothing was sent",
        sent: false,
        dryRun: true,
        phoneNumber,
        templateName,
        cards,
        withoutPhoto: cards.filter((c) => !c.photo).map((c) => c.name),
      });
    }

    // One send per card. A card with no picture is skipped rather than sent
    // without one, because the template's header is always an image; that
    // tutor is still listed in the options message that follows.
    const results = [];
    for (const card of cards) {
      if (!card.photo) {
        results.push({
          position: card.position,
          name: card.name,
          sent: false,
          skipped: true,
          failureReason: "No profile picture on this tutor",
        });
        continue;
      }

      const sendResult = await sendWhatsAppToTutor({
        phoneNumber,
        messageBody: card.messageBody,
        templateName,
        templateVars: card.templateVars,
        headerImageUrl: card.photo,
        // The header image can only travel on the template, never as free text.
        forceTemplate: true,
      });

      results.push({
        position: card.position,
        name: card.name,
        sent: sendResult.success,
        skipped: false,
        messageId: sendResult.messageId || null,
        failureReason: sendResult.failureReason || "",
      });
    }

    const sentCount = results.filter((r) => r.sent).length;
    res.json({
      message: `${sentCount} of ${cards.length} tutor card(s) sent to the parent`,
      sent: sentCount > 0,
      dryRun: false,
      templateName,
      phoneNumber,
      results,
    });
  } catch (error) {
    console.error("Send tutor cards error:", error);
    res.status(500).json({ message: error.message });
  }
});

// =============================================================
// POST record the parent's choice and tell that tutor they were picked.
// The flow ends here on purpose: no demo date, no demo time, no further
// message. Scheduling the demo is done by hand afterwards.
// POST /api/parent-enquiries/:id/select-tutor
// =============================================================
router.post("/:id/select-tutor", verifyToken(["admin"]), async (req, res) => {
  try {
    const { tutorId, dryRun = false, force = false } = req.body;
    if (!tutorId) return res.status(400).json({ message: "tutorId is required." });

    const lead = await ParentEnquiry.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: "Lead not found." });

    const tutor = await Tutor.findById(tutorId);
    if (!tutor) return res.status(404).json({ message: "Tutor not found." });

    // A parent tapping two buttons must not quietly reassign the lead.
    const already = lead.assignedTutorId ? String(lead.assignedTutorId) : "";
    if (already && already !== String(tutor._id) && !force) {
      return res.status(409).json({
        message: `This lead is already with ${lead.assignedTutor || "another tutor"}. Send force: true to change it.`,
        assignedTutor: lead.assignedTutor || "",
        assignedTutorId: already,
      });
    }

    const firstWard = lead.wards?.[0] || {};
    const subjects = Array.isArray(firstWard.subjectsNeeded)
      ? firstWard.subjectsNeeded.join(", ")
      : (firstWard.subjectsNeeded || "");
    const whatsappNumber = tutor.whatsapp || tutor.phone || "";
    const templateName =
      process.env.WHATSAPP_SELECTION_TEMPLATE_NAME || "tutor_selected_v1";

    // Values map to free_text_1..4, i.e. {{1}}..{{4}}, in this order.
    const templateVars = {
      tutor_name: tutor.name || "",
      grade: firstWard.classGrade ? `Grade ${firstWard.classGrade}` : "",
      subjects,
      location: [lead.area, lead.city].filter(Boolean).join(", "),
    };

    const messageBody =
      `Hello ${tutor.name || ""},\n\n` +
      `Good news. The parent has selected you for this tuition requirement.\n\n` +
      `Grade: ${templateVars.grade}\nSubject(s): ${subjects}\n` +
      `Location: ${templateVars.location}\n\n` +
      `Our team will contact you shortly to arrange the demo class.`;

    if (dryRun) {
      return res.json({
        message: "Dry run - nothing was sent and nothing was saved",
        sent: false,
        dryRun: true,
        tutorName: tutor.name,
        phoneNumber: whatsappNumber,
        templateName,
        templateVars,
        messageBody,
        alreadyAssignedTo: already || null,
      });
    }

    // Record the choice. The lead's status is deliberately left alone: no demo
    // has been scheduled yet, so calling it "Demo Scheduled" would be untrue.
    lead.assignedTutor = tutor.name;
    lead.assignedTutorId = tutor._id;
    await lead.save({ validateBeforeSave: false });

    await BroadcastLog.updateMany(
      { leadId: lead._id, tutorId: tutor._id },
      { $set: { responseStatus: "Assigned", respondedAt: new Date() } }
    );

    // Odoo is told who was picked, but not about a demo that does not exist.
    if (lead.odooLeadId) {
      try {
        await updateLeadAssignment(lead.odooLeadId, {
          tutorName: tutor.name,
          tutorCode: tutor.tutorCode || "",
          tutorPhone: whatsappNumber,
        });
      } catch (err) {
        console.error("Odoo update lead assignment error:", err.message);
      }
    }

    if (!whatsappNumber) {
      return res.json({
        message: "Tutor recorded, but there is no WhatsApp number to tell them on",
        sent: false,
        dryRun: false,
        recorded: true,
        tutorName: tutor.name,
        failureReason: "No WhatsApp number available for tutor",
      });
    }

    const sendResult = await sendWhatsAppToTutor({
      phoneNumber: whatsappNumber,
      messageBody,
      templateName,
      templateVars,
    });

    res.json({
      message: sendResult.success
        ? "Tutor recorded and told they were selected"
        : "Tutor recorded, but the message did not go",
      sent: sendResult.success,
      dryRun: false,
      recorded: true,
      tutorName: tutor.name,
      usedTemplate: sendResult.usedTemplate,
      messageId: sendResult.messageId || null,
      failureReason: sendResult.failureReason || "",
      templateName,
    });
  } catch (error) {
    console.error("Select tutor error:", error);
    res.status(500).json({ message: error.message });
  }
});

// =============================================================
// PUT update broadcast log response status (manual admin update)
// PUT /api/parent-enquiries/broadcast-logs/:logId/response
// =============================================================
router.put("/broadcast-logs/:logId/response", verifyToken(["admin"]), async (req, res) => {
  try {
    const { responseStatus } = req.body;
    const allowedResponses = [
      "No Response", "Interested", "Not Interested", "Accepted",
      "Rejected", "Assigned", "Joined",
    ];

    if (!allowedResponses.includes(responseStatus)) {
      return res.status(400).json({ message: "Invalid response status." });
    }

    const log = await BroadcastLog.findByIdAndUpdate(
      req.params.logId,
      {
        responseStatus,
        respondedAt: new Date(),
      },
      { new: true }
    );

    if (!log) return res.status(404).json({ message: "Broadcast log not found." });
    res.json(log);
  } catch (error) {
    console.error("Update broadcast log response error:", error);
    res.status(500).json({ message: error.message });
  }
});

// =============================================================
// GET recommend tutors for a parent lead
// GET /api/parent-enquiries/:leadId/recommend-tutors
// Returns 4-bucket recommendations: exact, nearby, city, backup
// Each tutor includes matchPercentage, distanceKm, reason, recommendationType
// =============================================================
router.get("/:leadId/recommend-tutors", verifyToken(["admin"]), async (req, res) => {
  try {
    const lead = await ParentEnquiry.findById(req.params.leadId).lean();
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    const parsedAddr = parseAddress(lead.address);
    const params = buildParamsFromLead(lead, parsedAddr);
    const recommendations = await getRecommendations(params);

    res.json({
      lead: {
        _id: lead._id,
        requirementId: lead.requirementId,
        parentName: lead.parentName,
        area: lead.area,
        city: lead.city,
        pincode: lead.pincode,
        status: lead.status,
      },
      params: {
        grade: params.grade,
        subjects: params.subjects,
        area: params.area,
        city: params.city,
        pincode: params.pincode,
        timing: params.timing,
        gender: params.gender,
      },
      recommendations,
    });
  } catch (error) {
    console.error("Recommend tutors error:", error);
    res.status(500).json({ message: error.message });
  }
});



// =============================================================
// POST retry a failed broadcast log entry
// POST /api/parent-enquiries/broadcast-logs/:logId/retry
// =============================================================
router.post("/broadcast-logs/:logId/retry", verifyToken(["admin"]), async (req, res) => {
  try {
    const log = await BroadcastLog.findById(req.params.logId);
    if (!log) return res.status(404).json({ message: "Broadcast log not found." });

    if (log.status !== "Failed") {
      return res.status(400).json({ message: "Only Failed broadcasts can be retried." });
    }

    // Check if this is a permanent failure â€” should not retry
    if (log.failureReason && isPermanentFailure(log.failureReason)) {
      return res.status(400).json({
        message: `This failure reason ("${log.failureReason}") is permanent and cannot be retried.`,
      });
    }

    if (log.retryCount >= 3) {
      return res.status(400).json({ message: "Maximum retry count (3) reached." });
    }

    const tutor = await Tutor.findById(log.tutorId);
    if (!tutor) return res.status(404).json({ message: "Tutor not found." });

    const lead = await ParentEnquiry.findById(log.leadId);
    if (!lead) return res.status(404).json({ message: "Lead not found." });

    // Update status to Sending
    await BroadcastLog.findByIdAndUpdate(log._id, {
      status: "Sending",
      lastRetryAt: new Date(),
    });

    const whatsappNumber = tutor.whatsapp || tutor.phone || "";
    if (!whatsappNumber) {
      await BroadcastLog.findByIdAndUpdate(log._id, {
        status: "Failed",
        failureReason: "No WhatsApp number available",
        retryCount: log.retryCount + 1,
      });
      return res.status(400).json({ message: "No WhatsApp number available for this tutor." });
    }

    const sendResult = await sendWhatsAppToTutor({
      phoneNumber: whatsappNumber,
      messageBody: log.message,
      templateName: log.templateName || undefined,
      forceTemplate: log.usedTemplate || false,
    });

    const updatedLog = await BroadcastLog.findByIdAndUpdate(
      log._id,
      {
        status: sendResult.success ? "Sent" : "Failed",
        failureReason: sendResult.failureReason || "",
        retryCount: log.retryCount + 1 + (sendResult.retryCount || 0),
        whatsappMessageId: sendResult.messageId || log.whatsappMessageId,
        lastRetryAt: new Date(),
      },
      { new: true }
    );

    res.json({
      message: sendResult.success ? "Retry successful" : "Retry failed",
      log: updatedLog,
      failureReason: sendResult.failureReason || "",
    });
  } catch (error) {
    console.error("Retry broadcast error:", error);
    res.status(500).json({ message: error.message });
  }
});

// =============================================================
// POST WhatsApp reply webhook
// POST /api/parent-enquiries/webhook/whatsapp-reply
//
// Called by Odoo or Meta when a tutor replies to a WhatsApp message.
// Secured by X-Webhook-Secret header.
// =============================================================
router.post("/webhook/whatsapp-reply", async (req, res) => {
  try {
    const webhookSecret = req.headers["x-webhook-secret"];
    const expectedSecret = process.env.WEBHOOK_SECRET;

    if (expectedSecret && webhookSecret !== expectedSecret) {
      return res.status(403).json({ message: "Unauthorized webhook call." });
    }

    const { phone, message, messageId } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ message: "phone and message are required." });
    }

    const replyText = String(message).trim().toLowerCase();
    let responseStatus = null;

    // â”€â”€ Expanded keyword recognition â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Not Interested checked FIRST to prevent "not interested" matching "interested"
    const NOT_INTERESTED_KEYWORDS = [
      "not interested", "nahi", "no", "nope", "reject", "not available",
      "busy", "later", "unavailable", "mat karo", "band karo", "cancel",
    ];
    const INTERESTED_KEYWORDS = [
      "interested", "yes", "accept", "ok", "okay", "confirm",
      "ji", "haan", "han", "ha", "chalega", "bilkul", "zaroor", "theek",
    ];

    if (NOT_INTERESTED_KEYWORDS.some((k) => replyText.includes(k))) {
      responseStatus = "Not Interested";
    } else if (INTERESTED_KEYWORDS.some((k) => replyText.includes(k))) {
      responseStatus = "Interested";
    }

    if (!responseStatus) {
      // Not a clear YES/NO â€” log but don't update
      console.log(`[Webhook] Ambiguous reply from ${phone}: "${message}"`);
      return res.json({ message: "Reply received but not a clear YES/NO.", processed: false });
    }

    // Find the tutor by phone number
    const tutor = await Tutor.findOne({
      $or: [
        { whatsapp: { $regex: phone.slice(-10) } },
        { phone: { $regex: phone.slice(-10) } },
      ],
    });

    if (!tutor) {
      console.warn(`[Webhook] No tutor found for phone: ${phone}`);
      return res.json({ message: "Tutor not found for this phone number.", processed: false });
    }

    // Find the most recent broadcast log for this tutor that has No Response
    const latestLog = await BroadcastLog.findOne({
      tutorId: tutor._id,
      responseStatus: "No Response",
      status: { $in: ["Sent", "Delivered", "Read"] },
    }).sort({ time: -1 });

    if (!latestLog) {
      console.warn(`[Webhook] No pending broadcast log found for tutor: ${tutor.name}`);
      return res.json({ message: "No pending broadcast log found.", processed: false });
    }

    await BroadcastLog.findByIdAndUpdate(latestLog._id, {
      responseStatus,
      respondedAt: new Date(),
      status: "Replied",
      whatsappMessageId: messageId || latestLog.whatsappMessageId,
    });

    console.log(`[Webhook] Updated broadcast log ${latestLog._id} â€” Tutor ${tutor.name} replied: ${responseStatus}`);

    // â”€â”€ Sync response to Odoo chatter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Fetch the lead to get odooLeadId
    if (latestLog.leadId) {
      const lead = await ParentEnquiry.findById(latestLog.leadId).select("odooLeadId requirementId");
      if (lead?.odooLeadId) {
        const emoji = responseStatus === "Interested" ? "âœ…" : "âŒ";
        const chatterMsg =
          `${emoji} Tutor <b>${tutor.name}</b> (${tutor.tutorCode || tutor.phone}) ` +
          `replied: <b>${responseStatus}</b> for requirement <b>${lead.requirementId}</b>`;

        addOdooChatterMessage(lead.odooLeadId, chatterMsg).catch((err) =>
          console.warn("[Webhook] Odoo chatter sync failed:", err.message)
        );
      }
    }

    res.json({
      message: "Reply processed successfully.",
      responseStatus,
      tutorName: tutor.name,
      logId: latestLog._id,
      processed: true,
    });
  } catch (error) {
    console.error("WhatsApp webhook error:", error);
    res.status(500).json({ message: error.message });
  }
});


/**
 * Automatically match and broadcast parent enquiry details to the top 10 matched tutors.
 * Tutors who are already approved & onboarded get the requirement message template.
 * Unboarded tutors get the Tutor Agreement onboarding template first.
 */
async function autoBroadcastTutorsForLead(leadData) {

  try {
    const lead = await ParentEnquiry.findById(leadData._id);
    if (!lead) {
      console.error(`[Auto-Broadcast] Lead not found for ID: ${leadData._id}`);
      return;
    }

    console.log(`[Auto-Broadcast] Starting matching for Lead ID: ${lead._id} (${lead.requirementId || "N/A"})`);

    const firstWard = lead.wards?.[0] || {};
    const parsedAddr = parseAddress(lead.address);
    const params = {
      pincode: lead.pincode || parsedAddr.pincode || "",
      area: lead.area || parsedAddr.area || "",
      locality: lead.locality || parsedAddr.locality || "",
      landmark: lead.landmark || parsedAddr.landmark || "",
      city: lead.city || parsedAddr.city || lead.geoInfo?.city || "",
      district: lead.district || parsedAddr.district || "",
      state: lead.state || parsedAddr.state || lead.geoInfo?.region || "",
      grade: firstWard.classGrade || "",
      board: firstWard.curriculum || "",
      subjects: Array.isArray(firstWard.subjectsNeeded) ? firstWard.subjectsNeeded : [],
      timing: lead.preferredTime || "",
      gender: lead.preferredGender || "No Preference",
      latitude: lead.latitude || null,
      longitude: lead.longitude || null,
    };

    const query = buildCentralizedQuery(params);
    const tutors = await Tutor.find(query);
    console.log(`[Auto-Broadcast] Found ${tutors.length} approved/unblocked tutors from base query.`);

    const scoredTutors = tutors
      .map((tutor) => {
        const scoreInfo = calculateTutorScore(params, tutor);
        return {
          ...tutor.toObject(),
          _id: tutor._id,
          matchScore: scoreInfo.score,
          matchPercentage: scoreInfo.percentage,
          locationScore: scoreInfo.locationScore,
          distanceKm: scoreInfo.distanceKm,
          distanceTier: scoreInfo.distanceTier,
        };
      })
      .filter((t) => {
        const hasLocationCriteria = !!(
          params.pincode ||
          params.area ||
          params.locality ||
          params.landmark ||
          params.city ||
          params.district ||
          params.state
        );
        if (hasLocationCriteria && t.locationScore === 0) {
          return false;
        }
        return t.matchPercentage > 0;
      })
      .sort(compareTutors);

    // Take top 10 best-matched tutors
    const topTutors = scoredTutors.slice(0, 10);
    if (topTutors.length === 0) {
      console.log(`[Auto-Broadcast] No matched tutors found for Lead ID: ${lead._id}`);
      return;
    }

    console.log(`[Auto-Broadcast] Broadcasting to top ${topTutors.length} best-matched tutors:`, topTutors.map((t) => t.name).join(", "));
    const reqId = lead.requirementId || "REQ-XXXXX";

    for (const scoredTutor of topTutors) {
      const tutor = await Tutor.findById(scoredTutor._id);
      if (!tutor) continue;

      const isApproved = tutor.status === "approved";
      const isOnboarded = tutor.onboardingCompleted === true;
      const isNewTutorWorkflow = !(isApproved && isOnboarded);

      if (isNewTutorWorkflow) {
        // Workflow 1: Send Tutor Agreement/Onboarding (once only)
        if (tutor.onboardingMessageSentAt) {
          console.log(`[Auto-Broadcast] Onboarding already sent for tutor ${tutor.name}. Skipping.`);
          continue;
        }

        const messageBody = buildOnboardingMessage(tutor.name);
        const log = new BroadcastLog({
          tutorId: tutor._id,
          tutorName: tutor.name,
          tutorPhone: tutor.whatsapp || tutor.phone || "",
          tutorCode: tutor.tutorCode || "",
          requirementId: reqId,
          leadId: lead._id,
          type: "whatsapp",
          message: messageBody,
          status: "Sending",
          adminName: "System Auto-Broadcast",
          adminEmail: "system@saraswatitutorial.com",
          broadcastType: "onboarding",
        });
        await log.save();

        const whatsappNumber = tutor.whatsapp || tutor.phone || "";
        if (!whatsappNumber) {
          await BroadcastLog.findByIdAndUpdate(log._id, {
            status: "Failed",
            failureReason: "No WhatsApp number available",
          });
          continue;
        }

        // Get sign link
        let tutorSignLink = "";
        let tutorSignRequestId = null;
        try {
          const uid = await getOdooUid();
          const searchDomains = [];
          if (tutor.email) {
            searchDomains.push([["signer_email", "=", tutor.email.trim()]]);
          }
          const cleanPhone = String(whatsappNumber).replace(/\D/g, "").slice(-10);
          if (cleanPhone) {
            searchDomains.push([["sms_number", "like", cleanPhone]]);
          }

          for (const domain of searchDomains) {
            const signItems = await callOdooMethod(
              uid,
              "sign.request.item",
              "search_read",
              [domain],
              { fields: ["id", "sign_request_id", "document_link", "state"], limit: 1, order: "id desc" }
            );
            if (signItems && signItems.length > 0 && signItems[0].document_link) {
              tutorSignLink = signItems[0].document_link;
              tutorSignRequestId = signItems[0].sign_request_id?.[0] || null;
              break;
            }
          }
        } catch (signErr) {
          console.error(`[Auto-Broadcast] Error fetching sign request for ${tutor.name}:`, signErr.message);
        }

        if (!tutorSignLink) {
          const odooBaseUrl = (process.env.ODOO_URL || "https://odoo.saraswatitutorial.com").replace(/\/+$/, "");
          tutorSignLink = `${odooBaseUrl}/sign`;
        }

        const sendResult = await sendWhatsAppToTutor({
          phoneNumber: whatsappNumber,
          messageBody,
          templateName: "Tutor Agreement",
          templateLang: "en",
          templateVars: {
            button_dynamic_url_1: tutorSignLink,
          },
          resId: tutorSignRequestId,
        });

        await BroadcastLog.findByIdAndUpdate(log._id, {
          status: sendResult.success ? "Sent" : "Failed",
          failureReason: sendResult.failureReason || "",
          retryCount: sendResult.retryCount || 0,
          whatsappMessageId: sendResult.messageId || "",
          usedTemplate: sendResult.usedTemplate || false,
          templateName: sendResult.usedTemplate ? "Tutor Agreement" : "",
        });

        if (sendResult.success) {
          tutor.onboardingMessageSentAt = new Date();
          await tutor.save();
        }

      } else {
        // Workflow 2: Existing Approved & Onboarded Tutor (Tuition Requirement Notification)
        const messageBody = buildBroadcastMessage(tutor.name, lead, firstWard, scoredTutor.distanceTier);

        const log = new BroadcastLog({
          tutorId: tutor._id,
          tutorName: tutor.name,
          tutorPhone: tutor.whatsapp || tutor.phone || "",
          tutorCode: tutor.tutorCode || "",
          requirementId: reqId,
          leadId: lead._id,
          type: "whatsapp",
          message: messageBody,
          status: "Sending",
          adminName: "System Auto-Broadcast",
          adminEmail: "system@saraswatitutorial.com",
          distanceKm: scoredTutor.distanceKm,
          matchPercentage: scoredTutor.matchPercentage,
          broadcastType: "requirement",
        });
        await log.save();

        const whatsappNumber = tutor.whatsapp || tutor.phone || "";
        if (!whatsappNumber) {
          await BroadcastLog.findByIdAndUpdate(log._id, {
            status: "Failed",
            failureReason: "No WhatsApp number available",
          });
          continue;
        }

        const templateName = process.env.WHATSAPP_REQUIREMENT_TEMPLATE_NAME || "tutor_requirement_v3";

        const sendResult = await sendWhatsAppToTutor({
          phoneNumber: whatsappNumber,
          messageBody,
          templateName,
          templateLang: "en",
          templateVars: buildRequirementTemplateVars(tutor.name, lead, firstWard),
        });

        await BroadcastLog.findByIdAndUpdate(log._id, {
          status: sendResult.success ? "Sent" : "Failed",
          failureReason: sendResult.failureReason || "",
          retryCount: sendResult.retryCount || 0,
          whatsappMessageId: sendResult.messageId || "",
          usedTemplate: sendResult.usedTemplate || false,
          templateName: sendResult.usedTemplate ? templateName : "",
        });
      }
    }
  } catch (err) {
    console.error("[Auto-Broadcast] Critical error in automatic matching and broadcast:", err.message, err);
  }
}

export default router;
