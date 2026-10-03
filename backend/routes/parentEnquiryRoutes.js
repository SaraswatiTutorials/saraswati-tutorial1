import express from "express";
import ParentEnquiry from "../models/ParentEnquiry.js";
import ParentEnquiryDraft from "../models/ParentEnquiryDraft.js";
import Attendance from "../models/Attendance.js";
import AnalyticsLog from "../models/AnalyticsLog.js";
import { createLead, updateLead, updateLeadAssignment, syncTutorStats, addOdooChatterMessage } from "../utils/odooService.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { resolveGeo } from "../utils/geoLookup.js";
import Tutor from "../models/Tutor.js";
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


const router = express.Router();

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
    const data = await ParentEnquiry.find().sort({ createdAt: -1 });

    // Synchronize completedClasses and packageStatus with Attendance single source of truth.
    // Batch attendance counts into one aggregation instead of one count query per lead.
    const leadsNeedingAttendance = data.filter(
      (lead) =>
        lead.status === "Enrolled" ||
        lead.assignedTutorId ||
        (lead.totalClasses && lead.totalClasses > 0)
    );

    const attendanceCounts = new Map();

    if (leadsNeedingAttendance.length > 0) {
      const leadIds = leadsNeedingAttendance.map((lead) => lead._id);

      const attendanceSummary = await Attendance.aggregate([
        {
          $match: {
            parentEnquiryId: { $in: leadIds },
            status: "Done",
          },
        },
        {
          $group: {
            _id: {
              parentEnquiryId: "$parentEnquiryId",
              packageCycle: "$packageCycle",
            },
            count: { $sum: 1 },
          },
        },
      ]);

      for (const row of attendanceSummary) {
        const leadId = String(row._id.parentEnquiryId);
        const cycle = row._id.packageCycle == null ? 1 : row._id.packageCycle;
        const key = `${leadId}:${cycle}`;
        attendanceCounts.set(key, (attendanceCounts.get(key) || 0) + row.count);
      }
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

        return lead;
      })
    );
    res.json(synchronizedData);
  } catch (error) {
    console.error("Parent enquiry fetch error:", error);
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
      { stepReached, formData, geoInfo: finalGeo, ipAddress: finalIp, visitor_id, session_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term },
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
      const count = await ParentEnquiry.countDocuments({});
      const seq = String(count + 1).padStart(5, "0");
      requirementId = `REQ-${seq}`;
      websiteStudentId = `STU-${seq}`;
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
      const count = await ParentEnquiry.countDocuments({});
      requirementId = `REQ-${String(count).padStart(5, "0")}`;
      lead.requirementId = requirementId;
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
router.delete("/:id", verifyToken(["admin"]), async (req, res) => {
  try {
    const enquiry = await ParentEnquiry.findByIdAndDelete(req.params.id);
    if (!enquiry) return res.status(404).json({ message: "Enquiry not found" });
    res.json({ message: "Enquiry deleted successfully" });
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
          : (process.env.WHATSAPP_REQUIREMENT_TEMPLATE_NAME || "tutor_requirement_v1");

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
        const sendResult = await sendWhatsAppToTutor({
          phoneNumber: whatsappNumber,
          messageBody: assignmentMsg,
          templateVars: { tutor_name: tutor.name },
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

        const templateName = process.env.WHATSAPP_REQUIREMENT_TEMPLATE_NAME || "tutor_requirement_v1";

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
