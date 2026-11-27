/**
 * The parent's automatic reply to their re-confirmation answer.
 *
 * When the Odoo inbound sync (odooInboundSync.js) saves the parent's tap on
 * the re-confirmation, the matching approved Odoo template goes to them:
 *
 *   "Yes,Correct"          → "Auto_Demo Booked Confirmation"
 *                            (demo_booked_confirmation; Grade {{1}} and
 *                            Subject(s) {{2}} are Odoo fields that Odoo fills
 *                            from the CRM lead itself)
 *   "Change some details"  → "Auto_Change Requirement Details"
 *                            (change_requirement_details; {{1}} parent name),
 *                            asking them to write only what should change
 *
 * Both templates apply to the CRM lead, so each is sent on the enquiry's own
 * Odoo lead (and appears in its chatter). An enquiry without an Odoo lead gets
 * nothing, rather than a message logged on some other lead.
 *
 * Safety:
 *  • once per answer per re-confirmation: the send is claimed on the row
 *    (`autoReplies.demoBooked` / `autoReplies.changeDetails`) before it goes,
 *    so a second tap, a re-run or a restart never sends it twice. A parent who
 *    taps "Change some details" and later "Yes,Correct" gets each reply once.
 *  • only when Panel 2 sending is on (PANEL_SENDING_ENABLED=true); otherwise
 *    it is recorded as held, for Panel 2 to show
 *  • AUTO_REPLY_ON_RECONFIRM=off switches it off
 *  • never in local safe mode (the inbound sync does not run there)
 * What happened is saved on the row and shown in Panel 2 at step 1.
 */

export const DEMO_BOOKED_TEMPLATE = process.env.WHATSAPP_DEMO_BOOKED_TEMPLATE || "demo_booked_confirmation";
export const CHANGE_DETAILS_TEMPLATE = process.env.WHATSAPP_CHANGE_DETAILS_TEMPLATE || "change_requirement_details";

/** Which reply goes for which answer, and the key it is recorded under. */
export const AUTO_REPLIES = {
  "Yes,Correct": { key: "demoBooked", label: "Demo Booked Confirmation", templateName: DEMO_BOOKED_TEMPLATE },
  "Change some details": { key: "changeDetails", label: "Change Requirement Details", templateName: CHANGE_DETAILS_TEMPLATE },
};

export function autoReplyEnabled(env = process.env) {
  return String(env.AUTO_REPLY_ON_RECONFIRM || "on").toLowerCase() !== "off";
}

/** The template values: Demo Booked's two are Odoo fields, so none are passed. */
export function replyVars(key, lead) {
  if (key === "changeDetails") return { "{{1}}": String(lead?.parentName || "").trim() || "Parent" };
  return {};
}

/** Free-text version, used only in logs and tests (the template always goes). */
function replyPreview(key, lead) {
  const ward = lead?.wards?.[0] || {};
  const subjects = Array.isArray(ward.subjectsNeeded) ? ward.subjectsNeeded.join(", ") : (ward.subjectsNeeded || "");
  if (key === "changeDetails") {
    return `Hey! Mr/Ms ${replyVars(key, lead)["{{1}}"]},\n\nYour request to modify the tuition requirement has been received.\n\n` +
      "Please reply with the updated details you wish to change.";
  }
  return `Your tuition requirement has been confirmed successfully.\n\nDemo Request: BOOKED\nGrade: ${ward.classGrade || ""}\nSubject(s): ${subjects}`;
}

export async function sendReconfirmReply(reconfirmId, deps) {
  const d = deps || (await defaultDeps());
  const rc = await d.findReconfirmation(reconfirmId);
  if (!rc) return { sent: false, reason: "re-confirmation not found" };
  const reply = AUTO_REPLIES[rc.reply];
  if (!reply) return { sent: false, reason: `parent replied "${rc.reply || "nothing"}"` };
  if (rc.autoReplies?.[reply.key]) return { sent: false, key: reply.key, reason: "already handled for this answer" };

  // Claim it first, so two runs can never both send.
  const claimed = await d.claim(rc._id, reply.key, { status: "sending", templateName: reply.templateName, startedAt: new Date() });
  if (!claimed) return { sent: false, key: reply.key, reason: "already handled for this answer" };

  const record = { status: "sending", templateName: reply.templateName, label: reply.label, reason: "" };
  const finish = async (status, extra = {}) => {
    Object.assign(record, extra, { status, at: new Date() });
    await d.saveReply(rc._id, reply.key, record);
    return { key: reply.key, sent: status === "sent", ...record };
  };

  try {
    if (!autoReplyEnabled(d.env)) return finish("held", { reason: "Automatic replies are off on this server (AUTO_REPLY_ON_RECONFIRM=off)." });
    if (!d.sendingEnabled()) {
      return finish("held", { reason: "Not sent: Panel 2 sending is off on this server (PANEL_SENDING_ENABLED)." });
    }
    const lead = await d.findLead(rc);
    if (!lead) return finish("skipped", { reason: "Enquiry not found." });
    if (!lead.odooLeadId) return finish("skipped", { reason: "This enquiry has no Odoo lead, so the template could not be sent." });
    const phoneNumber = String(rc.phone || lead.phone || "").trim();
    if (!phoneNumber) return finish("skipped", { reason: "No phone number for the parent." });

    const r = await d.send({
      phoneNumber,
      messageBody: replyPreview(reply.key, lead),
      templateName: reply.templateName,
      templateVars: replyVars(reply.key, lead),
      resId: Number(lead.odooLeadId),
      forceTemplate: true, // always the approved template
    });
    if (!r.success) {
      return finish("failed", {
        reason: r.failureReason === "Template Deleted or Inactive"
          ? `The "${reply.templateName}" template isn't approved in Odoo.`
          : (r.failureReason || "unknown reason"),
      });
    }
    return finish("sent", { messageId: r.messageId || null });
  } catch (err) {
    console.error(`[ReconfirmReply] ${rc.requirementId} failed:`, err.message);
    return finish("failed", { reason: err.message });
  }
}

/** Real MongoDB and WhatsApp, loaded only when used. */
async function defaultDeps() {
  const [{ default: mongoose }, { default: ParentEnquiry }, stages, { sendWhatsAppToTutor }] = await Promise.all([
    import("mongoose"), import("../models/ParentEnquiry.js"), import("./pipelineStages.js"), import("./whatsappService.js"),
  ]);
  const db = mongoose.connection.db;
  if (!db) throw new Error("database not connected");
  const rcs = db.collection("parent_reconfirmations");
  return {
    env: process.env,
    findReconfirmation: (id) => rcs.findOne({ _id: id }),
    async claim(id, key, value) {
      const field = `autoReplies.${key}`;
      const r = await rcs.updateOne({ _id: id, [field]: { $exists: false } }, { $set: { [field]: value } });
      return r.modifiedCount === 1;
    },
    saveReply: (id, key, value) => rcs.updateOne({ _id: id }, { $set: { [`autoReplies.${key}`]: value } }),
    findLead: (rc) => (rc.leadId && mongoose.isValidObjectId(rc.leadId)
      ? ParentEnquiry.findById(rc.leadId)
      : ParentEnquiry.findOne({ requirementId: rc.requirementId })),
    sendingEnabled: () => stages.panelSendingEnabled(),
    send: (opts) => sendWhatsAppToTutor(opts),
  };
}
