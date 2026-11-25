// "Yes,Correct" on the re-confirmation → shortlist + invite the top 10 on
// their own. Everything is an in-memory stand-in: no database, no WhatsApp.
import { test, mock, before } from "node:test";
import assert from "node:assert/strict";

let auto;
before(async () => {
  mock.module(new URL("../utils/pipelineStages.js", import.meta.url).href, {
    namedExports: { SHORTLIST_SIZE: 20, INVITE_SIZE: 10 },
  });
  auto = await import("../utils/autoPipeline.js");
});

function world({ reply = "Yes,Correct", autoRun, lead = { requirementId: "REQ-1", assignedTutor: "" }, shortlistSize = 0,
  invited = false, sending = true, shortlistResult = { saved: true, tutorCount: 20 },
  inviteResult = { sent: 10, results: Array.from({ length: 10 }, () => ({ sent: true })), templateName: "tutor_broadcast_v6" }, env = {} } = {}) {
  const rc = { _id: "rc1", requirementId: "REQ-1", reply, ...(autoRun ? { autoRun } : {}) };
  const calls = { shortlist: [], invite: [], saved: [] };
  const deps = {
    env,
    findReconfirmation: async () => rc,
    claim: async (id, run) => { if (rc.autoRun) return false; rc.autoRun = run; return true; },
    saveRun: async (id, run) => { rc.autoRun = { ...run }; calls.saved.push({ ...run }); },
    findLead: async () => lead,
    latestShortlistSize: async () => shortlistSize,
    shortlist: async (l, o) => { calls.shortlist.push(o); return shortlistResult; },
    alreadyInvited: async () => invited,
    sendingEnabled: () => sending,
    invite: async (l, o) => { calls.invite.push(o); return inviteResult; },
  };
  return { rc, calls, deps };
}

test("Yes,Correct: shortlists 20, then invites the top 10, and records it", async () => {
  const w = world();
  const r = await auto.autoShortlistAndInvite("rc1", w.deps);
  assert.equal(r.status, "done");
  assert.deepEqual(w.calls.shortlist, [{ limit: 20 }]);
  assert.deepEqual(w.calls.invite, [{ limit: 10, adminName: "Automatic (parent confirmed)" }]);
  assert.equal(w.rc.autoRun.shortlisted, 20);
  assert.equal(w.rc.autoRun.invited, 10);
});

test("runs only once per re-confirmation", async () => {
  const w = world();
  await auto.autoShortlistAndInvite("rc1", w.deps);
  const second = await auto.autoShortlistAndInvite("rc1", w.deps);
  assert.equal(second.ran, false);
  assert.equal(w.calls.invite.length, 1);
});

test("'Change some details' does not start anything", async () => {
  const w = world({ reply: "Change some details" });
  const r = await auto.autoShortlistAndInvite("rc1", w.deps);
  assert.equal(r.ran, false);
  assert.equal(w.calls.shortlist.length + w.calls.invite.length, 0);
});

test("a tutor already confirmed: nothing is shortlisted or sent", async () => {
  const w = world({ lead: { requirementId: "REQ-1", assignedTutor: "Asha" } });
  const r = await auto.autoShortlistAndInvite("rc1", w.deps);
  assert.equal(r.status, "skipped");
  assert.equal(w.calls.shortlist.length + w.calls.invite.length, 0);
});

test("an existing shortlist is used, not replaced", async () => {
  const w = world({ shortlistSize: 18 });
  const r = await auto.autoShortlistAndInvite("rc1", w.deps);
  assert.equal(w.calls.shortlist.length, 0);
  assert.equal(r.shortlistReused, true);
  assert.equal(r.shortlisted, 18);
  assert.equal(w.calls.invite.length, 1);
});

test("tutors already invited by a person: no more invitations", async () => {
  const w = world({ invited: true });
  const r = await auto.autoShortlistAndInvite("rc1", w.deps);
  assert.equal(r.status, "done");
  assert.equal(w.calls.invite.length, 0);
});

test("Panel 2 sending switched off: shortlist made, invitations held", async () => {
  const w = world({ sending: false });
  const r = await auto.autoShortlistAndInvite("rc1", w.deps);
  assert.equal(r.status, "held");
  assert.equal(w.calls.shortlist.length, 1);
  assert.equal(w.calls.invite.length, 0);
  assert.match(r.reason, /PANEL_SENDING_ENABLED/);
});

test("no tutor matched: stops before inviting", async () => {
  const w = world({ shortlistResult: { saved: false, note: "No tutor matched, so nothing was saved." } });
  const r = await auto.autoShortlistAndInvite("rc1", w.deps);
  assert.equal(r.status, "stopped");
  assert.equal(w.calls.invite.length, 0);
});

test("AUTO_INVITE_ON_CONFIRM=off switches it off", async () => {
  const w = world({ env: { AUTO_INVITE_ON_CONFIRM: "off" } });
  const r = await auto.autoShortlistAndInvite("rc1", w.deps);
  assert.equal(r.ran, false);
  assert.equal(w.calls.shortlist.length, 0);
});

test("an error is recorded on the row, not thrown", async () => {
  const w = world();
  w.deps.invite = async () => { throw new Error("Odoo down"); };
  const r = await auto.autoShortlistAndInvite("rc1", w.deps);
  assert.equal(r.status, "failed");
  assert.equal(w.rc.autoRun.reason, "Odoo down");
});

test("never repeats: a later tap, a re-run or a restart finds the run already recorded", async () => {
  const w = world({ autoRun: { status: "done", shortlisted: 20, invited: 10 } }); // recorded on the row, survives restarts
  for (let i = 0; i < 3; i++) {
    const r = await auto.autoShortlistAndInvite("rc1", w.deps);
    assert.equal(r.ran, false);
  }
  assert.equal(w.calls.shortlist.length + w.calls.invite.length, 0);
});

test("the automatic shortlist and invitations are labelled as done by the system", () => {
  assert.equal(auto.AUTO_BY, "Automatic (parent confirmed)");
  assert.equal(auto.AUTO_SHORTLIST_SOURCE, "automatic: parent confirmed");
});
