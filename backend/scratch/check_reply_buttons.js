// READ-ONLY: every WhatsApp template with quick-reply buttons, how often each
// button was tapped (inbound body equal to the label, last 90 days), and what
// inbound_messages / tutor_assignments / parent_reconfirmations hold.
//   cd backend && node scratch/check_reply_buttons.js
import dotenv from "dotenv"; dotenv.config({ quiet: true });
import mongoose from "mongoose";
const { getOdooUid, callOdooMethod } = await import("../utils/whatsappService.js");
const uid = await getOdooUid();
const norm = (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/[’‘]/g, "'").trim().toLowerCase();
const btns = await callOdooMethod(uid, "whatsapp.template.button", "search_read", [[["button_type", "=", "quick_reply"]]],
  { fields: ["name", "wa_template_id"], context: { active_test: false } });
const tplIds = [...new Set(btns.map((b) => b.wa_template_id[0]))];
const tpls = await callOdooMethod(uid, "whatsapp.template", "read", [tplIds], { fields: ["template_name", "status", "active", "model"] });
const inbound = await callOdooMethod(uid, "whatsapp.message", "search_read",
  [[["message_type", "=", "inbound"], ["create_date", ">=", "2026-08-25 00:00:00"]]], { fields: ["body", "create_date"], order: "id asc" });
const counts = {}; let lastAt = {};
for (const m of inbound) { const k = norm(m.body); counts[k] = (counts[k] || 0) + 1; lastAt[k] = m.create_date; }
console.log(`inbound messages since 25 Aug: ${inbound.length}\n`);
const labelOwners = {};
for (const t of tpls.sort((a, b) => (b.active - a.active) || a.template_name.localeCompare(b.template_name))) {
  const mine = btns.filter((b) => b.wa_template_id[0] === t.id);
  console.log(`${t.template_name}  [${t.status}${t.active ? "" : ", archived"}] model=${t.model || "-"}`);
  for (const b of mine) { const k = norm(b.name); (labelOwners[k] ||= []).push(t.template_name); console.log(`   "${b.name}"  tapped ${counts[k] || 0}x${counts[k] ? ", last " + lastAt[k] : ""}`); }
}
const shared = Object.entries(labelOwners).filter(([, v]) => v.length > 1);
console.log("\nbutton labels used by more than one template:", shared.map(([k, v]) => `"${k}" (${v.join(", ")})`).join("; ") || "none");
const known = new Set(Object.keys(labelOwners));
const other = Object.entries(counts).filter(([k]) => !known.has(k)).sort((a, b) => b[1] - a[1]).slice(0, 15);
console.log("\nmost common other inbound texts:", other.map(([k, n]) => `"${k.slice(0, 40)}" ${n}`).join(" | "));

await mongoose.connect(String(process.env.MONGO_URI || "").trim().replace(/^['"]|['"]$/g, ""), { autoIndex: false, autoCreate: false });
const db = mongoose.connection.db;
const routes = await db.collection("inbound_messages").aggregate([{ $group: { _id: { route: "$route", type: "$type", senderType: "$senderType" }, n: { $sum: 1 } } }]).toArray();
console.log("\ninbound_messages by route/type/sender:", routes.map((r) => `${JSON.stringify(r._id)}=${r.n}`).join(" | "));
const sample = await db.collection("inbound_messages").find({}).sort({ _id: -1 }).limit(2).toArray();
console.log("sample row:", JSON.stringify(sample[0], (k, v) => (k === "phone" || k === "last10" || k === "tutorWhatsapp" ? "…" : v)).slice(0, 700));
const ta = await db.collection("tutor_assignments").find({}).sort({ _id: -1 }).limit(1).toArray();
console.log("\ntutor_assignments sample:", JSON.stringify(ta[0], (k, v) => (/phone|whatsapp/i.test(k) ? "…" : k === "offeredTutors" ? `[${(v || []).length}]` : v)).slice(0, 900));
const pr = await db.collection("parent_reconfirmations").find({}).sort({ _id: -1 }).limit(1).toArray();
console.log("\nparent_reconfirmations:", await db.collection("parent_reconfirmations").countDocuments(), JSON.stringify(pr[0], (k, v) => (/phone|whatsapp/i.test(k) ? "…" : v)).slice(0, 600));
await mongoose.disconnect();
