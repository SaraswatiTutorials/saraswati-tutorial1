/**
 * The "here are your tutor options" message to a parent.
 *
 * Kept in one place because two callers need it: the admin route that sends it
 * by hand, and the scheduler that sends it once the tutors' answering window
 * closes. One builder means one wording and one set of rules.
 */

import { sendWhatsAppToTutor } from "./whatsappService.js";

/** Meta rejects a template whose parameter is empty, so unused slots say this. */
const UNUSED_SLOT = "—";

/** "Priya Sharma - 5 year exp - 3 km away", leaving out whatever we do not know. */
export function describeTutor(t) {
  return [
    t?.name,
    t?.experience ? `${t.experience} exp` : "",
    t?.distanceKm != null ? `${t.distanceKm} km away` : "",
  ].filter(Boolean).join(" - ");
}

/**
 * Builds the template variables and the free-text fallback.
 * Up to three tutors are offered; fewer is fine, and the unused option slots
 * are filled with a dash rather than left empty.
 */
export function buildTutorOptions(lead, tutors) {
  const ward = lead?.wards?.[0] || {};
  const grade = ward.classGrade ? `Grade ${ward.classGrade}` : "";
  const subjects = Array.isArray(ward.subjectsNeeded)
    ? ward.subjectsNeeded.join(", ")
    : (ward.subjectsNeeded || "");

  const offered = (tutors || []).slice(0, 3);
  // Odoo: Template Name "tutor_options_for_parent" (found by that even when
  // the display Name changes). Re-approved 4 Nov 2026 with seven variables:
  //   Dear Mr./Ms. {{1}}, ... Student's name: {{2}} / Grade: {{3}} /
  //   Subject(s): {{4}} ... 1. {{5}}  2. {{6}}  3. {{7}}
  // and the Tutor 1 / 2 / 3 buttons the parent taps.
  const templateName =
    process.env.WHATSAPP_TUTOR_OPTIONS_TEMPLATE_NAME || "tutor_options_for_parent";

  // Values map to free_text_1..7, i.e. {{1}}..{{7}}, in this order.
  const templateVars = {
    parent_name: lead?.parentName || "",
    student_name: ward.studentName || UNUSED_SLOT,
    grade,
    subjects,
    option_1: offered[0] ? describeTutor(offered[0]) : UNUSED_SLOT,
    option_2: offered[1] ? describeTutor(offered[1]) : UNUSED_SLOT,
    option_3: offered[2] ? describeTutor(offered[2]) : UNUSED_SLOT,
  };

  // Free-text version, worded like the template. The scheduler always sends
  // the template (the buttons live there); this is what a dry run shows.
  const messageBody =
    `Dear Mr./Ms. ${templateVars.parent_name},\n\n` +
    `Your tuition requirement has been reviewed, and the following tutors have been ` +
    `shortlisted based on the submitted requirements.\n\n` +
    `Student's name: ${templateVars.student_name}\n` +
    `Grade: ${grade}\nSubject(s): ${subjects}\n\n` +
    `Shortlisted Tutors\n\n` +
    offered.map((t, i) => `${i + 1}. ${describeTutor(t)}`).join("\n") +
    `\n\nOnce we receive your selection, our team will coordinate the demo schedule with the chosen tutor.`;

  return { offered, templateName, templateVars, messageBody };
}

/** The card's text and its template values; no photo (removed 4 Nov 2026). */
export function buildTutorCard(t, position, total) {
  const distance = t?.distanceKm != null ? `${t.distanceKm} km` : "";
  return {
    // Values map to free_text_1..4, i.e. {{1}}..{{4}}, in this order.
    templateVars: {
      position: String(position),
      tutor_name: t?.name || "",
      experience: t?.experience || "",
      distance,
    },
    // Used instead of the template inside WhatsApp's 24-hour window.
    messageBody:
      `*Tutor Option ${position} of ${total}*\n\n*${t?.name || ""}*\n\n` +
      `Experience: ${t?.experience || ""}\n` +
      `Distance: ${distance} from your location\n\n` +
      `*This tutor has been shortlisted for your registered tuition requirement.*`,
  };
}

/**
 * One card per tutor, sent just before the list the parent chooses from.
 *
 * Cards carry NO profile picture (the owner's decision, 4 Nov 2026), so every
 * offered tutor gets a card, photo or not, and the Odoo template
 * "tutor_option_card" must have Header Type: None. Without a picture the card
 * can also go as plain text inside WhatsApp's 24-hour window.
 */
export async function sendTutorCards(lead, tutors) {
  const offered = (tutors || []).slice(0, 3);
  const phoneNumber = lead?.phone || "";
  const templateName =
    process.env.WHATSAPP_TUTOR_CARD_TEMPLATE_NAME || "tutor_option_card";
  if (!phoneNumber) return { sent: 0, skipped: offered.length, results: [] };

  const results = [];
  for (const [i, t] of offered.entries()) {
    const { templateVars, messageBody } = buildTutorCard(t, i + 1, offered.length);
    const result = await sendWhatsAppToTutor({
      phoneNumber,
      messageBody,
      templateName,
      templateVars,
    });
    results.push({
      position: i + 1, name: t.name || "", sent: result.success,
      skipped: false, failureReason: result.failureReason || "",
    });
  }
  return { sent: results.filter((r) => r.sent).length, results, templateName };
}

/**
 * Sends it. The template is forced because the 1/2/3 buttons live on the
 * template, and the photo cards sent moments earlier reopen the free-text
 * window — without this the parent would get a list with nothing to tap.
 */
export async function sendTutorOptions(lead, tutors) {
  const { offered, templateName, templateVars, messageBody } = buildTutorOptions(lead, tutors);
  const phoneNumber = lead?.phone || "";
  if (!phoneNumber) {
    return { sent: false, failureReason: "No phone number on this lead.", offered, templateName };
  }

  const result = await sendWhatsAppToTutor({
    phoneNumber,
    messageBody,
    templateName,
    templateVars,
    forceTemplate: true,
  });

  return {
    sent: result.success,
    failureReason: result.failureReason || "",
    usedTemplate: result.usedTemplate,
    messageId: result.messageId || null,
    offered,
    templateName,
    templateVars,
    messageBody,
  };
}
