// Parent feedback on the tutor chosen for the demo (Panel 2 step 7). MongoDB,
// Odoo and WhatsApp are in-memory stand-ins; nothing leaves this process.
import { test, mock, before } from "node:test";
import assert from "node:assert/strict";

let fb;

before(async () => {
  mock.module("dotenv", { defaultExport: { config: () => ({}) }, namedExports: { config: () => ({}) } });
  fb = await import(new URL("../utils/tutorFeedback.js", import.meta.url).href);
});

const LEAD = {
  _id: "lead1", requirementId: "REQ-00500", phone: "9811111111", parentName: "Priya Sharma", odooLeadId: 77,
  assignedTutor: "Ravi Kumar", assignedTutorId: "t1", wards: [{ studentName: "Aarav" }],
};

function world({ tutor = { id: "t1", source: "tutor", name: "Ravi Kumar", tutorCode: "TUT0218" }, record = null, approved = true, sendOk = true } = {}) {
  const sent = [], created = [], sends = [], notes = [];
  let rec = record;
  const deps = {
    findTutor: async () => tutor,
    findRecord: async () => rec,
    createRecord: async (row) => { rec = { ...row, sends: [] }; created.push(row); return rec; },
    recordSend: async (r, s) => { r.sends.push(s); sends.push(s); },
    isApproved: async () => approved,
    send: async (opts) => { sent.push(opts); return sendOk ? { success: true, messageId: 55, usedTemplate: true } : { success: false, failureReason: "Template Deleted or Inactive" }; },
    note: async (id, text) => { notes.push(text); },
  };
  return { deps, sent, created, sends, notes, get rec() { return rec; } };
}

test("no tutor confirmed yet: the step is blocked", async () => {
  const r = await fb.sendFeedbackLink({ ...LEAD, assignedTutor: "", assignedTutorId: null }, { dryRun: true }, world().deps);
  assert.equal(r.blocked, true);
  assert.match(r.reason, /step 5/);
});

test("preview shows who, about whom, and the link; nothing is saved or sent", async () => {
  const w = world();
  const r = await fb.sendFeedbackLink(LEAD, { dryRun: true }, w.deps);
  assert.equal(r.ok, true);
  assert.equal(r.tutorName, "Ravi Kumar");
  assert.equal(r.studentName, "Aarav");
  assert.match(r.link, /^https:\/\/saraswatitutorial\.com\/tutor-feedback\/[A-Za-z0-9_-]{12}$/);
  assert.equal(w.sent.length, 0);
  assert.equal(w.created.length, 0);
});

test("a real send creates the record, fills the template, and notes Odoo", async () => {
  const w = world();
  const r = await fb.sendFeedbackLink(LEAD, { dryRun: false }, w.deps);
  assert.equal(r.sent, true);
  assert.equal(w.created.length, 1);
  assert.equal(w.created[0].tutorName, "Ravi Kumar");
  const vars = w.sent[0].templateVars;
  assert.equal(w.sent[0].templateName, "tutor_feedback_request");
  assert.equal(vars["{{1}}"], "Priya Sharma");
  assert.equal(vars["{{2}}"], "Ravi Kumar");
  assert.equal(vars["{{3}}"], "Aarav");
  assert.equal(vars.button_dynamic_url_1, fb.linkFor(w.rec.token));
  assert.match(w.sent[0].messageBody, /tutor-feedback\//); // the plain-text fallback carries the link too
  assert.equal(w.sends[0].status, "Sent");
  assert.match(w.notes[0], /Ravi Kumar/);
});

test("already sent: not sent again unless Send again (resend), and the same link is reused", async () => {
  const record = { token: "abcDEF123456", sends: [{ status: "Sent", at: new Date() }], submittedAt: null };
  const w = world({ record });
  const first = await fb.sendFeedbackLink(LEAD, { dryRun: false }, w.deps);
  assert.equal(first.sent, false);
  assert.match(first.reason, /Already sent/);
  const again = await fb.sendFeedbackLink(LEAD, { dryRun: false, resend: true }, w.deps);
  assert.equal(again.sent, true);
  assert.equal(w.sent[0].templateVars.button_dynamic_url_1, fb.linkFor("abcDEF123456"));
  assert.equal(w.created.length, 0);
});

test("once the parent has answered, that tutor's link is never sent again", async () => {
  const w = world({ record: { token: "abcDEF123456", sends: [], submittedAt: new Date() } });
  const r = await fb.sendFeedbackLink(LEAD, { dryRun: false, resend: true }, w.deps);
  assert.equal(r.blocked, true);
  assert.match(r.reason, /already gave feedback/);
  assert.equal(w.sent.length, 0);
});

test("template not approved yet: the failure says so", async () => {
  const w = world({ approved: false, sendOk: false });
  const r = await fb.sendFeedbackLink(LEAD, { dryRun: false }, w.deps);
  assert.equal(r.sent, false);
  assert.match(r.failureReason, /isn't approved by Meta yet/);
  assert.equal(w.sends[0].status, "Failed");
});

test("answers: demo happened needs stars and a decision; unknown options are dropped", () => {
  assert.match(fb.cleanAnswers({}).error, /demo class happened/);
  assert.match(fb.cleanAnswers({ demoHappened: "yes" }).error, /overall rating/);
  assert.match(fb.cleanAnswers({ demoHappened: "yes", overall: 4 }).error, /continue/);
  const { answers } = fb.cleanAnswers({
    demoHappened: "yes", overall: 4, decision: "continue",
    ratings: { teaching: 5, knowledge: 9, hacker: 3 },
    liked: ["Patient with my child", "<script>"], improve: ["Came late", "Came late"],
    comment: "  Great  ",
  });
  assert.deepEqual(answers.ratings, { teaching: 5 });
  assert.deepEqual(answers.liked, ["Patient with my child"]);
  assert.deepEqual(answers.improve, ["Came late"]);
  assert.equal(answers.comment, "Great");
});

test("answers: demo not happened yet needs nothing else", () => {
  const { answers, error } = fb.cleanAnswers({ demoHappened: "not_yet", comment: "Next Monday" });
  assert.equal(error, undefined);
  assert.equal(answers.overall, null);
  assert.equal(answers.comment, "Next Monday");
});

test("the form page never sees phone numbers or full names", () => {
  const v = fb.publicView({ parentName: "Priya Sharma", parentPhone: "9811111111", tutorName: "Ravi Kumar", studentName: "Aarav" });
  assert.equal(v.parentFirstName, "Priya");
  assert.ok(!JSON.stringify(v).includes("9811111111"));
  assert.equal(v.options.decisions.length, 3);
});
