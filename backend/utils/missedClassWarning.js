// Attendance warning: on the morning of a class day, warn the tutor on WhatsApp
// if attendance was not marked for the last two scheduled classes of that student.

import { toTime24 } from "./classTime.js";

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// Send at 8:00 AM India time, or 1 hour before class if it starts before 9:00 AM
const DEFAULT_SEND_MINUTES = 8 * 60;

// Only look this far back for the two previous class days
const LOOKBACK_DAYS = 14;

// Week days (0 = Sunday) the student has class, from preferredDays or the classSchedule text
export function scheduledDayIndexes(lead) {
  const preferred = Array.isArray(lead?.preferredDays) ? lead.preferredDays : [];
  const schedule = String(lead?.classSchedule || "").toLowerCase();
  const days = new Set();
  DAY_NAMES.forEach((name, idx) => {
    const short = name.slice(0, 3);
    const inPreferred = preferred.some((d) => {
      const v = String(d).trim().toLowerCase();
      return v === name || v === short;
    });
    if (inPreferred || schedule.includes(short)) days.add(idx);
  });
  return days;
}

// "2026-10-15" → day of week (0 = Sunday)
export function dayOfWeek(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// "2026-10-15", -1 → "2026-10-14"
export function shiftDate(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// The last `count` class days before `today`, most recent first
export function previousClassDates(today, dayIndexes, count = 2) {
  const dates = [];
  for (let back = 1; back <= LOOKBACK_DAYS && dates.length < count; back++) {
    const date = shiftDate(today, -back);
    if (dayIndexes.has(dayOfWeek(date))) dates.push(date);
  }
  return dates;
}

// With no known class time, only send in the morning (8:00–11:00 AM), never at night
const NO_TIME_SEND_UNTIL_MINUTES = 11 * 60;

// Is it time to send today's warning? From 8:00 AM (or 1 hour before an early class)
// until the class starts; with no known start time, 8:00–11:00 AM.
export function isWarningTime(nowMinutes, classStartTime) {
  const start = toTime24(classStartTime || "");
  if (!start) return nowMinutes >= DEFAULT_SEND_MINUTES && nowMinutes < NO_TIME_SEND_UNTIL_MINUTES;
  const [h, m] = start.split(":").map(Number);
  const startMinutes = h * 60 + m;
  const sendAt = Math.max(0, Math.min(DEFAULT_SEND_MINUTES, startMinutes - 60));
  return nowMinutes >= sendAt && nowMinutes < startMinutes;
}

// Current time in India as minutes after midnight
export function nowMinutesIST() {
  const [h, m] = new Date()
    .toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour12: false })
    .split(":")
    .map(Number);
  return (h % 24) * 60 + m;
}

export function buildMissedClassWarningMessage(tutorName, studentName) {
  return `Hello ${tutorName},

Our records show that attendance has not been marked for the last two scheduled classes for ${studentName}.

Kindly mark your attendance in the Saraswati Tutorials Teacher Portal after every class. Classes without marked attendance will not be added to your payable amount.

Thank you,
Saraswati Tutorials`;
}
