// An empty template value makes Odoo send the template's SAMPLE text instead
// (a tutor got a made-up demo date that way). Values are never empty.
import { test } from "node:test";
import assert from "node:assert/strict";
import { templateValue, EMPTY_TEMPLATE_VALUE } from "../utils/whatsappService.js";

test("empty, blank, null and undefined become a dash, never empty", () => {
  for (const v of ["", "   ", null, undefined]) assert.equal(templateValue(v), EMPTY_TEMPLATE_VALUE);
  assert.equal(EMPTY_TEMPLATE_VALUE, "—");
});

test("real values pass through unchanged (trimmed), numbers as text", () => {
  assert.equal(templateValue("Grade 10"), "Grade 10");
  assert.equal(templateValue("  Medahalli, Bangalore "), "Medahalli, Bangalore");
  assert.equal(templateValue(3), "3");
  assert.equal(templateValue(0), "0");
});

import { templateLookupDomain } from "../utils/whatsappService.js";

test("templates are found by display Name OR Template Name, so renames in Odoo do not break sending", () => {
  assert.deepEqual(templateLookupDomain("demo_confirmation_tutor"),
    ["|", ["name", "=", "demo_confirmation_tutor"], ["template_name", "=", "demo_confirmation_tutor"]]);
});
