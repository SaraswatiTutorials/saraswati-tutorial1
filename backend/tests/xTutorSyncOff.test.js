// The Odoo -> app tutor sync: x_tutor (missing from the live Odoo) is off unless
// ODOO_X_TUTOR_SYNC=true; master_tutors keeps running. Odoo, MongoDB and .env
// are all mocked out.
import { test, mock, before } from "node:test";
import assert from "node:assert/strict";

const modulePath = (rel) => new URL(`../${rel}`, import.meta.url).href;
const odooModels = [];

before(() => {
  mock.module("dotenv", { defaultExport: { config: () => ({}) }, namedExports: { config: () => ({}) } });
  const state = { findOne: async () => null, findOneAndUpdate: async () => null };
  mock.module(modulePath("models/SyncState.js"), { defaultExport: state });
  mock.module(modulePath("models/Tutor.js"), { defaultExport: { findOne: async () => null } });
  mock.module(modulePath("utils/whatsappService.js"), {
    namedExports: {
      getOdooUid: async () => 7,
      callOdooMethod: async (uid, model) => { odooModels.push(model); return []; },
    },
  });
});

async function runScheduledSync() {
  odooModels.length = 0;
  const { startSyncScheduler } = await import(modulePath("utils/syncService.js"));
  mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  try {
    startSyncScheduler();
    mock.timers.tick(30_000); // the first run, 30 s after start
  } finally {
    mock.timers.reset();
  }
  for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
  return [...odooModels];
}

test("x_tutor is not asked for by default; master_tutors still is", async () => {
  delete process.env.ODOO_X_TUTOR_SYNC;
  const models = await runScheduledSync();
  assert.ok(models.includes("master_tutors"), JSON.stringify(models));
  assert.ok(!models.includes("x_tutor"), JSON.stringify(models));
});

test("ODOO_X_TUTOR_SYNC=true turns it back on", async () => {
  process.env.ODOO_X_TUTOR_SYNC = "true";
  try {
    const models = await runScheduledSync();
    assert.ok(models.includes("x_tutor") && models.includes("master_tutors"), JSON.stringify(models));
  } finally {
    delete process.env.ODOO_X_TUTOR_SYNC;
  }
});

test("the setting reads true only for 'true'", async () => {
  const { xTutorSyncEnabled } = await import(modulePath("utils/syncService.js"));
  assert.equal(xTutorSyncEnabled({}), false);
  assert.equal(xTutorSyncEnabled({ ODOO_X_TUTOR_SYNC: "false" }), false);
  assert.equal(xTutorSyncEnabled({ ODOO_X_TUTOR_SYNC: " TRUE " }), true);
});
