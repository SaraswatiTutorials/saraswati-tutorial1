/**
 * Panel 2's "Demo send" page: shows someone (the founder, a tester) exactly
 * what a shortlisted partial tutor receives, on their own phone.
 *
 * For the number entered:
 *   1. The person is looked up as a tutor or partial tutor. If they are neither,
 *      a partial tutor record marked isDemo is made for them, so the login
 *      link really logs them in and they can do the full registration.
 *      isDemo records are never shortlisted for a real enquiry.
 *   2. BOTH WhatsApps go out, whatever the person has done already: the
 *      full-verification login link and the agreement to sign. The sends are
 *      recorded under requirement "DEMO".
 *
 * dryRun (the default) looks everything up and returns what would happen,
 * without creating a record or sending anything.
 */
import {
  sendVerificationLinks, PROFILE_TEMPLATE, AGREEMENT_TEMPLATE, AGREEMENT_LINK, PORTAL_LOGIN_URL,
  profileMessage, agreementMessage,
} from "./verificationLinks.js";

export const DEMO_REQUIREMENT = "DEMO";
export const DEMO_NAME = "Demo Tutor";

/** A 10-digit Indian mobile number from "+91 90411 57689", "09041157689", … or "". */
export function cleanNumber(v) {
  let d = String(v || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : "";
}

export async function demoVerification({ phone, name, dryRun = true } = {}, deps) {
  const num = cleanNumber(phone);
  if (!num) return { ok: false, reason: "Enter a valid 10-digit Indian mobile number." };
  const wantedName = String(name || "").trim().slice(0, 80) || DEMO_NAME;

  const d = deps || (await defaultDeps());
  const existing = await d.findPerson(num);
  const sendName = existing?.name || wantedName;
  const loginLink = PORTAL_LOGIN_URL + encodeURIComponent(existing?.tutorCode || num);

  const plan = {
    ok: true,
    dryRun,
    phone: num,
    name: sendName,
    person: existing,
    willCreate: !existing,
    loginLink,
    agreementLink: AGREEMENT_LINK,
    templates: {
      profile: { name: PROFILE_TEMPLATE, approved: await d.isApproved(PROFILE_TEMPLATE) },
      agreement: { name: AGREEMENT_TEMPLATE, approved: await d.isApproved(AGREEMENT_TEMPLATE) },
    },
    messages: {
      profile: profileMessage(sendName, loginLink),
      agreement: agreementMessage(sendName, AGREEMENT_LINK),
    },
  };
  if (!plan.templates.profile.approved || !plan.templates.agreement.approved) {
    return { ...plan, ok: false, reason: "Both WhatsApp templates must be approved in Odoo before the demo can be sent." };
  }
  if (dryRun) return { ...plan, note: "Preview only — nothing was created or sent." };

  const personId = existing?.id || (await d.createDemoPartial({ name: wantedName, whatsapp: num }));
  const result = await d.sendLinks({ requirementId: DEMO_REQUIREMENT }, { tutorId: personId, forceAll: true, dryRun: false });
  const row = result.tutors?.[0];
  return {
    ...plan,
    created: !existing,
    personId: String(personId),
    sent: result.sent || 0,
    profile: row?.profile || null,
    agreement: row?.agreement || null,
    reason: result.ok === false ? result.reason : "",
  };
}

/** Real MongoDB, Odoo and WhatsApp, loaded only when used. */
async function defaultDeps() {
  const [
    { default: Tutor }, { default: PartialTutor }, { tutorLoginQuery }, { partialTutorLoginQuery },
    { validateTemplate, getOdooUid },
  ] = await Promise.all([
    import("../models/Tutor.js"), import("../models/PartialTutor.js"), import("./loginMatch.js"), import("./tutorAccount.js"),
    import("./whatsappService.js"),
  ]);
  return {
    async findPerson(num) {
      // The same order the tutor login uses: a registered tutor first
      const t = await Tutor.findOne(tutorLoginQuery(num), { name: 1, tutorCode: 1, status: 1 }).lean();
      if (t) return { id: String(t._id), source: "tutor", name: t.name || "", tutorCode: t.tutorCode || "", isDemo: false, status: t.status };
      const p = await PartialTutor.findOne(partialTutorLoginQuery(num), { name: 1, tutorCode: 1, isDemo: 1, registeredTutorId: 1 })
        .sort({ createdAt: -1 }).lean();
      if (p) return { id: String(p._id), source: "partial", name: p.name || "", tutorCode: p.tutorCode || "", isDemo: p.isDemo === true };
      return null;
    },
    async isApproved(name) {
      return validateTemplate(await getOdooUid(), name);
    },
    async createDemoPartial({ name, whatsapp }) {
      const p = await PartialTutor.create({ name, whatsapp, isDemo: true });
      return String(p._id);
    },
    sendLinks: (lead, options) => sendVerificationLinks(lead, options),
  };
}

/** For the page: are the templates approved, and the last few demo sends. */
export async function demoOverview() {
  const [{ default: VerificationSend }, { validateTemplate, getOdooUid }] = await Promise.all([
    import("../models/VerificationSend.js"), import("./whatsappService.js"),
  ]);
  const uid = await getOdooUid().catch(() => null);
  const approved = async (n) => (uid ? validateTemplate(uid, n) : false);
  const recent = await VerificationSend.find({ requirementId: DEMO_REQUIREMENT })
    .sort({ createdAt: -1 }).limit(10)
    .select({ tutorName: 1, phone: 1, kind: 1, status: 1, failureReason: 1, createdAt: 1 }).lean();
  return {
    templates: {
      profile: { name: PROFILE_TEMPLATE, approved: await approved(PROFILE_TEMPLATE) },
      agreement: { name: AGREEMENT_TEMPLATE, approved: await approved(AGREEMENT_TEMPLATE) },
    },
    odooReachable: !!uid,
    defaultName: DEMO_NAME,
    recent,
  };
}
