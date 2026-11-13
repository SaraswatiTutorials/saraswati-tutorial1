// Panel 2's "Verification & agreement" step: who gets the login link, who gets
// the agreement, and what is recorded. Odoo, WhatsApp and MongoDB are
// stand-ins in memory; nothing leaves this process.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sendVerificationLinks, PROFILE_TEMPLATE, AGREEMENT_TEMPLATE, AGREEMENT_LINK, loginLinkFor,
} from "../utils/verificationLinks.js";

const lead = { _id: "lead1", requirementId: "REQ1" };

// Asha: registered, signed. Bala: registered, not signed. Chitra: partial, not signed.
const PEOPLE = {
  a: { id: "a", source: "tutor", name: "Asha", phone: "9000000001", whatsapp: "9000000001", email: "asha@example.com", tutorCode: "TUT0001", fullyVerified: true },
  b: { id: "b", source: "tutor", name: "Bala", phone: "9000000002", whatsapp: "", email: "", tutorCode: "TUT0002", fullyVerified: true },
  c: { id: "c", source: "partial", name: "Chitra", phone: "9000000003", whatsapp: "9000000003", email: "", tutorCode: "TUT0003", fullyVerified: false },
};

const SIGNERS = {
  items: [{ id: 1, sign_request_id: [10, "Agreement"], partner_id: [100, "Asha"], state: "completed", signing_date: "2026-10-02 06:00:00" }],
  requests: [{ id: 10, reference: "Tutor Engagement", create_date: "2026-10-01 05:00:00" }],
  partners: [{ id: 100, name: "Asha", email: "ASHA@example.com" }],
};

function world({ members = ["a", "b", "c"], approved = true, recent = [], sendOk = true, readSigners } = {}) {
  const sent = [];
  const recorded = [];
  return {
    sent, recorded,
    deps: {
      groupMembers: async () => members.map((id) => ({ tutorId: id, name: PEOPLE[id]?.name || id })),
      resolvePerson: async (m) => PEOPLE[m.tutorId] || null,
      readSigners: readSigners || (async () => SIGNERS),
      isApproved: async (name) => (typeof approved === "function" ? approved(name) : approved),
      recentSends: async () => recent,
      send: async (opts) => { sent.push(opts); return sendOk ? { success: true, messageId: String(500 + sent.length), usedTemplate: true } : { success: false, failureReason: "Invalid Number" }; },
      record: async (row) => { recorded.push(row); },
    },
  };
}

test("dry run: signed + verified gets nothing, unsigned gets agreement, partial gets both", async () => {
  const w = world();
  const r = await sendVerificationLinks(lead, { group: "top3", dryRun: true }, w.deps);
  assert.equal(r.ok, true);
  const by = Object.fromEntries(r.tutors.map((t) => [t.name, t]));
  assert.equal(by.Asha.gets, "nothing");
  assert.equal(by.Asha.agreementStatus, "signed");
  assert.equal(by.Bala.gets, "agreement");
  assert.equal(by.Chitra.gets, "login link + agreement");
  assert.equal(r.profileCount, 1);
  assert.equal(r.agreementCount, 2);
  assert.equal(r.willSend, 3);
  assert.equal(w.sent.length, 0);
  assert.equal(w.recorded.length, 0);
});

test("real run sends the login link before the agreement and records every send", async () => {
  const w = world();
  const r = await sendVerificationLinks(lead, { group: "invited", dryRun: false }, w.deps);
  assert.equal(r.sent, 3);
  assert.deepEqual(w.sent.map((s) => [s.templateVars.tutor_name, s.templateName]), [
    ["Bala", AGREEMENT_TEMPLATE],
    ["Chitra", PROFILE_TEMPLATE],
    ["Chitra", AGREEMENT_TEMPLATE],
  ]);
  const chitraLogin = w.sent[1];
  assert.equal(chitraLogin.templateVars.button_dynamic_url_1, loginLinkFor(PEOPLE.c));
  assert.match(chitraLogin.templateVars.button_dynamic_url_1, /\?id=TUT0003$/);
  assert.equal(w.sent[2].templateVars.button_dynamic_url_1, AGREEMENT_LINK);
  // The free-form text (used inside WhatsApp's 24-hour window) carries the link too
  assert.ok(chitraLogin.messageBody.includes(loginLinkFor(PEOPLE.c)));
  assert.deepEqual(w.recorded.map((x) => [x.tutorName, x.kind, x.status, x.group]), [
    ["Bala", "agreement", "Sent", "invited"],
    ["Chitra", "profile", "Sent", "invited"],
    ["Chitra", "agreement", "Sent", "invited"],
  ]);
});

test("a message sent recently is not sent again unless resend is asked for", async () => {
  const recent = [{ personId: "b", kind: "agreement", at: new Date() }];
  const w = world({ recent });
  const r = await sendVerificationLinks(lead, { dryRun: true }, w.deps);
  const bala = r.tutors.find((t) => t.name === "Bala");
  assert.equal(bala.agreement.willSend, false);
  assert.match(bala.agreement.reason, /^Already sent/);

  const again = await sendVerificationLinks(lead, { dryRun: true, resend: true }, world({ recent }).deps);
  assert.equal(again.tutors.find((t) => t.name === "Bala").agreement.willSend, true);
});

test("a template not approved in Odoo yet is not sent, and says why", async () => {
  const w = world({ approved: (name) => name !== PROFILE_TEMPLATE });
  const r = await sendVerificationLinks(lead, { dryRun: false }, w.deps);
  const chitra = r.tutors.find((t) => t.name === "Chitra");
  assert.equal(chitra.profile.willSend, false);
  assert.match(chitra.profile.reason, /not approved/);
  assert.equal(chitra.agreement.sent, true);
  assert.ok(!w.sent.some((s) => s.templateName === PROFILE_TEMPLATE));
});

test("failed sends are recorded as Failed with the reason", async () => {
  const w = world({ members: ["b"], sendOk: false });
  const r = await sendVerificationLinks(lead, { dryRun: false }, w.deps);
  assert.equal(r.sent, 0);
  assert.equal(r.failed, 1);
  assert.equal(w.recorded[0].status, "Failed");
  assert.equal(w.recorded[0].failureReason, "Invalid Number");
});

test("if Odoo Sign cannot be read, nothing is sent", async () => {
  const w = world({ readSigners: async () => { throw new Error("timeout"); } });
  const r = await sendVerificationLinks(lead, { dryRun: false }, w.deps);
  assert.equal(r.ok, false);
  assert.match(r.reason, /Could not check Odoo Sign/);
  assert.equal(w.sent.length, 0);
});

test("an empty group or unknown group is blocked", async () => {
  const empty = await sendVerificationLinks(lead, { group: "top3" }, world({ members: [] }).deps);
  assert.equal(empty.blocked, true);
  const bad = await sendVerificationLinks(lead, { group: "everyone" }, world().deps);
  assert.equal(bad.blocked, true);
});

test("one tutor: sends only the message asked for, even if it was sent recently", async () => {
  const recent = [{ personId: "c", kind: "agreement", at: new Date() }];
  const w = world({ recent });
  const r = await sendVerificationLinks(null, { tutorId: "c", kind: "agreement", dryRun: false }, w.deps);
  assert.equal(r.ok, true);
  assert.equal(r.group, "single");
  assert.deepEqual(w.sent.map((s) => s.templateName), [AGREEMENT_TEMPLATE]);
  assert.equal(r.tutors[0].profile.willSend, false);
  assert.equal(r.tutors[0].profile.reason, "Not asked for this time");
  assert.equal(w.recorded[0].group, "single");
  assert.equal(w.recorded[0].requirementId, "");
});

test("one tutor who already signed is not sent the agreement again", async () => {
  const w = world();
  const r = await sendVerificationLinks(null, { tutorId: "a", kind: "agreement", dryRun: false }, w.deps);
  assert.equal(r.willSend, 0);
  assert.match(r.tutors[0].agreement.reason, /^Signed/);
  assert.equal(w.sent.length, 0);
});
