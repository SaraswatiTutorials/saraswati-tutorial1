import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildRequirementTemplateVars,
  buildRequirementTemplateVarsV3,
  chooseRequirementTemplate,
} from "../utils/whatsappService.js";
import { classifyReply } from "../utils/tutorReplyScheduler.js";

const lead = {
  requirementId: "REQ-00999",
  parentName: "Test Parent",
  area: "Jayanagar",
  city: "Bengaluru",
  pincode: "560041",
  preferredTime: "5-7 PM",
  sessionsPerWeek: 3,
  monthlyFees: 4000,
};
const ward = { classGrade: "8", curriculum: "CBSE", subjectsNeeded: ["Maths", "Science"] };

test("invite values are in the v6 / v4 {{1}}–{{9}} order", () => {
  const vars = buildRequirementTemplateVars("Test Tutor", lead, ward);
  assert.deepEqual(Object.keys(vars), Array.from({ length: 9 }, (_, i) => `free_text_${i + 1}`));
  assert.deepEqual(Object.values(vars), [
    "Test Tutor",                     // {{1}}
    "₹4000/month",                    // {{2}} monthly fee
    "Class 8 (CBSE)",                 // {{3}} grade (board)
    "Maths, Science",                 // {{4}}
    "Jayanagar, Bengaluru, 560041",   // {{5}}
    "5-7 PM",                         // {{6}}
    "3",                              // {{7}} classes per week
    "REQ-00999",                      // {{8}} reference ID
    "Test Parent",                    // {{9}} parent name
  ]);
});

test("no value is ever empty (Meta rejects empty values)", () => {
  const vars = buildRequirementTemplateVars("", {}, {});
  for (const [k, v] of Object.entries(vars)) assert.ok(String(v).trim(), `${k} is empty`);
  assert.equal(vars.free_text_3, "N/A"); // no grade, no board, no empty "( )"
  assert.equal(vars.free_text_2, "Negotiable");
  assert.equal(vars.free_text_9, "N/A");
});

test("grade without a board has no brackets", () => {
  const vars = buildRequirementTemplateVars("T", lead, { ...ward, curriculum: "" });
  assert.equal(vars.free_text_3, "Class 8");
});

test("v3 values keep v3's old order (used until v4 is approved)", () => {
  assert.deepEqual(Object.values(buildRequirementTemplateVarsV3("Test Tutor", lead, ward)), [
    "Test Tutor", "Class 8", "CBSE", "Maths, Science", "Jayanagar, Bengaluru, 560041",
    "5-7 PM", "3", "₹4000/month", "REQ-00999",
  ]);
});

// The approval check is faked: these tests never call Odoo or WhatsApp.
function withTemplateEnv(value, fn) {
  const saved = process.env.WHATSAPP_REQUIREMENT_TEMPLATE_NAME;
  if (value === undefined) delete process.env.WHATSAPP_REQUIREMENT_TEMPLATE_NAME;
  else process.env.WHATSAPP_REQUIREMENT_TEMPLATE_NAME = value;
  return fn().finally(() => {
    if (saved === undefined) delete process.env.WHATSAPP_REQUIREMENT_TEMPLATE_NAME;
    else process.env.WHATSAPP_REQUIREMENT_TEMPLATE_NAME = saved;
  });
}

test("all approved (4 Nov): invites use v6 with the nine-value order", () =>
  withTemplateEnv(undefined, async () => {
    const c = await chooseRequirementTemplate({ isApproved: async () => true });
    assert.equal(c.templateName, "tutor_broadcast_v6");
    assert.equal(c.buildVars, buildRequirementTemplateVars);
  }));

test("v6 not approved: v4, same nine-value order", () =>
  withTemplateEnv(undefined, async () => {
    const asked = [];
    const c = await chooseRequirementTemplate({ isApproved: async (n) => { asked.push(n); return n === "tutor_broadcast_v4"; } });
    assert.deepEqual(asked, ["tutor_broadcast_v6", "tutor_broadcast_v4"]);
    assert.equal(c.templateName, "tutor_broadcast_v4");
    assert.equal(c.buildVars, buildRequirementTemplateVars);
  }));

test("only v3 approved: v3 with v3's own values", () =>
  withTemplateEnv(undefined, async () => {
    const c = await chooseRequirementTemplate({ isApproved: async (n) => n === "tutor_requirement_v3" });
    assert.equal(c.templateName, "tutor_requirement_v3");
    assert.equal(c.buildVars, buildRequirementTemplateVarsV3);
  }));

test("Odoo check failing for v6 falls through to the next approved one", () =>
  withTemplateEnv(undefined, async () => {
    const c = await chooseRequirementTemplate({ isApproved: async (n) => {
      if (n === "tutor_broadcast_v6") throw new Error("Odoo down");
      return true;
    } });
    assert.equal(c.templateName, "tutor_broadcast_v4");
  }));

test("env still says v3 but v3 is archived (Render today): v6 is used", () =>
  withTemplateEnv("tutor_requirement_v3", async () => {
    const c = await chooseRequirementTemplate({ isApproved: async (n) => n !== "tutor_requirement_v3" });
    assert.equal(c.templateName, "tutor_broadcast_v6");
    assert.equal(c.buildVars, buildRequirementTemplateVars);
  }));

test("none approved: v6 is returned, so the send reports the failure", () =>
  withTemplateEnv(undefined, async () => {
    const c = await chooseRequirementTemplate({ isApproved: async () => false });
    assert.equal(c.templateName, "tutor_broadcast_v6");
  }));

test("the new buttons are read correctly, and the old ones still are", () => {
  assert.equal(classifyReply("Available"), "interested");
  assert.equal(classifyReply("Not Available"), "not_interested");
  assert.equal(classifyReply("not available"), "not_interested");
  assert.equal(classifyReply("Interested"), "interested");
  assert.equal(classifyReply("Not Interested"), "not_interested");
  assert.equal(classifyReply("Unavailable"), "not_interested");
  // tutor_broadcast_v6 buttons (curly and straight apostrophes)
  assert.equal(classifyReply("I’m available"), "interested");
  assert.equal(classifyReply("I'm available"), "interested");
  assert.equal(classifyReply("I’ll pass this time"), "not_interested");
  assert.equal(classifyReply("I'll pass this time"), "not_interested");
  assert.equal(classifyReply("I passed my B.Ed"), "unclear"); // "passed" is not "pass"
});
