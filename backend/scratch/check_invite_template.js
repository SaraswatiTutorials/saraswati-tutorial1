// READ-ONLY: which WhatsApp template the tutor invitations use, its status and
// buttons in Odoo, and what the last invitations actually went out with.
//   cd backend && node scratch/check_invite_template.js
import dotenv from "dotenv"; dotenv.config({ quiet: true });
import mongoose from "mongoose";
const { getOdooUid, callOdooMethod, REQUIREMENT_TEMPLATES } = await import("../utils/whatsappService.js");
console.log("pinned in .env:", process.env.WHATSAPP_REQUIREMENT_TEMPLATE_NAME || "(none)", "| fallback order:", REQUIREMENT_TEMPLATES.join(" > "));
const uid = await getOdooUid();
const names = [...new Set([process.env.WHATSAPP_REQUIREMENT_TEMPLATE_NAME, ...REQUIREMENT_TEMPLATES].filter(Boolean))];
const tpls = await callOdooMethod(uid, "whatsapp.template", "search_read",
  [["|", ["template_name", "in", names], ["name", "in", names]]],
  { fields: ["id", "name", "template_name", "status", "active", "quality", "button_ids", "body"], context: { active_test: false } });
for (const t of tpls) {
  const btns = t.button_ids.length ? await callOdooMethod(uid, "whatsapp.template.button", "read", [t.button_ids], { fields: ["name", "button_type"] }) : [];
  console.log(`\n${t.template_name} (Odoo name "${t.name}") status=${t.status} active=${t.active} quality=${t.quality || "-"}`);
  console.log("  buttons:", btns.map((b) => `${b.name} [${b.button_type}]`).join(", ") || "none");
  console.log("  body:", String(t.body || "").replace(/\s+/g, " ").slice(0, 300));
}
await mongoose.connect(String(process.env.MONGO_URI || "").trim().replace(/^['"]|['"]$/g, ""), { autoIndex: false, autoCreate: false });
const logs = await mongoose.connection.db.collection("broadcastlogs").aggregate([
  { $match: { broadcastType: "requirement" } }, { $sort: { _id: -1 } }, { $limit: 200 },
  { $group: { _id: "$templateName", n: { $sum: 1 }, last: { $max: "$createdAt" } } }, { $sort: { last: -1 } }]).toArray();
console.log("\nlast 200 invitations by template:");
for (const l of logs) console.log(`  ${l._id || "(free text, 24h window)"}: ${l.n}, newest ${l.last ? new Date(l.last).toISOString() : "?"}`);
await mongoose.disconnect();
