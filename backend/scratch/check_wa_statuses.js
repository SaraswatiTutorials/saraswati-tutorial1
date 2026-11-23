// READ-ONLY: outbound WhatsApp states per day (delivered/read come back from Meta's
// webhook, so if they stop, the webhook stopped), and Odoo's webhook verify check.
//   cd backend && node scratch/check_wa_statuses.js
import dotenv from "dotenv"; dotenv.config();
const { getOdooUid, callOdooMethod } = await import("../utils/whatsappService.js");
const uid = await getOdooUid();
const rows = await callOdooMethod(uid, "whatsapp.message", "search_read",
  [[["create_date", ">=", "2026-10-28 00:00:00"]]], { fields: ["create_date", "message_type", "state"], order: "id asc" });
const byDay = {};
for (const r of rows) {
  const d = r.create_date.slice(0, 10);
  const k = `${r.message_type}:${r.state}`;
  (byDay[d] ||= {})[k] = (byDay[d][k] || 0) + 1;
}
for (const [d, c] of Object.entries(byDay)) console.log(d, JSON.stringify(c));
const last = await callOdooMethod(uid, "whatsapp.message", "search_read",
  [[["message_type", "=", "outbound"], ["state", "in", ["delivered", "read", "replied"]]]], { fields: ["create_date", "state"], order: "id desc", limit: 1 });
console.log("\nnewest outbound that Meta reported delivered/read:", JSON.stringify(last));
const fails = await callOdooMethod(uid, "whatsapp.message", "search_read",
  [[["create_date", ">=", "2026-11-03 00:00:00"], ["failure_reason", "!=", false]]], { fields: ["create_date", "state", "failure_reason"], order: "id desc", limit: 3 });
console.log("recent failures:", JSON.stringify(fails));
// Odoo's own webhook check, with its real verify token: Odoo should echo the challenge
const [acct] = await callOdooMethod(uid, "whatsapp.account", "read", [[2]], { fields: ["callback_url", "webhook_verify_token"] });
const r = await fetch(`${acct.callback_url}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(acct.webhook_verify_token)}&hub.challenge=4242`);
console.log(`\nOdoo webhook verify with the real token -> HTTP ${r.status}, body "${(await r.text()).slice(0, 20)}" (expect 200 and 4242)`);
