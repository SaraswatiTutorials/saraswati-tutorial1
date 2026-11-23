// Makes tutor_broadcast_v7: an exact copy of tutor_broadcast_V6 (id 139) with
// category Utility, then submits it to Meta. V6 is left as it is.
//   cd backend && node scratch/make_broadcast_v7.js            preview only
//   cd backend && node scratch/make_broadcast_v7.js --create   copy as a draft
//   cd backend && node scratch/make_broadcast_v7.js --submit   submit the draft to Meta
import dotenv from "dotenv"; dotenv.config({ quiet: true });
const { getOdooUid, callOdooMethod } = await import("../utils/whatsappService.js");
const uid = await getOdooUid();
const call = (m, meth, a, k = {}) => callOdooMethod(uid, m, meth, a, k);
const NEW = "tutor_broadcast_v7";
const show = async (id) => {
  const [t] = await call("whatsapp.template", "read", [[id]], { fields: ["name", "template_name", "template_type", "status", "lang_code", "model", "phone_field", "header_type", "footer_text", "body", "button_ids", "variable_ids"] });
  const btn = await call("whatsapp.template.button", "read", [t.button_ids], { fields: ["name", "button_type", "sequence"] });
  const vars = await call("whatsapp.template.variable", "read", [t.variable_ids], { fields: ["name", "field_type", "line_type", "demo_value"] });
  console.log(`#${id} ${t.name} / ${t.template_name} type=${t.template_type} status=${t.status} lang=${t.lang_code} model=${t.model} phone=${t.phone_field} header=${t.header_type} footer="${t.footer_text}"`);
  console.log("  buttons:", btn.sort((a, b) => a.sequence - b.sequence).map((b) => `${b.name} [${b.button_type}]`).join(", "));
  console.log("  variables:", vars.map((v) => `${v.name}:${v.field_type}=${v.demo_value}`).join(", "));
  return t;
};
const v6 = await show(139);
let [existing] = await call("whatsapp.template", "search_read", [[["template_name", "=", NEW]]], { fields: ["id", "status"], context: { active_test: false } });
if (process.argv.includes("--create") && !existing) {
  const newId = await call("whatsapp.template", "copy", [139], { default: { name: "tutor_broadcast_V7", template_name: NEW, template_type: "utility" } });
  console.log("\ncreated draft", newId);
  existing = { id: Array.isArray(newId) ? newId[0] : newId };
}
if (existing) {
  console.log("\nnew template:");
  const t = await show(existing.id);
  const same = t.body === v6.body && t.footer_text === v6.footer_text && t.button_ids.length === v6.button_ids.length && t.variable_ids.length === v6.variable_ids.length;
  console.log("  same body/footer/buttons/variables as V6:", same);
  if (process.argv.includes("--submit")) {
    if (t.status !== "draft") console.log("  not submitted: status is", t.status);
    else if (!same || t.template_type !== "utility") console.log("  not submitted: copy does not match");
    else {
      await call("whatsapp.template", "button_submit_template", [[existing.id]]);
      const [after] = await call("whatsapp.template", "read", [[existing.id]], { fields: ["status", "template_type"] });
      console.log("  submitted to Meta →", after.status, after.template_type);
    }
  }
} else console.log("\n(no tutor_broadcast_v7 yet — run with --create)");
