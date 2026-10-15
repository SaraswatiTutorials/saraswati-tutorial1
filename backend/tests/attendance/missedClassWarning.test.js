import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scheduledDayIndexes,
  dayOfWeek,
  shiftDate,
  previousClassDates,
  isWarningTime,
  buildMissedClassWarningMessage,
} from "../../utils/missedClassWarning.js";

test("class days come from preferredDays or the classSchedule text", () => {
  assert.deepEqual([...scheduledDayIndexes({ preferredDays: ["Monday", "Wednesday", "Fri"] })].sort(), [1, 3, 5]);
  assert.deepEqual([...scheduledDayIndexes({ classSchedule: "Tue, Thu @ 5 PM - 6 PM" })].sort(), [2, 4]);
  assert.equal(scheduledDayIndexes({}).size, 0);
});

test("date helpers", () => {
  assert.equal(dayOfWeek("2026-10-15"), 4); // Thursday
  assert.equal(shiftDate("2026-11-01", -1), "2026-10-31");
  assert.equal(shiftDate("2026-03-01", -1), "2026-02-28");
});

test("previous two class days, most recent first", () => {
  const monWedFri = new Set([1, 3, 5]);
  // Friday 2026-10-16 → Wednesday and Monday
  assert.deepEqual(previousClassDates("2026-10-16", monWedFri), ["2026-10-14", "2026-10-12"]);
  // Monday 2026-10-19 → last Friday and Wednesday
  assert.deepEqual(previousClassDates("2026-10-19", monWedFri), ["2026-10-16", "2026-10-14"]);
  // Once a week → two weeks back
  assert.deepEqual(previousClassDates("2026-10-17", new Set([6])), ["2026-10-10", "2026-10-03"]);
  assert.deepEqual(previousClassDates("2026-10-17", new Set()), []);
});

test("warning goes out from 8 AM until the class starts", () => {
  const at = (h, m = 0) => h * 60 + m;
  // Evening class: 8:00 AM up to 5:00 PM
  assert.equal(isWarningTime(at(7, 59), "17:00"), false);
  assert.equal(isWarningTime(at(8), "17:00"), true);
  assert.equal(isWarningTime(at(16, 59), "17:00"), true);
  assert.equal(isWarningTime(at(17), "17:00"), false);
  // Early class at 7:30 AM: 1 hour before
  assert.equal(isWarningTime(at(6, 29), "07:30"), false);
  assert.equal(isWarningTime(at(6, 30), "07:30"), true);
  // 12-hour format and unknown time
  assert.equal(isWarningTime(at(9), "5:00 PM"), true);
  assert.equal(isWarningTime(at(7), ""), false);
  // Unknown class time: mornings only (8–11 AM), never at night
  assert.equal(isWarningTime(at(9), ""), true);
  assert.equal(isWarningTime(at(11), ""), false);
  assert.equal(isWarningTime(at(21, 48), ""), false);
});

test("message text", () => {
  const msg = buildMissedClassWarningMessage("Rahul", "Aarav");
  assert.match(msg, /^Hello Rahul,/);
  assert.match(msg, /attendance has not been marked for the last two scheduled classes for Aarav\./);
  assert.match(msg, /will not be added to your payable amount/);
  assert.doesNotMatch(msg, /third/);
  assert.match(msg, /Saraswati Tutorials$/);
});
