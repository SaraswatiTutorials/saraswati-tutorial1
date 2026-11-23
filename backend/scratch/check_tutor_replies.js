// READ-ONLY: recent inbound WhatsApp messages and what the reply sweep did with
// them, plus the invitations for the enquiries named.
//   cd backend && node scratch/check_tutor_replies.js REQ-00424 REQ-00425 REQ-00426
import dotenv from "dotenv"; dotenv.config();
import mongoose from "mongoose";
await mongoose.connect(String(process.env.MONGO_URI || "").trim().replace(/^['"]|['"]$/g, ""), { autoIndex: false, autoCreate: false });
const db = mongoose.connection.db;
const since = new Date(Date.now() - 4 * 24 * 3600 * 1000);
try {
  const total = await db.collection("inbound_messages").countDocuments({});
  const recent = await db.collection("inbound_messages").find({ $or: [{ receivedAt: { $gte: since } }, { createdAt: { $gte: since } }] })
    .sort({ _id: -1 }).limit(40).toArray();
  console.log(`inbound_messages: ${total} total, ${recent.length} in the last 4 days (newest first)`);
  const keys = new Set(); recent.forEach((m) => Object.keys(m).forEach((k) => keys.add(k)));
  console.log("fields seen:", [...keys].join(", "));
  for (const m of recent) {
    console.log(` ${(m.receivedAt || m.createdAt || m._id.getTimestamp()).toISOString?.() || ""} route=${m.route} last10=${m.last10 || m.phone} ` +
      `text="${String(m.text || "").slice(0, 40)}" intent=${m.replyIntent || "-"} outcome=${m.replyOutcome || "(not swept)"} req=${m.requirementId || ""}`);
  }
  const notSwept = await db.collection("inbound_messages").countDocuments({ route: "tutor", replyAppliedAt: { $exists: false } });
  console.log("\ntutor rows not swept yet:", notSwept);

  for (const req of process.argv.slice(2)) {
    const logs = await db.collection("broadcastlogs").find({ requirementId: req, broadcastType: "requirement" })
      .project({ tutorName: 1, tutorPhone: 1, status: 1, responseStatus: 1, time: 1, createdAt: 1 }).toArray();
    console.log(`\n${req}: ${logs.length} invitation log(s)`);
    for (const l of logs) console.log(`  ${l.tutorName} ${l.tutorPhone} ${l.status} reply=${l.responseStatus} time=${l.time ? new Date(l.time).toISOString() : "MISSING"}`);
  }
} finally { await mongoose.disconnect(); }
