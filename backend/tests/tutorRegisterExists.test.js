// The full website registration form refuses someone already registered, both
// at the check after step 1 and when the form is sent. Models and outside
// services are mocked; nothing reaches MongoDB, Odoo or the network.
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

const modulePath = (rel) => new URL(`../${rel}`, import.meta.url).href;

let existing, asked, registered;

before(async () => {
  for (const m of ["Tutor", "TutorRegistrationDraft", "ParentEnquiry", "BroadcastLog"]) {
    mock.module(modulePath(`models/${m}.js`), { defaultExport: {} });
  }
  mock.module(modulePath("utils/tutorExists.js"), {
    namedExports: {
      findExistingTutor: async (who) => { asked.push(who); return existing; },
      tutorExistsBody: (found) => ({ success: false, exists: true, code: "TUTOR_EXISTS", ...found }),
    },
  });
  mock.module(modulePath("utils/tutorRegistration.js"), {
    namedExports: {
      registerTutor: async (body) => { registered.push(body); return { _id: "t-new", ...body }; },
      tutorCodeOptions: async () => ({}),
    },
  });
  const noop = async () => null;
  mock.module(modulePath("utils/odooService.js"), { namedExports: { createLead: noop, upsertMasterTutor: noop } });
  mock.module(modulePath("utils/documentLink.js"), { namedExports: { getDocumentOpenUrl: () => "" } });
  mock.module(modulePath("middleware/authMiddleware.js"), { namedExports: { verifyToken: () => (req, res, next) => next() } });
  mock.module("node-fetch", { defaultExport: async () => { throw new Error("Network access is disabled in tests"); } });
  globalThis.fetch = async () => { throw new Error("Network access is disabled in tests"); };
});

beforeEach(() => {
  existing = null;
  asked = [];
  registered = [];
});

const handlerOf = async (path) => {
  const { default: router } = await import(modulePath("routes/tutorRoutes.js"));
  return router.stack.find((l) => l.route?.path === path && l.route.methods.post).route.stack.at(-1).handle;
};
const run = async (path, body) => {
  const res = { statusCode: 200, payload: null, status(c) { this.statusCode = c; return this; }, json(d) { this.payload = d; return this; } };
  await (await handlerOf(path))({ body }, res);
  return res;
};
const form = () => ({ name: "Asha", phone: "9876543210", whatsapp: "9876543211", email: "asha@example.test", status: "pending" });

test("after step 1: a new person carries on", async () => {
  const res = await run("/check-exists", { phone: "9876543210", whatsapp: "9876543211", email: "asha@example.test" });
  assert.deepEqual(res.payload, { success: true, exists: false });
  assert.deepEqual(asked, [{ phones: ["9876543210", "9876543211"] }]); // email not used
});

test("after step 1: someone already registered is told so", async () => {
  existing = { matchedOn: "phone", source: "tutor" };
  const res = await run("/check-exists", { phone: "9876543210", email: "asha@example.test" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.exists, true);
  assert.equal(res.payload.matchedOn, "phone");
});

test("sending the form: someone already registered is refused, nothing is saved", async () => {
  existing = { matchedOn: "phone", source: "partial" };
  const res = await run("/", form());
  assert.equal(res.statusCode, 409);
  assert.equal(res.payload.code, "TUTOR_EXISTS");
  assert.equal(res.payload.source, "partial");
  assert.equal(registered.length, 0);
});

test("sending the form: a new person is registered as before", async () => {
  const res = await run("/", form());
  assert.equal(res.statusCode, 201);
  assert.equal(registered.length, 1);
  assert.deepEqual(asked, [{ phones: ["9876543210", "9876543211"] }]);
});

test("the form's own checks still come first", async () => {
  assert.equal((await run("/", { ...form(), email: "" })).statusCode, 400);
  assert.equal(asked.length, 0);
});
