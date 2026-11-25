/**
 * The "demo assigned" WhatsApp messages an admin sends by hand from the main
 * admin panel, after picking a tutor for a parent's enquiry (Search Tutor →
 * Assign Demo).
 *
 * Two approved Odoo templates, one per person:
 *   Tutor  — "Demo Assigned To Tutor" (demo_assigned_to_tutor, model master_tutors)
 *            Hello *{{1}}* ... Student Grade: {{2}} / Subject(s): {{3}} /
 *            Location: {{4}} / Demo Date & Time: {{5}}
 *   Parent — "Demo Scheduled Message" (demo_scheduled_message, model crm.lead)
 *            Hello {{1}} ... Assigned Tutor: {{2}} / Grade: {{5}} /
 *            Subject(s): {{3}} / Demo Date & Time: {{4}}
 *
 * Values are keyed by placeholder ("{{n}}"), so whatsappService asks Odoo which
 * free-text slot each one is instead of trusting the order of the variables.
 */

export const DEMO_TUTOR_TEMPLATE = "Demo Assigned To Tutor";
export const DEMO_PARENT_TEMPLATE = "Demo Scheduled Message";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-28" → "Sat, 28 Nov 2026"; anything else is returned as given. */
export function formatDemoDate(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || "").trim());
  if (!m) return String(date || "").trim();
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return String(date).trim();
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "17:00" → "5:00 PM"; anything else is returned as given. */
export function formatDemoTime(time) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(time || "").trim());
  if (!m) return String(time || "").trim();
  const h = Number(m[1]);
  if (h > 23) return String(time).trim();
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m[2]} ${suffix}`;
}

/** "Sat, 28 Nov 2026 at 5:00 PM" */
export function formatDemoSlot(date, time) {
  return [formatDemoDate(date), formatDemoTime(time)].filter(Boolean).join(" at ");
}

/** Template values and the free-text fallback for both messages. */
export function buildDemoNotices(lead, tutor, demoDate, demoTime) {
  const ward = lead?.wards?.[0] || {};
  const grade = ward.classGrade ? `Grade ${ward.classGrade}` : "";
  const subjects = Array.isArray(ward.subjectsNeeded)
    ? ward.subjectsNeeded.join(", ")
    : (ward.subjectsNeeded || "");
  const location = [lead?.area, lead?.city].filter(Boolean).join(", ");
  const slot = formatDemoSlot(demoDate, demoTime);
  const tutorName = tutor?.name || "";
  const parentName = lead?.parentName || "";

  const tutorNotice = {
    templateName: process.env.WHATSAPP_ASSIGNMENT_TEMPLATE_NAME || DEMO_TUTOR_TEMPLATE,
    templateVars: {
      "{{1}}": tutorName,
      "{{2}}": grade,
      "{{3}}": subjects,
      "{{4}}": location,
      "{{5}}": slot,
    },
    messageBody:
      `Hello *${tutorName}*,\n\n` +
      `Good news - the parent has selected you for a demo class.\n\n` +
      `Student Grade: *${grade}*\nSubject(s): *${subjects}*\n` +
      `Location: *${location}*\nDemo Date & Time: *${slot}*\n\n` +
      `Please reply *YES* to confirm your availability.\n\n` +
      `If you are unable to take this demo, reply *NO* so we can inform the parent in time.`,
  };

  const parentNotice = {
    templateName: process.env.WHATSAPP_DEMO_PARENT_TEMPLATE_NAME || DEMO_PARENT_TEMPLATE,
    templateVars: {
      "{{1}}": parentName,
      "{{2}}": tutorName,
      "{{3}}": subjects,
      "{{4}}": slot,
      "{{5}}": grade,
    },
    messageBody:
      `Hello ${parentName},\n\n` +
      `Your tutor demo has been scheduled.\n\n` +
      `👤 Assigned Tutor : *${tutorName}*\n Grade: *${grade}*\n` +
      `📚 Subject(s): *${subjects}*\n🕒 Demo Date & Time: *${slot}*\n\n` +
      `Please ensure the student is available during the demo time.\n\n` +
      `After the demo, you'll receive a quick confirmation message to proceed further.\n\n` +
      `Regards,\nSaraswati Tutorials`,
  };

  return { slot, tutor: tutorNotice, parent: parentNotice };
}
