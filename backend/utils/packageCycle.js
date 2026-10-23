// Package cycles: 1 cycle = 1 month of classes for a student (ParentEnquiry).
// A cycle ends when all its classes are marked Done, or when its month is over
// (month = first class date → one month later), whichever comes first.
// The next cycle then starts automatically.

import Attendance from "../models/Attendance.js";

// Work for the same student runs one at a time (attendance marking and the
// daily rollover), so a cycle can't be closed twice and skip a month.
const studentLocks = new Map();
export async function withStudentLock(key, task) {
  const previous = studentLocks.get(key) || Promise.resolve();
  const run = previous.then(task);
  const tail = run.catch(() => {});
  studentLocks.set(key, tail);
  try {
    return await run;
  } finally {
    if (studentLocks.get(key) === tail) studentLocks.delete(key);
  }
}

// "2026-10-05" → "2026-11-04" (last day of a one-month cycle)
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

// Today as "YYYY-MM-DD" in India time (attendance dates are local dates)
export function todayIST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

// Attendance query for one cycle (logs without packageCycle belong to Cycle 1)
export function cycleFilterFor(cycle) {
  return cycle === 1
    ? { $or: [{ packageCycle: 1 }, { packageCycle: { $exists: false } }, { packageCycle: null }] }
    : { packageCycle: cycle };
}

// Last day of the current cycle's month, or "" if no class is logged in it yet
// (an empty cycle hasn't started, so it never runs out)
export async function currentCycleEndDate(lead) {
  const first = await Attendance.findOne({
    parentEnquiryId: lead._id,
    ...cycleFilterFor(lead.currentPackageCycle || 1),
  })
    .sort({ date: 1 })
    .select("date")
    .lean();
  return first?.date ? addOneMonth(first.date) : "";
}

// Cycle a new class goes into. A class dated before the current cycle began belongs to the
// earlier cycle whose month covers its date, while that cycle still has classes left
// (e.g. classes the tutor marks late, after the month already rolled over).
// Anything else goes into the current cycle.
export async function cycleForClassDate(lead, date) {
  const current = lead.currentPackageCycle || 1;
  const firstDate = async (cycle) =>
    (await Attendance.findOne({ parentEnquiryId: lead._id, ...cycleFilterFor(cycle) })
      .sort({ date: 1 })
      .select("date")
      .lean())?.date || "";

  const currentStart = await firstDate(current);
  if (currentStart && date >= currentStart) return current;

  for (let cycle = current - 1; cycle >= 1; cycle--) {
    const start = await firstDate(cycle);
    if (!start || date < start) continue;
    if (date > addOneMonth(start)) return current;
    const total = (lead.packageHistory || []).find((h) => h.cycle === cycle)?.totalClasses || lead.totalClasses || 12;
    const done = await Attendance.countDocuments({
      parentEnquiryId: lead._id,
      ...cycleFilterFor(cycle),
      status: "Done",
    });
    return done < total ? cycle : current;
  }
  return current;
}

// Recount Done classes of an earlier cycle into its packageHistory entry (caller saves the lead)
export async function refreshPastCycleCount(lead, cycle) {
  const done = await Attendance.countDocuments({
    parentEnquiryId: lead._id,
    ...cycleFilterFor(cycle),
    status: "Done",
  });
  const entry = (lead.packageHistory || []).find((h) => h.cycle === cycle);
  if (entry) entry.completedClasses = done;
  return { done, total: entry?.totalClasses || lead.totalClasses || 12, changed: Boolean(entry) };
}

// Archive the current cycle into packageHistory and start the next one (caller saves the lead)
export function advanceToNextCycle(lead, doneCount) {
  const currentCycle = lead.currentPackageCycle || 1;
  const total = lead.totalClasses || 12;
  const completedClasses = doneCount || lead.completedClasses || 0;
  // The counter resets below, so the parent renewal reminder (checkParentRenewalReminders)
  // picks up a fully completed cycle from here instead, unless it was already sent
  const alreadyReminded = lead.packageStatus === "completed" && lead.renewalReminderSentForTotal === total;

  if (!lead.packageHistory) lead.packageHistory = [];
  lead.packageHistory.push({
    cycle: currentCycle,
    totalClasses: total,
    completedClasses,
    completedAt: new Date(),
    renewalReminderPending: completedClasses >= total && !alreadyReminded,
  });

  lead.currentPackageCycle = currentCycle + 1;
  lead.completedClasses = 0;
  lead.packageStatus = "active";
  return lead.currentPackageCycle;
}

// Close the current cycle automatically and save the lead
export async function completeCycle(lead, doneCount) {
  const nextCycle = advanceToNextCycle(lead, doneCount);
  await lead.save({ validateBeforeSave: false });
  return nextCycle;
}
