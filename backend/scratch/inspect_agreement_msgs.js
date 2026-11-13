// READ-ONLY: how tutor_agreement4 messages rendered, and the draft partial template.
import dotenv from "dotenv"; dotenv.config();
const clean = (v) => String(v || "").trim().replace(/^['"]|['"]$/g, "");
const URL_ = clean(process.env.ODOO_JSONRPC_URL) || `${clean(process.env.ODOO_COMMUNITY_URL || process.env.ODOO_URL)}/jsonrpc`;
const DB = clean(process.env.ODOO_DB), USER = clean(process.env.ODOO_USERNAME), PASS = clean(process.env.ODOO_PASSWORD);
async function rpc(service, method, args) {
  if (!(method === "authenticate" || ["search_read", "read", "fields_get"].includes(args[4]))) throw new Error("read only");
  const r = await fetch(URL_, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: { service, method, args }, id: 1 }) });
  const d = await r.json(); if (d.error) throw new Error(d.error.data?.message || d.error.message); return d.result;
}
const uid = await rpc("common", "authenticate", [DB, USER, PASS, {}]);
const call = (m, meth, a, kw = {}) => rpc("object", "execute_kw", [DB, uid, PASS, m, meth, a, kw]);
console.log("item 234:", JSON.stringify(await call("sign.request.item", "read", [[234]], { fields: ["display_name"] })));
const msgs = await call("whatsapp.message", "search_read", [[["wa_template_id", "in", [100, 72, 99]]]], { fields: ["id", "wa_template_id", "state", "body", "failure_reason", "create_date"], order: "id desc", limit: 4 });
for (const m of msgs) console.log("\nMSG", m.id, m.wa_template_id?.[1], m.state, m.failure_reason || "", m.create_date, "\n", String(m.body || "").replace(/<[^>]+>/g, " ").slice(0, 300));
const t = await call("whatsapp.template", "read", [[123]], { fields: ["name", "body", "button_ids", "variable_ids", "header_text", "footer_text"] });
console.log("\nTPL123", JSON.stringify(t, null, 1));
if (t[0].button_ids.length) console.log(JSON.stringify(await call("whatsapp.template.button", "read", [t[0].button_ids], { fields: ["name", "button_type", "url_type", "website_url"] })));
if (t[0].variable_ids.length) console.log(JSON.stringify(await call("whatsapp.template.variable", "read", [t[0].variable_ids], { fields: ["name", "field_type", "field_name", "line_type", "demo_value"] })));
const bf = await call("whatsapp.template", "fields_get", [], { attributes: ["type", "selection", "required"] });
console.log("\ntemplate fields:", JSON.stringify(Object.fromEntries(Object.entries(bf).filter(([k, v]) => ["header_type","template_type","status","lang_code","url_type","quality"].includes(k) || v.required).map(([k, v]) => [k, v.selection || v.type]))));
const btf = await call("whatsapp.template.button", "fields_get", [], { attributes: ["type", "selection", "required"] });
console.log("button fields:", JSON.stringify(Object.fromEntries(Object.entries(btf).filter(([, v]) => v.selection || v.required).map(([k, v]) => [k, v.selection || v.type]))));
const vf = await call("whatsapp.template.variable", "fields_get", [], { attributes: ["type", "selection", "required"] });
console.log("var fields:", JSON.stringify(Object.fromEntries(Object.entries(vf).filter(([, v]) => v.selection || v.required).map(([k, v]) => [k, v.selection || v.type]))));
