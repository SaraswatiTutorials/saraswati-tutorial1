// Values passed by placeholder ({ "{{n}}": value }) must land in Odoo's
// free_text_n. Odoo lists a template's variables sorted as TEXT, so "{{10}}"
// comes before "{{1}}"; its composer still fills free_text_n into {{n}} by
// number (checked against Odoo's own preview on 25 Nov 2026). Odoo here is an
// in-memory stand-in: nothing is sent.
import { test, mock, before } from "node:test";
import assert from "node:assert/strict";

const calls = [];
let variables;

before(() => {
  mock.module("node-fetch", {
    defaultExport: async (url, opts) => {
      const { params } = JSON.parse(opts.body);
      let result = null;
      if (params.service === "common") result = 7;
      else {
        const [, , , model, method, args] = params.args;
        calls.push({ model, method, args });
        if (model === "whatsapp.template" && method === "search_read") result = [{ id: 146, status: "approved", model: "crm.lead", name: "t", body: "" }];
        else if (model === "whatsapp.template" && method === "read") result = [{ variable_ids: variables.map((v, i) => i + 1) }];
        else if (model === "whatsapp.template.variable") result = variables;
        else if (method === "search") result = [1];
        else if (model === "whatsapp.composer" && method === "create") result = 99;
        else result = [555];
      }
      return { ok: true, status: 200, url, headers: { get: () => "application/json" }, text: async () => JSON.stringify({ result }) };
    },
  });
});

// Odoo's order: sorted as text
const tenVars = ["{{10}}", "{{1}}", "{{2}}", "{{3}}", "{{4}}", "{{5}}", "{{6}}", "{{7}}", "{{8}}", "{{9}}"]
  .map((name) => ({ name, field_type: "free_text", line_type: "body" }));

test("a ten-variable template: each value goes into its own free_text slot", async () => {
  variables = tenVars;
  calls.length = 0;
  const { sendWhatsAppToTutor } = await import("../utils/whatsappService.js");
  const templateVars = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`{{${i + 1}}}`, `value ${i + 1}`]));
  const r = await sendWhatsAppToTutor({ phoneNumber: "910000000000", messageBody: "", templateName: "tutor_profile_card_v2", templateVars, forceTemplate: true });
  assert.equal(r.success, true);
  const composer = calls.find((c) => c.model === "whatsapp.composer" && c.method === "create").args[0];
  for (let i = 1; i <= 10; i++) assert.equal(composer[`free_text_${i}`], `value ${i}`, `free_text_${i}`);
});

test("a mixed template (Odoo field + free text) still counts free-text slots alone", async () => {
  // {{1}}–{{5}} are Odoo fields; {{6}} and {{7}} are free text → slots 1 and 2
  variables = [
    ...["{{1}}", "{{2}}", "{{3}}", "{{4}}", "{{5}}"].map((name) => ({ name, field_type: "field", line_type: "body" })),
    { name: "{{6}}", field_type: "free_text", line_type: "body" },
    { name: "{{7}}", field_type: "free_text", line_type: "body" },
  ];
  calls.length = 0;
  const { sendWhatsAppToTutor } = await import("../utils/whatsappService.js");
  await sendWhatsAppToTutor({ phoneNumber: "910000000000", messageBody: "", templateName: "x", templateVars: { "{{6}}": "six", "{{7}}": "seven" }, forceTemplate: true });
  const composer = calls.find((c) => c.model === "whatsapp.composer" && c.method === "create").args[0];
  assert.equal(composer.free_text_1, "six");
  assert.equal(composer.free_text_2, "seven");
});
