// The parent's automatic reply to their re-confirmation answer
// (utils/reconfirmReply.js): "Yes,Correct" → Auto_Demo Booked Confirmation,
// "Change some details" → Auto_Change Requirement Details. Sent once per
// answer, on the enquiry's own Odoo lead, only when Panel 2 sending is on.
// Everything is in memory: nothing is sent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sendReconfirmReply, replyVars, autoReplyEnabled } from "../utils/reconfirmReply.js";

function world({ reply = "Yes,Correct", lead = {}, sending = true, env = {}, sendResult = { success: true, messageId: 777 }, rc = {} } = {}) {
  const state = { sends: [], row: { _id: "rc1", requirementId: "REQ-00700", leadId: "l700", phone: "+919876543210", sent: true, reply, ...rc } };
  const theLead = lead === null ? null : {
    _id: "l700", requirementId: "REQ-00700", parentName: "Meera Iyer", phone: "9876543210", odooLeadId: "4321",
    wards: [{ classGrade: "8", subjectsNeeded: ["Maths", "Science"] }], ...lead,
  };
  const deps = {
    env,
    findReconfirmation: async () => state.row,
    async claim(id, key, value) {
      if (state.row.autoReplies?.[key]) return false;
      state.row.autoReplies = { ...(state.row.autoReplies || {}), [key]: value };
      return true;
    },
    saveReply: async (id, key, value) => { state.row.autoReplies[key] = { ...value }; },
    findLead: async () => theLead,
    sendingEnabled: () => sending,
    send: async (opts) => { state.sends.push(opts); return sendResult; },
  };
  return { state, deps };
}

test("'Yes,Correct' sends Auto_Demo Booked Confirmation on the enquiry's Odoo lead", async () => {
  const w = world();
  const r = await sendReconfirmReply("rc1", w.deps);
  assert.equal(r.sent, true);
  assert.equal(w.state.sends.length, 1);
  const s = w.state.sends[0];
  assert.equal(s.templateName, "demo_booked_confirmation");
  assert.equal(s.resId, 4321); // Odoo fills Grade and Subject(s) from this lead
  assert.deepEqual(s.templateVars, {});
  assert.equal(s.forceTemplate, true);
  assert.equal(s.phoneNumber, "+919876543210");
  assert.equal(w.state.row.autoReplies.demoBooked.status, "sent");
});

test("'Change some details' sends Auto_Change Requirement Details with the parent's name", async () => {
  const w = world({ reply: "Change some details" });
  await sendReconfirmReply("rc1", w.deps);
  assert.equal(w.state.sends[0].templateName, "change_requirement_details");
  assert.deepEqual(w.state.sends[0].templateVars, { "{{1}}": "Meera Iyer" });
  assert.equal(w.state.row.autoReplies.changeDetails.status, "sent");
});

test("sent once per answer: a second tap or a re-run sends nothing", async () => {
  const w = world();
  await sendReconfirmReply("rc1", w.deps);
  const again = await sendReconfirmReply("rc1", w.deps);
  assert.equal(again.sent, false);
  assert.match(again.reason, /already handled/);
  assert.equal(w.state.sends.length, 1);
});

test("'Change some details' then 'Yes,Correct': each reply goes once", async () => {
  const w = world({ reply: "Change some details" });
  await sendReconfirmReply("rc1", w.deps);
  w.state.row.reply = "Yes,Correct";
  await sendReconfirmReply("rc1", w.deps);
  assert.deepEqual(w.state.sends.map((s) => s.templateName), ["change_requirement_details", "demo_booked_confirmation"]);
});

test("Panel 2 sending off: held and recorded, nothing sent", async () => {
  const w = world({ sending: false });
  const r = await sendReconfirmReply("rc1", w.deps);
  assert.equal(r.sent, false);
  assert.equal(w.state.sends.length, 0);
  assert.equal(w.state.row.autoReplies.demoBooked.status, "held");
  assert.match(w.state.row.autoReplies.demoBooked.reason, /PANEL_SENDING_ENABLED/);
});

test("AUTO_REPLY_ON_RECONFIRM=off: held, nothing sent", async () => {
  const w = world({ env: { AUTO_REPLY_ON_RECONFIRM: "off" } });
  await sendReconfirmReply("rc1", w.deps);
  assert.equal(w.state.sends.length, 0);
  assert.equal(w.state.row.autoReplies.demoBooked.status, "held");
  assert.equal(autoReplyEnabled({}), true);
  assert.equal(autoReplyEnabled({ AUTO_REPLY_ON_RECONFIRM: "OFF" }), false);
});

test("no Odoo lead: skipped, never sent on some other lead", async () => {
  const w = world({ lead: { odooLeadId: "" } });
  const r = await sendReconfirmReply("rc1", w.deps);
  assert.equal(r.sent, false);
  assert.equal(w.state.sends.length, 0);
  assert.equal(w.state.row.autoReplies.demoBooked.status, "skipped");
});

test("a failed send is recorded with the reason", async () => {
  const w = world({ sendResult: { success: false, failureReason: "Template Deleted or Inactive" } });
  const r = await sendReconfirmReply("rc1", w.deps);
  assert.equal(r.sent, false);
  assert.equal(w.state.row.autoReplies.demoBooked.status, "failed");
  assert.match(w.state.row.autoReplies.demoBooked.reason, /isn't approved/);
});

test("no answer yet, or an unknown one: nothing happens", async () => {
  const w = world({ reply: "" });
  const r = await sendReconfirmReply("rc1", w.deps);
  assert.equal(r.sent, false);
  assert.equal(w.state.sends.length, 0);
  assert.equal(w.state.row.autoReplies, undefined);
});

test("a parent without a name is greeted as Parent", () => {
  assert.deepEqual(replyVars("changeDetails", { parentName: "  " }), { "{{1}}": "Parent" });
});
