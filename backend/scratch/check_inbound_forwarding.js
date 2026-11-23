// READ-ONLY: how Odoo passes incoming WhatsApp messages on to n8n — the
// automation rules on whatsapp.message / discuss messages, and their actions.
//   cd backend && node scratch/check_inbound_forwarding.js
import dotenv from "dotenv"; dotenv.config({ quiet: true });
const { getOdooUid, callOdooMethod } = await import("../utils/whatsappService.js");
const uid = await getOdooUid();
const ctx = { context: { active_test: false } };
const rules = await callOdooMethod(uid, "base.automation", "search_read", [[]],
  { fields: ["id", "name", "active", "model_name", "trigger", "action_server_ids", "write_date", "last_run", "filter_domain"], ...ctx });
for (const r of rules) {
  if (!/whatsapp|mail\.message|discuss|n8n|webhook/i.test(`${r.name} ${r.model_name}`)) continue;
  console.log(`\nrule #${r.id} "${r.name}" active=${r.active} model=${r.model_name} trigger=${r.trigger} written=${r.write_date} last_run=${r.last_run || "-"}`);
  console.log("  domain:", r.filter_domain || "-");
  if (r.action_server_ids.length) {
    const acts = await callOdooMethod(uid, "ir.actions.server", "read", [r.action_server_ids], { fields: ["name", "state", "webhook_url", "code"] });
    for (const a of acts) console.log(`  action "${a.name}" type=${a.state} url=${a.webhook_url ? a.webhook_url.replace(/(https?:\/\/[^/]+).*/, "$1/…") : "-"}${a.code ? " code:" + a.code.replace(/\s+/g, " ").slice(0, 160) : ""}`);
  }
}
console.log("\nall rules:", rules.map((r) => `#${r.id} ${r.active ? "" : "(off) "}${r.name} [${r.model_name}]`).join(" | "));
