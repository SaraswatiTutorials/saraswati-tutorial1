// The tutor reply sweep: which invitation a reply marks. MongoDB is a small
// stand-in in memory that supports only what the sweep uses.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sweepTutorReplies } from "../utils/tutorReplyScheduler.js";

const match = (doc, q) => Object.entries(q).every(([k, v]) => {
  const val = doc[k];
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if ("$exists" in v) return (val !== undefined) === v.$exists;
    if ("$in" in v) return v.$in.includes(val === undefined ? null : val);
    if ("$regex" in v) return new RegExp(v.$regex).test(String(val || ""));
    if ("$gte" in v) return val >= v.$gte;
  }
  return val === v;
});

function fakeDb(data) {
  const coll = (name) => {
    const rows = data[name] || (data[name] = []);
    const cursor = (q) => {
      let out = rows.filter((r) => match(r, q));
      const c = {
        sort: (s) => { const [[k, dir]] = Object.entries(s); out = [...out].sort((a, b) => (a[k] > b[k] ? dir : -dir)); return c; },
        limit: (n) => { out = out.slice(0, n); return c; },
        toArray: async () => out,
        next: async () => out[0] || null,
      };
      return c;
    };
    return {
      find: cursor,
      findOne: async (q) => rows.find((r) => match(r, q)) || null,
      updateOne: async (q, u) => { const r = rows.find((x) => match(x, q)); if (r) Object.assign(r, u.$set); },
    };
  };
  return { collection: coll };
}

const hoursAgo = (h) => new Date(Date.now() - h * 3600000);

test("a button tap marks the invitation it answers, not the newest one", async () => {
  const data = {
    broadcastlogs: [
      { _id: "old", broadcastType: "requirement", requirementId: "REQ-1", tutorName: "H", tutorPhone: "919353072251", whatsappMessageId: "3704", time: hoursAgo(5), responseStatus: "No Response" },
      { _id: "new", broadcastType: "requirement", requirementId: "REQ-2", tutorName: "H", tutorPhone: "919353072251", whatsappMessageId: "3900", time: hoursAgo(1), responseStatus: "No Response" },
    ],
    inbound_messages: [{ _id: "m1", route: "tutor", last10: "9353072251", text: "I’m available", replyToOdooMessageId: 3704, receivedAt: hoursAgo(0) }],
  };
  const r = await sweepTutorReplies(fakeDb(data));
  assert.equal(r.marked, 1);
  assert.equal(data.broadcastlogs[0].responseStatus, "Interested");
  assert.equal(data.broadcastlogs[1].responseStatus, "No Response");
  assert.equal(data.inbound_messages[0].requirementId, "REQ-1");
});

test("a tutor who changes their mind on the same invitation: the latest tap counts", async () => {
  const data = {
    broadcastlogs: [{ _id: "i", broadcastType: "requirement", requirementId: "REQ-1", tutorPhone: "9353072251", whatsappMessageId: 3704, time: hoursAgo(2), responseStatus: "Interested" }],
    inbound_messages: [{ _id: "m", route: "tutor", last10: "9353072251", text: "I’ll pass this time", replyToOdooMessageId: 3704, receivedAt: new Date() }],
  };
  await sweepTutorReplies(fakeDb(data));
  assert.equal(data.broadcastlogs[0].responseStatus, "Not Interested");
});

test("an invitation already turned into an assignment is never overwritten", async () => {
  const data = {
    broadcastlogs: [{ _id: "i", broadcastType: "requirement", requirementId: "REQ-1", tutorPhone: "9353072251", whatsappMessageId: 3704, time: hoursAgo(2), responseStatus: "Assigned" }],
    inbound_messages: [{ _id: "m", route: "tutor", last10: "9353072251", text: "I’ll pass this time", replyToOdooMessageId: 3704, receivedAt: new Date() }],
  };
  await sweepTutorReplies(fakeDb(data));
  assert.equal(data.broadcastlogs[0].responseStatus, "Assigned");
  assert.equal(data.inbound_messages[0].replyOutcome, "already_assigned");
});

test("a typed reply with no link still goes to the newest unanswered invitation", async () => {
  const data = {
    broadcastlogs: [
      { _id: "a", broadcastType: "requirement", requirementId: "REQ-1", tutorPhone: "9353072251", time: hoursAgo(5), responseStatus: "No Response" },
      { _id: "b", broadcastType: "requirement", requirementId: "REQ-2", tutorPhone: "9353072251", time: hoursAgo(1), responseStatus: "No Response" },
    ],
    inbound_messages: [{ _id: "m", route: "tutor", last10: "9353072251", text: "yes I am available", receivedAt: new Date() }],
  };
  await sweepTutorReplies(fakeDb(data));
  assert.equal(data.broadcastlogs[1].responseStatus, "Interested");
  assert.equal(data.broadcastlogs[0].responseStatus, "No Response");
});
