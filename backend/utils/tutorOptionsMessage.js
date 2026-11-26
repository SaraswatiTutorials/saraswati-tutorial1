/**
 * The "here are your tutor options" message to a parent.
 *
 * Kept in one place because two callers need it: the admin route that sends it
 * by hand, and the scheduler that sends it once the tutors' answering window
 * closes. One builder means one wording and one set of rules.
 */

import { sendWhatsAppToTutor, firstApprovedTemplate } from "./whatsappService.js";

/**
 * Odoo templates for the parent's top-3 message, newest first. Both have the
 * same seven variables in the same order and the Tutor 1 / 2 / 3 buttons:
 *   Dear Mr./Ms. {{1}}, ... Students' name: {{2}} / Grade: {{3}} /
 *   Subject(s): {{4}} ... 1. {{5}}  2. {{6}}  3. {{7}}
 * "tutor_options_for_parent_working" (4 Nov 2026, bold wording) is used once
 * Meta approves it; "tutor_options_for_parent" until then.
 */
export const TUTOR_OPTIONS_TEMPLATES = ["tutor_options_for_parent_working", "tutor_options_for_parent"];

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
  // The preferred template; sendTutorOptions falls back to the older one
  // while this one awaits approval (see TUTOR_OPTIONS_TEMPLATES).
  const templateName =
    process.env.WHATSAPP_TUTOR_OPTIONS_TEMPLATE_NAME || TUTOR_OPTIONS_TEMPLATES[0];

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

/**
 * Odoo templates for the tutor cards, preferred first. All have an image
 * header, which the code fills with the tutor's profile photo on every send
 * (headerImageUrl), the same way the photo cards always worked.
 *
 * "tutor_profile_card_v2" (Tutor Profile Card v2, #146, 25 Nov 2026; ten
 * variables): "Tutor Option {{1}} of {{2}}" at the top like the old option
 * card, a blank line between the details, and the old card's closing line
 * "This tutor has been shortlisted for your registered tuition requirement."
 *   {{3}} Full Name … {{10}} Language of instruction
 *
 * "tutor_profile_card" (Tutor Profile Card, #145, approved 25 Nov 2026 from the
 * office's design; eight variables):
 *   Dear Parent, / Please find the details of the tutor assigned for your Ward.
 *   *Tutor Details:* / Full Name: {{1}} / Qualification: {{2}} /
 *   *Teaching Experience: {{3}}* / *Subjects Expertise: {{4}}* / Location: {{5}} /
 *   Vehicle: {{6}} / Occupation: {{7}} / Language of instruction: {{8}}
 *
 * "tutor_option_card2" (Tutor Option Card2; four variables) is approved but
 * ARCHIVED in Odoo (since 3 Nov 2026), so it is used only if someone restores
 * it while the one above still awaits Meta's approval:
 *   Here is Tutor Option {{1}} ... *Tutor Details:* {{2}} /
 *   Experience: {{3}} / Distance from your location: {{4}}
 */
export const TUTOR_PROFILE_TEMPLATE_V2 = "tutor_profile_card_v2";
export const TUTOR_PROFILE_TEMPLATE = "tutor_profile_card";
export const TUTOR_OPTION_CARD_FALLBACK = "tutor_option_card2";
export const TUTOR_CARD_TEMPLATES = [TUTOR_PROFILE_TEMPLATE_V2, TUTOR_PROFILE_TEMPLATE, TUTOR_OPTION_CARD_FALLBACK];
export const TUTOR_CARD_TEMPLATE = TUTOR_PROFILE_TEMPLATE_V2;

/**
 * Header picture for a tutor with no profile photo on file. An image-header
 * template must be sent with a picture, so this keeps every tutor's card going.
 */
export const DEFAULT_CARD_PHOTO = "https://saraswatitutorial.com/logo.png";

/**
 * The picture for a card's header. WhatsApp takes only JPG or PNG there, so a
 * Cloudinary photo in another format is asked for as JPG, and anything that
 * is not a photo (a PDF uploaded by mistake, no URL) gets the logo.
 */
export function cardPhotoUrl(photo) {
  const url = String(photo || "").trim();
  if (!/^https?:\/\//.test(url)) return DEFAULT_CARD_PHOTO;
  const ext = (url.split("?")[0].match(/\.(\w+)$/) || [, ""])[1].toLowerCase();
  if (["jpg", "jpeg", "png"].includes(ext)) return url;
  if (["pdf", "doc", "docx"].includes(ext)) return DEFAULT_CARD_PHOTO;
  if (/res\.cloudinary\.com\/.+\/image\/upload\//.test(url)) {
    return url.replace("/image/upload/", "/image/upload/f_jpg/").replace(/\.\w+(\?.*)?$/, ".jpg$1");
  }
  return url;
}

/**
 * The occupation a parent sees. A tutor who is a student is shown as "Tutor".
 */
export function displayOccupation(occupation) {
  const s = String(occupation || "").trim();
  if (!s) return "";
  return /\bstudent\b/i.test(s) ? "Tutor" : s;
}

// WhatsApp caps a whole message body at 1024 characters.
const MAX_VALUE = 200;
const clip = (s) => (s.length > MAX_VALUE ? `${s.slice(0, MAX_VALUE - 1).trimEnd()}…` : s);
const listOf = (v) => (Array.isArray(v) ? v.filter(Boolean).join(", ") : String(v || "").trim());

/**
 * Where the tutor is: their area, else the first three areas they teach in,
 * without the city repeated after each ("Marathahalli, Bangalore, ITPL,
 * Bangalore" → "Marathahalli, ITPL").
 */
function locationOf(t) {
  const area = String(t?.area || "").trim();
  if (area) return clip(area);
  const city = String(t?.city || "").trim().toLowerCase();
  const knownCities = new Set(["bangalore", "bengaluru", "mumbai", city].filter(Boolean));
  const places = (Array.isArray(t?.locations) ? t.locations : String(t?.locations || "").split(","))
    .flatMap((l) => String(l || "").split(","))
    .map((p) => p.trim())
    .filter((p) => p && !knownCities.has(p.toLowerCase()));
  const unique = [...new Set(places)];
  if (unique.length) return clip(unique.slice(0, 3).join(", "));
  return String(t?.city || "").trim();
}

/**
 * "Yes (KA50EB8431)" when the tutor has a vehicle and its number is on file;
 * otherwise "Paid" (no vehicle, or no vehicle number) — the owner's wording.
 */
export function vehicleOf(t) {
  const number = String(t?.vehicleNumber || "").trim();
  return String(t?.hasVehicle || "").toLowerCase() === "yes" && number ? `Yes (${number})` : "Paid";
}

/**
 * The tutor details, label → value, in the order of the office's card.
 */
export function tutorDetails(t) {
  return {
    "Full Name": String(t?.name || "").trim(),
    Qualification: String(t?.qualification || "").trim(),
    "Teaching Experience": String(t?.experience || "").trim(),
    "Subjects Expertise": clip(listOf(t?.subjects) || listOf(t?.expertise) || String(t?.subject || "").trim()),
    Location: locationOf(t),
    Vehicle: vehicleOf(t),
    Occupation: displayOccupation(t?.occupation),
    "Language of instruction": listOf(t?.languages),
  };
}

/**
 * The card's template values, its free-text version and its header picture.
 * `templateName` picks which template's variables to fill (see
 * TUTOR_CARD_TEMPLATES); the profile card is the default.
 */
export function buildTutorCard(t, position, total, templateName = TUTOR_PROFILE_TEMPLATE_V2) {
  const d = tutorDetails(t);
  const headerImageUrl = cardPhotoUrl(t?.photo);
  const dash = (v) => v || "—";

  // Same layout as the v2 template (shown in dry runs).
  const messageBody =
    `*Tutor Option ${position} of ${total}*\n\n` +
    `Dear Parent,\nPlease find the details of the tutor assigned for your Ward.\n\n` +
    `*Tutor Details:*\n\n` +
    `Full Name: ${dash(d["Full Name"])}\n\n` +
    `Qualification: ${dash(d.Qualification)}\n\n` +
    `*Teaching Experience: ${dash(d["Teaching Experience"])}*\n\n` +
    `*Subjects Expertise: ${dash(d["Subjects Expertise"])}*\n\n` +
    `Location: ${dash(d.Location)}\n\n` +
    `Vehicle: ${dash(d.Vehicle)}\n\n` +
    `Occupation: ${dash(d.Occupation)}\n\n` +
    `Language of instruction: ${dash(d["Language of instruction"])}\n\n` +
    `*This tutor has been shortlisted for your registered tuition requirement.*\n\n` +
    `_Saraswati Tutorials_`;

  if (templateName === TUTOR_PROFILE_TEMPLATE_V2) {
    return {
      templateName,
      // Keyed by placeholder; Odoo's free_text_n fills {{n}}.
      templateVars: {
        "{{1}}": String(position),
        "{{2}}": String(total),
        "{{3}}": d["Full Name"],
        "{{4}}": d.Qualification,
        "{{5}}": d["Teaching Experience"],
        "{{6}}": d["Subjects Expertise"],
        "{{7}}": d.Location,
        "{{8}}": d.Vehicle,
        "{{9}}": d.Occupation,
        "{{10}}": d["Language of instruction"],
      },
      headerImageUrl,
      messageBody,
    };
  }

  if (templateName === TUTOR_OPTION_CARD_FALLBACK) {
    const distance = t?.distanceKm != null ? `${t.distanceKm} km` : "";
    const oneLine = Object.entries(d)
      .filter(([label, v]) => v && label !== "Teaching Experience")
      .map(([label, v]) => (label === "Full Name" ? v : `${label}: ${v}`))
      .join(" | ");
    return {
      templateName,
      // free_text_1..4, i.e. {{1}}..{{4}}, in this order.
      templateVars: { position: String(position), tutor_details: oneLine || d["Full Name"], experience: d["Teaching Experience"], distance },
      headerImageUrl,
      messageBody,
    };
  }

  return {
    templateName,
    // Keyed by placeholder, so Odoo is asked which slot each one is.
    templateVars: {
      "{{1}}": d["Full Name"],
      "{{2}}": d.Qualification,
      "{{3}}": d["Teaching Experience"],
      "{{4}}": d["Subjects Expertise"],
      "{{5}}": d.Location,
      "{{6}}": d.Vehicle,
      "{{7}}": d.Occupation,
      "{{8}}": d["Language of instruction"],
    },
    headerImageUrl,
    messageBody,
  };
}

/**
 * The full tutor records behind the offered tutors, by tutor code, so the card
 * can show qualification, subjects, languages and the photo even when the
 * caller passed only a name and code. Partial tutors fill in what they have.
 */
async function loadTutorProfiles(codes) {
  if (!codes.length) return new Map();
  const [{ default: Tutor }, { default: PartialTutor }] = await Promise.all([
    import("../models/Tutor.js"),
    import("../models/PartialTutor.js"),
  ]);
  const [full, partial] = await Promise.all([
    Tutor.find({ tutorCode: { $in: codes } })
      .select("tutorCode name photo qualification experience subjects expertise subject area city locations hasVehicle vehicleNumber occupation languages")
      .lean(),
    PartialTutor.find({ tutorCode: { $in: codes } })
      .select("tutorCode name photo experience occupation location")
      .lean(),
  ]);
  const map = new Map();
  for (const p of partial) map.set(p.tutorCode, { ...p, area: p.location?.area || "", city: p.location?.city || "" });
  for (const f of full) map.set(f.tutorCode, f); // a full registration wins
  return map;
}

/** Caller's values win; the stored record fills the gaps. */
function withProfile(t, stored) {
  const merged = { ...(stored || {}) };
  for (const [k, v] of Object.entries(t || {})) {
    if (v != null && v !== "" && !(Array.isArray(v) && !v.length)) merged[k] = v;
  }
  return merged;
}

/** Which card template to send now: an env override, else the newest approved. */
export async function chooseCardTemplate() {
  if (process.env.WHATSAPP_TUTOR_CARD_TEMPLATE_NAME) return process.env.WHATSAPP_TUTOR_CARD_TEMPLATE_NAME;
  return (await firstApprovedTemplate(TUTOR_CARD_TEMPLATES)) || TUTOR_OPTION_CARD_FALLBACK;
}

/** The cards for up to three tutors, with their stored profiles filled in. */
export async function prepareTutorCards(tutors, { loadProfiles = loadTutorProfiles, templateName = TUTOR_PROFILE_TEMPLATE_V2 } = {}) {
  const offered = (tutors || []).slice(0, 3);
  let profiles = new Map();
  try {
    profiles = await loadProfiles(offered.map((t) => t?.tutorCode).filter(Boolean));
  } catch (err) {
    console.error("[Tutor Cards] Could not load tutor profiles:", err.message);
  }
  return offered.map((t, i) => {
    const tutor = withProfile(t, profiles.get(t?.tutorCode));
    return {
      position: i + 1,
      tutorCode: tutor.tutorCode || "",
      name: tutor.name || "",
      hasPhoto: cardPhotoUrl(tutor.photo) !== DEFAULT_CARD_PHOTO,
      ...buildTutorCard(tutor, i + 1, offered.length, templateName),
    };
  });
}

/**
 * One card per tutor: the top-3 cards before the parent chooses, and the
 * assigned tutor's card on Assign Demo. Every card carries the tutor's profile
 * picture as its header (or the logo when there is none), so it always goes as
 * the template, inside the 24-hour window too: plain text could not carry it.
 */
export async function sendTutorCards(lead, tutors, options = {}) {
  const phoneNumber = lead?.phone || "";
  if (!phoneNumber) return { sent: 0, skipped: (tutors || []).slice(0, 3).length, results: [] };

  const templateName = options.templateName || await chooseCardTemplate();
  const cards = await prepareTutorCards(tutors, { ...options, templateName });
  const results = [];
  for (const card of cards) {
    const send = (headerImageUrl) => sendWhatsAppToTutor({
      phoneNumber,
      messageBody: card.messageBody,
      templateName,
      templateVars: card.templateVars,
      headerImageUrl,
      forceTemplate: true,
    });
    let result = await send(card.headerImageUrl);
    let photo = card.hasPhoto;
    // The tutor's photo could not be fetched or was refused: the card still
    // goes, with the logo, rather than not at all.
    if (!result.success && card.headerImageUrl !== DEFAULT_CARD_PHOTO && result.failureReason !== "Template Deleted or Inactive") {
      console.warn(`[Tutor Cards] ${card.name}: photo card failed (${result.failureReason}); sending with the logo`);
      result = await send(DEFAULT_CARD_PHOTO);
      photo = false;
    }
    results.push({
      position: card.position, name: card.name, sent: result.success,
      skipped: false, messageId: result.messageId || null,
      failureReason: result.failureReason || "", photo,
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
  const built = buildTutorOptions(lead, tutors);
  const { offered, templateVars, messageBody } = built;
  // An env override is used as given; otherwise the newest approved template.
  const templateName = process.env.WHATSAPP_TUTOR_OPTIONS_TEMPLATE_NAME
    ? built.templateName
    : await firstApprovedTemplate(TUTOR_OPTIONS_TEMPLATES);
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
