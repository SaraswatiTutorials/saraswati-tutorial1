// Local safe mode's request guard only covers /api, so Panel 2's step route has to
// refuse for itself. Shortlists are written straight to the collection, past the
// database guard too. Everything is mocked; nothing can leave the test.
import { test, mock, before } from "node:test";
import assert from "node:assert/strict";

const modulePath = (rel) => new URL(`../${rel}`, import.meta.url).href;
const calls = [];
const stage = (name) => async () => { calls.push(name); return { stage: name, ok: true }; };

let handler;
before(async () => {
  process.env.PANEL_SENDING_ENABLED = "true";
  mock.module(modulePath("models/ParentEnquiry.js"), { defaultExport: { findOne: async () => ({ requirementId: "REQ-1" }) } });
  mock.module(modulePath("routes/pipelineBoardRoutes.js"), { namedExports: { requireLogin: (req, res, next) => next() } });
  mock.module(modulePath("utils/localSafeMode.js"), { namedExports: { LOCAL_SAFE_MODE: true } });
  mock.module(modulePath("utils/pipelineStages.js"), {
    namedExports: {
      reconfirmRequirement: stage("reconfirm"), shortlistTutors: stage("shortlist"), inviteTutors: stage("invite"),
      sendTopThree: stage("top3"), notifySelectedTutor: stage("selected"), panelSendingEnabled: () => true,
      SHORTLIST_SIZE: 20, INVITE_SIZE: 10,
    },
  });
  const { default: router } = await import(modulePath("routes/panelActionRoutes.js"));
  handler = router.stack.find((l) => l.route?.path === "/api/stage/:stage" && l.route.methods.post).route.stack.at(-1).handle;
});

const press = async (name, body) => {
  const res = { statusCode: 200, payload: null, status(c) { this.statusCode = c; return this; }, json(d) { this.payload = d; return this; } };
  await handler({ params: { stage: name }, body }, res);
  return res;
};

for (const name of ["reconfirm", "shortlist", "invite", "top3", "selected"]) {
  test(`local safe mode refuses a real ${name}, even with sending switched on`, async () => {
    calls.length = 0;
    const res = await press(name, { requirementId: "REQ-1", dryRun: false });
    assert.equal(res.statusCode, 403);
    assert.equal(calls.length, 0);
  });
}

test("local safe mode still allows a preview", async () => {
  calls.length = 0;
  const res = await press("invite", { requirementId: "REQ-1", dryRun: true });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls, ["invite"]);
});
