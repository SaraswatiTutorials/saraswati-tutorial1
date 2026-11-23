// Panel 2's "Demo send": a test number gets both the login link and the
// agreement. MongoDB, Odoo and WhatsApp are stand-ins in memory.
import { test } from "node:test";
import assert from "node:assert/strict";
import { demoVerification, cleanNumber, DEMO_REQUIREMENT } from "../utils/demoVerification.js";

function world({ existing = null, approved = true } = {}) {
  const created = [];
  const sends = [];
  return {
    created, sends,
    deps: {
      findPerson: async () => existing,
      isApproved: async () => approved,
      createDemoPartial: async (row) => { created.push(row); return "demo1"; },
      sendLinks: async (lead, options) => {
        sends.push({ lead, options });
        return { ok: true, sent: 2, tutors: [{ profile: { willSend: true, sent: true }, agreement: { willSend: true, sent: true } }] };
      },
    },
  };
}

test("numbers are read the way people type them", () => {
  assert.equal(cleanNumber("+91 90411 57689"), "9041157689");
  assert.equal(cleanNumber("09041157689"), "9041157689");
  assert.equal(cleanNumber("9041157689"), "9041157689");
  assert.equal(cleanNumber("12345"), "");
  assert.equal(cleanNumber("1234567890"), ""); // not a mobile number
});

test("preview for a new number: says a demo record will be made, creates and sends nothing", async () => {
  const w = world();
  const r = await demoVerification({ phone: "+91 90411 57689", name: "Founder Test" }, w.deps);
  assert.equal(r.ok, true);
  assert.equal(r.willCreate, true);
  assert.equal(r.name, "Founder Test");
  assert.match(r.loginLink, /\?id=9041157689$/);
  assert.ok(r.messages.profile.includes(r.loginLink));
  assert.ok(r.messages.agreement.includes(r.agreementLink));
  assert.equal(w.created.length, 0);
  assert.equal(w.sends.length, 0);
});

test("real send for a new number: makes the demo partial tutor, then sends both messages", async () => {
  const w = world();
  const r = await demoVerification({ phone: "9041157689", name: "", dryRun: false }, w.deps);
  assert.deepEqual(w.created, [{ name: "Demo Tutor", whatsapp: "9041157689" }]);
  assert.equal(w.sends.length, 1);
  assert.equal(w.sends[0].lead.requirementId, DEMO_REQUIREMENT);
  assert.deepEqual(w.sends[0].options, { tutorId: "demo1", forceAll: true, dryRun: false });
  assert.equal(r.created, true);
  assert.equal(r.sent, 2);
  assert.equal(r.profile.sent, true);
  assert.equal(r.agreement.sent, true);
});

test("a number already on file is used as it is, with its own name", async () => {
  const existing = { id: "t9", source: "tutor", name: "Real Name", tutorCode: "TUT0900", isDemo: false };
  const w = world({ existing });
  const r = await demoVerification({ phone: "9041157689", name: "Typed Name", dryRun: false }, w.deps);
  assert.equal(w.created.length, 0);
  assert.equal(w.sends[0].options.tutorId, "t9");
  assert.equal(r.name, "Real Name");
  assert.match(r.loginLink, /\?id=TUT0900$/);
});

test("nothing is sent while a template is not approved", async () => {
  const w = world({ approved: false });
  const r = await demoVerification({ phone: "9041157689", dryRun: false }, w.deps);
  assert.equal(r.ok, false);
  assert.match(r.reason, /approved/);
  assert.equal(w.created.length, 0);
  assert.equal(w.sends.length, 0);
});

test("a bad number is refused", async () => {
  const r = await demoVerification({ phone: "123" }, world().deps);
  assert.equal(r.ok, false);
});
