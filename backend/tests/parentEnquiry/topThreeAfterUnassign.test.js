// A parent must not get the automatic top-3 message because an admin removed their
// tutor. Runs the real findDue on a fake database; nothing else can be reached.
import { test, mock, before } from "node:test";
import assert from "node:assert/strict";

const modulePath = (rel) => new URL(`../../${rel}`, import.meta.url).href;

let findDue;

before(async () => {
  mock.module(modulePath("utils/tutorOptionsMessage.js"), { namedExports: { sendTutorCards: async () => ({ sent: 0, results: [] }) } });
  ({ findDue } = await import(modulePath("utils/topThreeScheduler.js")));
});

// One requirement whose window has closed, with one tutor who said yes
function fakeDb(lead) {
  const collections = {
    broadcastlogs: {
      aggregate: () => ({ toArray: async () => [{ _id: "REQ-1", firstSentAt: new Date("2026-01-01") }] }),
      find: () => ({ toArray: async () => [{ tutorCode: "TUT1", responseStatus: "Interested" }] }),
    },
    tutor_top3: { countDocuments: async () => 0 },
    parentenquiries: { findOne: async () => lead },
    tutor_shortlists: {
      find: () => ({ sort: () => ({ limit: () => ({ next: async () => ({ tutors: [{ tutorCode: "TUT1", score: 1 }] }) }) }) }),
    },
  };
  return { collection: (name) => collections[name] };
}

const baseLead = { _id: "lead-1", requirementId: "REQ-1", phone: "9000000001" };

test("a lead that never had its tutor removed is still sent as before", async () => {
  const due = await findDue(fakeDb({ ...baseLead, assignedTutorId: null }));
  assert.equal(due.length, 1);
  assert.equal(due[0].requirementId, "REQ-1");
});

test("a lead with a tutor is still skipped", async () => {
  assert.equal((await findDue(fakeDb({ ...baseLead, assignedTutorId: "tutor-1" }))).length, 0);
});

test("a lead whose tutor an admin removed is skipped", async () => {
  const lead = { ...baseLead, assignedTutorId: null, tutorUnassignedAt: new Date() };
  assert.equal((await findDue(fakeDb(lead))).length, 0);
});
