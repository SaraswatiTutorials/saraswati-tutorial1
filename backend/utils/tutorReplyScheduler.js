/**
 * Tutor reply scheduler.
 *
 * The n8n router already records every inbound WhatsApp message in
 * `inbound_messages`, with the sender's number and what they wrote. This reads
 * those rows and marks the matching invitation Interested or Not Interested.
 *
 * It exists because the handover from the router to WF07.2 kept losing the
 * sender's number: a MongoDB step in the middle replaces the item with its own
 * result, so the phone and the wording never arrived. Rather than keep that
 * fragile, the decision is made here, from the row the router has already
 * written and which is known to be complete.
 *
 * Nothing is sent from here. It only records what a tutor answered.
 */

import mongoose from "mongoose";

const SWEEP_SECONDS = Number(process.env.TUTOR_REPLY_SWEEP_SECONDS || 60);

/** How long after an invitation a reply can still be taken as its answer. */
const REPLY_WINDOW_HOURS = Number(process.env.TUTOR_REPLY_WINDOW_HOURS || 72);

const YES = /\b(yes|yeah|yep|interested|intrested|available|ready|ok|okay|sure|confirm|confirmed|accept|accepted|haan|han|ha|ji|theek|thik)\b/i;
const NO = /\b(no|nope|not interested|notinterested|busy|unavailable|can'?t|cannot|cant|decline|declined|reject|sorry|nahi|nai|nhi)\b/i;

/**
 * What a tutor's wording means, or "unclear" when it is not obvious.
 * "Not interested" contains "interested", so the negated phrase is removed
 * before looking for agreement — otherwise a plain refusal matches both.
 */
export function classifyReply(text) {
  const t = String(text || "").trim();
  if (!t) return "unclear";
  const stripped = t.replace(/\bnot\s+(interested|intrested|available|free|keen)\b/gi, " ");
  const yes = YES.test(stripped);
  const no = NO.test(t);
  if (yes && !no) return "interested";
  if (no && !yes) return "not_interested";
  return "unclear"; // both or neither — a person should read it
}

const STATUS = { interested: "Interested", not_interested: "Not Interested" };

/**
 * One sweep over the replies nobody has acted on yet.
 * Every row is stamped either way, so an unclear message is not re-read
 * forever, and a person can still see it was left alone.
 */
export async function sweepTutorReplies() {
  const db = mongoose.connection.db;
  if (!db) return { skipped: "database not connected" };

  const pending = await db.collection("inbound_messages")
    .find({ route: "tutor", replyAppliedAt: { $exists: false } })
    .sort({ receivedAt: 1 })
    .limit(50)
    .toArray();

  if (!pending.length) return { seen: 0, marked: 0 };

  let marked = 0;
  for (const msg of pending) {
    const last10 = String(msg.last10 || msg.phone || "").replace(/\D/g, "").slice(-10);
    const intent = classifyReply(msg.text);
    const stamp = { replyAppliedAt: new Date(), replyIntent: intent };

    if (intent === "unclear" || last10.length !== 10) {
      await db.collection("inbound_messages").updateOne(
        { _id: msg._id },
        { $set: { ...stamp, replyOutcome: last10.length === 10 ? "left_for_a_person" : "no_phone" } },
      );
      continue;
    }

    // The invitation this is answering: the most recent one still unanswered.
    const since = new Date(Date.now() - REPLY_WINDOW_HOURS * 3600000);
    const invite = await db.collection("broadcastlogs")
      .find({
        broadcastType: "requirement",
        tutorPhone: { $regex: last10 + "$" },
        time: { $gte: since },
        responseStatus: { $in: ["No Response", null] },
      })
      .sort({ time: -1 })
      .limit(1)
      .next();

    if (!invite) {
      await db.collection("inbound_messages").updateOne(
        { _id: msg._id }, { $set: { ...stamp, replyOutcome: "no_open_invitation" } });
      continue;
    }

    await db.collection("broadcastlogs").updateOne(
      { _id: invite._id },
      { $set: { responseStatus: STATUS[intent], respondedAt: msg.receivedAt || new Date() } },
    );
    await db.collection("inbound_messages").updateOne(
      { _id: msg._id },
      { $set: { ...stamp, replyOutcome: "recorded", requirementId: invite.requirementId } },
    );

    marked += 1;
    console.log(
      `[TutorReply] ${invite.requirementId}: ${invite.tutorName} -> ${STATUS[intent]} ` +
      `(said "${String(msg.text || "").slice(0, 30)}")`
    );
  }

  return { seen: pending.length, marked };
}

export function startTutorReplyScheduler() {
  console.log(`[TutorReply] Scheduler starting — checking replies every ${SWEEP_SECONDS}s`);
  setInterval(() => {
    sweepTutorReplies().catch((e) => console.error("[TutorReply] sweep error:", e.message));
  }, SWEEP_SECONDS * 1000);
}
