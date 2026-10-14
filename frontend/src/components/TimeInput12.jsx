// 12-hour time picker (hour / minute / AM-PM). Native <input type="time"> shows
// 24-hour time on many browsers and locales, so attendance forms use this instead.
// The value in and out is still "HH:mm" (24-hour), e.g. "17:00", or "" when empty.

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

// "17:05" → { hour: "5", minute: "05", period: "PM" }
function splitTime(value) {
  const m = TIME_RE.exec(value || "");
  if (!m) return { hour: "", minute: "", period: "" };
  const h = Number(m[1]);
  return { hour: String(h % 12 || 12), minute: m[2], period: h >= 12 ? "PM" : "AM" };
}

// { hour: "5", minute: "05", period: "PM" } → "17:05"
function joinTime({ hour, minute, period }) {
  if (!hour) return "";
  let h = Number(hour) % 12;
  if (period === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${minute || "00"}`;
}

export default function TimeInput12({ value, onChange, required = false, className = "", ariaLabel = "Time" }) {
  const parts = splitTime(value);
  // Keep an existing off-step minute (e.g. "17:07") selectable
  const minutes = parts.minute && !MINUTES.includes(parts.minute) ? [...MINUTES, parts.minute].sort() : MINUTES;

  // Picking a part on an empty time fills the rest with :00 PM (most classes are in the evening)
  const update = (field) => (e) => {
    const next = { minute: "00", period: "PM", ...pickSet(parts), [field]: e.target.value };
    onChange(joinTime(next));
  };

  return (
    <div className="flex gap-1.5" role="group" aria-label={ariaLabel}>
      <select aria-label={`${ariaLabel} hour`} required={required} value={parts.hour} onChange={update("hour")} className={`${className} min-w-0 flex-1 px-2`}>
        <option value="">--</option>
        {HOURS.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <select aria-label={`${ariaLabel} minute`} value={parts.minute} onChange={update("minute")} disabled={!parts.hour} className={`${className} min-w-0 flex-1 px-2`}>
        {!parts.hour && <option value="">--</option>}
        {minutes.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <select aria-label={`${ariaLabel} AM or PM`} value={parts.period} onChange={update("period")} disabled={!parts.hour} className={`${className} min-w-0 flex-1 px-2`}>
        {!parts.hour && <option value="">--</option>}
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

// Only the parts that are set, so they override the defaults
function pickSet(parts) {
  return Object.fromEntries(Object.entries(parts).filter(([, v]) => v));
}
