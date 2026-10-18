import ParentEnquiry from "../models/ParentEnquiry.js";
import Tutor from "../models/Tutor.js";
import BroadcastLog from "../models/BroadcastLog.js";
import Attendance from "../models/Attendance.js";
import { sendWhatsAppToTutor } from "./whatsappService.js";
import { broadcastService, RETRYABLE_FAILURE_REASONS } from "./broadcastService.js";
import { startSyncScheduler } from "./syncService.js";
import { syncAttendanceLogToOdoo } from "./odooService.js";
import {
  withStudentLock,
  todayIST,
  cycleFilterFor,
  currentCycleEndDate,
  completeCycle,
} from "./packageCycle.js";
import { usualClassTime } from "./classTime.js";
import {
  scheduledDayIndexes,
  dayOfWeek,
  previousClassDates,
  isWarningTime,
  nowMinutesIST,
  buildMissedClassWarningMessage,
} from "./missedClassWarning.js";

const MAX_RETRY_COUNT = Number(process.env.RETRY_COUNT || 3);
const MISSED_CLASS_TEMPLATE_NAME = process.env.WHATSAPP_MISSED_CLASS_TEMPLATE_NAME || "tutor_attendance_not_marked";

// ─────────────────────────────────────────────────────────────────────────────
// Attendance Reminder Scheduler
// ─────────────────────────────────────────────────────────────────────────────

// Helper to parse time strings (e.g. "19:00", "7:00 PM") to minutes since midnight
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  
  // Format: "19:00"
  let match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    return parseInt(match[1]) * 60 + parseInt(match[2]);
  }
  
  // Format: "7:00 PM"
  match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const ampm = match[3].toUpperCase();
    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  
  return null;
}

// Fallback email sender (logs to console/logs as fallback)
async function sendEmailReminder(tutor, lead) {
  const teacherName = tutor.name || "Teacher";
  const recipient = tutor.email || "no-email@saraswatitutorial.com";
  
  console.log(`[Email Fallback] Dispatching email reminder to ${recipient} for tutor ${teacherName}`);
  console.log(`Subject: Saraswati Tutorials Attendance Reminder`);
  console.log(`Body: Hello ${teacherName}, Your scheduled class has ended. Please update today's attendance in the portal.`);
  return true;
}

export async function checkAndSendAttendanceReminders() {
  try {
    const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const shortDaysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    
    // YYYY-MM-DD and time of day in India (the server clock may be UTC)
    const todayDateStr = todayIST();
    const currentMinutes = nowMinutesIST();
    const todayIndex = dayOfWeek(todayDateStr);
    const todayName = daysOfWeek[todayIndex];
    const todayShortName = shortDaysOfWeek[todayIndex];

    // Fetch active enquiries with assigned tutors
    const enquiries = await ParentEnquiry.find({
      status: { $in: ["Enrolled", "Won", "Demo Scheduled"] },
      assignedTutorId: { $ne: null },
      lastReminderSentDate: { $ne: todayDateStr },
    });

    for (const lead of enquiries) {
      // 1. Verify if today is a scheduled day
      const preferredDays = Array.isArray(lead.preferredDays) ? lead.preferredDays : [];
      const scheduleString = String(lead.classSchedule || "").toLowerCase();
      
      const isTodayScheduled = 
        preferredDays.some(d => String(d).toLowerCase() === todayName.toLowerCase() || String(d).toLowerCase() === todayShortName.toLowerCase()) ||
        scheduleString.includes(todayName.toLowerCase()) || 
        scheduleString.includes(todayShortName.toLowerCase());

      if (!isTodayScheduled) continue;

      // 2. Parse class end time
      let classEndTime = lead.endTime || "";
      if (!classEndTime && lead.classSchedule) {
        // Try parsing from classSchedule string (e.g. "Mon, Wed, Fri @ 5 PM - 7 PM" or "5:00 PM - 7:00 PM")
        const timePartMatch = lead.classSchedule.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?\s*-\s*(\d{1,2}):?(\d{2})?\s*(AM|PM)/i);
        if (timePartMatch) {
          classEndTime = `${timePartMatch[4]}:${timePartMatch[5] || "00"} ${timePartMatch[6]}`;
        }
      }

      if (!classEndTime) continue;

      const endTimeMinutes = parseTimeToMinutes(classEndTime);
      if (endTimeMinutes === null) continue;

      // Check if current time is exactly 15 to 25 minutes after the class ended
      if (currentMinutes >= endTimeMinutes + 15 && currentMinutes <= endTimeMinutes + 25) {
        // Query Attendance model to see if attendance was already marked today
        const existingAttendance = await Attendance.findOne({
          parentEnquiryId: lead._id,
          tutorId: lead.assignedTutorId,
          date: todayDateStr,
        });

        if (existingAttendance) {
          console.log(`[Reminder System] Attendance already marked for Lead ID: ${lead._id} on ${todayDateStr}. Skipping reminder.`);
          lead.lastReminderSentDate = todayDateStr;
          await lead.save({ validateBeforeSave: false });
          continue;
        }

        const tutor = await Tutor.findById(lead.assignedTutorId);
        if (!tutor) continue;

        const teacherName = tutor.name || "Teacher";
        const phoneNumber = tutor.whatsapp || tutor.phone || "";
        const messageBody = `Hello ${teacherName}\n\nYour scheduled class has ended.\n\nPlease update today's attendance in the Saraswati Tutorials Teacher Portal.\n\nThank you.`;

        console.log(`[Reminder System] Triggering attendance reminder for ${teacherName} (Lead ID: ${lead._id})`);
        
        let sentSuccessfully = false;

        // Try WhatsApp primary
        if (phoneNumber) {
          try {
            const result = await sendWhatsAppToTutor({
              phoneNumber,
              messageBody,
              templateVars: { tutor_name: teacherName },
            });
            sentSuccessfully = result.success;
            if (!sentSuccessfully) {
              console.warn(`[Reminder System] WhatsApp dispatch failed: ${result.failureReason}`);
            }
          } catch (wsErr) {
            console.error(`[Reminder System] WhatsApp error:`, wsErr.message);
          }
        }

        // Fallback to Email if WhatsApp failed
        if (!sentSuccessfully) {
          console.log(`[Reminder System] WhatsApp delivery failed or unavailable. Falling back to Email.`);
          await sendEmailReminder(tutor, lead);
        }

        // Log execution to prevent duplicate notifications
        lead.lastReminderSentDate = todayDateStr;
        await lead.save({ validateBeforeSave: false });
      }
    }
  } catch (err) {
    console.error(`[Reminder System Error]:`, err.message);
  }
}

/**
 * On the morning of a class day, warn the tutor on WhatsApp if attendance was not
 * marked for the last two scheduled classes of that student (see missedClassWarning.js).
 */
let missedClassWarningsRunning = false;
export async function checkMissedClassWarnings() {
  // A slow WhatsApp send must not let the next minute's run pick up the same students
  if (missedClassWarningsRunning) return;
  missedClassWarningsRunning = true;

  try {
    const today = todayIST();
    const nowMinutes = nowMinutesIST();

    const leads = await ParentEnquiry.find({
      status: { $in: ["Enrolled", "Won"] },
      assignedTutorId: { $ne: null },
      missWarningSentDate: { $ne: today },
    });

    for (const lead of leads) {
      const dayIndexes = scheduledDayIndexes(lead);
      if (!dayIndexes.has(dayOfWeek(today))) continue;
      if (!isWarningTime(nowMinutes, usualClassTime(lead).start)) continue;

      const [lastDate, earlierDate] = previousClassDates(today, dayIndexes, 2);
      if (!earlierDate) continue;

      // Only once classes with this tutor have started (a newly assigned tutor has no history yet)
      const firstLog = await Attendance.findOne({ parentEnquiryId: lead._id, tutorId: lead.assignedTutorId })
        .sort({ date: 1 })
        .select("date")
        .lean();
      if (!firstLog || firstLog.date > earlierDate) continue;

      const logs = await Attendance.find({
        parentEnquiryId: lead._id,
        date: { $gte: earlierDate, $lt: today },
      }).lean();

      // Any class done since then (e.g. a rescheduled class) means the tutor is attending
      if (logs.some((l) => l.status === "Done")) continue;

      // Warn only when attendance was not marked at all on both class days
      if (logs.some((l) => l.date === lastDate || l.date === earlierDate)) continue;

      // Mark first so a failed send isn't repeated every minute
      await ParentEnquiry.updateOne({ _id: lead._id }, { missWarningSentDate: today });

      const tutor = await Tutor.findById(lead.assignedTutorId);
      const phoneNumber = tutor?.whatsapp || tutor?.phone || "";
      if (!phoneNumber) {
        console.warn(`[Missed Class Warning] No WhatsApp number for tutor of Lead ID: ${lead._id}. Skipping.`);
        continue;
      }

      const teacherName = tutor.name || "Teacher";
      const studentName = lead.wards?.map((w) => w.studentName).filter(Boolean).join(", ") || "your student";
      console.log(`[Missed Class Warning] ${teacherName} did not mark attendance on ${earlierDate} and ${lastDate} for ${studentName} (Lead ID: ${lead._id}). Sending warning.`);

      try {
        const result = await sendWhatsAppToTutor({
          phoneNumber,
          messageBody: buildMissedClassWarningMessage(teacherName, studentName),
          templateName: MISSED_CLASS_TEMPLATE_NAME,
          // Order matters: {{1}} = tutor name, {{2}} = student name
          templateVars: { tutor_name: teacherName, student_name: studentName },
          // Always the approved template (wording is edited in Odoo), even
          // inside the 24-hour chat window.
          forceTemplate: true,
        });
        if (result.success) {
          console.log(`[Missed Class Warning] Sent to ${teacherName} (${phoneNumber}).`);
        } else {
          console.warn(`[Missed Class Warning] WhatsApp dispatch failed for ${teacherName}: ${result.failureReason}`);
        }
      } catch (wsErr) {
        console.error(`[Missed Class Warning] WhatsApp error:`, wsErr.message);
      }
    }
  } catch (err) {
    console.error(`[Missed Class Warning Error]:`, err.message);
  } finally {
    missedClassWarningsRunning = false;
  }
}

/**
 * Check for student packages with exactly 1 class remaining and alert Admin.
 */
export async function checkPackageCompletionAlerts() {
  try {
    const leads = await ParentEnquiry.find({
      status: { $in: ["Enrolled", "Won"] },
      totalClasses: { $ne: null, $gt: 0 },
    });

    for (const lead of leads) {
      const remaining = lead.totalClasses - lead.completedClasses;
      if (remaining === 1) {
        if (lead.packageAlertSentForTotal !== lead.totalClasses) {
          const studentName = lead.wards?.map(w => w.studentName).join(", ") || "Unknown Student";
          const adminAlertMsg = `[ADMIN ALERT] package completion threshold reached: Student "${studentName}" (Lead ID: ${lead._id}, Req: ${lead.requirementId || "N/A"}) has exactly 1 class remaining out of ${lead.totalClasses} total classes. Please initiate renewal processes.`;
          console.warn(adminAlertMsg);

          lead.packageAlertSentForTotal = lead.totalClasses;
          await lead.save({ validateBeforeSave: false });
        }
      }
    }
  } catch (err) {
    console.error(`[Package Completion Alert Error]:`, err.message);
  }
}

/**
 * Check for student packages with exactly 0 classes remaining and alert Parent via WhatsApp.
 */
export async function checkParentRenewalReminders() {
  try {
    const leads = await ParentEnquiry.find({
      status: { $in: ["Enrolled", "Won"] },
      totalClasses: { $ne: null, $gt: 0 },
    });

    for (const lead of leads) {
      const remaining = lead.totalClasses - lead.completedClasses;
      // A completed cycle that auto-started the next one has already reset the counter,
      // so its numbers come from the archived cycle instead
      const archived = lead.packageHistory?.[lead.packageHistory.length - 1];
      const archivedPending = archived?.renewalReminderPending === true;
      if (remaining <= 0 || archivedPending) {
        if (archivedPending || lead.renewalReminderSentForTotal !== lead.totalClasses) {
          const completedClasses = archivedPending ? archived.completedClasses : lead.completedClasses;
          const totalClasses = archivedPending ? archived.totalClasses : lead.totalClasses;
          const studentName = lead.wards?.map(w => w.studentName).join(", ") || "Unknown Student";
          const parentName = lead.parentName || "Parent";
          const phoneNumber = lead.phone;

          const messageBody = `Dear ${parentName},\n\nThis is a friendly reminder that the current tutoring package for ${studentName} has been completed (${completedClasses}/${totalClasses} classes completed).\n\nTo ensure uninterrupted sessions, please process the package renewal payment. Let us know if you need any assistance.\n\nThank you,\nSaraswati Tutorials`;

          console.log(`[Renewal Reminder] Sending renewal message to Parent: ${parentName} (${phoneNumber})`);

          let sentSuccessfully = false;
          if (phoneNumber) {
            try {
              const result = await sendWhatsAppToTutor({
                phoneNumber,
                messageBody,
                templateVars: { parent_name: parentName, student_name: studentName },
                forceTemplate: false,
              });
              sentSuccessfully = result.success;
              if (!sentSuccessfully) {
                console.warn(`[Renewal Reminder] WhatsApp dispatch failed: ${result.failureReason}`);
              }
            } catch (wsErr) {
              console.error(`[Renewal Reminder] WhatsApp error:`, wsErr.message);
            }
          }

          if (archivedPending) archived.renewalReminderPending = false;
          else lead.renewalReminderSentForTotal = lead.totalClasses;
          await lead.save({ validateBeforeSave: false });
        }
      }
    }
  } catch (err) {
    console.error(`[Parent Renewal Reminder Error]:`, err.message);
  }
}

/**
 * 1 cycle = 1 month. Once a day, start the next cycle for students whose current
 * cycle's month is over (cycles that finish early by classes advance in /attendance/mark).
 */
let lastCycleRolloverDay = "";
export async function checkMonthlyCycleRollover() {
  const today = todayIST();
  if (lastCycleRolloverDay === today) return;
  lastCycleRolloverDay = today;

  try {
    const leads = await ParentEnquiry.find({
      assignedTutorId: { $ne: null },
      status: { $nin: ["Lost", "Rejected", "Demo Cancelled", "Cancelled"] },
    }).select("_id");

    for (const { _id } of leads) {
      await withStudentLock(String(_id), async () => {
        const lead = await ParentEnquiry.findById(_id);
        if (!lead) return;
        const endedCycle = lead.currentPackageCycle || 1;
        const doneCount = await Attendance.countDocuments({
          parentEnquiryId: lead._id,
          ...cycleFilterFor(endedCycle),
          status: "Done",
        });
        const isFull = doneCount >= (lead.totalClasses || 12);
        const monthEnd = await currentCycleEndDate(lead);
        const monthOver = monthEnd && today > monthEnd;
        if (!isFull && !monthOver) return;

        const nextCycle = await completeCycle(lead, doneCount);
        console.log(`[Cycle Rollover] Lead ${lead._id}: Month ${endedCycle} ${isFull ? "completed" : `ended on ${monthEnd}`} (${doneCount} classes done) → Month ${nextCycle} started.`);
      });
    }
  } catch (err) {
    console.error(`[Cycle Rollover Error]:`, err.message);
  }
}

// Start Background Interval (runs every 60 seconds)
export function startReminderScheduler() {
  console.log(`[Reminder System] Starting automated attendance check daemon...`);
  setInterval(() => {
    checkAndSendAttendanceReminders();
    checkMissedClassWarnings();
    checkPackageCompletionAlerts();
    checkParentRenewalReminders();
    checkMonthlyCycleRollover();
  }, 60 * 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry Scheduler — runs every 5 minutes, retries only TRANSIENT failures
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run one batch of retries for failed broadcasts.
 * Only retries TRANSIENT failures (Timeout, Network Error, Server Error, Rate Limited).
 * Never retries PERMANENT failures (Invalid Number, Blocked, Template Missing, etc.).
 */
async function runRetryBatch() {
  try {
    const failedLogs = await BroadcastLog.find({
      status: "Failed",
      retryCount: { $lt: MAX_RETRY_COUNT },
      failureReason: { $in: RETRYABLE_FAILURE_REASONS },
    })
      .sort({ time: 1 }) // oldest first
      .limit(50);        // max 50 per batch to prevent overload

    if (failedLogs.length === 0) return;

    console.log(`[Retry Scheduler] Processing ${failedLogs.length} retryable failed broadcasts`);

    for (const log of failedLogs) {
      await broadcastService.retryLog(log);
    }

    console.log(`[Retry Scheduler] ✅ Batch complete`);
  } catch (err) {
    console.error(`[Retry Scheduler] Batch error:`, err.message);
  }
}

/**
 * Run one batch of retries for failed or pending attendance synchronizations.
 * Checks for records where odooSyncStatus is 'failed' or 'pending' within the last 48 hours.
 */
async function runAttendanceRetryBatch() {
  try {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const unsyncedLogs = await Attendance.find({
      odooSyncStatus: { $in: ["failed", "pending"] },
      createdAt: { $gte: twoDaysAgo },
    })
      .sort({ updatedAt: 1 })
      .limit(20);

    if (unsyncedLogs.length === 0) return;

    console.log(`[Attendance Retry Scheduler] Retrying ${unsyncedLogs.length} unsynced attendance record(s)...`);

    for (const log of unsyncedLogs) {
      try {
        const lead = await ParentEnquiry.findById(log.parentEnquiryId);
        const tutor = log.tutorId ? await Tutor.findById(log.tutorId) : null;
        await syncAttendanceLogToOdoo({ log, lead, tutor, postChatter: false });
      } catch (retryErr) {
        console.warn(`[Attendance Retry Scheduler] Retry failed for log ${log._id}:`, retryErr.message);
      }
    }
  } catch (err) {
    console.error(`[Attendance Retry Scheduler] Batch error:`, err.message);
  }
}

/**
 * Start the 5-minute retry scheduler for failed broadcasts and attendance synchronizations.
 * Picks up transient failures that were not retried inline.
 */
export function startRetryScheduler() {
  const intervalMs = 5 * 60 * 1000; // 5 minutes
  console.log("[Retry Scheduler] Starting — runs every 5 minutes");

  setInterval(() => {
    runRetryBatch().catch((err) =>
      console.error("[Retry Scheduler] Unhandled broadcast retry error:", err.message)
    );
    runAttendanceRetryBatch().catch((err) =>
      console.error("[Retry Scheduler] Unhandled attendance retry error:", err.message)
    );
  }, intervalMs);
}

// Re-export sync scheduler so server.js only needs to import from one file
export { startSyncScheduler };
