/**
 * Creates the two WhatsApp templates Panel 2's "Verification & agreement" step
 * sends (utils/verificationLinks.js), on res.partner with a free-text {{1}}
 * for the tutor's name:
 *   tutor_full_verification  partial tutor → login link to complete full verification
 *   tutor_agreement_sign     anyone not signed → the Odoo Sign agreement
 *
 *   cd backend
 *   node scratch/create_verification_templates.js            show what exists, change nothing
 *   node scratch/create_verification_templates.js --create   create missing ones as drafts
 *   node scratch/create_verification_templates.js --submit   submit drafts to Meta for approval
 *
 * A template that already exists is never changed.
 */
import dotenv from "dotenv";
dotenv.config();

const clean = (v) => String(v || "").trim().replace(/^['"]|['"]$/g, "");
const URL_ = clean(process.env.ODOO_JSONRPC_URL) || `${clean(process.env.ODOO_COMMUNITY_URL || process.env.ODOO_URL)}/jsonrpc`;
const DB = clean(process.env.ODOO_DB), USER = clean(process.env.ODOO_USERNAME), PASS = clean(process.env.ODOO_PASSWORD);
const CREATE = process.argv.includes("--create");
const SUBMIT = process.argv.includes("--submit");

const AGREEMENT_LINK = "https://odoo.saraswatitutorial.com/sign/document/mail/242/08a6535e-f877-49a0-a066-8cbab5ca8694";

const TEMPLATES = [
  {
    name: "Tutor Full Verification",
    template_name: "tutor_full_verification",
    header_text: "Full Verification Pending",
    body:
      "Hello *{{1}}*,\n\n" +
      "*Your tutor profile has been shortlisted for a Saraswati Tutorials tuition requirement.* 🎉\n\n" +
      "To move ahead, please complete your *Full Verification* on the Tutor Portal:\n\n" +
      "1️⃣ Tap *Login to Tutor Portal* below\n" +
      "2️⃣ Sign in with your *registered mobile number*\n" +
      "3️⃣ Open *Full verification* and fill in all your details & documents\n\n" +
      "_Only fully verified tutors receive parent contact details and demo confirmations._",
    footer_text: "Saraswati Tutorials · Tutor Verification Team",
    demoName: "Ravi Kumar",
    button: {
      name: "Login to Tutor Portal", url_type: "dynamic",
      website_url: "https://saraswatitutorial.com/teacher/login?id=",
      demo: "https://saraswatitutorial.com/teacher/login?id=TUT0218",
    },
  },
  {
    name: "Tutor Agreement Sign",
    template_name: "tutor_agreement_sign",
    header_text: "Tutor’s Authorisation",
    body:
      "Hello *{{1}}*,\n\n" +
      "*Your tutor profile has been matched with a Saraswati Tutorials tuition requirement.*\n\n" +
      "✅ A *one-time Tutor Engagement Agreement* must be signed before we can proceed with this assignment.\n\n" +
      "After signing, you will receive:\n" +
      "• Parent contact details\n" +
      "• Exact assignment location\n" +
      "• Demo/class timing updates\n\n" +
      "_It takes less than 2 minutes. Please use the same name and mobile number you registered with._",
    footer_text: "Tap the button below to read and sign.",
    demoName: "Ravi Kumar",
    // Static: the agreement link is the same for every tutor
    button: { name: "Sign Agreement", url_type: "static", website_url: AGREEMENT_LINK },
  },
];

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

const find = async (t) => (await call("whatsapp.template", "search_read",
  [[["template_name", "=", t.template_name]]], { fields: ["id", "name", "status", "variable_ids", "button_ids"], context: { active_test: false } }))[0];

async function show(id) {
  const [t] = await call("whatsapp.template", "read", [[id]], { fields: ["name", "template_name", "status", "model", "phone_field", "variable_ids", "button_ids"] });
  const vars = t.variable_ids.length ? await call("whatsapp.template.variable", "read", [t.variable_ids], { fields: ["name", "line_type", "field_type", "demo_value", "button_id"] }) : [];
  const btns = t.button_ids.length ? await call("whatsapp.template.button", "read", [t.button_ids], { fields: ["name", "button_type", "url_type", "website_url"] }) : [];
  console.log(`  #${id} ${t.template_name} [${t.status}] model=${t.model} phone=${t.phone_field}`);
  for (const v of vars) console.log(`    var ${v.name} (${v.line_type}, ${v.field_type}) demo=${v.demo_value}`);
  for (const b of btns) console.log(`    button "${b.name}" ${b.url_type} ${b.website_url}`);
  return { t, vars, btns };
}

const [partnerModel] = await call("ir.model", "search_read", [[["model", "=", "res.partner"]]], { fields: ["id"] });
const [account] = await call("whatsapp.account", "search_read", [[]], { fields: ["id", "name"], limit: 1 });

for (const spec of TEMPLATES) {
  console.log(`\n== ${spec.template_name}`);
  let existing = await find(spec);
  if (!existing && CREATE) {
    const id = await call("whatsapp.template", "create", [{
      name: spec.name,
      template_name: spec.template_name,
      lang_code: "en",
      template_type: "utility",
      wa_account_id: account.id,
      model_id: partnerModel.id,
      phone_field: "phone",
      header_type: "text",
      header_text: spec.header_text,
      body: spec.body,
      footer_text: spec.footer_text,
      button_ids: [[0, 0, {
        sequence: 0, name: spec.button.name, button_type: "url",
        url_type: spec.button.url_type, website_url: spec.button.website_url,
      }]],
    }]);
    console.log(`  created #${id}`);
    existing = await find(spec);

    // Example values Meta reviews: the body's {{1}} and the dynamic button
    const { vars } = await show(existing.id);
    for (const v of vars) {
      if (v.line_type === "body") {
        await call("whatsapp.template.variable", "write", [[v.id], { field_type: "free_text", demo_value: spec.demoName }]);
      } else if (v.line_type === "button" && spec.button.demo) {
        await call("whatsapp.template.variable", "write", [[v.id], { demo_value: spec.button.demo }]);
      }
    }
    console.log("  example values set");
  }
  if (!existing) { console.log("  does not exist (run with --create)"); continue; }
  await show(existing.id);

  if (SUBMIT) {
    const [{ status }] = await call("whatsapp.template", "read", [[existing.id]], { fields: ["status"] });
    if (status !== "draft") { console.log(`  not submitted: status is ${status}`); continue; }
    await call("whatsapp.template", "button_submit_template", [[existing.id]]);
    const [{ status: after }] = await call("whatsapp.template", "read", [[existing.id]], { fields: ["status"] });
    console.log(`  submitted to Meta → ${after}`);
  }
}
