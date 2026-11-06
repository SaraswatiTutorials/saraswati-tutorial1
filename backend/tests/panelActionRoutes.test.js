// Panel 2's step route must never send unless it was explicitly told to and the
// server allows it. The stages themselves are mocked, so nothing here can reach
// Odoo, WhatsApp or the database.
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

const modulePath = (rel) => new URL(`../${rel}`, import.meta.url).href;
const calls = [];
const stage = (name) => async (lead, third, fourth) => {
  const options = name === "selected" ? fourth : third;
  calls.push({ name, options });
  return { stage: name, ok: true, dryRun: options.dryRun };
};

let handler;
before(async () => {
  mock.module(modulePath("models/ParentEnquiry.js"), {
    defaultExport: { findOne: async ({ requirementId }) => (requirementId === "REQ-1" ? { requirementId } : null) },
  });
  mock.module(modulePath("routes/pipelineBoardRoutes.js"), { namedExports: { requireLogin: (req, res, next) => next() } });
  mock.module(modulePath("utils/localSafeMode.js"), { namedExports: { LOCAL_SAFE_MODE: false } });
  mock.module(modulePath("utils/pipelineStages.js"), {
    namedExports: {
      reconfirmRequirement: stage("reconfirm"),
      shortlistTutors: stage("shortlist"),
      inviteTutors: stage("invite"),
      sendTopThree: stage("top3"),
      notifySelectedTutor: stage("selected"),
      panelSendingEnabled: () => process.env.PANEL_SENDING_ENABLED === "true",
      SHORTLIST_SIZE: 20,
      INVITE_SIZE: 10,
    },
  });
  const { default: router } = await import(modulePath("routes/panelActionRoutes.js"));
  const layer = router.stack.find((l) => l.route?.path === "/api/stage/:stage" && l.route.methods.post);
  handler = layer.route.stack.at(-1).handle;
});

beforeEach(() => {
  calls.length = 0;
  delete process.env.PANEL_SENDING_ENABLED;
});

async function press(name, body) {
  const res = {
    statusCode: 200, payload: null,
    status(c) { this.statusCode = c; return this; },
    json(d) { this.payload = d; return this; },
  };
  await handler({ params: { stage: name }, body }, res);
  return res;
}

for (const name of ["reconfirm", "invite", "top3", "selected"]) {
  test(`${name}: refused for real unless sending is switched on`, async () => {
    const res = await press(name, { requirementId: "REQ-1", dryRun: false, tutorId: "T1" });
    assert.equal(res.statusCode, 403);
    assert.equal(res.payload.blocked, true);
    assert.equal(calls.length, 0);
  });

  test(`${name}: runs for real once sending is switched on`, async () => {
    process.env.PANEL_SENDING_ENABLED = "true";
    await press(name, { requirementId: "REQ-1", dryRun: false, tutorId: "T1" });
    assert.equal(calls[0].options.dryRun, false);
  });
}

test("shortlist only saves, so it works with sending off", async () => {
  const res = await press("shortlist", { requirementId: "REQ-1", dryRun: false });
  assert.equal(res.statusCode, 200);
  assert.equal(calls[0].options.dryRun, false);
});

for (const body of [{}, { dryRun: "false" }, { dryRun: 0 }, { dryRun: null }, { dryRun: true }]) {
  test(`anything but dryRun:false is a preview, even with sending on: ${JSON.stringify(body)}`, async () => {
    process.env.PANEL_SENDING_ENABLED = "true";
    await press("invite", { requirementId: "REQ-1", ...body });
    assert.equal(calls[0].options.dryRun, true);
  });
}

test("force and resend only count when they are really true", async () => {
  await press("top3", { requirementId: "REQ-1", force: "yes", resend: 1 });
  assert.equal(calls[0].options.force, false);
  assert.equal(calls[0].options.resend, false);
});

test("the tutor limit is kept within bounds", async () => {
  await press("invite", { requirementId: "REQ-1", limit: 5000 });
  assert.equal(calls[0].options.limit, 50);
  await press("invite", { requirementId: "REQ-1", limit: -3 });
  assert.equal(calls[1].options.limit, 1);
});

test("an unknown enquiry or step is refused", async () => {
  assert.equal((await press("invite", { requirementId: "NOPE" })).statusCode, 404);
  assert.equal((await press("delete-everything", { requirementId: "REQ-1" })).statusCode, 400);
  assert.equal((await press("invite", {})).statusCode, 400);
  assert.equal(calls.length, 0);
});
