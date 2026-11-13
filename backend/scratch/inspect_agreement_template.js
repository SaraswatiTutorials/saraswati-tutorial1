// READ-ONLY: what tutor_agreement4 and sign request 242 look like in Odoo.
// Only authenticate / search_read / read / fields_get are sent.
//   cd backend && node scratch/inspect_agreement_template.js
import dotenv from "dotenv";
dotenv.config();

const clean = (v) => String(v || "").trim().replace(/^['"]|['"]$/g, "");
const URL_ = clean(process.env.ODOO_JSONRPC_URL) || `${clean(process.env.ODOO_COMMUNITY_URL || process.env.ODOO_URL)}/jsonrpc`;
const DB = clean(process.env.ODOO_DB), USER = clean(process.env.ODOO_USERNAME), PASS = clean(process.env.ODOO_PASSWORD);

async function rpc(service, method, args) {
  if (!(method === "authenticate" || ["search_read", "read", "fields_get"].includes(args[4]))) throw new Error("read only");
  const r = await fetch(URL_, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: { service, method, args }, id: 1 }) });
  const d = await r.json();
  if (d.error) throw new Error(d.error.data?.message || d.error.message);
  return d.result;
}
const uid = await rpc("common", "authenticate", [DB, USER, PASS, {}]);
const call = (model, method, args, kw = {}) => rpc("object", "execute_kw", [DB, uid, PASS, model, method, args, kw]);
const fieldsOf = async (model, wanted) => { const h = await call(model, "fields_get", [], { attributes: ["type"] }); return wanted.filter((f) => h[f]); };

const tplFields = await fieldsOf("whatsapp.template", ["id", "name", "template_name", "status", "model", "phone_field", "body", "header_type", "header_text", "footer_text", "button_ids", "variable_ids", "lang_code", "template_type", "wa_account_id"]);
const tpls = await call("whatsapp.template", "search_read", [["|", "|", ["template_name", "ilike", "agreement"], ["template_name", "ilike", "portal"], ["template_name", "ilike", "verif"]]], { fields: tplFields, context: { active_test: false } });
for (const t of tpls) {
  console.log("\n=== TEMPLATE", t.id, t.name, "|", t.template_name, "|", t.status, "|", t.model, "| phone:", t.phone_field);
  if (t.template_name === "tutor_agreement4") {
    console.log(JSON.stringify({ ...t, body: t.body }, null, 1));
    if (t.button_ids?.length) console.log("BUTTONS", JSON.stringify(await call("whatsapp.template.button", "read", [t.button_ids], {}), null, 1).slice(0, 3000));
    if (t.variable_ids?.length) console.log("VARS", JSON.stringify(await call("whatsapp.template.variable", "read", [t.variable_ids], { fields: ["name", "field_type", "field_name", "line_type", "demo_value", "button_id"] }), null, 1));
  }
}

const reqF = await fieldsOf("sign.request", ["id", "reference", "state", "template_id", "request_item_ids", "create_date", "subject", "share_link"]);
console.log("\n=== sign.request 242", JSON.stringify(await call("sign.request", "read", [[242]], { fields: reqF }), null, 1));
const itemF = await fieldsOf("sign.request.item", ["id", "state", "partner_id", "role_id", "signer_email", "sms_number", "access_token", "document_link"]);
console.log("items", JSON.stringify(await call("sign.request.item", "search_read", [[["sign_request_id", "=", 242]]], { fields: itemF }), null, 1));
const stF = await fieldsOf("sign.template", ["id", "name", "active", "sign_item_ids", "responsible_count"]);
console.log("\n=== sign.template", JSON.stringify(await call("sign.template", "search_read", [[]], { fields: stF, context: { active_test: false } }).then((r) => r.map((x) => ({ id: x.id, name: x.name, active: x.active, roles: x.responsible_count })))));
const states = await call("sign.request", "search_read", [[]], { fields: ["id", "state", "template_id"], order: "id desc", limit: 15 });
console.log("\n=== latest requests", JSON.stringify(states));
