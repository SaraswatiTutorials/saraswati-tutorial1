// READ-ONLY: is Odoo's side able to take Meta's webhook POSTs?
//  1. POST a fake, wrongly signed webhook: Odoo should refuse it (403), proving the
//     request gets through the proxy to Odoo's WhatsApp code. Nothing is saved.
//  2. Odoo modules / settings changed around 3 Nov.
//   cd backend && node scratch/check_odoo_webhook_post.js
import dotenv from "dotenv"; dotenv.config();
const { getOdooUid, callOdooMethod } = await import("../utils/whatsappService.js");
const uid = await getOdooUid();
const [acct] = await callOdooMethod(uid, "whatsapp.account", "read", [[2]], { fields: ["callback_url", "account_uid"] });
const tryPost = async (label, body, headers = {}) => {
  const r = await fetch(acct.callback_url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  const h = ["server", "cf-ray", "via", "x-powered-by"].map((k) => r.headers.get(k) ? `${k}=${r.headers.get(k)}` : "").filter(Boolean).join(" ");
  console.log(`${label} -> HTTP ${r.status} ${h} body="${(await r.text()).replace(/\s+/g, " ").slice(0, 120)}"`);
};
await tryPost("empty entry list (no signature)", { object: "whatsapp_business_account", entry: [] });
await tryPost("our account, WRONG signature", { object: "whatsapp_business_account", entry: [{ id: acct.account_uid, changes: [] }] },
  { "X-Hub-Signature-256": "sha256=" + "0".repeat(64) });

const mods = await callOdooMethod(uid, "ir.module.module", "search_read",
  [[["state", "=", "installed"], ["write_date", ">=", "2026-10-25 00:00:00"]]], { fields: ["name", "latest_version", "write_date"], order: "write_date desc", limit: 15 });
console.log("\nmodules installed/updated since 25 Oct:", mods.length ? "" : "none");
for (const m of mods) console.log(`  ${m.write_date} ${m.name} ${m.latest_version}`);
const params = await callOdooMethod(uid, "ir.config_parameter", "search_read",
  [[["write_date", ">=", "2026-10-25 00:00:00"]]], { fields: ["key", "write_date"], order: "write_date desc", limit: 15 });
console.log("\nsystem parameters changed since 25 Oct:", params.length ? "" : "none");
for (const p of params) console.log(`  ${p.write_date} ${p.key}`);
try {
  const logs = await callOdooMethod(uid, "ir.logging", "search_read",
    [[["create_date", ">=", "2026-11-03 13:00:00"], "|", ["message", "ilike", "whatsapp"], ["name", "ilike", "whatsapp"]]], { fields: ["create_date", "level", "name", "message"], order: "id desc", limit: 8 });
  console.log("\nOdoo logs mentioning whatsapp since 3 Nov:", logs.length ? "" : "none stored");
  for (const l of logs) console.log(`  ${l.create_date} ${l.level} ${l.name}: ${String(l.message).slice(0, 150)}`);
} catch (e) { console.log("\nir.logging not readable:", e.message.slice(0, 100)); }
const ver = await fetch(new URL("/web/webclient/version_info", acct.callback_url), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then((r) => r.json()).catch(() => null);
console.log("\nOdoo version:", ver?.result?.server_version || "?");
