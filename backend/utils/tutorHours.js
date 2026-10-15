// Tutor hours for payroll: classes marked Done in a date range, grouped by the tutor
// who took them and then by student. Missed classes are not paid, so they're left out.
// A class whose length differs from the student's plan is flagged as a mismatch.

import { logMinutes } from "./classTime.js";

const byName = (key) => (a, b) => String(a[key] || "").localeCompare(String(b[key] || ""));

const emptyTotals = () => ({ classesDone: 0, totalMinutes: 0, unknownDurationClasses: 0, mismatchClasses: 0 });

function addClass(totals, minutes, mismatch) {
  totals.classesDone += 1;
  if (minutes === null) totals.unknownDurationClasses += 1;
  else totals.totalMinutes += minutes;
  if (mismatch) totals.mismatchClasses += 1;
}

// logs: attendance records; leadsById: Map of parentEnquiryId → { studentName, requirementId, plannedMinutes }
export function summarizeTutorHours(logs, leadsById = new Map()) {
  const tutors = new Map();
  const grandTotal = emptyTotals();

  for (const log of logs) {
    if (log.status !== "Done") continue;

    const tutorKey = String(log.tutorId);
    if (!tutors.has(tutorKey)) {
      tutors.set(tutorKey, { tutorId: tutorKey, tutorName: log.tutorName || "Unknown Tutor", ...emptyTotals(), students: new Map() });
    }
    const tutor = tutors.get(tutorKey);

    const leadKey = String(log.parentEnquiryId);
    if (!tutor.students.has(leadKey)) {
      const lead = leadsById.get(leadKey) || {};
      tutor.students.set(leadKey, {
        parentEnquiryId: leadKey,
        studentName: lead.studentName || log.studentName || "Unknown Student",
        requirementId: lead.requirementId || log.requirementId || "",
        plannedMinutes: lead.plannedMinutes || null,
        ...emptyTotals(),
        classes: [],
      });
    }
    const student = tutor.students.get(leadKey);

    const minutes = logMinutes(log);
    const mismatch = minutes !== null && student.plannedMinutes !== null && minutes !== student.plannedMinutes;

    student.classes.push({
      logId: String(log._id),
      date: log.date,
      classStartTime: log.classStartTime || "",
      classEndTime: log.classEndTime || "",
      minutes,
      mismatch,
    });
    addClass(student, minutes, mismatch);
    addClass(tutor, minutes, mismatch);
    addClass(grandTotal, minutes, mismatch);
  }

  const tutorList = [...tutors.values()]
    .map((t) => ({
      ...t,
      students: [...t.students.values()]
        .map((s) => ({ ...s, classes: s.classes.sort((a, b) => a.date.localeCompare(b.date)) }))
        .sort(byName("studentName")),
    }))
    .sort(byName("tutorName"));

  return { tutors: tutorList, totals: grandTotal };
}
