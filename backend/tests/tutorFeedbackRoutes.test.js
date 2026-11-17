// The parent feedback form's API, with every database model and Odoo replaced
// by stand-ins that fail the test if the preview ever touches them.
import { test, mock, before } from "node:test";
import assert from "node:assert/strict";

const modulePath = (rel) => new URL(`../${rel}`, import.meta.url).href;
const touched = [];
const watch = (name) => new Proxy({}, { get: (_, key) => (...args) => { touched.push(`${name}.${String(key)}`); return { lean: async () => null }; } });

let handlers;

before(async () => {
  mock.module("dotenv", { defaultExport: { config: () => ({}) }, namedExports: { config: () => ({}) } });
  mock.module(modulePath("models/TutorFeedback.js"), { defaultExport: watch("TutorFeedback") });
  mock.module(modulePath("models/Tutor.js"), { defaultExport: watch("Tutor") });
  mock.module(modulePath("models/ParentEnquiry.js"), { defaultExport: watch("ParentEnquiry") });
  mock.module(modulePath("utils/odooService.js"), { namedExports: { addOdooChatterMessage: async () => { touched.push("odoo"); } } });
  const { default: router } = await import(modulePath("routes/tutorFeedbackRoutes.js"));
  const handlerFor = (method) => router.stack.find((l) => l.route?.path === "/:token" && l.route.methods[method]).route.stack[0].handle;
  handlers = { get: handlerFor("get"), post: handlerFor("post") };
});

function call(handler, req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ status: this.statusCode, body }); },
    };
    handler({ headers: {}, ip: "", body: {}, ...req }, res);
  });
}

test("the preview shows sample details and the real questions, without touching the database", async () => {
  touched.length = 0;
  const { status, body } = await call(handlers.get, { params: { token: "preview" } });
  assert.equal(status, 200);
  assert.equal(body.preview, true);
  assert.equal(body.tutorName, "Ravi Kumar");
  assert.equal(body.parentFirstName, "Priya");
  assert.equal(body.options.aspects.length, 5);
  assert.equal(body.options.decisions.length, 3);
  assert.deepEqual(touched, []);
});

test("answers sent from the preview are checked like real ones but never saved", async () => {
  touched.length = 0;
  const bad = await call(handlers.post, { params: { token: "preview" }, body: { demoHappened: "yes" } });
  assert.equal(bad.status, 400);
  assert.match(bad.body.message, /overall rating/);
  const good = await call(handlers.post, { params: { token: "preview" }, body: { demoHappened: "yes", overall: 4, decision: "continue" } });
  assert.equal(good.status, 200);
  assert.equal(good.body.preview, true);
  assert.deepEqual(touched, []);
});

test("a malformed link is refused before the database is asked", async () => {
  touched.length = 0;
  const { status } = await call(handlers.get, { params: { token: "../../etc" } });
  assert.equal(status, 404);
  assert.deepEqual(touched, []);
});
