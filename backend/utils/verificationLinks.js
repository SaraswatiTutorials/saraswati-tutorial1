/**
 * Panel 2's "Verification & agreement" step.
 *
 * For a group of tutors on an enquiry — the top 3 offered to the parent, or
 * everyone invited (up to 10) — each tutor is checked for two things:
 *
 *   1. Full verification. A partial tutor (short sign-up form, never completed
 *      the full registration) gets the PROFILE template: a button that opens
 *      the Tutor Portal login with their tutor ID filled in. They sign in with
 *      their mobile number and fill in "Full verification".
 *   2. Signed agreement. Anyone without a signed agreement in Odoo Sign gets
 *      the AGREEMENT template: a button that opens the agreement to sign.
 *
 * Missing both: both messages, login link first. Missing one: that one.
 * Neither: nothing. The agreement is checked live in Odoo Sign when the step
 * runs, so a tutor who signed a minute ago is not asked again.
 *
 * The same message is not sent to the same tutor twice within RECENT_HOURS
 * (any enquiry), unless `resend` is set. Every send is recorded in
 * VerificationSend, which the board shows per tutor.
 *
 * One tutor: pass `tutorId` (a tutor or partial tutor id, or a tutor ID like
 * TUT0218) to send only to them — the "Send again" buttons. That always
 * resends, and `kind` ("agreement" or "profile") limits it to one message.
 * No enquiry is needed then.
 */

import { agreementsByTutor } from "./agreementSync.js";

export const PROFILE_TEMPLATE = process.env.WHATSAPP_PROFILE_LINK_TEMPLATE || "tutor_full_verification";
export const AGREEMENT_TEMPLATE = process.env.WHATSAPP_AGREEMENT_LINK_TEMPLATE || "tutor_agreement_sign";

/** The shared Odoo Sign link for the Tutor Engagement agreement (sign request 242). */
export const AGREEMENT_LINK = process.env.TUTOR_AGREEMENT_SIGN_LINK ||
  "https://odoo.saraswatitutorial.com/sign/document/mail/242/08a6535e-f877-49a0-a066-8cbab5ca8694";

/** Tutor Portal login; the tutor ID (or number) is added to the end and fills the box. */
export const PORTAL_LOGIN_URL = process.env.TUTOR_PORTAL_LOGIN_URL || "https://saraswatitutorial.com/teacher/login?id=";

export const RECENT_HOURS = Number(process.env.VERIFICATION_RESEND_HOURS || 24);
export const GROUPS = { top3: "Top 3 tutors", invited: "Invited tutors", single: "One tutor" };
export const KINDS = ["profile", "agreement"];

const last10 = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length >= 10 ? d.slice(-10) : ""; };

export function loginLinkFor(person) {
  return PORTAL_LOGIN_URL + encodeURIComponent(person.tutorCode || last10(person.phone));
}

// Sent as plain text instead of the template when the tutor wrote to us in
// the last 24 hours (WhatsApp's rule), so the link is in the text itself.
export function profileMessage(name, link) {
  return `Hello *${name}*,\n\n` +
    `*Your profile has been shortlisted for a Saraswati Tutorials tuition requirement.*\n\n` +
    `To move ahead, please complete your *Full Verification* on the Tutor Portal:\n` +
    `1. Open ${link}\n2. Sign in with your *registered mobile number*\n` +
    `3. Open *Full verification* and fill in all your details and documents\n\n` +
    `_Only fully verified tutors receive parent contact details and demo confirmations._`;
}

export function agreementMessage(name, link) {
  return `Hello *${name}*,\n\n` +
    `*Your tutor profile has been matched with a Saraswati Tutorials tuition requirement.*\n\n` +
    `A *one-time Tutor Engagement Agreement* must be signed before we can share the assignment with you.\n\n` +
    `Sign it here: ${link}\n\n` +
    `_Please use the same name and mobile number you registered with._`;
}

const when = (d) => new Date(d).toLocaleString("en-IN", {
  timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
});

/**
 * Works out, sends (unless dryRun) and records the messages for one group.
 * `deps` are the outside world; see defaultDeps for the real ones.
 */
export async function sendVerificationLinks(lead, { group = "top3", dryRun = true, resend = false, tutorId = "", kind = "" } = {}, deps) {
  const stage = "verify";
  const requirementId = lead?.requirementId || "";
  const blocked = (reason) => ({ stage, ok: false, blocked: true, reason, dryRun });
  if (tutorId) { group = "single"; resend = true; }
  if (!GROUPS[group]) return blocked(`Unknown group "${group}".`);
  if (kind && !KINDS.includes(kind)) return blocked(`Unknown message "${kind}".`);
  if (!requirementId && group !== "single") return blocked("This enquiry has no requirement ID.");

  const d = deps || (await defaultDeps());

  const members = group === "single"
    ? [{ tutorId: String(tutorId), tutorCode: String(tutorId), name: String(tutorId) }]
    : await d.groupMembers(lead, group);
  if (!members.length) {
    return blocked(group === "top3"
      ? "No tutor has said yes yet, so there is no top 3 to check."
      : "No tutor has been invited for this enquiry yet.");
  }

  // The same person can be reached two ways (partial form and the record they became)
  const people = [];
  const missing = [];
  for (const m of members) {
    const p = await d.resolvePerson(m);
    if (!p) { missing.push(m.name || m.tutorCode || "(unknown)"); continue; }
    if (!people.some((x) => x.id === p.id)) people.push(p);
  }
  if (!people.length) return blocked("None of these tutors could be found in the database.");

  let signers;
  try {
    signers = await d.readSigners();
  } catch (err) {
    return blocked(`Could not check Odoo Sign, so nothing was sent: ${err.message}`);
  }
  const signed = agreementsByTutor({
    ...signers,
    tutors: people.map((p) => ({ _id: p.id, phone: p.phone, whatsapp: p.whatsapp, email: p.email })),
  });

  const approved = {
    profile: await d.isApproved(PROFILE_TEMPLATE),
    agreement: await d.isApproved(AGREEMENT_TEMPLATE),
  };
  const recent = await d.recentSends(people.map((p) => p.id), requirementId, RECENT_HOURS);

  const plan = people.map((p) => {
    const agreement = signed.get(p.id) || { status: "none" };
    const decide = (k, needed, doneReason) => {
      if (!needed) return { needed: false, willSend: false, reason: doneReason };
      if (kind && kind !== k) return { needed: true, willSend: false, reason: "Not asked for this time" };
      if (!p.phone) return { needed: true, willSend: false, reason: "No WhatsApp number" };
      if (!approved[k]) {
        return { needed: true, willSend: false,
          reason: `Template ${k === "profile" ? PROFILE_TEMPLATE : AGREEMENT_TEMPLATE} is not approved in Odoo yet` };
      }
      const prev = !resend && recent.find((r) => r.personId === p.id && r.kind === k);
      if (prev) return { needed: true, willSend: false, reason: `Already sent ${when(prev.at)}` };
      return { needed: true, willSend: true, reason: "" };
    };
    const profile = decide("profile", !p.fullyVerified, "Fully verified");
    const agree = decide("agreement", agreement.status !== "signed",
      `Signed${agreement.signedAt ? " " + when(agreement.signedAt) : ""}`);
    const gets = [profile.willSend && "login link", agree.willSend && "agreement"].filter(Boolean);
    return {
      person: p,
      row: {
        name: p.name,
        tutorCode: p.tutorCode,
        source: p.source,
        fullyVerified: p.fullyVerified,
        agreementStatus: agreement.status,
        agreementSignedAt: agreement.signedAt || null,
        profile, agreement: agree,
        gets: gets.length ? gets.join(" + ") : "nothing",
      },
    };
  });

  const summary = {
    stage, ok: true, dryRun, requirementId, group, groupLabel: GROUPS[group], kind: kind || "",
    templates: {
      profile: { name: PROFILE_TEMPLATE, approved: approved.profile },
      agreement: { name: AGREEMENT_TEMPLATE, approved: approved.agreement },
    },
    agreementLink: AGREEMENT_LINK,
    notFound: missing,
    profileCount: plan.filter((x) => x.row.profile.willSend).length,
    agreementCount: plan.filter((x) => x.row.agreement.willSend).length,
  };
  summary.willSend = summary.profileCount + summary.agreementCount;

  if (dryRun) {
    return { ...summary, sent: 0, tutors: plan.map((x) => x.row), note: "Dry run — nothing was sent or saved." };
  }

  const tutors = [];
  for (const { person: p, row } of plan) {
    const out = { ...row };
    for (const kind of ["profile", "agreement"]) {
      if (!row[kind].willSend) continue;
      const link = kind === "profile" ? loginLinkFor(p) : AGREEMENT_LINK;
      const templateName = kind === "profile" ? PROFILE_TEMPLATE : AGREEMENT_TEMPLATE;
      const result = await d.send({
        phoneNumber: p.phone,
        messageBody: kind === "profile" ? profileMessage(p.name, link) : agreementMessage(p.name, link),
        templateName,
        templateLang: "en",
        templateVars: { tutor_name: p.name || "Tutor", button_dynamic_url_1: link },
      });
      await d.record({
        requirementId, leadId: lead?._id || null, group,
        personId: p.id, tutorSource: p.source, tutorName: p.name, tutorCode: p.tutorCode, phone: p.phone,
        kind, templateName, link,
        status: result.success ? "Sent" : "Failed",
        failureReason: result.failureReason || "",
        whatsappMessageId: result.messageId || "",
        usedTemplate: result.usedTemplate === true,
      });
      out[kind] = { ...row[kind], sent: result.success === true, failureReason: result.failureReason || "" };
    }
    tutors.push(out);
  }
  const sends = tutors.flatMap((t) => [t.profile, t.agreement]).filter((k) => k.willSend);
  return { ...summary, sent: sends.filter((k) => k.sent).length, failed: sends.filter((k) => !k.sent).length, tutors };
}

/** Real MongoDB and Odoo, loaded only when the step runs. */
async function defaultDeps() {
  const [
    { default: mongoose }, { default: Tutor }, { default: PartialTutor }, { default: BroadcastLog },
    { default: VerificationSend }, { rankInterested }, { makeOdooReader, readOdooSigners },
    { sendWhatsAppToTutor, validateTemplate, getOdooUid },
  ] = await Promise.all([
    import("mongoose"), import("../models/Tutor.js"), import("../models/PartialTutor.js"), import("../models/BroadcastLog.js"),
    import("../models/VerificationSend.js"), import("./topThreeScheduler.js"), import("./agreementSync.js"),
    import("./whatsappService.js"),
  ]);
  const db = () => mongoose.connection.db;
  const asPerson = (t, partial) => (t
    ? { id: String(t._id), source: "tutor", name: t.name || partial?.name || "", phone: t.whatsapp || t.phone || partial?.whatsapp || "",
        whatsapp: t.whatsapp || "", email: t.email || "", tutorCode: t.tutorCode || partial?.tutorCode || "", fullyVerified: true }
    : { id: String(partial._id), source: "partial", name: partial.name || "", phone: partial.whatsapp || "",
        whatsapp: partial.whatsapp || "", email: "", tutorCode: partial.tutorCode || "", fullyVerified: false });

  return {
    async groupMembers(lead, group) {
      const requirementId = lead.requirementId;
      if (group === "invited") {
        const logs = await BroadcastLog.find(
          { requirementId, broadcastType: "requirement", status: { $ne: "Failed" } },
          { tutorId: 1, tutorCode: 1, tutorName: 1, tutorSource: 1 },
        ).sort({ createdAt: 1 }).lean();
        const seen = new Set();
        return logs.filter((l) => { const k = String(l.tutorId || l.tutorCode); if (seen.has(k)) return false; seen.add(k); return true; })
          .map((l) => ({ tutorId: l.tutorId ? String(l.tutorId) : "", tutorCode: l.tutorCode || "", name: l.tutorName || "" }));
      }
      // Top 3: the three offered to the parent; before that, the best three who said yes
      const sentTop3 = await db().collection("tutor_top3").find({ requirementId, sent: true }).sort({ preparedAt: -1 }).limit(1).next();
      if (sentTop3?.tutors?.length) {
        return sentTop3.tutors.map((t) => ({ tutorId: t.tutorId ? String(t.tutorId) : "", tutorCode: t.tutorCode || "", name: t.name || "" }));
      }
      const shortlist = await db().collection("tutor_shortlists")
        .find({ requirementId, "tutors.0": { $exists: true } }).sort({ matchedAt: -1 }).limit(1).next();
      const logs = await db().collection("broadcastlogs").find({ requirementId, broadcastType: "requirement" }).toArray();
      return rankInterested(shortlist?.tutors || [], logs).slice(0, 3)
        .map((t) => ({ tutorId: t.tutorId ? String(t.tutorId) : "", tutorCode: t.tutorCode || "", name: t.name || "" }));
    },

    async resolvePerson({ tutorId, tutorCode }) {
      const valid = tutorId && mongoose.isValidObjectId(tutorId);
      // An invite log can point at either list (a partial tutor who registered
      // is logged under the tutor record they became), so both are tried.
      let t = valid ? await Tutor.findById(tutorId).lean() : null;
      let p = !t && valid ? await PartialTutor.findById(tutorId).lean() : null;
      if (!t && !p && tutorCode) {
        t = (await Tutor.findOne({ tutorCode, status: "approved" }).lean()) || (await Tutor.findOne({ tutorCode }).lean());
        if (!t) p = await PartialTutor.findOne({ tutorCode }).lean();
      }
      if (p?.registeredTutorId) t = (await Tutor.findById(p.registeredTutorId).lean()) || null;
      if (t) return asPerson(t, p);
      return p ? asPerson(null, p) : null;
    },

    readSigners: async () => readOdooSigners(await makeOdooReader()),

    async isApproved(name) {
      const uid = await getOdooUid();
      return validateTemplate(uid, name);
    },

    async recentSends(personIds, requirementId, hours) {
      const since = new Date(Date.now() - hours * 3600 * 1000);
      const rows = await VerificationSend.find({
        personId: { $in: personIds }, status: "Sent",
        $or: [{ requirementId }, { createdAt: { $gte: since } }],
      }, { personId: 1, kind: 1, createdAt: 1 }).sort({ createdAt: -1 }).lean();
      return rows.map((r) => ({ personId: String(r.personId), kind: r.kind, at: r.createdAt }));
    },

    send: (opts) => sendWhatsAppToTutor(opts),
    record: (row) => VerificationSend.create(row),
  };
}
