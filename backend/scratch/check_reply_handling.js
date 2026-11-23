// READ-ONLY: how the reply sweep handled every saved reply, and phone formats
// in invitation logs.  cd backend && node scratch/check_reply_handling.js
import dotenv from "dotenv"; dotenv.config();
import mongoose from "mongoose";
await mongoose.connect(String(process.env.MONGO_URI || "").trim().replace(/^['"]|['"]$/g, ""), { autoIndex: false, autoCreate: false });
const { classifyReply } = await import("../utils/tutorReplyScheduler.js");
try {
  const db = mongoose.connection.db;
  const rows = await db.collection("inbound_messages").find({}).sort({ _id: 1 }).toArray();
  const count = (f) => rows.reduce((m, r) => { const k = String(f(r)); m[k] = (m[k] || 0) + 1; return m; }, {});
  console.log("route:", JSON.stringify(count((r) => r.route)));
  console.log("type:", JSON.stringify(count((r) => r.type)));
  console.log("outcome:", JSON.stringify(count((r) => r.replyOutcome)));
  console.log("intent:", JSON.stringify(count((r) => r.replyIntent)));
  console.log("\nRows that look like a yes/no but were not recorded:");
  for (const r of rows) {
    const guess = classifyReply(r.text);
    if (r.replyOutcome !== "recorded" && (guess !== "unclear" || /interest|availab|yes|no\b/i.test(r.text || "")))
      console.log(`  ${r._id.getTimestamp().toISOString().slice(0, 16)} ${r.last10} route=${r.route} type=${r.type} text="${String(r.text || "").slice(0, 40)}" -> ${r.replyOutcome || "(not swept)"}`);
  }
  console.log("\nButton/empty-text rows:", rows.filter((r) => !String(r.text || "").trim() || r.type !== "text").length);
  for (const r of rows.filter((r) => r.type !== "text").slice(0, 5)) console.log("  ", JSON.stringify({ type: r.type, text: r.text, button: r.button, interactive: r.interactive, route: r.route, outcome: r.replyOutcome }).slice(0, 200));

  const logs = await db.collection("broadcastlogs").find({ broadcastType: "requirement" }, { projection: { tutorPhone: 1 } }).toArray();
  const odd = logs.filter((l) => !/^\d{10}$/.test(String(l.tutorPhone || "")));
  console.log(`\nInvitation logs: ${logs.length}; tutorPhone not plain 10 digits: ${odd.length}`, JSON.stringify([...new Set(odd.map((l) => l.tutorPhone))].slice(0, 8)));
  const samples = ["I am available", "I am available still now", "Yes I am interested", "Interested", "INTERESTED", "Available sir", "Yes, no problem", "Not interested", "No sir", "I'm available", "ok", "Yes available but timing?"];
  console.log("\nclassifyReply:", samples.map((s) => `"${s}"=${classifyReply(s)}`).join(" | "));
} finally { await mongoose.disconnect(); }
