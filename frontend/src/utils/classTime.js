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
