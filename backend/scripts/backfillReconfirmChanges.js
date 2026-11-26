/**
 * One-time catch-up: messages a parent wrote after tapping "Change some
 * details" BEFORE the inbound sync started saving them as change requests
 * (25 Nov 2026) were left "for a person". This attaches them to that
 * re-confirmation's `changeRequests`, so Panel 2 step 1 shows them.
 *
 *   cd backend
 *   node scripts/backfillReconfirmChanges.js           dry run: lists what it would add
 *   node scripts/backfillReconfirmChanges.js --apply   adds them
 *
 * Only plain text messages from the same number, within 14 days after the
 * "Change some details" tap, are taken. Each Odoo message is added once.
 * Nothing is sent to anyone.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import { reconfirmAnswer } from "../utils/odooInboundSync.js";

dotenv.config();
const APPLY = process.argv.includes("--apply");
const DAYS = 14;

await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI, { serverSelectionTimeoutMS: 30000 });
const db = mongoose.connection.db;

const rows = await db.collection("parent_reconfirmations")
  .find({ sent: true, reply: "Change some details", repliedAt: { $ne: null } }).toArray();

let added = 0;
for (const rc of rows) {
  const num = String(rc.phone || "").replace(/\D/g, "").slice(-10);
  if (num.length !== 10) continue;
  const until = new Date(new Date(rc.repliedAt).getTime() + DAYS * 86400000);
  const have = new Set((rc.changeRequests || []).map((c) => c.odooMessageId));
  const msgs = await db.collection("inbound_messages").find({
    last10: num, type: "text", receivedAt: { $gte: rc.repliedAt, $lte: until },
  }).sort({ receivedAt: 1 }).toArray();

  const fresh = msgs.filter((m) => m.text && !reconfirmAnswer(m.text) && !have.has(m.odooMessageId));
  console.log(`${rc.requirementId}: ${fresh.length} message(s) to add`);
  for (const m of fresh) {
    console.log(`   ${APPLY ? "added" : "would add"}  ${new Date(m.receivedAt).toISOString()}  ${m.text}`);
    if (!APPLY) continue;
    await db.collection("parent_reconfirmations").updateOne(
      { _id: rc._id, "changeRequests.odooMessageId": { $ne: m.odooMessageId } },
      { $push: { changeRequests: { text: m.text, at: m.receivedAt, odooMessageId: m.odooMessageId } } },
    );
    await db.collection("inbound_messages").updateOne(
      { _id: m._id },
      { $set: { requirementId: rc.requirementId, replyIntent: "change_details_text", replyOutcome: "change_request_recorded" } },
    );
    added += 1;
  }
}
console.log(APPLY ? `\nAdded ${added}.` : "\nDry run — nothing was written. Add --apply to add them.");
await mongoose.disconnect();
