/**
 * Top-three scheduler.
 *
 * Tutors are given a window to answer a requirement before the parent hears
 * anything. Once that window closes, whoever said Interested is ranked and the
 * best of them — up to three, fewer if fewer replied — is sent to the parent.
 *
 * Waiting matters: sending as soon as the first tutor replies would hand the
 * parent whoever happened to be quickest rather than whoever is best.
 *
 * Window length: TOP3_WAIT_HOURS, default 7.
 * Runs every TOP3_SWEEP_MINUTES, default 15.
 *
 * This file only reads, ranks and calls the existing send route. It adds no
 * new way to message anyone.
 */

import mongoose from "mongoose";
import { sendTutorCards } from "./tutorOptionsMessage.js";

export const WAIT_HOURS = Number(process.env.TOP3_WAIT_HOURS || 7);
const SWEEP_MINUTES = Number(process.env.TOP3_SWEEP_MINUTES || 15);

/** Give up after this many failed attempts, so a bad send is not retried forever. */
const MAX_ATTEMPTS = Number(process.env.TOP3_MAX_ATTEMPTS || 3);

/** Send a photo card per tutor before the list. TOP3_PHOTO_CARDS=false turns it off. */
const SEND_PHOTO_CARDS = String(process.env.TOP3_PHOTO_CARDS || "true").toLowerCase() !== "false";

/** Replies that mean "yes, I'll take it". */
const YES = new Set(["Interested", "Accepted", "Assigned"]);

/**
 * The tutors who said yes for one requirement, best first.
 * Ranked on the shortlist's own score, with the closer tutor winning a tie —
 * the same ordering the shortlist itself used, so nothing new is invented.
 */
export function rankInterested(shortlistTutors, logs) {
  const saidYes = new Map();
  for (const l of logs) {
    if (!YES.has(l.responseStatus)) continue;
    const key = l.tutorCode || String(l.tutorId || "");
    if (key) saidYes.set(key, l);
  }

  return (shortlistTutors || [])
    .filter((t) => saidYes.has(t.tutorCode) || saidYes.has(String(t.tutorId || "")))
    .sort((a, b) =>
      (b.score ?? 0) - (a.score ?? 0) ||
      (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER));
}

/**
 * Requirements whose window has closed and whose parent has not been told yet.
 * A requirement with nobody interested is left alone rather than sent empty.
 */
export async function findDue(db, now = new Date()) {
  const cutoff = new Date(now.getTime() - WAIT_HOURS * 60 * 60 * 1000);

  // Earliest invite per requirement: the window starts when tutors were asked.
  const firstInvites = await db.collection("broadcastlogs").aggregate([
    { $match: { broadcastType: "requirement", requirementId: { $ne: null } } },
    { $group: { _id: "$requirementId", firstSentAt: { $min: "$time" } } },
    { $match: { firstSentAt: { $lte: cutoff } } },
  ]).toArray();

  const due = [];
  for (const row of firstInvites) {
    const requirementId = row._id;

    // Already handled? Leave it alone. A parent is offered their options once.
    const alreadySent = await db.collection("tutor_top3")
      .countDocuments({ requirementId, sent: true });
    if (alreadySent) continue;

    // A send that keeps failing must not be retried forever.
    const failedAttempts = await db.collection("tutor_top3")
      .countDocuments({ requirementId, sent: false });
    if (failedAttempts >= MAX_ATTEMPTS) continue;

    const lead = await db.collection("parentenquiries").findOne({ requirementId });
    if (!lead || !lead.phone) continue;
    if (lead.assignedTutorId) continue; // a tutor is already chosen

    const shortlist = await db.collection("tutor_shortlists")
      .find({ requirementId }).sort({ matchedAt: -1 }).limit(1).next();
    const logs = await db.collection("broadcastlogs")
      .find({ requirementId, broadcastType: "requirement" }).toArray();

    const ranked = rankInterested(shortlist?.tutors || [], logs);
    if (!ranked.length) continue; // nobody said yes; nothing to offer

    due.push({ requirementId, lead, firstSentAt: row.firstSentAt, ranked });
  }
  return due;
}

/**
 * One sweep. Sends through the normal route so there is a single code path
 * for messaging the parent, and a single place where it is logged.
 */
export async function sweepTopThree({ send } = {}) {
  const db = mongoose.connection.db;
  if (!db) return { skipped: "database not connected" };

  const due = await findDue(db);
  if (!due.length) return { due: 0, sent: 0 };

  let sent = 0;
  for (const item of due) {
    const top = item.ranked.slice(0, 3);

    // The shortlist does not carry photos, and the parent's cards are built
    // around them, so they come from the tutors' own records.
    const codes = top.map((t) => t.tutorCode).filter(Boolean);
    const photos = new Map(
      (codes.length
        ? await db.collection("tutors")
            .find({ tutorCode: { $in: codes } }, { projection: { tutorCode: 1, photo: 1 } })
            .toArray()
        : []
      ).map((t) => [t.tutorCode, t.photo || ""]),
    );

    const offered = top.map((t) => ({
      name: t.name,
      tutorCode: t.tutorCode,
      experience: t.experience,
      distanceKm: t.distanceKm,
      photo: t.photo || photos.get(t.tutorCode) || "",
    }));

    let result = null;
    let error = "";
    let cards = null;
    try {
      // The photo cards go first, so the parent can see who they are choosing
      // between before the message that asks them to choose.
      if (SEND_PHOTO_CARDS) {
        cards = await sendTutorCards(item.lead, offered);
        console.log(
          `[Top3] ${item.requirementId}: ${cards.sent} of ${offered.length} photo cards sent`
        );
      }
      result = await send(item.lead, offered);
    } catch (err) {
      error = err.message;
      console.error(`[Top3] ${item.requirementId} failed:`, err.message);
    }

    // Written whether it went or not. This is what stops the parent being
    // messaged again on the next sweep, and it is what the board reads.
    await db.collection("tutor_top3").insertOne({
      requirementId: item.requirementId,
      leadId: String(item.lead._id),
      parentName: item.lead.parentName || "",
      parentPhone: item.lead.phone || "",
      interestedCount: item.ranked.length,
      offeredCount: offered.length,
      tutors: offered.map((t, i) => ({ choice: i + 1, ...t })),
      templateName: result?.templateName || "",
      cardsSent: cards ? cards.sent : 0,
      // The Odoo message, so the board can show whether WhatsApp delivered it.
      messageId: result?.messageId || null,
      cardResults: cards ? cards.results : [],
      sent: result?.sent === true,
      failureReason: error || result?.failureReason || "",
      outcome: result?.sent ? "sent_to_parent" : "send_failed",
      source: "top-three scheduler",
      preparedAt: new Date(),
    });

    if (result?.sent) sent += 1;
    console.log(
      `[Top3] ${item.requirementId}: ${item.ranked.length} interested, ` +
      `offered ${offered.length} — ${result?.sent ? "sent" : error || result?.failureReason || "not sent"}`
    );
  }
  return { due: due.length, sent };
}

export function startTopThreeScheduler(send) {
  console.log(
    `[Top3] Scheduler starting — tutors get ${WAIT_HOURS}h to answer, ` +
    `checked every ${SWEEP_MINUTES} min`
  );
  setInterval(() => {
    sweepTopThree({ send }).catch((e) => console.error("[Top3] sweep error:", e.message));
  }, SWEEP_MINUTES * 60 * 1000);
}
