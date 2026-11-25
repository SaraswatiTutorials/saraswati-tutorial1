/**
 * Creates the "Tutor Profile Card" WhatsApp template in Odoo: the tutor's
 * profile photo as the header (sent by the code on every message) and the
 * tutor details laid out like the office's card.
 *
 *   cd backend
 *   node scripts/createTutorProfileTemplate.js            show what exists, change nothing
 *   node scripts/createTutorProfileTemplate.js --create   create it as a draft
 *   node scripts/createTutorProfileTemplate.js --submit   submit the draft to Meta for approval
 *
 * A template that already exists is never changed.
 * The code that fills it: utils/tutorOptionsMessage.js (buildTutorCard).
 */
import dotenv from "dotenv";
dotenv.config();

const clean = (v) => String(v || "").trim().replace(/^['"]|['"]$/g, "");
const URL_ = clean(process.env.ODOO_JSONRPC_URL) || `${clean(process.env.ODOO_COMMUNITY_URL || process.env.ODOO_URL)}/jsonrpc`;
const DB = clean(process.env.ODOO_DB), USER = clean(process.env.ODOO_USERNAME), PASS = clean(process.env.ODOO_PASSWORD);
const CREATE = process.argv.includes("--create");
const SUBMIT = process.argv.includes("--submit");

// Sample header picture Meta reviews; every real send carries the tutor's own photo.
const SAMPLE_HEADER = "https://saraswatitutorial.com/logo.png";

export const SPEC = {
  name: "Tutor Profile Card",
  template_name: "tutor_profile_card",
  body:
    "Dear Parent,\n" +
    "Please find the details of the tutor assigned for your Ward.\n\n" +
    "*Tutor Details:*\n\n" +
    "Full Name: {{1}}\n" +
    "Qualification: {{2}}\n" +
    "*Teaching Experience: {{3}}*\n" +
    "*Subjects Expertise: {{4}}*\n" +
    "Location: {{5}}\n" +
    "Vehicle: {{6}}\n" +
    "Occupation: {{7}}\n" +
    "Language of instruction: {{8}}\n\n" +
    "_Saraswati Tutorials_",
  demo: [
    "Niraj Kumar Singh", "Graduated", "15 yrs", "Maths, English, Science, Hindi, Computer",
    "Marathahalli", "Yes (KA50EB8431)", "Lead Engineer in MNC", "English",
  ],
};

async function rpc(service, method, args) {
  const r = await fetch(URL_, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: { service, method, args }, id: Date.now() }) });
  const d = await r.json();
  if (d.error) throw new Error(d.error.data?.message || d.error.message);
  return d.result;
}

const uid = await rpc("common", "authenticate", [DB, USER, PASS, {}]);
if (!uid) throw new Error("Odoo login failed");
const call = (model, method, args, kw = {}) => rpc("object", "execute_kw", [DB, uid, PASS, model, method, args, kw]);

const find = async () => (await call("whatsapp.template", "search_read",
  [[["template_name", "=", SPEC.template_name]]],
  { fields: ["id", "status"], context: { active_test: false } }))[0];

async function show(id) {
  const [t] = await call("whatsapp.template", "read", [[id]],
    { fields: ["name", "template_name", "status", "model", "phone_field", "header_type", "variable_ids", "body"] });
  const vars = await call("whatsapp.template.variable", "read", [t.variable_ids],
    { fields: ["name", "line_type", "field_type", "demo_value"] });
  console.log(`  #${id} ${t.name} [${t.template_name}] status=${t.status} model=${t.model} header=${t.header_type}`);
  console.log(t.body.split("\n").map((l) => `    | ${l}`).join("\n"));
  for (const v of vars) console.log(`    var ${v.name} (${v.line_type}, ${v.field_type}) example="${v.demo_value}"`);
  return vars;
}

let existing = await find();
if (!existing && CREATE) {
  const [leadModel] = await call("ir.model", "search_read", [[["model", "=", "crm.lead"]]], { fields: ["id"] });
  const [account] = await call("whatsapp.account", "search_read", [[]], { fields: ["id"], limit: 1 });

  const img = await fetch(SAMPLE_HEADER);
  if (!img.ok) throw new Error(`sample header unreachable (${img.status})`);
  const attachmentId = await call("ir.attachment", "create", [{
    name: "tutor_profile_card_sample.png",
    datas: Buffer.from(await img.arrayBuffer()).toString("base64"),
    mimetype: "image/png",
  }]);

  const id = await call("whatsapp.template", "create", [{
    name: SPEC.name,
    template_name: SPEC.template_name,
    lang_code: "en",
    template_type: "utility",
    wa_account_id: account.id,
    model_id: leadModel.id,
    phone_field: "phone",
    header_type: "image",
    header_attachment_ids: [[6, 0, [attachmentId]]],
    body: SPEC.body,
  }]);
  console.log(`created #${id}`);
  existing = await find();

  const vars = await call("whatsapp.template.variable", "search_read",
    [[["wa_template_id", "=", existing.id], ["line_type", "=", "body"]]], { fields: ["id", "name"] });
  for (const v of vars) {
    const n = Number(/\d+/.exec(v.name)?.[0]);
    await call("whatsapp.template.variable", "write", [[v.id], { field_type: "free_text", demo_value: SPEC.demo[n - 1] }]);
  }
  console.log("example values set");
}

if (!existing) {
  console.log(`"${SPEC.template_name}" does not exist yet (run with --create)`);
  process.exit(0);
}
await show(existing.id);

if (SUBMIT) {
  const [{ status }] = await call("whatsapp.template", "read", [[existing.id]], { fields: ["status"] });
  if (status !== "draft") {
    console.log(`not submitted: status is ${status}`);
  } else {
    await call("whatsapp.template", "button_submit_template", [[existing.id]]);
    const [{ status: after }] = await call("whatsapp.template", "read", [[existing.id]], { fields: ["status"] });
    console.log(`submitted to Meta → ${after}`);
  }
}
