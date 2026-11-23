// READ-ONLY: newest inbound_messages rows, and inbound WhatsApp in Odoo for a number.
//   cd backend && node scratch/check_inbound_odoo.js 7044804435
import dotenv from "dotenv"; dotenv.config();
import mongoose from "mongoose";
await mongoose.connect(String(process.env.MONGO_URI || "").trim().replace(/^['"]|['"]$/g, ""), { autoIndex: false, autoCreate: false });
try {
  const db = mongoose.connection.db;
  const newest = await db.collection("inbound_messages").find({}).sort({ _id: -1 }).limit(3).toArray();
  for (const m of newest) console.log("newest row:", m._id.getTimestamp().toISOString(), JSON.stringify({ ...m, _id: undefined, raw: undefined, payload: undefined }).slice(0, 400));
  const cols = (await db.listCollections().toArray()).map((c) => c.name).filter((n) => /inbound|message|reply|webhook|whatsapp/i.test(n));
  for (const c of cols) {
    const last = await db.collection(c).find({}).sort({ _id: -1 }).limit(1).next();
    console.log(`collection ${c}: ${await db.collection(c).estimatedDocumentCount()} rows, newest ${last ? last._id.getTimestamp?.().toISOString() : "-"}`);
  }
  const { getOdooUid, callOdooMethod } = await import("../utils/whatsappService.js");
  const uid = await getOdooUid();
  const num = String(process.argv[2] || "").slice(-10);
  const msgs = await callOdooMethod(uid, "whatsapp.message", "search_read",
    [[["message_type", "=", "inbound"], ["mobile_number", "like", num]]],
    { fields: ["id", "create_date", "body", "state", "mobile_number"], order: "id desc", limit: 5 });
  console.log(`\nOdoo inbound from ${num}:`);
  for (const m of msgs) console.log(" ", m.create_date, m.state, String(m.body || "").replace(/<[^>]+>/g, " ").trim().slice(0, 60));
  const any = await callOdooMethod(uid, "whatsapp.message", "search_read",
    [[["message_type", "=", "inbound"]]], { fields: ["create_date", "mobile_number"], order: "id desc", limit: 5 });
  console.log("\nOdoo newest inbound (any number):", any.map((m) => m.create_date).join(", "));
} finally { await mongoose.disconnect(); }
