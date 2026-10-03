import express from "express";
import jwt from "jsonwebtoken";
import Tutor from "../models/Tutor.js";
import ParentEnquiry from "../models/ParentEnquiry.js";
import Attendance from "../models/Attendance.js";
import {
  updateLead,
  syncAttendanceLogToOdoo,
  syncLeadAttendanceSummaryToOdoo,
  deleteOdooAttendanceLog,
} from "../utils/odooService.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// =============================================================
// Helper: Date operations and cycle breakdown calculations
// =============================================================
export function addOneMonth(dateStr) {
  if (!dateStr) return "";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month - 1, day);
      d.setMonth(d.getMonth() + 1);
      d.setDate(d.getDate() - 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dt = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${dt}`;
    }
  } catch (e) {}
  return "";
}

export function formatDateRange(startDate, endDate) {
  if (!startDate) return "";
  if (!endDate) return startDate;
  const parsePart = (str) => {
    try {
      const parts = str.split("-");
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
      }
    } catch (e) {}
    return str;
  };
  return `${parsePart(startDate)} – ${parsePart(endDate)}`;
}

export function computeCycleBreakdown(lead, allLogs) {
  const currentCycle = lead.currentPackageCycle || 1;
  const totalClassesPerCycle = lead.totalClasses || 12;

  // Group logs by cycle (treating missing/null packageCycle as Cycle 1)
  const logsByCycle = {};
  allLogs.forEach((log) => {
    const c = log.packageCycle || 1;
    if (!logsByCycle[c]) logsByCycle[c] = [];
    logsByCycle[c].push(log);
  });

  const maxCycle = Math.max(
    currentCycle,
    ...Object.keys(logsByCycle).map(Number),
    ...(lead.packageHistory || []).map((p) => p.cycle || 1),
    1
  );

  const cycles = [];
  for (let c = 1; c <= maxCycle; c++) {
    const cycleLogs = logsByCycle[c] || [];
    cycleLogs.sort((a, b) => {
      const dComp = (a.date || "").localeCompare(b.date || "");
      if (dComp !== 0) return dComp;
      return new Date(a.timestamp || 0) - new Date(b.timestamp || 0);
    });

    const doneCount = cycleLogs.filter((l) => l.status === "Done").length;
    const missedCount = cycleLogs.filter((l) => l.status === "Missed").length;

    // Check archived history if available
    const historyEntry = (lead.packageHistory || []).find((h) => h.cycle === c);
    const scheduled = historyEntry?.totalClasses || totalClassesPerCycle;
    const remaining = Math.max(0, scheduled - doneCount);

    const isPastCycle = c < currentCycle;
    const isCompleted = isPastCycle || (doneCount >= scheduled && scheduled > 0);
    const status = isCompleted ? "Completed" : (c === currentCycle ? "Active" : "Upcoming");

    // Cycle date calculation
    let startDate = "";
    let endDate = "";

    if (cycleLogs.length > 0) {
      startDate = cycleLogs[0].date;
      if (isCompleted) {
        endDate = cycleLogs[cycleLogs.length - 1].date;
      } else {
        endDate = addOneMonth(startDate);
      }
    } else if (c === 1) {
      startDate = lead.demoDate || (lead.createdAt ? lead.createdAt.toISOString().split("T")[0] : "");
      endDate = startDate ? addOneMonth(startDate) : "";
    } else if (cycles[c - 2]?.endDate) {
      startDate = cycles[c - 2].endDate;
      endDate = addOneMonth(startDate);
    }

    cycles.push({
      cycleNumber: c,
      monthNumber: c,
      monthLabel: `Month ${c} (Cycle ${c})`,
      cycleName: `Month ${c}`,
      startDate,
      endDate,
      dateRangeDisplay: formatDateRange(startDate, endDate),
      totalScheduled: scheduled,
      completedCount: doneCount,
      missedCount,
      remainingCount: remaining,
      status,
      logs: cycleLogs,
    });
  }

  return cycles;
}

// =============================================================
// Helper: Get student card with authoritative multi-cycle status
// =============================================================
export async function formatStudentCard(lead) {
  const currentCycle = lead.currentPackageCycle || 1;
  const total = lead.totalClasses || 12;

  // Retrieve all attendance logs for this student/parent enquiry
  const allLogs = await Attendance.find({ parentEnquiryId: lead._id }).sort({ date: 1, timestamp: 1 });

  // Compute multi-cycle breakdown
  const cycles = computeCycleBreakdown(lead, allLogs);
  const activeCycleData = cycles.find((c) => c.cycleNumber === currentCycle) || cycles[cycles.length - 1];

  const completed = activeCycleData ? activeCycleData.completedCount : 0;
  const missed = activeCycleData ? activeCycleData.missedCount : 0;
  const remaining = activeCycleData ? activeCycleData.remainingCount : Math.max(0, total - completed);
  const packageStatus = activeCycleData ? (activeCycleData.status === "Completed" ? "completed" : "active") : "active";

  // Keep Lead document state in sync with single source of truth without erasing
  if (lead.completedClasses !== completed || lead.packageStatus !== packageStatus) {
    lead.completedClasses = completed;
    lead.packageStatus = packageStatus;
    await lead.save({ validateBeforeSave: false }).catch(() => {});
  }

  const latestLog = allLogs.length > 0 ? allLogs[allLogs.length - 1] : null;
  const studentName = lead.wards?.map((w) => w.studentName).join(", ") || "Unknown Student";

  return {
    _id: lead._id,
    studentName,
    tutorName: lead.assignedTutor || "Not Assigned",
    assignedTutorId: lead.assignedTutorId || null,
    requirementId: lead.requirementId || "REQ-N/A",
    totalClasses: total,
    completedClasses: completed,
    remainingClasses: remaining,
    missedClasses: missed,
    currentPackageCycle: currentCycle,
    currentMonthNumber: currentCycle,
    currentMonthLabel: activeCycleData?.monthLabel || `Month ${currentCycle}`,
    cycleStartDate: activeCycleData?.startDate || "",
    cycleEndDate: activeCycleData?.endDate || "",
    cycleDateRange: activeCycleData?.dateRangeDisplay || "",
    packageStatus,
    packageHistory: lead.packageHistory || [],
    cycles: cycles.map((c) => ({
      cycleNumber: c.cycleNumber,
      monthNumber: c.monthNumber,
      monthLabel: c.monthLabel,
      cycleName: c.cycleName,
      startDate: c.startDate,
      endDate: c.endDate,
      dateRangeDisplay: c.dateRangeDisplay,
      totalScheduled: c.totalScheduled,
      completedCount: c.completedCount,
      missedCount: c.missedCount,
      remainingCount: c.remainingCount,
      status: c.status,
    })),
    classSchedule: lead.classSchedule || lead.preferredTime || "Not Scheduled",
    classDuration: lead.classDuration || "Not provided",
    currentAttendanceStatus: latestLog ? latestLog.status : "Pending",
    latestLogDate: latestLog ? latestLog.date : null,
    latestLogTopics: latestLog ? latestLog.topicsCovered : "",
    leadStatus: lead.status,
  };
}

// =============================================================
// POST: Tutor Login (by tutorCode, email, or phone)
// =============================================================
router.post("/tutor-login", async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({ message: "Identifier (code, email, or phone) is required." });
    }

    const cleanIdentifier = String(identifier).trim();

    // Query tutor
    const tutor = await Tutor.findOne({
      $or: [
        { tutorCode: { $regex: new RegExp(`^${cleanIdentifier}$`, "i") } },
        { email: { $regex: new RegExp(`^${cleanIdentifier}$`, "i") } },
        { phone: { $regex: cleanIdentifier.slice(-10) } },
        { whatsapp: { $regex: cleanIdentifier.slice(-10) } },
      ],
    });

    if (!tutor) {
      return res.status(401).json({ message: "Tutor not found with the provided credentials." });
    }

    if (tutor.status !== "approved") {
      return res.status(403).json({ message: "Your tutor profile is pending approval or rejected." });
    }

    // Sign JWT token
    const token = jwt.sign(
      { id: tutor._id, name: tutor.name, role: "tutor" },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "30d" }
    );

    res.json({
      success: true,
      token,
      tutor: {
        id: tutor._id,
        name: tutor.name,
        tutorCode: tutor.tutorCode,
        email: tutor.email,
        phone: tutor.phone,
      },
    });
  } catch (error) {
    console.error("Tutor login error:", error);
    res.status(500).json({ message: error.message });
  }
});

// =============================================================
// GET: Tutor's Active Students
// =============================================================
router.get("/tutor/:tutorId/students", verifyToken(["admin", "tutor"]), async (req, res) => {
  try {
    const { tutorId } = req.params;

    // Retrieve active student parent enquiries for this tutor
    // Exclude cancelled/rejected/lost
    const activeLeads = await ParentEnquiry.find({
      assignedTutorId: tutorId,
      status: { $nin: ["Lost", "Rejected", "Demo Cancelled", "Cancelled"] },
    }).sort({ createdAt: -1 });

    const studentCards = await Promise.all(
      activeLeads.map(lead => formatStudentCard(lead))
    );

    res.json({ success: true, students: studentCards });
  } catch (error) {
    console.error("Fetch tutor students error:", error);
    res.status(500).json({ message: error.message });
  }
});

// =============================================================
// POST: Mark Attendance (Done / Missed) - Idempotent & Editable
// =============================================================
router.post("/mark", verifyToken(["admin", "tutor"]), async (req, res) => {
  try {
    const {
      parentEnquiryId,
      tutorId,
      status,
      topicsCovered,
      missedReason,
      customReason,
      date,
    } = req.body;

    if (!parentEnquiryId || !tutorId || !status || !date) {
      return res.status(400).json({ success: false, message: "Missing required fields (parentEnquiryId, tutorId, status, date)." });
    }

    if (status === "Done" && !topicsCovered?.trim()) {
      return res.status(400).json({ success: false, message: "Topics covered is required for completed classes." });
    }

    if (status === "Missed" && !missedReason?.trim()) {
      return res.status(400).json({ success: false, message: "Reason is required for missed classes." });
    }

    if (status === "Missed" && missedReason === "Other" && !customReason?.trim()) {
      return res.status(400).json({ success: false, message: "Custom reason description is required." });
    }

    // Fetch parent enquiry and tutor info
    const lead = await ParentEnquiry.findById(parentEnquiryId);
    if (!lead) return res.status(404).json({ success: false, message: "Student enquiry not found." });

    const tutor = await Tutor.findById(tutorId);
    if (!tutor) return res.status(404).json({ success: false, message: "Tutor not found." });

    const activeCycle = lead.currentPackageCycle || 1;
    const activeTotal = lead.totalClasses || 12;

    const cycleFilter = activeCycle === 1
      ? { $or: [{ packageCycle: 1 }, { packageCycle: { $exists: false } }, { packageCycle: null }] }
      : { packageCycle: activeCycle };

    // Check if an attendance record for this student and date already exists
    let existing = await Attendance.findOne({
      parentEnquiryId: lead._id,
      ...cycleFilter,
      date,
    });

    // Fallback search across student and date regardless of cycle
    if (!existing) {
      existing = await Attendance.findOne({
        parentEnquiryId: lead._id,
        date,
      });
    }

    let attendanceDoc = null;
    let isUpdate = false;

    if (existing) {
      // ── UPDATE EXISTING ATTENDANCE RECORD (NO FALSE SUCCESS, NO DUPLICATES) ──
      isUpdate = true;
      existing.status = status;
      if (status === "Done") {
        existing.topicsCovered = topicsCovered?.trim() || "";
        existing.missedReason = "";
        existing.customReason = "";
      } else if (status === "Missed") {
        existing.topicsCovered = "";
        existing.missedReason = missedReason || "";
        existing.customReason = missedReason === "Other" ? (customReason?.trim() || "") : "";
      }
      existing.tutorId = tutor._id;
      existing.tutorName = tutor.name;
      if (!existing.packageCycle) existing.packageCycle = activeCycle;
      existing.timestamp = new Date();

      if (!existing.externalAttendanceId) {
        existing.externalAttendanceId = `ATT-${existing._id}`;
      }
      if (!existing.websiteStudentId && lead.websiteStudentId) {
        existing.websiteStudentId = lead.websiteStudentId;
      }

      await existing.save();
      attendanceDoc = existing;
    } else {
      // ── CREATE NEW ATTENDANCE RECORD ─────────────────────────────
      isUpdate = false;
      const countInCycle = await Attendance.countDocuments({
        parentEnquiryId: lead._id,
        ...cycleFilter,
      });
      const sessionNumber = countInCycle + 1;

      attendanceDoc = new Attendance({
        parentEnquiryId: lead._id,
        studentName: lead.wards?.map((w) => w.studentName).join(", ") || "Unknown Student",
        requirementId: lead.requirementId || "REQ-N/A",
        websiteStudentId: lead.websiteStudentId || "",
        tutorId: tutor._id,
        tutorName: tutor.name,
        packageCycle: activeCycle,
        sessionNumber,
        status,
        topicsCovered: status === "Done" ? (topicsCovered?.trim() || "") : "",
        missedReason: status === "Missed" ? (missedReason || "") : "",
        customReason: status === "Missed" && missedReason === "Other" ? (customReason?.trim() || "") : "",
        date,
      });

      // Stable externalAttendanceId (uses MongoDB _id)
      if (!attendanceDoc.externalAttendanceId) {
        attendanceDoc.externalAttendanceId = `ATT-${attendanceDoc._id}`;
      }

      await attendanceDoc.save();
    }

    // Recalculate completed count for active cycle
    const newCompletedCount = await Attendance.countDocuments({
      parentEnquiryId: lead._id,
      ...cycleFilter,
      status: "Done",
    });

    let cycleNotice = "";
    if (newCompletedCount >= activeTotal && activeTotal > 0) {
      lead.completedClasses = activeTotal;
      lead.packageStatus = "completed";
      cycleNotice = ` Month ${activeCycle} is now completed (${newCompletedCount}/${activeTotal} classes)!`;
    } else {
      lead.completedClasses = newCompletedCount;
      lead.packageStatus = "active";
    }

    await lead.save({ validateBeforeSave: false });

    // Sync to Odoo (x_attendance_log, crm.lead summary, and Chatter) asynchronously
    syncAttendanceLogToOdoo({ log: attendanceDoc, lead, tutor, postChatter: true }).catch((odooErr) => {
      console.error("[Odoo Attendance Log Sync Error]:", odooErr.message);
    });
    syncLeadAttendanceSummaryToOdoo(lead, {
      cycleNumber: activeCycle,
      totalScheduled: activeTotal,
      completedCount: lead.completedClasses,
      remainingCount: Math.max(0, activeTotal - lead.completedClasses),
      status: lead.packageStatus,
      logs: [attendanceDoc],
    }).catch((odooErr) => {
      console.error("[Odoo Lead Summary Sync Error]:", odooErr.message);
    });

    const updatedCard = await formatStudentCard(lead);

    res.json({
      success: true,
      created: !isUpdate,
      updated: isUpdate,
      message: isUpdate
        ? `Attendance record updated successfully.${cycleNotice}`
        : `Attendance recorded successfully.${cycleNotice}`,
      session: {
        sessionNumber: attendanceDoc.sessionNumber,
        status: attendanceDoc.status,
        date: attendanceDoc.date,
      },
      package: {
        totalClasses: updatedCard.totalClasses,
        completedClasses: updatedCard.completedClasses,
        remainingClasses: updatedCard.remainingClasses,
        packageCycle: updatedCard.currentPackageCycle,
        status: updatedCard.packageStatus,
      },
      attendance: attendanceDoc,
      updatedStudentCard: updatedCard,
    });
  } catch (error) {
    console.error("Mark attendance error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =============================================================
// GET: Comprehensive Attendance History (all cycles)
// =============================================================
router.get("/history/:parentEnquiryId", async (req, res) => {
  try {
    const { parentEnquiryId } = req.params;
    const lead = await ParentEnquiry.findById(parentEnquiryId);
    if (!lead) return res.status(404).json({ message: "Student enquiry not found." });

    const allLogs = await Attendance.find({ parentEnquiryId }).sort({ date: 1, timestamp: 1 });
    const cycles = computeCycleBreakdown(lead, allLogs);

    res.json({
      success: true,
      currentCycle: lead.currentPackageCycle || 1,
      totalClassesPerCycle: lead.totalClasses || 12,
      packageHistory: lead.packageHistory || [],
      cycles,
      allLogs,
    });
  } catch (error) {
    console.error("Fetch history error:", error);
    res.status(500).json({ message: error.message });
  }
});

// =============================================================
// GET: Download CSV Attendance History
// =============================================================
router.get("/download-history/:parentEnquiryId", async (req, res) => {
  try {
    const { parentEnquiryId } = req.params;
    const cycleFilter = req.query.cycle; // 'all' or specific cycle number

    const lead = await ParentEnquiry.findById(parentEnquiryId);
    if (!lead) return res.status(404).json({ message: "Student enquiry not found." });

    const query = { parentEnquiryId };
    if (cycleFilter && cycleFilter !== "all" && !isNaN(Number(cycleFilter))) {
      const cNum = Number(cycleFilter);
      if (cNum === 1) {
        query.$or = [{ packageCycle: 1 }, { packageCycle: { $exists: false } }, { packageCycle: null }];
      } else {
        query.packageCycle = cNum;
      }
    }

    const logs = await Attendance.find(query).sort({ packageCycle: 1, sessionNumber: 1, timestamp: 1 });

    const studentName = lead.wards?.map((w) => w.studentName).join(", ") || "Student";
    const reqId = lead.requirementId || "REQ";

    let csvContent = "Cycle,Month,Class #,Date,Status,Student Name,Teacher,Requirement ID,Topics Covered / Reason\n";

    logs.forEach((log) => {
      const cycleNumber = log.packageCycle || 1;
      const cycleStr = `Cycle ${cycleNumber}`;
      const monthStr = `Month ${cycleNumber}`;
      const sessionStr = log.sessionNumber || 1;
      const dateStr = log.date || "";
      const statusStr = log.status || "";
      const sName = `"${(log.studentName || studentName).replace(/"/g, '""')}"`;
      const tName = `"${(log.tutorName || lead.assignedTutor || "").replace(/"/g, '""')}"`;
      const rId = `"${(log.requirementId || reqId).replace(/"/g, '""')}"`;

      let noteStr = "";
      if (log.status === "Done") {
        noteStr = log.topicsCovered || "";
      } else {
        noteStr = log.missedReason === "Other" ? (log.customReason || "Other") : (log.missedReason || "Missed");
      }
      noteStr = `"${noteStr.replace(/"/g, '""')}"`;

      csvContent += `${cycleStr},${monthStr},${sessionStr},${dateStr},${statusStr},${sName},${tName},${rId},${noteStr}\n`;
    });

    const filename = `Attendance_History_${reqId}_${cycleFilter ? `cycle_${cycleFilter}` : "all"}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error("Download history error:", error);
    res.status(500).json({ message: error.message });
  }
});

// =============================================================
// GET: Attendance logs for a specific student/enquiry
// =============================================================
router.get("/logs/:parentEnquiryId", verifyToken(["admin", "tutor"]), async (req, res) => {
  try {
    const { parentEnquiryId } = req.params;
    const lead = await ParentEnquiry.findById(parentEnquiryId);
    if (!lead) return res.status(404).json({ message: "Student enquiry not found." });

    const allLogs = await Attendance.find({ parentEnquiryId }).sort({ date: 1, timestamp: 1 });
    const cycles = computeCycleBreakdown(lead, allLogs);
    const card = await formatStudentCard(lead);

    res.json({
      success: true,
      logs: [...allLogs].reverse(), // newest first
      cycles,
      card,
    });
  } catch (error) {
    console.error("Fetch attendance logs error:", error);
    res.status(500).json({ message: error.message });
  }
});

// =============================================================
// POST: Parent Login / Search (by phone number) - Normalized & Multi-Enquiry
// =============================================================
router.post("/parent-login", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ message: "Phone number is required." });
    }

    // Normalize phone number: extract all digits
    const digits = String(phone).replace(/\D/g, "");
    if (digits.length < 5) {
      return res.status(400).json({ message: "Please enter a valid phone number." });
    }
    const last10 = digits.slice(-10);
    // Flexible regex allowing spaces/hyphens/dots between digits
    const flexiblePattern = last10.split("").join("[\\s\\-\\.]*");

    const enquiries = await ParentEnquiry.find({
      $or: [
        { phone: { $regex: last10 } },
        { phone: { $regex: flexiblePattern } },
      ],
    }).sort({ createdAt: -1 });

    if (!enquiries.length) {
      return res.status(404).json({ message: "No active student enquiry found for this phone number." });
    }

    // Sort enquiries: active tuitions (with assigned tutor or attendance) prioritized first
    const sortedEnquiries = [...enquiries].sort((a, b) => {
      const aHasTutor = Boolean(a.assignedTutor || a.assignedTutorId);
      const bHasTutor = Boolean(b.assignedTutor || b.assignedTutorId);
      if (aHasTutor && !bHasTutor) return -1;
      if (!aHasTutor && bHasTutor) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Format cards and retrieve history with cycles
    const results = await Promise.all(
      sortedEnquiries.map(async (lead) => {
        const allLogs = await Attendance.find({ parentEnquiryId: lead._id }).sort({ date: 1, timestamp: 1 });
        const cycles = computeCycleBreakdown(lead, allLogs);
        const card = await formatStudentCard(lead);
        return {
          card,
          cycles,
          logs: [...allLogs].reverse(),
        };
      })
    );

    res.json({ success: true, results });
  } catch (error) {
    console.error("Parent login error:", error);
    res.status(500).json({ message: error.message });
  }
});

// =============================================================
// GET: Admin Alerts (Self-healing list of notifications)
// =============================================================
router.get("/admin-alerts", verifyToken(["admin"]), async (req, res) => {
  try {
    const alerts = [];

    // Condition 1: If a teacher has missed more than two classes in total
    const missedAggregation = await Attendance.aggregate([
      { $match: { status: "Missed" } },
      {
        $group: {
          _id: { tutorId: "$tutorId", tutorName: "$tutorName" },
          missedCount: { $sum: 1 },
        },
      },
      { $match: { missedCount: { $gt: 2 } } },
    ]);

    missedAggregation.forEach((item) => {
      alerts.push({
        id: `missed-${item._id.tutorId}`,
        type: "missed_classes",
        message: `Teacher ${item._id.tutorName} has missed more than two classes (${item.missedCount} missed).`,
        tutorId: item._id.tutorId,
        tutorName: item._id.tutorName,
        count: item.missedCount,
        severity: "high",
      });
    });

    // Condition 2: Payment reminders at >= 90% completion
    const activeLeads = await ParentEnquiry.find({
      status: {
        $in: [
          "New Lead",
          "Fees Finalized",
          "Demo Scheduled",
          "Feedback Pending",
          "Enrolled",
          "Won",
        ],
      },
      totalClasses: { $gt: 0 },
    })
      .select("_id requirementId wards completedClasses totalClasses")
      .lean();

    activeLeads.forEach((lead) => {
      const completed = lead.completedClasses || 0;
      const total = lead.totalClasses || 12;
      const ratio = completed / total;
      if (ratio >= 0.9 && completed > 0) {
        alerts.push({
          id: `payment-${lead._id}`,
          type: "payment_reminder",
          message: `Requirement ${lead.requirementId || "REQ-N/A"} (${lead.wards?.map(w => w.studentName).join(", ") || "Unknown Student"}) has completed ${Math.round(ratio * 100)}% of scheduled classes. Payment review is recommended.`,
          parentEnquiryId: lead._id,
          requirementId: lead.requirementId,
          completed,
          total,
          severity: "medium",
        });
      }
    });

    res.json({ success: true, alerts });
  } catch (error) {
    console.error("Fetch admin alerts error:", error);
    res.status(500).json({ message: error.message });
  }
});

// =============================================================
// PUT: Update tuition details / Start New Package Cycle (Admin only)
// =============================================================
router.put("/update-tuition/:id", verifyToken(["admin"]), async (req, res) => {
  try {
    const { classDuration, totalClasses, classSchedule, completedClasses, startNewCycle } = req.body;
    const lead = await ParentEnquiry.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: "Student enquiry not found." });

    if (startNewCycle) {
      // Calculate actual completed count from DB for the cycle being archived
      const currentCycle = lead.currentPackageCycle || 1;
      const cycleFilter = currentCycle === 1
        ? { $or: [{ packageCycle: 1 }, { packageCycle: { $exists: false } }, { packageCycle: null }] }
        : { packageCycle: currentCycle };
      const actualDoneCount = await Attendance.countDocuments({
        parentEnquiryId: lead._id,
        ...cycleFilter,
        status: "Done",
      });

      // Archive current cycle into packageHistory with accurate completed count
      if (!lead.packageHistory) lead.packageHistory = [];
      lead.packageHistory.push({
        cycle: currentCycle,
        totalClasses: lead.totalClasses || 12,
        completedClasses: actualDoneCount || lead.completedClasses || 0,
        completedAt: new Date(),
      });

      // Increment cycle, activate next cycle
      lead.currentPackageCycle = currentCycle + 1;
      lead.completedClasses = 0;
      lead.packageStatus = "active";
      if (totalClasses !== undefined && totalClasses > 0) {
        lead.totalClasses = totalClasses;
      }
      if (classDuration !== undefined) lead.classDuration = classDuration;
      if (classSchedule !== undefined) lead.classSchedule = classSchedule;
    } else {
      if (classDuration !== undefined) lead.classDuration = classDuration;
      if (totalClasses !== undefined && totalClasses > 0) lead.totalClasses = totalClasses;
      if (classSchedule !== undefined) lead.classSchedule = classSchedule;
      if (completedClasses !== undefined) {
        lead.completedClasses = completedClasses;
        lead.packageStatus = completedClasses >= (lead.totalClasses || 12) ? "completed" : "active";
      }
    }

    await lead.save({ validateBeforeSave: false });

    // Sync to Odoo
    syncLeadAttendanceSummaryToOdoo(lead).catch((odooErr) => {
      console.error("[Odoo sync error during manual update]:", odooErr.message);
    });

    const card = await formatStudentCard(lead);
    res.json({ success: true, studentCard: card });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// =============================================================
// DELETE: Delete an attendance log (Admin only)
// =============================================================
router.delete("/log/:logId", verifyToken(["admin"]), async (req, res) => {
  try {
    const log = await Attendance.findById(req.params.logId);
    if (!log) return res.status(404).json({ message: "Log not found." });

    const parentEnquiryId = log.parentEnquiryId;
    const logCycle = log.packageCycle || 1;
    const odooAttId = log.odooAttendanceId;

    await Attendance.findByIdAndDelete(req.params.logId);

    // If synced to Odoo, delete from Odoo x_attendance_log
    if (odooAttId) {
      deleteOdooAttendanceLog(odooAttId).catch((odooErr) => {
        console.error("[Odoo Delete Log Error]:", odooErr.message);
      });
    }

    // Recalculate Completed Classes count
    const lead = await ParentEnquiry.findById(parentEnquiryId);
    if (lead) {
      const activeCycle = lead.currentPackageCycle || 1;
      if (logCycle === activeCycle) {
        const completedCount = await Attendance.countDocuments({
          parentEnquiryId,
          packageCycle: activeCycle,
          status: "Done",
        });
        lead.completedClasses = Math.min(lead.totalClasses || 12, completedCount);
        lead.packageStatus = lead.completedClasses >= (lead.totalClasses || 12) ? "completed" : "active";
        await lead.save({ validateBeforeSave: false });

        syncLeadAttendanceSummaryToOdoo(lead).catch((odooErr) => {
          console.error("[Odoo Sync Error after delete log]:", odooErr.message);
        });
      }
    }

    res.json({ success: true, message: "Attendance log deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// =============================================================
// PUT: Update an attendance log (Admin only)
// =============================================================
router.put("/log/:logId", verifyToken(["admin"]), async (req, res) => {
  try {
    const { status, date, topicsCovered, missedReason, customReason } = req.body;
    const log = await Attendance.findById(req.params.logId);
    if (!log) return res.status(404).json({ message: "Log not found." });

    if (status) log.status = status;
    if (date) log.date = date;
    if (status === "Done") {
      log.topicsCovered = topicsCovered || "";
      log.missedReason = "";
      log.customReason = "";
    } else if (status === "Missed") {
      log.topicsCovered = "";
      log.missedReason = missedReason || "";
      log.customReason = customReason || "";
    }

    if (!log.externalAttendanceId) {
      log.externalAttendanceId = `ATT-${log._id}`;
    }

    const parentEnquiryId = log.parentEnquiryId;
    const lead = await ParentEnquiry.findById(parentEnquiryId);
    if (!log.websiteStudentId && lead?.websiteStudentId) {
      log.websiteStudentId = lead.websiteStudentId;
    }

    await log.save();

    // Sync updated log to Odoo Community asynchronously (non-blocking)
    syncAttendanceLogToOdoo({ log, lead, tutor: null, postChatter: true }).catch((odooErr) => {
      console.error("[Odoo Sync Error after update log]:", odooErr.message);
    });

    if (lead) {
      const activeCycle = lead.currentPackageCycle || 1;
      const logCycle = log.packageCycle || 1;
      if (logCycle === activeCycle) {
        const cycleFilter = activeCycle === 1
          ? {
              parentEnquiryId,
              status: "Done",
              $or: [{ packageCycle: 1 }, { packageCycle: { $exists: false } }, { packageCycle: null }]
            }
          : { parentEnquiryId, packageCycle: activeCycle, status: "Done" };
        const completedCount = await Attendance.countDocuments(cycleFilter);
        lead.completedClasses = completedCount;
        lead.packageStatus = lead.completedClasses >= (lead.totalClasses || 12) ? "completed" : "active";
        await lead.save({ validateBeforeSave: false });

        syncLeadAttendanceSummaryToOdoo(lead).catch((odooErr) => {
          console.error("[Odoo Lead Summary Sync Error after log edit]:", odooErr.message);
        });
      }
    }

    res.json({ success: true, log });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// =============================================================
// POST: Batch Sync all Attendance & Leads to Odoo (Admin only)
// =============================================================
router.post("/sync-all-to-odoo", verifyToken(["admin"]), async (req, res) => {
  try {
    const leads = await ParentEnquiry.find({
      status: { $nin: ["Lost", "Rejected", "Demo Cancelled", "Cancelled"] },
    });

    let totalSyncedLogs = 0;
    let totalSyncedLeads = 0;
    let failedCount = 0;

    for (const lead of leads) {
      try {
        const allLogs = await Attendance.find({ parentEnquiryId: lead._id }).sort({ date: 1, sessionNumber: 1 });
        const cycles = computeCycleBreakdown(lead, allLogs);
        const activeCycle = lead.currentPackageCycle || 1;
        const activeCycleData = cycles.find((c) => c.cycleNumber === activeCycle) || cycles[cycles.length - 1];

        // 1. Sync lead summary
        const summaryOk = await syncLeadAttendanceSummaryToOdoo(lead, activeCycleData);
        if (summaryOk) totalSyncedLeads++;

        // 2. Sync individual logs (postChatter: false during bulk to prevent flood, logs are preserved in x_attendance_log)
        for (const log of allLogs) {
          try {
            const syncRes = await syncAttendanceLogToOdoo({ log, lead, tutor: null, postChatter: false });
            if (syncRes && syncRes.success) {
              totalSyncedLogs++;
            } else {
              failedCount++;
            }
          } catch (e) {
            failedCount++;
          }
        }
      } catch (leadErr) {
        console.error(`[Batch Sync Error for lead ${lead._id}]:`, leadErr.message);
        failedCount++;
      }
    }

    res.json({
      success: true,
      message: `Batch sync complete: ${totalSyncedLeads} student leads and ${totalSyncedLogs} attendance logs synced to Odoo.`,
      stats: {
        syncedLeads: totalSyncedLeads,
        syncedLogs: totalSyncedLogs,
        failedCount,
      },
    });
  } catch (err) {
    console.error("Batch sync to Odoo failed:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =============================================================
// POST: Sync single Lead & all its logs to Odoo (Admin only)
// =============================================================
router.post("/sync-lead-to-odoo/:leadId", verifyToken(["admin"]), async (req, res) => {
  try {
    const lead = await ParentEnquiry.findById(req.params.leadId);
    if (!lead) return res.status(404).json({ success: false, message: "Student enquiry not found." });

    const allLogs = await Attendance.find({ parentEnquiryId: lead._id }).sort({ date: 1, sessionNumber: 1 });
    const cycles = computeCycleBreakdown(lead, allLogs);
    const activeCycle = lead.currentPackageCycle || 1;
    const activeCycleData = cycles.find((c) => c.cycleNumber === activeCycle) || cycles[cycles.length - 1];

    // Sync summary
    await syncLeadAttendanceSummaryToOdoo(lead, activeCycleData);

    // Sync all logs
    let syncedLogs = 0;
    for (const log of allLogs) {
      await syncAttendanceLogToOdoo({ log, lead, tutor: null, postChatter: false });
      syncedLogs++;
    }

    res.json({
      success: true,
      message: `Synced ${lead.wards?.[0]?.studentName || lead.parentName} to Odoo with ${syncedLogs} attendance log(s).`,
      odooLeadId: lead.odooLeadId,
      syncedLogs,
    });
  } catch (err) {
    console.error("Single lead sync to Odoo failed:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =============================================================
// POST: Retry sync single attendance log to Odoo Community
// POST /api/attendance/retry-sync/:logId
// =============================================================
router.post("/retry-sync/:logId", verifyToken(["admin"]), async (req, res) => {
  try {
    const log = await Attendance.findById(req.params.logId);
    if (!log) return res.status(404).json({ success: false, message: "Attendance log not found." });

    const lead = await ParentEnquiry.findById(log.parentEnquiryId);
    const tutor = log.tutorId ? await Tutor.findById(log.tutorId) : null;

    const result = await syncAttendanceLogToOdoo({ log, lead, tutor });

    res.json({
      success: result.success,
      externalAttendanceId: result.externalAttendanceId,
      websiteStudentId: result.websiteStudentId,
      odooSyncStatus: log.odooSyncStatus,
      odooAttendanceId: log.odooAttendanceId,
      error: result.error,
    });
  } catch (err) {
    const cleanError = err.message.replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, "Bearer [MASKED]");
    res.status(500).json({ success: false, message: cleanError });
  }
});

export default router;
