/**
 * Parent feedback about the tutor chosen for the demo.
 *
 * Panel 2's step 7, "Tutor feedback from the parent", sends the parent a
 * WhatsApp link to a short form about whoever is assigned to the enquiry
 * (the tutor confirmed in step 5). It is pressed by hand, after the demo. If
 * the parent then moves to another tutor from the top 3, pressing it again
 * sends a new link about that tutor; each tutor's answers are kept apart.
 *
 * The message is the Odoo template FEEDBACK_TEMPLATE (a "Give Feedback"
 * button that opens FEEDBACK_URL + token), or plain text with the link when
 * the parent wrote to us in the last 24 hours (WhatsApp's rule).
 */
import crypto from "node:crypto";

export const FEEDBACK_TEMPLATE = process.env.WHATSAPP_FEEDBACK_TEMPLATE || "tutor_feedback_request";
export const FEEDBACK_URL = process.env.TUTOR_FEEDBACK_URL || "https://saraswatitutorial.com/tutor-feedback/";

// What the form offers. The page reads these from the API, so the two never disagree.
export const RATING_ASPECTS = [
  { key: "teaching", label: "Teaching & explanation" },
  { key: "knowledge", label: "Subject knowledge" },
  { key: "punctuality", label: "Punctuality" },
  { key: "behaviour", label: "Behaviour & communication" },
  { key: "comfort", label: "How comfortable your child felt" },
];
export const LIKED_OPTIONS = [
  "Explains concepts clearly", "Patient with my child", "Came on time", "Friendly and polite",
  "Engaging and interactive", "Well prepared", "Strong in the subject", "Gave practice work",
];
export const IMPROVE_OPTIONS = [
  "Explained too fast", "Came late", "Not well prepared", "Hard to understand",
  "Child was not comfortable", "Too strict", "Not engaging", "Nothing, all good",
];
export const DECISIONS = [
  { key: "continue", label: "Yes, continue with this tutor" },
  { key: "another", label: "I'd like a different tutor" },
  { key: "unsure", label: "Not sure yet" },
];
export const DEMO_STATES = [
  { key: "yes", label: "Yes, it happened" },
  { key: "not_yet", label: "Not yet / rescheduled" },
];
export const COMMENT_MAX = 1000;

export const newToken = () => crypto.randomBytes(9).toString("base64url");
export const linkFor = (token) => FEEDBACK_URL + token;

const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "";
const clean = (s, max = 200) => String(s ?? "").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, max);

/**
 * Checks and tidies what the form sent. Returns { answers } or { error }.
 * Anything not on the lists is dropped rather than stored.
 */
export function cleanAnswers(body = {}) {
  const demoHappened = DEMO_STATES.some((d) => d.key === body.demoHappened) ? body.demoHappened : "";
  if (!demoHappened) return { error: "Please tell us whether the demo class happened." };
  const comment = clean(body.comment, COMMENT_MAX);

  if (demoHappened !== "yes") {
    return { answers: { demoHappened, overall: null, ratings: {}, liked: [], improve: [], decision: "", comment } };
  }

  const star = (v) => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null; };
  const overall = star(body.overall);
  if (!overall) return { error: "Please give an overall rating from 1 to 5 stars." };

  const ratings = {};
  for (const { key } of RATING_ASPECTS) {
    const n = star(body.ratings?.[key]);
    if (n) ratings[key] = n;
  }
  const pick = (list, allowed) => [...new Set((Array.isArray(list) ? list : []).filter((x) => allowed.includes(x)))];
  const decision = DECISIONS.some((d) => d.key === body.decision) ? body.decision : "";
  if (!decision) return { error: "Please tell us whether you would like to continue with this tutor." };

  return {
    answers: {
      demoHappened, overall, ratings,
      liked: pick(body.liked, LIKED_OPTIONS),
      improve: pick(body.improve, IMPROVE_OPTIONS),
      decision, comment,
    },
  };
}

/** What the form page is allowed to see: no phone numbers, the parent's first name only. */
export function publicView(doc, { photo = "", subjects = "", grade = "" } = {}) {
  return {
    parentFirstName: firstName(doc.parentName),
    studentName: doc.studentName || "",
    tutorName: doc.tutorName || "",
    tutorCode: doc.tutorCode || "",
    tutorPhoto: photo || "",
    subjects, grade,
    submitted: !!doc.submittedAt,
    submittedAt: doc.submittedAt || null,
    options: { aspects: RATING_ASPECTS, liked: LIKED_OPTIONS, improve: IMPROVE_OPTIONS, decisions: DECISIONS, demoStates: DEMO_STATES, commentMax: COMMENT_MAX },
  };
}

/** One line for Odoo's chatter and the board. */
export function summarise(doc) {
  if (!doc.submittedAt) return "";
  if (doc.demoHappened !== "yes") return `Parent says the demo with ${doc.tutorName} has not happened yet.`;
  const decision = DECISIONS.find((d) => d.key === doc.decision)?.label || doc.decision;
  return `Parent feedback on ${doc.tutorName}: ${doc.overall}/5 stars. ${decision}.` +
    (doc.comment ? ` "${doc.comment.slice(0, 200)}"` : "");
}

export function feedbackMessage({ parentName, tutorName, studentName, link }) {
  return `Hello *${parentName || "Parent"}*,\n\n` +
    `Thank you for choosing *Saraswati Tutorials*. 🙏\n\n` +
    `We would like to know how the demo class with tutor *${tutorName}* went for *${studentName || "your child"}*.\n\n` +
    `Your feedback takes less than a minute and helps us make sure your child has the right tutor.\n\n` +
    `Share your feedback here: ${link}`;
}

const when = (d) => new Date(d).toLocaleString("en-IN", {
  timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
});

/**
 * Panel 2 step 7. Works out (and, unless dryRun, sends) the feedback link for
 * the tutor assigned to this enquiry. `resend` sends a link that was already
 * sent once; a link the parent has answered is never sent again.
 */
export async function sendFeedbackLink(lead, { dryRun = true, resend = false } = {}, deps) {
  const stage = "feedback";
  const requirementId = lead?.requirementId || "";
  const blocked = (reason) => ({ stage, ok: false, blocked: true, reason, dryRun });
  if (!lead) return blocked("No enquiry.");
  if (!lead.assignedTutorId && !lead.assignedTutor) {
    return blocked("No tutor is confirmed on this enquiry yet. Confirm the tutor chosen for the demo first (step 5).");
  }
  const phone = String(lead.phone || "").trim();
  if (!phone) return blocked("This parent has no phone number.");

  const d = deps || (await defaultDeps());
  const tutor = await d.findTutor(lead.assignedTutorId);
  const tutorName = tutor?.name || lead.assignedTutor || "";
  if (!tutorName) return blocked("The confirmed tutor could not be found.");

  const studentName = lead.wards?.[0]?.studentName || "";
  const parentName = lead.parentName || "";
  let record = await d.findRecord(lead._id, tutor?.id || null, tutorName);

  if (record?.submittedAt) {
    return blocked(`${parentName || "The parent"} already gave feedback on ${tutorName} (${when(record.submittedAt)}). It is shown under step 7.`);
  }
  const lastSent = record?.sends?.filter((s) => s.status === "Sent").at(-1);
  const approved = await d.isApproved(FEEDBACK_TEMPLATE);
  const token = record?.token || newToken();
  const link = linkFor(token);

  const plan = {
    stage, ok: true, dryRun, requirementId,
    to: phone, parentName, studentName, tutorName, tutorCode: tutor?.tutorCode || "",
    link, templateName: FEEDBACK_TEMPLATE, templateApproved: approved,
    alreadySentAt: lastSent?.at || null,
    willSend: true, reason: "",
    messagePreview: feedbackMessage({ parentName, tutorName, studentName, link }),
  };
  if (lastSent && !resend) {
    plan.willSend = false;
    plan.reason = `Already sent ${when(lastSent.at)}. Press Send again to send it once more.`;
  }
  if (dryRun) return { ...plan, sent: false, note: "Dry run — nothing was sent or saved." };
  if (!plan.willSend) return { ...plan, sent: false };

  if (!record) {
    record = await d.createRecord({
      token, leadId: lead._id, requirementId, parentName, parentPhone: phone, studentName,
      tutorId: tutor?.id || null, tutorSource: tutor?.source || "", tutorName, tutorCode: tutor?.tutorCode || "",
    });
  }

  const result = await d.send({
    phoneNumber: phone,
    messageBody: plan.messagePreview,
    templateName: FEEDBACK_TEMPLATE,
    templateLang: "en",
    templateVars: { "{{1}}": parentName || "Parent", "{{2}}": tutorName, "{{3}}": studentName || "your child", button_dynamic_url_1: link },
  });
  const send = {
    at: new Date(), status: result.success ? "Sent" : "Failed",
    failureReason: result.failureReason || "", whatsappMessageId: String(result.messageId || ""), usedTemplate: result.usedTemplate === true,
  };
  await d.recordSend(record, send);

  if (!result.success) {
    const notApproved = result.failureReason === "Template Deleted or Inactive";
    return {
      ...plan, sent: false,
      failureReason: notApproved
        ? `The "${FEEDBACK_TEMPLATE}" template isn't approved by Meta yet, so it could not be sent. Try again once Odoo shows it as approved.`
        : result.failureReason || "unknown reason",
    };
  }
  if (lead.odooLeadId) {
    d.note(lead.odooLeadId, `Tutor feedback link sent to the parent on WhatsApp, about ${tutorName}.`).catch(() => {});
  }
  return { ...plan, sent: true, sentAt: send.at };
}

/** Real MongoDB and Odoo, loaded only when the step runs. */
async function defaultDeps() {
  const [{ default: mongoose }, { default: Tutor }, { default: PartialTutor }, { default: TutorFeedback },
    { sendWhatsAppToTutor, validateTemplate, getOdooUid }, { addOdooChatterMessage }] = await Promise.all([
    import("mongoose"), import("../models/Tutor.js"), import("../models/PartialTutor.js"), import("../models/TutorFeedback.js"),
    import("./whatsappService.js"), import("./odooService.js"),
  ]);
  return {
    async findTutor(id) {
      if (!id || !mongoose.isValidObjectId(id)) return null;
      const t = await Tutor.findById(id, { name: 1, tutorCode: 1, photo: 1 }).lean();
      if (t) return { id: t._id, source: "tutor", name: t.name, tutorCode: t.tutorCode || "", photo: t.photo || "" };
      const p = await PartialTutor.findById(id, { name: 1, tutorCode: 1 }).lean();
      return p ? { id: p._id, source: "partial", name: p.name, tutorCode: p.tutorCode || "", photo: "" } : null;
    },
    findRecord: (leadId, tutorId, tutorName) =>
      TutorFeedback.findOne(tutorId ? { leadId, tutorId } : { leadId, tutorName }).sort({ createdAt: -1 }),
    createRecord: (row) => TutorFeedback.create(row),
    async recordSend(record, send) {
      record.sends.push(send);
      if (send.status === "Sent") record.lastSentAt = send.at;
      await record.save();
    },
    isApproved: async (name) => validateTemplate(await getOdooUid(), name),
    send: (opts) => sendWhatsAppToTutor(opts),
    note: (odooLeadId, text) => addOdooChatterMessage(odooLeadId, text),
  };
}
