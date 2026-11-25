// Incoming WhatsApp messages read from Odoo (the job that replaced n8n).
// Odoo and MongoDB are stand-ins in memory.
import { test } from "node:test";
import assert from "node:assert/strict";
import { plainText, parentChoice, reconfirmAnswer, syncInboundMessages } from "../utils/odooInboundSync.js";

const HARITHA = "9353072251";
const PARENT = "9876543210";

function world({ cursor = 100, messages = [], invites = {}, top3 = [], reconfirms = [], people = {}, saved = [] } = {}) {
  const state = { cursor, inbound: [...saved], choices: [], reconfirmReplies: [], fetchedAfter: [] };
  const deps = {
    getCursor: async () => state.cursor,
    setCursor: async (id) => { state.cursor = id; },
    startCursor: async () => 50,
    fetchInbound: async (after, limit) => { state.fetchedAfter.push(after); return messages.filter((m) => m.id > after).slice(0, limit); },
    alreadySaved: async (id, uid) => state.inbound.some((r) => r.odooMessageId === id || (uid && r.msgId === uid)),
    findInvite: async (replyTo) => invites[replyTo] || null,
    findTop3: async ({ replyTo, last10, choiceTyped }) =>
      top3.find((t) => t.messageId === replyTo) || (choiceTyped ? top3.find((t) => t.parentPhone.endsWith(last10)) : null) || null,
    findReconfirm: async ({ replyTo, last10, answerTyped }) =>
      reconfirms.find((r) => r.messageId === replyTo) || (answerTyped ? reconfirms.find((r) => r.phone.endsWith(last10)) : null) || null,
    whoIs: async (num) => people[num] || null,
    saveInbound: async (row) => { state.inbound.push(row); },
    saveChoice: async (row) => { state.choices.push(row); },
    saveReconfirmReply: async (r) => { state.reconfirmReplies.push(r); },
  };
  return { state, deps };
}

const msg = (id, body, { phone = HARITHA, replyTo = null, uid = `wamid.${id}` } = {}) => ({
  id, body, mobile_number: `+91${phone}`, msg_uid: uid, parent_id: replyTo ? [replyTo, phone] : false, create_date: "2026-11-23 10:20:50",
});

test("Odoo's HTML becomes the words the person sent", () => {
  assert.equal(plainText("<p>I’m available</p>"), "I’m available");
  assert.equal(plainText("<p>Proceed with agreement &amp; shortlisting</p>"), "Proceed with agreement & shortlisting");
  assert.equal(plainText("<p>line one</p><p>line two</p>"), "line one\nline two");
  assert.equal(plainText(false), "");
});

test("the parent's choice and the re-confirmation buttons are recognised", () => {
  assert.equal(parentChoice("Tutor 2"), 2);
  assert.equal(parentChoice("tutor3"), 3);
  assert.equal(parentChoice("1"), 1);
  assert.equal(parentChoice("Tutor 4"), null);
  assert.equal(parentChoice("I want tutor 1 please"), null);
  assert.equal(reconfirmAnswer("Yes,Correct"), "Yes,Correct");
  assert.equal(reconfirmAnswer("yes, correct"), "Yes,Correct");
  assert.equal(reconfirmAnswer("Change some details"), "Change some details");
  assert.equal(reconfirmAnswer("yes"), null);
});

test("a tap on an invitation is saved for the tutor reply sweep, tied to that invitation", async () => {
  const w = world({
    messages: [msg(3721, "<p>I’m available</p>", { replyTo: 3704 })],
    invites: { 3704: { requirementId: "REQ-00405", tutorId: "t1", tutorName: "G Haritha" } },
  });
  const r = await syncInboundMessages(w.deps);
  assert.equal(r.saved, 1);
  const row = w.state.inbound[0];
  assert.equal(row.route, "tutor");
  assert.equal(row.senderType, "tutor");
  assert.equal(row.requirementId, "REQ-00405");
  assert.equal(row.tutorId, "t1");
  assert.equal(row.replyToOdooMessageId, 3704);
  assert.equal(row.text, "I’m available");
  assert.equal(row.last10, HARITHA);
  assert.equal(row.odooMessageId, 3721);
  assert.equal(row.receivedAt.toISOString(), "2026-11-23T10:20:50.000Z");
  assert.equal(row.replyAppliedAt, undefined, "left for the tutor reply sweep to mark");
  assert.equal(w.state.cursor, 3721);
});

test("the parent tapping Tutor 2 records that tutor as their choice, without assigning anyone", async () => {
  const offer = {
    _id: "offer1", requirementId: "REQ-00405", leadId: "lead1", messageId: 4000, parentPhone: PARENT, parentName: "Priya", preparedAt: new Date("2026-11-23T11:00:00Z"),
    tutors: [{ choice: 1, name: "A", tutorCode: "TUT1" }, { choice: 2, name: "G Haritha", tutorCode: "TUT0194" }, { choice: 3, name: "C", tutorCode: "TUT3" }],
  };
  const w = world({ messages: [msg(3800, "<p>Tutor 2</p>", { phone: PARENT, replyTo: 4000 })], top3: [offer] });
  const r = await syncInboundMessages(w.deps);
  assert.equal(r.choices, 1);
  const c = w.state.choices[0];
  assert.equal(c.requirementId, "REQ-00405");
  assert.equal(c.choice, 2);
  assert.equal(c.tutorName, "G Haritha");
  assert.equal(c.tutorCode, "TUT0194");
  assert.equal(c.assigned, false);
  assert.equal(c.willAssign, false);
  assert.equal(w.state.inbound[0].route, "parent");
  assert.equal(w.state.inbound[0].replyOutcome, "parent_chose");
});

test("a typed '1' from the parent counts as a choice on their newest options", async () => {
  const offer = { _id: "o", requirementId: "REQ-1", parentPhone: `91${PARENT}`, tutors: [{ choice: 1, name: "A", tutorCode: "TUT1" }] };
  const w = world({ messages: [msg(3801, "<p>1</p>", { phone: PARENT })], top3: [offer] });
  await syncInboundMessages(w.deps);
  assert.equal(w.state.choices[0].tutorCode, "TUT1");
});

test("a choice that is not on the list is left for a person", async () => {
  const offer = { _id: "o", requirementId: "REQ-1", messageId: 4000, parentPhone: PARENT, tutors: [{ choice: 1, name: "A" }] };
  const w = world({ messages: [msg(3802, "<p>Tutor 3</p>", { phone: PARENT, replyTo: 4000 })], top3: [offer] });
  await syncInboundMessages(w.deps);
  assert.equal(w.state.choices.length, 0);
  assert.equal(w.state.inbound[0].replyOutcome, "no_such_option");
});

test("the re-confirmation answer is saved on that re-confirmation", async () => {
  const w = world({
    messages: [msg(3803, "<p>Change some details</p>", { phone: PARENT, replyTo: 4100 })],
    reconfirms: [{ _id: "rc1", requirementId: "REQ-7", leadId: "lead7", messageId: 4100, phone: PARENT }],
  });
  const r = await syncInboundMessages(w.deps);
  assert.equal(r.reconfirms, 1);
  assert.deepEqual(w.state.reconfirmReplies[0].reply, "Change some details");
  assert.equal(w.state.reconfirmReplies[0].id, "rc1");
  assert.equal(w.state.inbound[0].requirementId, "REQ-7");
  assert.equal(w.state.inbound[0].replyOutcome, "reconfirm_recorded");
});

test("other messages are routed by who the number belongs to", async () => {
  const w = world({
    messages: [
      msg(3810, "<p>K sir if any opportunity pls provide me</p>", { phone: HARITHA }),
      msg(3811, "<p>when will the demo be?</p>", { phone: PARENT }),
      msg(3812, "<p>hi</p>", { phone: "9000000001" }),
    ],
    people: { [HARITHA]: { senderType: "tutor", tutorId: "t1" }, [PARENT]: { senderType: "parent", parentEnquiryId: "lead1", requirementId: "REQ-9" } },
  });
  await syncInboundMessages(w.deps);
  const [a, b, c] = w.state.inbound;
  assert.equal(a.route, "tutor");
  assert.equal(a.tutorId, "t1");
  assert.equal(a.replyAppliedAt, undefined, "a tutor's message still goes through the reply sweep");
  assert.equal(b.route, "parent");
  assert.equal(b.requirementId, "REQ-9");
  assert.equal(b.replyOutcome, "left_for_a_person");
  assert.equal(c.route, "human_support");
  assert.equal(c.senderType, "unknown");
});

test("a message already saved (by an earlier run or by n8n) is not saved twice", async () => {
  const w = world({
    messages: [msg(3820, "<p>Interested</p>", { uid: "wamid.same" }), msg(3821, "<p>hi</p>")],
    saved: [{ odooMessageId: 999, msgId: "wamid.same" }],
  });
  const r = await syncInboundMessages(w.deps);
  assert.equal(r.skipped, 1);
  assert.equal(r.saved, 1);
  assert.equal(w.state.inbound.filter((x) => x.odooMessageId === 3820).length, 0);
  assert.equal(w.state.cursor, 3821);
  const again = await syncInboundMessages(w.deps);
  assert.equal(again.read, 0, "the next run starts after the last message");
});

test("a preview saves nothing and does not move on", async () => {
  const w = world({ messages: [msg(3830, "<p>I’ll pass this time</p>", { replyTo: 3704 })], invites: { 3704: { requirementId: "REQ-00405" } } });
  const r = await syncInboundMessages(w.deps, { dryRun: true });
  assert.equal(r.saved, 1);
  assert.match(r.items[0].what, /REQ-00405/);
  assert.equal(w.state.inbound.length, 0);
  assert.equal(w.state.cursor, 100);
});

test("the first run carries on from where n8n stopped", async () => {
  const w = world({ cursor: null, messages: [msg(40, "<p>old</p>"), msg(60, "<p>new</p>")] });
  const r = await syncInboundMessages(w.deps);
  assert.deepEqual(w.state.fetchedAfter, [50]);
  assert.equal(r.saved, 1);
  assert.equal(w.state.cursor, 60);
});

test("a failure stops the run at that message, so it is tried again next time", async () => {
  const w = world({ messages: [msg(3840, "<p>a</p>"), msg(3841, "<p>b</p>")] });
  let calls = 0;
  w.deps.saveInbound = async (row) => { calls += 1; if (row.odooMessageId === 3841) throw new Error("db down"); w.state.inbound.push(row); };
  await assert.rejects(syncInboundMessages(w.deps), /db down/);
  assert.equal(w.state.cursor, 3840);
  assert.equal(calls, 2);
});

// After "Change some details": what the parent writes next is shown in Panel 2.
function changeWorld({ reply = "Change some details", messages }) {
  const reconf = { _id: "rc1", requirementId: "REQ-00429", leadId: "lead429", phone: `+91${PARENT}`, messageId: 5000, sent: true, reply };
  const w = world({ messages, reconfirms: [reconf], people: { [PARENT]: { senderType: "parent", parentEnquiryId: "lead429", requirementId: "REQ-00429" } } });
  w.state.changes = [];
  w.deps.findChangePending = async ({ last10 }) => (reconf.reply === "Change some details" && reconf.phone.endsWith(last10) ? reconf : null);
  w.deps.saveChangeRequest = async (c) => { w.state.changes.push(c); };
  return w;
}

test("after 'Change some details', the parent's next messages are saved as what to change", async () => {
  const w = changeWorld({
    messages: [
      msg(4001, "<p>Location is 2b, Tower 2, SNN Clermont, Nagavara 560045</p>", { phone: PARENT }),
      msg(4002, "<p>Tutor gender is male</p>", { phone: PARENT }),
    ],
  });
  const r = await syncInboundMessages(w.deps);
  assert.equal(r.changeRequests, 2);
  assert.deepEqual(w.state.changes.map((c) => [c.id, c.text, c.inboundOdooMessageId]), [
    ["rc1", "Location is 2b, Tower 2, SNN Clermont, Nagavara 560045", 4001],
    ["rc1", "Tutor gender is male", 4002],
  ]);
  assert.equal(w.state.inbound[0].requirementId, "REQ-00429");
  assert.equal(w.state.inbound[0].replyOutcome, "change_request_recorded");
});

test("text written as a reply to the re-confirmation itself is also what to change", async () => {
  const w = changeWorld({ reply: "", messages: [msg(4003, "<p>Class is 8 not 7</p>", { phone: PARENT, replyTo: 5000 })] });
  const r = await syncInboundMessages(w.deps);
  assert.equal(r.changeRequests, 1);
  assert.equal(w.state.changes[0].text, "Class is 8 not 7");
});

test("after 'Yes,Correct', a later message is not treated as a change; a person reads it", async () => {
  const w = changeWorld({ reply: "Yes,Correct", messages: [msg(4004, "<p>Thank you</p>", { phone: PARENT })] });
  const r = await syncInboundMessages(w.deps);
  assert.equal(r.changeRequests, 0);
  assert.equal(w.state.inbound[0].replyOutcome, "left_for_a_person");
});

test("a preview records no change request", async () => {
  const w = changeWorld({ messages: [msg(4005, "<p>Tutor gender is male</p>", { phone: PARENT })] });
  const r = await syncInboundMessages(w.deps, { dryRun: true });
  assert.equal(r.changeRequests, 1);
  assert.equal(w.state.changes.length, 0);
});
