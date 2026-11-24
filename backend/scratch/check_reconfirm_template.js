// READ-ONLY: the parent re-confirmation template Panel 2 sends, its state in
// Odoo, which Odoo automations used to send it, and the recent sends.
//   cd backend && node scratch/check_reconfirm_template.js
import dotenv from "dotenv"; dotenv.config({ quiet: true });
import mongoose from "mongoose";
const { getOdooUid, callOdooMethod } = await import("../utils/whatsappService.js");
const { RECONFIRM_TEMPLATE } = await import("../utils/pipelineStages.js");
const uid = await getOdooUid();
const call = (m, meth, a, k = {}) => callOdooMethod(uid, m, meth, a, k);
console.log("Panel 2 sends:", RECONFIRM_TEMPLATE, "| .env override:", process.env.WHATSAPP_RECONFIRM_TEMPLATE_NAME || "(none)");
const tpls = await call("whatsapp.template", "search_read", [["|", "|", ["template_name", "ilike", "confirm"], ["name", "ilike", "confirm"], ["template_name", "ilike", "booking"]]],
  { fields: ["id", "name", "template_name", "status", "active", "template_type", "model", "body", "button_ids", "variable_ids", "write_date"], context: { active_test: false } });
for (const t of tpls) {
  const btn = t.button_ids.length ? await call("whatsapp.template.button", "read", [t.button_ids], { fields: ["name", "button_type"] }) : [];
  const vars = t.variable_ids.length ? await call("whatsapp.template.variable", "read", [t.variable_ids], { fields: ["name", "field_type", "field_name", "demo_value"] }) : [];
  const used = await call("whatsapp.message", "search_read", [[["wa_template_id", "=", t.id]]], { fields: ["create_date", "state"], order: "id desc", limit: 1 });
  const n = await call("whatsapp.message", "search_count", [[["wa_template_id", "=", t.id]]]);
  console.log(`\n${t.template_name === RECONFIRM_TEMPLATE ? ">>> " : ""}#${t.id} ${t.name} / ${t.template_name} [${t.status}${t.active ? "" : ", ARCHIVED"}] ${t.template_type} model=${t.model}`);
  console.log(`  sent ${n}x, last ${used[0]?.create_date || "never"} (${used[0]?.state || "-"})`);
  if (t.template_name === RECONFIRM_TEMPLATE || /re_?confirm/i.test(t.template_name)) {
    console.log("  buttons:", btn.map((b) => `${b.name} [${b.button_type}]`).join(", ") || "none");
    console.log("  variables:", vars.map((v) => `${v.name}:${v.field_type}${v.field_name ? "(" + v.field_name + ")" : ""}`).join(", "));
    console.log("  body:", String(t.body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 600));
  }
}
const rules = await call("base.automation", "search_read", [[["name", "ilike", "confirm"]]], { fields: ["id", "name", "active", "trigger", "model_name"], context: { active_test: false } });
console.log("\nOdoo automations with 'confirm':", rules.map((r) => `#${r.id} ${r.name} [${r.active ? "ON" : "off"}] ${r.model_name}/${r.trigger}`).join(" | "));
await mongoose.connect(String(process.env.MONGO_URI || "").trim().replace(/^['"]|['"]$/g, ""), { autoIndex: false, autoCreate: false });
const rows = await mongoose.connection.db.collection("parent_reconfirmations").find({}).sort({ sentAt: -1 }).limit(5).toArray();
console.log(`\nPanel 2 re-confirmations recorded: ${await mongoose.connection.db.collection("parent_reconfirmations").countDocuments()}`);
for (const r of rows) console.log(`  ${r.requirementId} ${r.templateName} sent=${r.sent} ${r.failureReason || ""} at ${r.sentAt?.toISOString?.()}`);
await mongoose.disconnect();
