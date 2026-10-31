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
  const templateName =
    process.env.WHATSAPP_TUTOR_OPTIONS_TEMPLATE_NAME || "Tutor Options For Parent";

  // Values map to free_text_1..6, i.e. {{1}}..{{6}}, in this order.
  const templateVars = {
    parent_name: lead?.parentName || "",
    grade,
    subjects,
    option_1: offered[0] ? describeTutor(offered[0]) : UNUSED_SLOT,
    option_2: offered[1] ? describeTutor(offered[1]) : UNUSED_SLOT,
    option_3: offered[2] ? describeTutor(offered[2]) : UNUSED_SLOT,
  };

  const choiceLine = offered.length === 1
    ? "Please reply 1 to confirm this tutor."
    : `Please reply with the number of your preferred tutor (1-${offered.length}).`;

  const messageBody =
    `Hello Mr./Ms. ${lead?.parentName || ""},\n\n` +
    `We have shortlisted ${offered.length} tutor(s) for your requirement.\n\n` +
    `Grade: ${grade}\nSubject(s): ${subjects}\n\n` +
    offered.map((t, i) => `${i + 1}) ${describeTutor(t)}`).join("\n") +
    `\n\n${choiceLine}`;

  return { offered, templateName, templateVars, messageBody };
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
