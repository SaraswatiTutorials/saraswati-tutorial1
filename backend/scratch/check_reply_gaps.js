// READ-ONLY: replies the sweep never looks at (route not "tutor") from people who
// had an invitation, and why "no_open_invitation" rows found none.
import dotenv from "dotenv"; dotenv.config();
import mongoose from "mongoose";
await mongoose.connect(String(process.env.MONGO_URI || "").trim().replace(/^['"]|['"]$/g, ""), { autoIndex: false, autoCreate: false });
const { classifyReply } = await import("../utils/tutorReplyScheduler.js");
try {
  const db = mongoose.connection.db;
  const rows = await db.collection("inbound_messages").find({}).toArray();
  console.log("Non-tutor-route replies from a number that had an invitation within 72h before:");
  for (const r of rows.filter((x) => x.route !== "tutor")) {
    const at = new Date(r.receivedAt || r._id.getTimestamp());
    const inv = await db.collection("broadcastlogs").findOne({ broadcastType: "requirement", tutorPhone: { $regex: r.last10 + "$" },
      time: { $gte: new Date(at - 72 * 3600e3), $lte: at } });
    if (inv) console.log(`  ${at.toISOString().slice(0, 16)} ${r.last10} route=${r.route} "${String(r.text).slice(0, 40)}" -> would be ${classifyReply(r.text)} for ${inv.requirementId} (${inv.tutorName}, reply now: ${inv.responseStatus})`);
  }
  console.log("\nno_open_invitation rows:");
  for (const r of rows.filter((x) => x.replyOutcome === "no_open_invitation")) {
    const at = new Date(r.receivedAt || r._id.getTimestamp());
    const invs = await db.collection("broadcastlogs").find({ tutorPhone: { $regex: r.last10 + "$" } }).sort({ time: -1 }).limit(3)
      .project({ requirementId: 1, broadcastType: 1, time: 1, responseStatus: 1 }).toArray();
    console.log(`  ${at.toISOString().slice(0, 16)} ${r.last10} "${String(r.text).slice(0, 25)}": ` +
      (invs.map((i) => `${i.requirementId} ${i.broadcastType} ${i.time ? new Date(i.time).toISOString().slice(0, 16) : "no time"} ${i.responseStatus}`).join("; ") || "never invited"));
  }
} finally { await mongoose.disconnect(); }
