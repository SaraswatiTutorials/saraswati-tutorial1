/**
 * When a parent taps "Yes,Correct" on the re-confirmation, Panel 2's next two
 * steps run on their own:
 *   2. Shortlist tutors  — the best SHORTLIST_SIZE (20), saved as usual
 *   3. Invite tutors     — the top INVITE_SIZE (10) of them get the approved
 *                          invite template, exactly as the Invite button does
 *
 * Called by the Odoo inbound sync (odooInboundSync.js) right after it saves
 * the parent's "Yes,Correct". The same stage functions as the Panel 2 buttons
 * do the work (pipelineStages.js), so the tutors, the template and the logs
 * are identical to a person pressing the buttons.
 *
 * Safety:
 *  • once per re-confirmation: the run is claimed on the row (`autoRun`)
 *    before anything happens, so a second tap or a re-run does nothing
 *  • nothing when a tutor is already confirmed on the enquiry
 *  • an existing shortlist is used rather than replaced
 *  • no invitations when anyone was already invited for this requirement
 *    (a person got there first)
 *  • invitations only when Panel 2 sending is on (PANEL_SENDING_ENABLED=true);
 *    otherwise the shortlist is made and the invitations wait for the button
 *  • AUTO_INVITE_ON_CONFIRM=off switches the whole thing off
 *  • never in local safe mode (the inbound sync does not run there)
 * What happened is saved on the row and shown in Panel 2 at step 1.
 */
import { SHORTLIST_SIZE, INVITE_SIZE } from "./pipelineStages.js";

/** Recorded on what the automatic run makes, so Panel 2 can say the system did it. */
export const AUTO_BY = "Automatic (parent confirmed)";
export const AUTO_SHORTLIST_SOURCE = "automatic: parent confirmed";

export function autoInviteEnabled(env = process.env) {
  return String(env.AUTO_INVITE_ON_CONFIRM || "on").toLowerCase() !== "off";
}

export async function autoShortlistAndInvite(reconfirmId, deps) {
  const d = deps || (await defaultDeps());
  if (!autoInviteEnabled(d.env)) return { ran: false, reason: "AUTO_INVITE_ON_CONFIRM is off" };

  const rc = await d.findReconfirmation(reconfirmId);
  if (!rc) return { ran: false, reason: "re-confirmation not found" };
  if (rc.reply !== "Yes,Correct") return { ran: false, reason: `parent replied "${rc.reply || "nothing"}"` };
  if (rc.autoRun) return { ran: false, reason: "already ran for this re-confirmation" };

  // Claim it first, so two runs can never both go ahead.
  const claimed = await d.claim(rc._id, { status: "running", startedAt: new Date() });
  if (!claimed) return { ran: false, reason: "already ran for this re-confirmation" };

  const run = { status: "running", startedAt: new Date(), shortlisted: 0, shortlistReused: false, invited: 0, inviteFailed: 0, reason: "" };
  const finish = async (status, reason = "") => {
    Object.assign(run, { status, reason, finishedAt: new Date() });
    await d.saveRun(rc._id, run);
    return { ran: true, ...run };
  };

  try {
    const lead = await d.findLead(rc.requirementId);
    if (!lead) return finish("skipped", "Enquiry not found.");
    if (lead.assignedTutor) return finish("skipped", `${lead.assignedTutor} is already confirmed on this enquiry.`);

    // Step 2: shortlist (or keep the one a person already made)
    const existing = await d.latestShortlistSize(rc.requirementId);
    if (existing > 0) {
      run.shortlisted = existing;
      run.shortlistReused = true;
    } else {
      const s = await d.shortlist(lead, { limit: SHORTLIST_SIZE });
      if (s.blocked) return finish("stopped", s.reason || "Shortlist could not run.");
      if (!s.saved) return finish("stopped", s.note || "No tutor matched, so no shortlist was saved.");
      run.shortlisted = s.tutorCount || 0;
    }

    // Step 3: invite the top 10
    if (await d.alreadyInvited(rc.requirementId)) {
      return finish("done", "Tutors were already invited for this requirement, so no more invitations were sent.");
    }
    if (!d.sendingEnabled()) {
      return finish("held", "Shortlist made. Invitations were not sent because Panel 2 sending is off on this server (PANEL_SENDING_ENABLED). Press Invite tutors to send them.");
    }
    const inv = await d.invite(lead, { limit: INVITE_SIZE, adminName: AUTO_BY });
    if (inv.blocked) return finish("stopped", inv.reason || "Invitations could not be sent.");
    run.invited = inv.sent || 0;
    run.inviteFailed = (inv.results || []).filter((r) => !r.sent).length;
    run.templateName = inv.templateName || "";
    return finish("done", run.invited ? "" : "Nobody on the shortlist could be invited.");
  } catch (err) {
    console.error(`[AutoInvite] ${rc.requirementId} failed:`, err.message);
    return finish("failed", err.message);
  }
}

/** Real MongoDB and the Panel 2 stage functions, loaded only when used. */
async function defaultDeps() {
  const [{ default: mongoose }, { default: ParentEnquiry }, stages] = await Promise.all([
    import("mongoose"), import("../models/ParentEnquiry.js"), import("./pipelineStages.js"),
  ]);
  const db = mongoose.connection.db;
  if (!db) throw new Error("database not connected");
  const rcs = db.collection("parent_reconfirmations");
  return {
    env: process.env,
    findReconfirmation: (id) => rcs.findOne({ _id: id }),
    async claim(id, autoRun) {
      const r = await rcs.updateOne({ _id: id, autoRun: { $exists: false } }, { $set: { autoRun } });
      return r.modifiedCount === 1;
    },
    saveRun: (id, autoRun) => rcs.updateOne({ _id: id }, { $set: { autoRun } }),
    findLead: (requirementId) => ParentEnquiry.findOne({ requirementId }),
    async latestShortlistSize(requirementId) {
      const s = await db.collection("tutor_shortlists")
        .find({ requirementId, "tutors.0": { $exists: true } }).sort({ matchedAt: -1 }).limit(1).next();
      return s ? (s.tutors || []).length : 0;
    },
    shortlist: (lead, opts) => stages.shortlistTutors(lead, { ...opts, source: AUTO_SHORTLIST_SOURCE }),
    alreadyInvited: async (requirementId) => !!(await db.collection("broadcastlogs").findOne(
      { requirementId, broadcastType: "requirement", status: { $ne: "Failed" } }, { projection: { _id: 1 } })),
    sendingEnabled: () => stages.panelSendingEnabled(),
    invite: (lead, opts) => stages.inviteTutors(lead, opts),
  };
}
