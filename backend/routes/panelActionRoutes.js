/**
 * Panel 2's buttons.
 *
 * Panel 2 itself (pipelineBoardRoutes.js) stays a read-only view. This is the
 * one place it is allowed to act, kept in its own file so that promise is easy
 * to check: everything that writes or sends is here, and nothing else is.
 *
 * Mounted alongside Panel 2 at /panel2, so it shares that page's login rather
 * than depending on the admin JWT.
 *
 * POST /panel2/api/stage/:stage
 *   body: { requirementId, dryRun, limit?, tutorId?, force?, resend?, group? }
 *   (group, for "verify" only: "top3" or "invited")
 *
 * `dryRun: true` is the safe way to use all of this: the stage does its real
 * work and reports exactly what would be sent, but sends nothing and saves
 * nothing. A real send also needs PANEL_SENDING_ENABLED=true on the server.
 */

import express from "express";
import ParentEnquiry from "../models/ParentEnquiry.js";
import { requireLogin } from "./pipelineBoardRoutes.js";
import { LOCAL_SAFE_MODE } from "../utils/localSafeMode.js";
import {
  reconfirmRequirement,
  shortlistTutors,
  inviteTutors,
  sendTopThree,
  notifySelectedTutor,
  panelSendingEnabled,
  SHORTLIST_SIZE,
  INVITE_SIZE,
} from "../utils/pipelineStages.js";
import { sendVerificationLinks } from "../utils/verificationLinks.js";
import { sendFeedbackLink } from "../utils/tutorFeedback.js";

const router = express.Router();

/** The order they are meant to be pressed in, which the page also renders. */
export const STAGE_LIST = [
  { key: "reconfirm", label: "Send re-confirmation", hint: "Parent confirms the requirement or asks to change it" },
  { key: "shortlist", label: `Shortlist ${SHORTLIST_SIZE} tutors`, hint: "Find and save the best matches" },
  { key: "invite", label: `Invite ${INVITE_SIZE} tutors`, hint: "Ask the top of the shortlist if they are interested" },
  { key: "top3", label: "Send top 3 to parent", hint: "Offer the best of whoever said yes" },
  { key: "selected", label: "Tell the chosen tutor", hint: "Confirm the parent's pick to that tutor" },
  { key: "verify", label: "Verification & agreement", hint: "Login link to partial tutors, agreement to anyone who has not signed" },
  { key: "feedback", label: "Send feedback link", hint: "After the demo, ask the parent about the confirmed tutor" },
];

/** Shortlisting only saves a record. Every other stage messages someone. */
const SENDS_A_MESSAGE = new Set(["reconfirm", "invite", "top3", "selected", "verify", "feedback"]);

const MAX_LIMIT = 50;

// A real run for one requirement at a time, so a double press or a second open
// tab cannot send the same message twice while the first is still going.
const running = new Set();

router.get("/api/stage", requireLogin, (req, res) => {
  res.json({
    stages: STAGE_LIST,
    shortlistSize: SHORTLIST_SIZE,
    inviteSize: INVITE_SIZE,
    sendingEnabled: panelSendingEnabled() && !LOCAL_SAFE_MODE,
  });
});

router.post("/api/stage/:stage", requireLogin, async (req, res) => {
  const { stage } = req.params;
  const { requirementId, dryRun = true, limit, tutorId, force = false, resend = false, group = "top3", kind = "" } = req.body || {};

  if (!requirementId) return res.status(400).json({ message: "requirementId is required." });

  // Anything other than an explicit false is treated as a dry run, so a
  // mistyped or missing flag cannot send a real message.
  const isDryRun = dryRun !== false;

  if (!isDryRun) {
    // Local safe mode's request guard only covers /api, and shortlists are
    // written straight to the collection, past its database guard too.
    if (LOCAL_SAFE_MODE) {
      return res.status(403).json({ stage, ok: false, blocked: true, reason: "Local safe mode: this server cannot save or send anything." });
    }
    if (SENDS_A_MESSAGE.has(stage) && !panelSendingEnabled()) {
      return res.status(403).json({
        stage, ok: false, blocked: true,
        reason: "Sending is switched off on this server, so nothing was sent. Set PANEL_SENDING_ENABLED=true to allow it.",
      });
    }
  }

  const lockKey = `${requirementId}|${stage}${stage === "verify" ? "|" + (tutorId || group) : ""}`;
  if (!isDryRun && running.has(lockKey)) {
    return res.status(409).json({ stage, ok: false, blocked: true, reason: "This step is already running for this enquiry." });
  }

  if (!isDryRun) running.add(lockKey);
  try {
    const lead = await ParentEnquiry.findOne({ requirementId: String(requirementId) });
    if (!lead) return res.status(404).json({ message: `No enquiry found for ${requirementId}.` });

    const options = { dryRun: isDryRun, force: force === true, resend: resend === true };
    if (limit != null && Number.isFinite(Number(limit))) {
      options.limit = Math.min(Math.max(1, Math.floor(Number(limit))), MAX_LIMIT);
    }

    let result;
    switch (stage) {
      case "reconfirm":
        result = await reconfirmRequirement(lead, options);
        break;
      case "shortlist":
        result = await shortlistTutors(lead, options);
        break;
      case "invite":
        result = await inviteTutors(lead, options);
        break;
      case "top3":
        result = await sendTopThree(lead, options);
        break;
      case "selected":
        result = await notifySelectedTutor(lead, tutorId, options);
        break;
      case "verify":
        result = await sendVerificationLinks(lead, {
          group: String(group), dryRun: options.dryRun, resend: options.resend,
          tutorId: tutorId ? String(tutorId) : "", kind: kind ? String(kind) : "",
        });
        break;
      case "feedback":
        result = await sendFeedbackLink(lead, { dryRun: options.dryRun, resend: options.resend });
        break;
      default:
        return res.status(400).json({ message: `Unknown stage "${stage}".` });
    }

    res.json({ requirementId, ...result });
  } catch (error) {
    console.error(`[Panel 2] Stage "${stage}" failed for ${requirementId}:`, error);
    res.status(500).json({ stage, ok: false, message: error.message });
  } finally {
    if (!isDryRun) running.delete(lockKey);
  }
});

export default router;
