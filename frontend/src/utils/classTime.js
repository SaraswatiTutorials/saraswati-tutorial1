// Class time on attendance records is stored as "HH:mm" (24-hour), e.g. "17:00".

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

// "17:00" → "5:00 PM"
export function formatTime12(value) {
  const m = TIME_RE.exec(value || "");
  if (!m) return "";
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
}

// "5:00 PM – 6:30 PM", or "" when the record has no time (older records)
export function formatClassTimeRange(start, end) {
  const s = formatTime12(start);
  const e = formatTime12(end);
  return s && e ? `${s} – ${e}` : "";
}

// Error message for the time inputs, or "" when both are valid and end is after start
export function classTimeError(start, end) {
  if (!start || !end) return "Please select the class start and end time.";
  if (!TIME_RE.test(start) || !TIME_RE.test(end)) return "Please enter a valid class time.";
  if (end <= start) return "Class end time must be after the start time.";
  return "";
}

// Durations a tutor can pick when marking attendance, in minutes (1, 1.5, 2, 2.5 hours)
export const CLASS_DURATION_OPTIONS = [60, 90, 120, 150];

// Class length in minutes ("17:00", "18:30" → 90), or null if not a valid pair
export function classMinutes(start, end) {
  const s = TIME_RE.exec(start || "");
  const e = TIME_RE.exec(end || "");
  if (!s || !e) return null;
  const diff = Number(e[1]) * 60 + Number(e[2]) - (Number(s[1]) * 60 + Number(s[2]));
  return diff > 0 ? diff : null;
}

// "17:00" + 90 → "18:30"; "" if the result would pass midnight
export function addMinutesToTime(start, minutes) {
  const m = TIME_RE.exec(start || "");
  if (!m) return "";
  const total = Number(m[1]) * 60 + Number(m[2]) + minutes;
  if (total >= 24 * 60) return "";
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// Minutes of an attendance record: stored duration, else from its class time, else null
export function logMinutes(log) {
  if (Number.isFinite(log?.durationMinutes) && log.durationMinutes > 0) return log.durationMinutes;
  return classMinutes(log?.classStartTime, log?.classEndTime);
}

// 90 → "1.5 hrs", 60 → "1 hr"; "" when unknown
export function formatHours(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  const hours = Math.round((minutes / 60) * 100) / 100;
  return `${hours} ${hours === 1 ? "hr" : "hrs"}`;
}

// Planned minutes per class from a student's plan: hoursPerDay, else the
// classDuration text ("1.5 Hours", "1 hr", "90 min"), else the usual class time
export function plannedClassMinutes(lead) {
  const hours = Number(lead?.hoursPerDay);
  if (Number.isFinite(hours) && hours > 0) return Math.round(hours * 60);
  const m = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)\b/.exec(String(lead?.classDuration || "").toLowerCase());
  if (m) return Math.round(m[2].startsWith("h") ? Number(m[1]) * 60 : Number(m[1]));
  return classMinutes(lead?.startTime, lead?.endTime);
}
