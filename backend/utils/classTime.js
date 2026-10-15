// Class time for an attendance record: "HH:mm" (24-hour), e.g. "17:00".
// Both times are optional on the API so older clients keep working; when sent,
// they must be valid and the class must end after it starts.

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const toMinutes = (value) => {
  const m = TIME_RE.exec(value);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// Returns { ok: true, provided: false } when neither time is sent,
// { ok: true, provided: true, start, end } for a valid pair, or { ok: false, message }.
export function parseClassTime(start, end) {
  const isBlank = (v) => v === undefined || v === null || v === "";
  if ((!isBlank(start) && typeof start !== "string") || (!isBlank(end) && typeof end !== "string")) {
    return { ok: false, message: "Class time must be in HH:mm format." };
  }
  const s = typeof start === "string" ? start.trim() : "";
  const e = typeof end === "string" ? end.trim() : "";
  if (!s && !e) return { ok: true, provided: false };
  if (!s || !e) return { ok: false, message: "Enter both the class start and end time." };
  const sm = toMinutes(s);
  const em = toMinutes(e);
  if (sm === null || em === null) return { ok: false, message: "Class time must be in HH:mm format." };
  if (em <= sm) return { ok: false, message: "Class end time must be after the start time." };
  return { ok: true, provided: true, start: s, end: e };
}

// "5:00 PM" / "5 PM" / "17:00" → "17:00"; anything else → ""
export function toTime24(value) {
  if (typeof value !== "string") return "";
  const v = value.trim();
  if (TIME_RE.test(v)) return v;
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i.exec(v);
  if (!m) return "";
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h < 1 || h > 12 || min > 59) return "";
  const pm = m[3].toUpperCase() === "PM";
  if (h === 12) h = pm ? 12 : 0;
  else if (pm) h += 12;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// A student's usual class time, used to pre-fill the tutor's attendance form.
// Uses the enquiry's startTime/endTime, else its time slot ("5:00 PM – 6:30 PM").
export function usualClassTime(lead) {
  const start = toTime24(lead?.startTime || "");
  const end = toTime24(lead?.endTime || "");
  if (parseClassTime(start, end).provided) return { start, end };
  const slot = String(lead?.classTimingSlot || "");
  const parts = slot.split(/\s*[–—-]\s*/);
  if (parts.length === 2) {
    const s = toTime24(parts[0]);
    const e = toTime24(parts[1]);
    if (parseClassTime(s, e).provided) return { start: s, end: e };
  }
  return { start: "", end: "" };
}

// "17:00" → "5:00 PM"
export function formatTime12(value) {
  const m = TIME_RE.exec(value || "");
  if (!m) return "";
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
}

// "5:00 PM – 6:30 PM", or "" when no time is stored
export function formatClassTimeRange(start, end) {
  const s = formatTime12(start);
  const e = formatTime12(end);
  return s && e ? `${s} – ${e}` : "";
}

// Class length in minutes from "HH:mm" times ("17:00", "18:30" → 90), or null if not a valid pair
export function classMinutes(start, end) {
  const s = toMinutes(start || "");
  const e = toMinutes(end || "");
  return s !== null && e !== null && e > s ? e - s : null;
}

// Minutes of an attendance record: the stored duration, else worked out from its
// class time (records made before durationMinutes existed), else null
export function logMinutes(log) {
  if (Number.isFinite(log?.durationMinutes) && log.durationMinutes > 0) return log.durationMinutes;
  return classMinutes(log?.classStartTime, log?.classEndTime);
}

// Planned minutes per class from the student's plan: hoursPerDay, else the
// classDuration text ("1.5 Hours", "1 hr", "90 min"), else the usual class time
export function plannedClassMinutes(lead) {
  const hours = Number(lead?.hoursPerDay);
  if (Number.isFinite(hours) && hours > 0) return Math.round(hours * 60);
  const text = String(lead?.classDuration || "").toLowerCase();
  const m = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)\b/.exec(text);
  if (m) {
    const n = Number(m[1]);
    return Math.round(m[2].startsWith("h") ? n * 60 : n);
  }
  const usual = usualClassTime(lead);
  return classMinutes(usual.start, usual.end);
}

// 90 → "1.5 hrs", 60 → "1 hr", 75 → "1.25 hrs"
export function formatHours(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  const hours = Math.round((minutes / 60) * 100) / 100;
  return `${hours} ${hours === 1 ? "hr" : "hrs"}`;
}
