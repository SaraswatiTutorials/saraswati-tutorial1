/**
 * The tutor-matching pipeline, one function per stage.
 *
 * Each stage is a step a member of staff presses in Panel 2, in order:
 *
 *   1. reconfirmRequirement  parent gets the Re-Confirmation template and taps
 *                            "Yes,Correct" or "Change some details"
 *   2. shortlistTutors       best 20 tutors are found and saved
 *   3. inviteTutors          top 10 of those are asked if they are interested
 *   4. sendTopThree          best 3 of whoever said yes go to the parent
 *   5. notifySelectedTutor   the tutor the parent picked is told
 *
 * Every stage takes `dryRun`. With it, the stage does all its real work —
 * looks the template up in Odoo, scores the tutors, builds every variable —
 * and returns exactly what would have gone out, without sending a message or
 * writing a record. That is how this is tested without troubling a tutor.
 *
 * Nothing here runs on a timer. A stage happens because somebody asked for it,
 * and the Panel 2 route only lets a real send through when PANEL_SENDING_ENABLED
 * is set (see panelSendingEnabled).
 */

import mongoose from "mongoose";
import Tutor from "../models/Tutor.js";
import PartialTutor from "../models/PartialTutor.js";
import BroadcastLog from "../models/BroadcastLog.js";
import {
  buildCentralizedQuery,
  calculateTutorScore,
  compareTutors,
  computeMatchReason,
  parseAddress,
} from "./matchingEngine.js";
import {
  sendWhatsAppToTutor,
  buildBroadcastMessage,
  chooseRequirementTemplate,
} from "./whatsappService.js";
import { sendTutorCards, sendTutorOptions } from "./tutorOptionsMessage.js";
import { rankInterested } from "./topThreeScheduler.js";
import { updateLeadAssignment } from "./odooService.js";

/**
 * The master switch for Panel 2's real sends. Off unless PANEL_SENDING_ENABLED=true
 * is set on the server, so previews and shortlists work while nothing can reach a
 * parent or a tutor. Read per call, so it does not depend on load order.
 */
export function panelSendingEnabled() {
  return String(process.env.PANEL_SENDING_ENABLED || "").toLowerCase() === "true";
}

/** What the parent should read, rather than the id stored on the enquiry. */
const PLAN_NAMES = {
  foundation: "Foundation Plan",
  advance: "Advance Growth Plan",
  elite: "Elite Mentor Plan",
};

const whenSent = (date) =>
  new Date(date).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });

/**
 * How far a tutor may be and still be shortlisted.
 *
 * Distance comes first: somebody who cannot reach the family is no use
 * however well they score, so anyone beyond this is dropped outright rather
 * than ranked low. Set SHORTLIST_RADIUS_KM to change it.
 */
export const SHORTLIST_RADIUS_KM = Number(process.env.SHORTLIST_RADIUS_KM || 10);

/** How many tutors each stage works with. Both are overridable per call. */
export const SHORTLIST_SIZE = Number(process.env.PIPELINE_SHORTLIST_SIZE || 20);
export const INVITE_SIZE = Number(process.env.PIPELINE_INVITE_SIZE || 10);

/** Send an option card per tutor before the list of three. */
const SEND_PHOTO_CARDS = String(process.env.TOP3_PHOTO_CARDS || "true").toLowerCase() !== "false";

/** Stage 1's template. Its buttons are "Yes,Correct" and "Change some details". */
export const RECONFIRM_TEMPLATE =
  process.env.WHATSAPP_RECONFIRM_TEMPLATE_NAME || "re_confirmation_copy";

/** Stage 5's template. */
export const SELECTION_TEMPLATE =
  process.env.WHATSAPP_SELECTION_TEMPLATE_NAME || "demo_confirmation_tutor";

const db = () => mongoose.connection.db;

const firstWardOf = (lead) => lead?.wards?.[0] || {};

const subjectsOf = (ward) =>
  Array.isArray(ward?.subjectsNeeded) ? ward.subjectsNeeded.join(", ") : (ward?.subjectsNeeded || "");

/** A stage that cannot run says why in the same shape as one that did. */
const blocked = (stage, reason) => ({ stage, ok: false, blocked: true, reason, dryRun: false });

/**
 * The matching parameters for a lead, built the same way the enquiry's own
 * auto-broadcast built them, so a shortlist made here and one made there
 * cannot disagree.
 */
export function matchParamsFor(lead) {
  const ward = firstWardOf(lead);
  const addr = parseAddress(lead.address);
  return {
    pincode: lead.pincode || addr.pincode || "",
    area: lead.area || addr.area || "",
    locality: lead.locality || addr.locality || "",
    landmark: lead.landmark || addr.landmark || "",
    city: lead.city || addr.city || lead.geoInfo?.city || "",
    district: lead.district || addr.district || "",
    state: lead.state || addr.state || lead.geoInfo?.region || "",
    grade: ward.classGrade || "",
    board: ward.curriculum || "",
    subjects: Array.isArray(ward.subjectsNeeded) ? ward.subjectsNeeded : [],
    timing: lead.preferredTime || "",
    gender: lead.preferredGender || "No Preference",
    latitude: lead.latitude || null,
    longitude: lead.longitude || null,
  };
}

// =============================================================
// Stage 1 — Re-Confirmation to the parent
// =============================================================

/**
 * Seven of this template's ten variables are Odoo `field` variables reading
 * off the CRM lead, so the message can only be built against that record.
 * Without the Odoo lead id the composer would fall back to an unrelated
 * record and the parent would be shown somebody else's requirement, so a lead
 * that has not synced is refused rather than sent wrong.
 *
 * The three free-text variables are addressed by their placeholder — {{6}},
 * {{8}}, {{10}} — because on a mixed template the free-text slots are
 * numbered among themselves, not by position in the body.
 *
 * Each real send is recorded, so the board can show it and a second press
 * cannot message the parent again without `resend`.
 */
export async function reconfirmRequirement(lead, { dryRun = false, resend = false } = {}) {
  const stage = "reconfirm";
  const phoneNumber = lead?.phone || "";
  if (!phoneNumber) return blocked(stage, "This enquiry has no phone number.");

  const requirementId = lead?.requirementId || "";
  if (!requirementId) return blocked(stage, "This enquiry has no requirement ID.");
  const previous = await db().collection("parent_reconfirmations")
    .find({ requirementId, sent: true }).sort({ sentAt: -1 }).limit(1).next();
  if (previous && !resend) {
    return blocked(stage, `The parent was already sent this on ${whenSent(previous.sentAt)}.`);
  }

  if (!lead.odooLeadId) {
    return blocked(
      stage,
      "This enquiry has not synced to Odoo yet. Most of this template is filled from the Odoo lead, " +
        "so sending it now would show the parent another lead's details. Sync the lead first.",
    );
  }

  const ward = firstWardOf(lead);
  const templateVars = {
    "{{6}}": lead.preferredTime || lead.classTimingSlot || "—",
    "{{8}}": lead.monthlyFees != null && lead.monthlyFees !== "" ? String(lead.monthlyFees) : "—",
    "{{10}}": PLAN_NAMES[lead.planType] || lead.planType || "—",
  };

  // Worded like the template, for the case where the parent messaged us in the
  // last 24 hours and a plain message is allowed.
  const messageBody =
    `Hello *Parent,*\n\nAs discussed over the call, here are your requirement details:\n\n` +
    `• Grade(s): *${ward.classGrade || "—"} ${ward.curriculum || ""}*\n` +
    `• Subject(s): *${subjectsOf(ward) || "—"}*\n` +
    `• Location: *${[lead.area, lead.city].filter(Boolean).join(", ") || "—"}*\n` +
    `• Tutor Gender: *${lead.preferredGender || "No Preference"}*\n` +
    `• Class Timing: *${templateVars["{{6}}"]}*\n` +
    `• Sessions/Week: *${lead.daysPerWeek || "—"}*\n` +
    `• Duration: *${lead.hoursPerDay || "—"}*\n` +
    `• Plan: *${templateVars["{{10}}"]}*\n\n` +
    `• Monthly Fees: ₹${templateVars["{{8}}"]}\n\nKindly Re-confirm the details:`;

  const plan = {
    stage,
    ok: true,
    dryRun,
    templateName: RECONFIRM_TEMPLATE,
    odooLeadId: lead.odooLeadId,
    phoneNumber,
    templateVars,
    messageBody,
    buttons: ["Yes,Correct", "Change some details"],
  };
  if (dryRun) return { ...plan, sent: false, note: "Dry run — nothing was sent." };

  const result = await sendWhatsAppToTutor({
    phoneNumber,
    messageBody,
    templateName: RECONFIRM_TEMPLATE,
    templateVars,
    resId: Number(lead.odooLeadId),
    forceTemplate: true, // the two reply buttons only exist on the template
  });

  await db().collection("parent_reconfirmations").insertOne({
    requirementId,
    leadId: String(lead._id),
    phone: phoneNumber,
    templateName: RECONFIRM_TEMPLATE,
    sent: result.success === true,
    messageId: result.messageId || null,
    failureReason: result.failureReason || "",
    source: "panel 2 re-confirmation button",
    sentAt: new Date(),
  });

  return {
    ...plan,
    sent: result.success,
    messageId: result.messageId || null,
    usedTemplate: result.usedTemplate,
    failureReason: result.failureReason || "",
  };
}

/** Last ten digits, so 09876543210 and +91 98765 43210 are one person. */
const last10 = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
};

/**
 * A short sign-up form record, shaped so the matching engine can score it.
 *
 * The form asks for the three things the ranking is actually built on: where
 * they are, what they do, and how long they have taught. Nothing is asked
 * about subjects, grades, boards, timings or gender, so those factors score
 * zero and the person ranks on distance and experience alone — which is
 * honest, rather than flattering them with marks for things nobody knows.
 *
 * The flattening matters: the form stores `location` as an object, while the
 * scorer reads `tutor.location` as an area name. Passing the object straight
 * through would put "[object Object]" into the area comparison.
 */
/**
 * One row per person, newest first in, duplicates dropped.
 *
 * Nothing stops somebody filling the form in twice, and plenty have: 17
 * numbers appear more than once and one appears four times. Without this a
 * single person takes four of the twenty places on a shortlist. The most
 * recent submission wins, since it is the one most likely to be current. A
 * record with no usable number is kept, because there is nothing to match it
 * against and dropping it would lose a real person.
 */
function dedupePartials(rowsNewestFirst) {
  const seen = new Set();
  const kept = [];
  for (const row of rowsNewestFirst) {
    const key = last10(row.whatsapp);
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    kept.push(row);
  }
  return kept;
}

export function partialAsTutor(p) {
  const loc = p.location || {};
  return {
    _id: p._id,
    name: p.name || "",
    whatsapp: p.whatsapp || "",
    phone: p.whatsapp || "",
    experience: p.experience || "",
    occupation: p.occupation || "",
    area: loc.area || "",
    city: loc.city || "",
    pincode: loc.pincode || "",
    location: loc.placeLabel || loc.area || "",
    latitude: loc.latitude ?? null,
    longitude: loc.longitude ?? null,
    isPartial: true,
  };
}

// ---------------------------------------------------------------
// Occupation
// ---------------------------------------------------------------
//
// The third thing both forms ask about, alongside where somebody is and how
// long they have taught. College Lecturer first, then School Teacher: the
// order the office actually works to. The matching engine has no occupation
// factor at all, so this is added here, to every candidate — registered and
// sign-up form alike — rather than inside the shared engine, where it would
// silently change the recommendation API and the old auto-broadcast too.
//
// Occupation is worth a quarter of the whole score. Edit this share and the
// standings below to change the priority; nothing else needs touching.
export const OCCUPATION_SHARE = 0.25;

/** Relative standing, before it is scaled to the share above. */
const OCCUPATION_FRACTION = {
  "college lecturer": 1,
  "school teacher": 0.8,
  "working professional": 0.55,
  freelancer: 0.55,
  other: 0.4,
  student: 0.25,
};

/**
 * Anything not recognised — blank, or a one-off label like "Law Faculty" —
 * lands mid-table rather than at the bottom. Nearly half the registered
 * tutors have no occupation on file, and scoring them zero would drop those
 * 163 people below a student who happened to tick a box on the short form. A
 * missing answer is not a bad answer.
 */
const UNKNOWN_FRACTION = 0.55;

export function occupationFraction(occupation) {
  const key = String(occupation || "").trim().toLowerCase();
  if (!key) return UNKNOWN_FRACTION;
  return OCCUPATION_FRACTION[key] ?? UNKNOWN_FRACTION;
}

/**
 * How many points occupation is worth for this requirement.
 *
 * The engine's own maximum moves with how much the parent specified — a lead
 * with no board or timing is marked out of less — so a fixed number would be
 * a different share on every enquiry. Solving w / (engineMax + w) = share
 * keeps it at exactly a quarter whatever else was asked for.
 */
export function occupationWeight(engineMax) {
  return Math.round(((engineMax || 100) * OCCUPATION_SHARE) / (1 - OCCUPATION_SHARE));
}

export function occupationScore(occupation, engineMax = 155) {
  return Math.round(occupationWeight(engineMax) * occupationFraction(occupation));
}

/** Added to every candidate's score, and to the denominator, so percentages stay comparable. */
function withOccupation(score, tutor) {
  const weight = occupationWeight(score.maxPossibleScore);
  const points = Math.round(weight * occupationFraction(tutor.occupation));
  const total = score.score + points;
  const max = score.maxPossibleScore + weight;
  return {
    ...score,
    score: total,
    maxPossibleScore: max,
    percentage: Math.min(100, Math.round((total / (max || 100)) * 100)),
    breakdown: { ...score.breakdown, occupation: points },
  };
}

/** Named in the reason only when it actually lifted someone up the list. */
function occupationNote(occupation) {
  const key = String(occupation || "").trim().toLowerCase();
  return key === "college lecturer" || key === "school teacher"
    ? `Priority: ${String(occupation).trim()}`
    : "";
}

/**
 * The score a sign-up form entry has actually earned.
 *
 * The matching engine awards full marks when a field is missing — twenty for
 * grade when `grades` is empty, ten for gender when `gender` is unset. That
 * rule is deliberate and right for registered tutors, whose profiles are
 * often thin, and it must stay as it is for them.
 *
 * Applied to a form entry it is nonsense: almost every field is missing, so
 * the rule hands them thirty unearned points and floats them above tutors who
 * genuinely teach the subject. So a form entry keeps only what the form
 * actually asked about — where they are and how long they have taught — and
 * scores zero on the rest. The denominator is left alone, so the percentages
 * stay directly comparable with a registered tutor's.
 */
const PARTIAL_CAN_EARN = new Set(["pincode", "area", "city", "experience"]);

function earnedByPartial(score) {
  const kept = Object.fromEntries(
    Object.entries(score.breakdown).map(([k, v]) => [k, PARTIAL_CAN_EARN.has(k) ? v : 0]),
  );
  const total = Object.values(kept).reduce((n, v) => n + v, 0);
  return {
    ...score,
    score: total,
    percentage: Math.min(100, Math.round((total / (score.maxPossibleScore || 100)) * 100)),
    breakdown: kept,
  };
}

// =============================================================
// Stage 2 — shortlist the best tutors
// =============================================================

export async function shortlistTutors(lead, {
  limit = SHORTLIST_SIZE, dryRun = false, includePartial = true, radiusKm = SHORTLIST_RADIUS_KM,
} = {}) {
  const stage = "shortlist";
  const requirementId = lead?.requirementId || "";
  if (!requirementId) return blocked(stage, "This enquiry has no requirement ID.");

  const params = matchParamsFor(lead);
  const registered = await Tutor.find(buildCentralizedQuery(params));

  // Everyone who filled in the short sign-up form is a candidate too — see
  // partialAsTutor for what is known about them and what is not. Nobody is
  // dropped for being unverified; the only ones left out are the ones who are
  // already in the running under their registered record, so that the same
  // person cannot occupy two places on one shortlist.
  //
  // The check is against every *approved* tutor, and only those. Two
  // different mistakes are being avoided at once:
  //
  //   - against only this requirement's matches, an approved tutor who failed
  //     the grade or gender test would reappear through the sign-up form.
  //     Being filtered out is an answer, not another door to try.
  //   - against every tutor on file, the thirty-four people who are pending
  //     here and also filled in the form would vanish from both pools: out of
  //     the first for not being approved, out of the second as duplicates of
  //     a record that is not in the running either.
  //
  // So an approved tutor is already represented and their form entry is
  // dropped; anyone else is carried by their form entry.
  const onFile = await Tutor.find({ status: "approved" }, { whatsapp: 1, phone: 1 }).lean();
  const registeredPhones = new Set(
    onFile.flatMap((t) => [last10(t.whatsapp), last10(t.phone)]).filter(Boolean),
  );
  const partials = includePartial
    ? dedupePartials(
        (await PartialTutor.find({ status: { $ne: "registered" } })
          .sort({ createdAt: -1 }).lean())
          .filter((p) => {
            const key = last10(p.whatsapp);
            return !key || !registeredPhones.has(key);
          }),
      ).map(partialAsTutor)
    : [];

  const candidates = [...registered, ...partials];

  const hasLocation = !!(
    params.pincode || params.area || params.locality ||
    params.landmark || params.city || params.district || params.state
  );

  const scored = candidates
    .map((tutor) => {
      const raw = calculateTutorScore(params, tutor);
      // earnedByPartial strips the engine's unearned marks; occupation is
      // added after, because a form entry did declare that one.
      const score = withOccupation(tutor.isPartial ? earnedByPartial(raw) : raw, tutor);
      return {
        doc: tutor,
        name: tutor.name,
        tutorId: tutor._id,
        tutorCode: tutor.tutorCode || "",
        experience: tutor.experience || "",
        occupation: tutor.occupation || "",
        isPartial: tutor.isPartial === true,
        phone: tutor.isPartial ? tutor.whatsapp : undefined,
        score: score.score,
        matchPercentage: score.percentage,
        locationScore: score.locationScore,
        distanceKm: score.distanceKm,
        distanceTier: score.distanceTier,
        reason: [computeMatchReason(params, tutor, score), occupationNote(tutor.occupation)]
          .filter(Boolean).join(" • "),
      };
    })
    // Too far to teach this family, so out — before anything else is weighed.
    // Somebody whose distance cannot be worked out, because one end has no
    // coordinates, is kept and judged on the pincode, area and city match
    // instead of being thrown away for missing data.
    .filter((t) => t.distanceKm == null || t.distanceKm <= radiusKm)
    // A tutor who matches nothing about where the family is, is not a match at
    // all; without this they ride in on subject alone from another city.
    .filter((t) => !(hasLocation && t.locationScore === 0) && t.matchPercentage > 0)
    .sort((a, b) => {
      // Approved tutors first, always. Somebody who registered and was
      // approved outranks somebody who only filled in the short form, however
      // well that entry scores — the form entries take whatever places are
      // left once the approved ones run out, which on a thinly covered area
      // is most of the list and on a dense one is none of it.
      if (a.isPartial !== b.isPartial) return a.isPartial ? 1 : -1;

      // Then distance, which leads. compareTutors treats two people within a
      // kilometre of each other as equally near and lets the score settle it,
      // so occupation's quarter decides between neighbours rather than
      // dragging somebody in from the far side of the city.
      return compareTutors(a, b);
    });

  const top = scored.slice(0, limit);
  const tutors = top.map((t, i) => ({
    rank: i + 1,
    tutorId: String(t.tutorId),
    name: t.name,
    tutorCode: t.tutorCode,
    score: t.score,
    matchPercentage: t.matchPercentage,
    distanceKm: t.distanceKm,
    experience: t.experience,
    occupation: t.occupation,
    reason: t.reason,
    // Marked so the board, and the invite step, can tell at a glance that
    // this person has not registered yet.
    isPartial: t.isPartial,
    ...(t.isPartial ? { phone: t.phone || "", source: "partial sign-up form" } : {}),
  }));

  const partialCount = tutors.filter((t) => t.isPartial).length;

  const plan = {
    stage,
    ok: true,
    dryRun,
    requirementId,
    limit,
    candidatesConsidered: candidates.length,
    registeredConsidered: registered.length,
    partialConsidered: partials.length,
    radiusKm,
    matchedCount: scored.length,
    tutorCount: tutors.length,
    partialCount,
    tutors,
  };
  if (dryRun) return { ...plan, saved: false, note: "Dry run — no shortlist was saved." };
  if (!tutors.length) return { ...plan, saved: false, note: "No tutor matched, so nothing was saved." };

  await db().collection("tutor_shortlists").insertOne({
    requirementId,
    leadId: String(lead._id),
    tutors,
    tutorCount: tutors.length,
    partialCount,
    candidatesConsidered: candidates.length,
    radiusKm,
    source: "panel 2 shortlist button",
    matchedAt: new Date(),
  });

  return { ...plan, saved: true };
}

/**
 * The person a shortlist row points at, from whichever list holds them.
 *
 * From here on a partial tutor is treated as a tutor: invited, counted,
 * offered to the parent, chosen. The only differences are the ones that
 * cannot apply — they have no tutor code, no approval status and no
 * availability flag — so those checks are skipped rather than failed.
 */
async function findCandidate(row) {
  if (row.isPartial) {
    const p = row.tutorId ? await PartialTutor.findById(row.tutorId).catch(() => null) : null;
    if (!p) return null;
    return {
      _id: p._id,
      name: p.name || "",
      phone: p.whatsapp || "",
      tutorCode: "",
      isPartial: true,
      blocked: false,
      notApproved: "",
    };
  }

  const t = row.tutorId
    ? await Tutor.findById(row.tutorId).catch(() => null)
    : await Tutor.findOne({ tutorCode: row.tutorCode });
  if (!t) return null;
  return {
    _id: t._id,
    name: t.name || "",
    phone: t.whatsapp || t.phone || "",
    tutorCode: t.tutorCode || "",
    isPartial: false,
    blocked: t.availabilityStatus === "Blocked",
    notApproved: t.status === "approved" ? "" : (t.status || "not approved"),
  };
}

// =============================================================
// Stage 3 — invite tutors to the requirement
// =============================================================

/**
 * Invites the top tutors on the most recent shortlist.
 *
 * `ignoreOnboarding` is on by default and is the whole point of the button:
 * the automatic path only invites a tutor marked onboardingCompleted, which
 * almost no approved tutor is, so it finds nobody. Here an approved tutor who
 * is not blocked is invited whether or not anyone ticked that box.
 */
export async function inviteTutors(lead, { limit = INVITE_SIZE, dryRun = false, resend = false } = {}) {
  const stage = "invite";
  const requirementId = lead?.requirementId || "";
  if (!requirementId) return blocked(stage, "This enquiry has no requirement ID.");
  if (lead.assignedTutor) {
    return blocked(stage, `${lead.assignedTutor} is confirmed on this enquiry. Unassign them in the admin panel to start again.`);
  }

  // The newest shortlist with tutors on it: a later run that found nobody must
  // not hide the list these tutors were invited from.
  const shortlist = await db().collection("tutor_shortlists")
    .find({ requirementId, "tutors.0": { $exists: true } }).sort({ matchedAt: -1 }).limit(1).next();
  if (!shortlist || !(shortlist.tutors || []).length) {
    return blocked(stage, "There is no shortlist for this enquiry yet. Shortlist the tutors first.");
  }

  const ward = firstWardOf(lead);
  const planned = [];

  for (const row of shortlist.tutors) {
    if (planned.filter((p) => p.willSend).length >= limit) break;

    const tutor = await findCandidate(row);

    if (!tutor) {
      planned.push({
        name: row.name, willSend: false,
        skipReason: row.isPartial ? "Partial tutor form entry is no longer on file" : "Tutor record not found",
      });
      continue;
    }
    if (tutor.blocked) {
      planned.push({ name: tutor.name, willSend: false, skipReason: "Tutor is Blocked" });
      continue;
    }
    if (tutor.notApproved) {
      planned.push({ name: tutor.name, willSend: false, skipReason: `Tutor is ${tutor.notApproved}` });
      continue;
    }
    const phoneNumber = tutor.phone;
    if (!phoneNumber) {
      planned.push({ name: tutor.name, willSend: false, skipReason: "No WhatsApp number" });
      continue;
    }
    if (!resend) {
      // A failed attempt never reached the tutor, so pressing Invite again is
      // how it is retried: nothing retries these on a timer any more.
      const already = await BroadcastLog.findOne({
        requirementId, tutorId: tutor._id, broadcastType: "requirement", status: { $ne: "Failed" },
      }).select("_id").lean();
      if (already) {
        planned.push({ name: tutor.name, willSend: false, skipReason: "Already invited for this requirement" });
        continue;
      }
    }

    planned.push({
      name: tutor.name,
      tutorId: String(tutor._id),
      tutorCode: tutor.tutorCode,
      isPartial: tutor.isPartial,
      distanceKm: row.distanceKm,
      matchPercentage: row.matchPercentage,
      willSend: true,
      doc: tutor,
    });
  }

  const toSend = planned.filter((p) => p.willSend);
  const chosen = await chooseRequirementTemplate();

  const summary = {
    stage,
    ok: true,
    dryRun,
    requirementId,
    limit,
    templateName: chosen.templateName,
    shortlistSize: shortlist.tutors.length,
    willSend: toSend.length,
    skipped: planned.filter((p) => !p.willSend).map(({ name, skipReason }) => ({ name, skipReason })),
  };

  if (dryRun) {
    return {
      ...summary,
      sent: 0,
      note: "Dry run — no invite was sent and no log was written.",
      preview: toSend.slice(0, 3).map((p) => ({
        name: p.name,
        templateVars: chosen.buildVars(p.name, lead, ward),
      })),
      partialCount: toSend.filter((p) => p.isPartial).length,
      tutors: toSend.map(({ name, tutorCode, distanceKm, isPartial }) =>
        ({ name, tutorCode, distanceKm, isPartial })),
    };
  }

  const results = [];
  for (const p of toSend) {
    const tutor = p.doc;
    const phoneNumber = tutor.phone;
    const messageBody = buildBroadcastMessage(tutor.name, lead, ward, null);

    const log = await new BroadcastLog({
      tutorId: tutor._id,
      tutorName: tutor.name,
      tutorPhone: phoneNumber,
      tutorCode: tutor.tutorCode,
      tutorSource: tutor.isPartial ? "partial" : "tutor",
      requirementId,
      leadId: lead._id,
      type: "whatsapp",
      message: messageBody,
      status: "Sending",
      adminName: "Panel 2",
      adminEmail: "",
      distanceKm: p.distanceKm,
      matchPercentage: p.matchPercentage,
      broadcastType: "requirement",
    }).save();

    const result = await sendWhatsAppToTutor({
      phoneNumber,
      messageBody,
      templateName: chosen.templateName,
      templateLang: "en",
      templateVars: chosen.buildVars(tutor.name, lead, ward),
    });

    await BroadcastLog.findByIdAndUpdate(log._id, {
      status: result.success ? "Sent" : "Failed",
      failureReason: result.failureReason || "",
      retryCount: result.retryCount || 0,
      whatsappMessageId: result.messageId || "",
      usedTemplate: result.usedTemplate || false,
      templateName: result.usedTemplate ? chosen.templateName : "",
    });

    results.push({
      name: tutor.name,
      sent: result.success,
      failureReason: result.failureReason || "",
    });
  }

  return { ...summary, sent: results.filter((r) => r.sent).length, results };
}

// =============================================================
// Stage 4 — the best three go to the parent
// =============================================================

/**
 * Ranks whoever said Interested and offers the best three to the parent.
 *
 * The seven-hour wait the scheduler enforced does not apply here: a person
 * pressed the button, which is the decision that wait existed to make.
 */
export async function sendTopThree(lead, { dryRun = false, force = false } = {}) {
  const stage = "top3";
  const requirementId = lead?.requirementId || "";
  if (!requirementId) return blocked(stage, "This enquiry has no requirement ID.");
  if (!lead.phone) return blocked(stage, "This enquiry has no phone number.");
  if (lead.assignedTutor) {
    return blocked(stage, `${lead.assignedTutor} is confirmed on this enquiry. Unassign them in the admin panel to start again.`);
  }

  const alreadySent = await db().collection("tutor_top3").countDocuments({ requirementId, sent: true });
  if (alreadySent && !force) {
    return blocked(stage, "The parent has already been sent their options.");
  }

  const shortlist = await db().collection("tutor_shortlists")
    .find({ requirementId, "tutors.0": { $exists: true } }).sort({ matchedAt: -1 }).limit(1).next();
  const logs = await db().collection("broadcastlogs")
    .find({ requirementId, broadcastType: "requirement" }).toArray();

  const ranked = rankInterested(shortlist?.tutors || [], logs);
  if (!ranked.length) {
    return blocked(stage, "No invited tutor has said Interested yet, so there is nothing to offer.");
  }

  const top = ranked.slice(0, 3);
  const codes = top.map((t) => t.tutorCode).filter(Boolean);
  const photos = new Map(
    (codes.length
      ? await db().collection("tutors")
          .find({ tutorCode: { $in: codes } }, { projection: { tutorCode: 1, photo: 1 } }).toArray()
      : []
    ).map((t) => [t.tutorCode, t.photo || ""]),
  );

  const offered = top.map((t) => ({
    name: t.name,
    tutorCode: t.tutorCode,
    score: t.score,
    experience: t.experience,
    occupation: t.occupation,
    distanceKm: t.distanceKm,
    photo: t.photo || photos.get(t.tutorCode) || "",
  }));

  const plan = {
    stage,
    ok: true,
    dryRun,
    requirementId,
    interestedCount: ranked.length,
    offeredCount: offered.length,
    photoCards: SEND_PHOTO_CARDS,
    tutors: offered.map((t, i) => ({ choice: i + 1, ...t, photo: t.photo ? "(on file)" : "" })),
  };
  if (dryRun) return { ...plan, sent: false, note: "Dry run — the parent was not messaged." };

  let cards = null;
  let result = null;
  let error = "";
  try {
    if (SEND_PHOTO_CARDS) cards = await sendTutorCards(lead, offered);
    result = await sendTutorOptions(lead, offered);
  } catch (err) {
    error = err.message;
  }

  await db().collection("tutor_top3").insertOne({
    requirementId,
    leadId: String(lead._id),
    parentName: lead.parentName || "",
    parentPhone: lead.phone || "",
    interestedCount: ranked.length,
    offeredCount: offered.length,
    tutors: offered.map((t, i) => ({ choice: i + 1, ...t })),
    templateName: result?.templateName || "",
    cardsSent: cards ? cards.sent : 0,
    messageId: result?.messageId || null,
    cardResults: cards ? cards.results : [],
    sent: result?.sent === true,
    failureReason: error || result?.failureReason || "",
    outcome: result?.sent ? "sent_to_parent" : "send_failed",
    source: "panel 2 top three button",
    preparedAt: new Date(),
  });

  return {
    ...plan,
    sent: result?.sent === true,
    cardsSent: cards ? cards.sent : 0,
    templateName: result?.templateName || "",
    failureReason: error || result?.failureReason || "",
  };
}

// =============================================================
// Stage 5 — tell the tutor the parent picked
// =============================================================

/**
 * Records the parent's choice and tells that tutor.
 *
 * The variable order matches the approved template exactly: {{1}} tutor,
 * {{2}} requirement ID, {{3}} grade, {{4}} subjects, {{5}} location. Keep it
 * in step with POST /api/parent-enquiries/:id/select-tutor, which sends the
 * same message from the admin dashboard.
 */
export async function notifySelectedTutor(lead, tutorId, { dryRun = false, force = false } = {}) {
  const stage = "selected";
  if (!tutorId) return blocked(stage, "No tutor was chosen.");

  // Panel 2 knows tutors by their code; the dashboard passes a Mongo id. A
  // partial tutor has no code, so they are looked for in their own list by
  // id: the parent picked them, so they are told like anyone else.
  const byId = mongoose.isValidObjectId(tutorId);
  const tutor = (byId
    ? await Tutor.findById(tutorId).catch(() => null)
    : await Tutor.findOne({ tutorCode: String(tutorId) }))
    || (byId ? await PartialTutor.findById(tutorId).catch(() => null) : null);
  if (!tutor) return blocked(stage, "That tutor was not found.");

  const already = lead.assignedTutorId ? String(lead.assignedTutorId) : "";
  if (already && already !== String(tutor._id) && !force) {
    return blocked(stage, `This enquiry is already with ${lead.assignedTutor || "another tutor"}. Unassign them in the admin panel first.`);
  }
  if (already && already === String(tutor._id) && !force) {
    return blocked(stage, `${tutor.name} has already been told they were selected.`);
  }

  const ward = firstWardOf(lead);
  const phoneNumber = tutor.whatsapp || tutor.phone || "";
  if (!phoneNumber) return blocked(stage, `${tutor.name} has no WhatsApp number.`);

  const templateVars = {
    tutor_name: tutor.name || "",
    requirement_id: lead.requirementId || "",
    grade: ward.classGrade ? `Grade ${ward.classGrade}` : "",
    subjects: subjectsOf(ward),
    location: [lead.area, lead.city].filter(Boolean).join(", "),
  };

  const messageBody =
    `Hello *${templateVars.tutor_name}'s - Demo Selection Update!*\n\n` +
    `The parent *(ID - ${templateVars.requirement_id})* has selected your profile ` +
    `for the following tuition requirement.\n\n` +
    `Grade: ${templateVars.grade}\nSubject(s): ${templateVars.subjects}\n` +
    `Location: ${templateVars.location}\n\n` +
    `Your selection is confirmed at the shortlisting stage.\n\n` +
    `*Our coordination team will contact you to confirm the demo schedule.*`;

  const plan = {
    stage,
    ok: true,
    dryRun,
    tutorName: tutor.name,
    phoneNumber,
    templateName: SELECTION_TEMPLATE,
    templateVars,
    messageBody,
  };
  if (dryRun) return { ...plan, sent: false, recorded: false, note: "Dry run — nothing was sent or saved." };

  const result = await sendWhatsAppToTutor({
    phoneNumber,
    messageBody,
    templateName: SELECTION_TEMPLATE,
    templateVars,
  });

  // Only a tutor who was really told counts as assigned. Recording it first
  // would leave a failed send looking done, and block pressing it again.
  if (result.success) {
    lead.assignedTutor = tutor.name;
    lead.assignedTutorId = tutor._id;
    await lead.save({ validateBeforeSave: false });

    await BroadcastLog.updateMany(
      { leadId: lead._id, tutorId: tutor._id },
      { $set: { responseStatus: "Assigned", respondedAt: new Date() } },
    );

    // Odoo is told who was picked, but not about a demo that does not exist.
    if (lead.odooLeadId) {
      await updateLeadAssignment(lead.odooLeadId, {
        tutorName: tutor.name,
        tutorCode: tutor.tutorCode || "",
        tutorPhone: phoneNumber,
        keepStatus: true,
      });
    }
  }

  return {
    ...plan,
    recorded: result.success === true,
    sent: result.success,
    messageId: result.messageId || null,
    failureReason: result.failureReason || "",
  };
}

export const STAGES = {
  reconfirm: reconfirmRequirement,
  shortlist: shortlistTutors,
  invite: inviteTutors,
  top3: sendTopThree,
  selected: notifySelectedTutor,
};
