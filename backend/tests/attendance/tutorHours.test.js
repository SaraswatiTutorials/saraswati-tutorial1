import { test } from "node:test";
import assert from "node:assert/strict";
import { classMinutes, logMinutes, plannedClassMinutes, formatHours } from "../../utils/classTime.js";
import { summarizeTutorHours } from "../../utils/tutorHours.js";

test("class length from the class time", () => {
  assert.equal(classMinutes("17:00", "18:30"), 90);
  assert.equal(classMinutes("09:00", "11:30"), 150);
  assert.equal(classMinutes("18:00", "17:00"), null);
  assert.equal(classMinutes("", ""), null);
});

test("record length: stored duration, else from the time, else unknown", () => {
  assert.equal(logMinutes({ durationMinutes: 120, classStartTime: "17:00", classEndTime: "18:00" }), 120);
  assert.equal(logMinutes({ durationMinutes: null, classStartTime: "17:00", classEndTime: "18:00" }), 60);
  assert.equal(logMinutes({}), null);
});

test("planned length from the student's plan", () => {
  assert.equal(plannedClassMinutes({ hoursPerDay: 1.5 }), 90);
  assert.equal(plannedClassMinutes({ classDuration: "2 Hours" }), 120);
  assert.equal(plannedClassMinutes({ classDuration: "1 hr" }), 60);
  assert.equal(plannedClassMinutes({ classDuration: "90 min" }), 90);
  assert.equal(plannedClassMinutes({ startTime: "17:00", endTime: "18:00" }), 60);
  assert.equal(plannedClassMinutes({}), null);
});

test("hours text", () => {
  assert.equal(formatHours(60), "1 hr");
  assert.equal(formatHours(90), "1.5 hrs");
  assert.equal(formatHours(150), "2.5 hrs");
  assert.equal(formatHours(null), "");
});

test("hours are grouped by tutor and student; missed classes are not counted", () => {
  const log = (over) => ({ _id: Math.random(), status: "Done", tutorName: "Priya", tutorId: "t1", parentEnquiryId: "s1", ...over });
  const logs = [
    log({ date: "2026-10-02", classStartTime: "17:00", classEndTime: "18:30" }),
    log({ date: "2026-10-01", classStartTime: "17:00", classEndTime: "18:30", durationMinutes: 90 }),
    log({ date: "2026-10-03", classStartTime: "17:00", classEndTime: "19:00" }), // 2 hrs on a 1.5 hr plan
    log({ date: "2026-10-04", status: "Missed", classStartTime: "17:00", classEndTime: "18:30" }),
    log({ date: "2026-10-05", parentEnquiryId: "s2" }), // old record without a time
    log({ date: "2026-10-02", tutorId: "t2", tutorName: "Amit", parentEnquiryId: "s3", classStartTime: "10:00", classEndTime: "11:00" }),
  ];
  const leads = new Map([
    ["s1", { studentName: "Aarav", requirementId: "REQ-1", plannedMinutes: 90 }],
    ["s2", { studentName: "Diya", requirementId: "REQ-2", plannedMinutes: 60 }],
    ["s3", { studentName: "Ishaan", requirementId: "REQ-3", plannedMinutes: null }],
  ]);

  const { tutors, totals } = summarizeTutorHours(logs, leads);

  assert.deepEqual(tutors.map((t) => t.tutorName), ["Amit", "Priya"]);
  assert.deepEqual(totals, { classesDone: 5, totalMinutes: 360, unknownDurationClasses: 1, mismatchClasses: 1 });

  const priya = tutors[1];
  assert.equal(priya.classesDone, 4);
  assert.equal(priya.totalMinutes, 300);
  assert.equal(priya.unknownDurationClasses, 1);
  assert.equal(priya.mismatchClasses, 1);

  const aarav = priya.students.find((s) => s.studentName === "Aarav");
  assert.deepEqual(aarav.classes.map((c) => c.date), ["2026-10-01", "2026-10-02", "2026-10-03"]);
  assert.deepEqual(aarav.classes.map((c) => c.mismatch), [false, false, true]);

  // No plan → never flagged
  assert.equal(tutors[0].students[0].mismatchClasses, 0);
});
