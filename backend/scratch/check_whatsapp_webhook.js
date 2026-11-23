// READ-ONLY: Odoo's WhatsApp account settings (no secrets printed) and whether
// the webhook address answers.  cd backend && node scratch/check_whatsapp_webhook.js
import dotenv from "dotenv"; dotenv.config();
const { getOdooUid, callOdooMethod } = await import("../utils/whatsappService.js");
const uid = await getOdooUid();
const have = await callOdooMethod(uid, "whatsapp.account", "fields_get", [], { attributes: ["type"] });
const want = ["id", "name", "active", "callback_url", "phone_uid", "account_uid", "app_uid", "write_date", "write_uid", "notify_user_ids"].filter((f) => have[f]);
const accts = await callOdooMethod(uid, "whatsapp.account", "search_read", [[]], { fields: want, context: { active_test: false } });
console.log("whatsapp accounts:", JSON.stringify(accts, null, 1));
const base = await callOdooMethod(uid, "ir.config_parameter", "search_read", [[["key", "in", ["web.base.url", "web.base.url.freeze"]]]], { fields: ["key", "value", "write_date"] });
console.log("base url:", JSON.stringify(base));
for (const a of accts) {
  if (!a.callback_url) continue;
  const u = a.callback_url + "?hub.mode=subscribe&hub.verify_token=wrong-on-purpose&hub.challenge=123";
  try {
    const r = await fetch(u);
    console.log(`GET ${a.callback_url} (wrong token on purpose) -> HTTP ${r.status}`);
  } catch (e) { console.log(`GET ${a.callback_url} -> ${e.message}`); }
}
