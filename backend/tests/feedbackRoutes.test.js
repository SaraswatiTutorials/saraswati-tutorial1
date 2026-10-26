// Issues reported from the feedback button on the parent enquiry and tutor registration
// forms, with the Feedback model replaced by an in-memory store. No MongoDB connection is made.
import { test, describe, mock, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

const modulePath = (rel) => new URL(`../${rel}`, import.meta.url).href;

const store = [];

const FakeFeedback = {
  async create(doc) {
    const record = { _id: String(store.length + 1), createdAt: new Date(Date.now() + store.length), ...doc };
    store.push(record);
    return record;
  },
  find(filter) {
    let rows = store.filter((r) => !filter.source || r.source === filter.source);
    const query = {
      sort: () => { rows = [...rows].sort((a, b) => b.createdAt - a.createdAt); return query; },
      limit: (n) => { rows = rows.slice(0, n); return query; },
      lean: async () => rows,
    };
    return query;
  },
  async aggregate() {
    const counts = {};
    for (const r of store) counts[r.source] = (counts[r.source] || 0) + 1;
    return Object.entries(counts).map(([_id, count]) => ({ _id, count }));
  },
};

let handlers;
let router;

before(async () => {
  mock.module(modulePath("models/Feedback.js"), {
    defaultExport: FakeFeedback,
    namedExports: {
      FEEDBACK_SOURCES: ["parent-enquiry", "tutor-registration"],
      FEEDBACK_CATEGORIES: ["form", "upload", "location", "error", "fees", "suggestion", "other"],
    },
  });
  ({ default: router } = await import(modulePath("routes/feedbackRoutes.js")));
  const handlerFor = (method) => {
    const stack = router.stack.find((l) => l.route?.path === "/" && l.route.methods[method]).route.stack;
    return stack[stack.length - 1].handle; // skip verifyToken
  };
  handlers = { submit: handlerFor("post"), list: handlerFor("get") };
});

beforeEach(() => store.splice(0));

const call = async (handler, { body = {}, query = {} } = {}) => {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
  await handler({ body, query, headers: { "user-agent": "test-agent" }, socket: { remoteAddress: "1.2.3.4" } }, res);
  return res;
};
const submit = (body) => call(handlers.submit, { body });
const list = (query) => call(handlers.list, { query });

describe("reporting an issue", () => {
  test("parent and tutor issues are saved with their form, issue type and contact", async () => {
    const res = await submit({
      source: "parent-enquiry", category: "location", message: "  Map does not open  ",
      name: " Asha ", phone: "9876543210", step: 2,
    });
    assert.equal(res.statusCode, 201);
    assert.equal(store.length, 1);
    assert.equal(store[0].source, "parent-enquiry");
    assert.equal(store[0].category, "location");
    assert.equal(store[0].message, "Map does not open");
    assert.equal(store[0].name, "Asha");
    assert.equal(store[0].phone, "9876543210");
    assert.equal(store[0].step, 2);
    assert.equal(store[0].userAgent, "test-agent");

    const tutor = await submit({ source: "tutor-registration", category: "upload", message: "Upload was slow" });
    assert.equal(tutor.statusCode, 201);
    assert.equal(store[1].source, "tutor-registration");
    assert.equal(store[1].name, ""); // contact is optional
  });

  test("an empty message, unknown form or unknown issue type is refused and nothing is saved", async () => {
    const ok = { source: "parent-enquiry", category: "error" };
    assert.equal((await submit({ ...ok, message: "   " })).statusCode, 400);
    assert.equal((await submit({ ...ok, source: "homepage", message: "hi" })).statusCode, 400);
    assert.equal((await submit({ category: "error", message: "hi" })).statusCode, 400);
    assert.equal((await submit({ ...ok, category: "spam", message: "hi" })).statusCode, 400);
    assert.equal((await submit({ source: "parent-enquiry", message: "hi" })).statusCode, 400);
    assert.equal((await submit({ ...ok, message: "x".repeat(2001) })).statusCode, 400);
    assert.equal(store.length, 0);
  });
});

describe("admin feedback list", () => {
  test("lists newest first with totals for each form, and filters by form", async () => {
    await submit({ source: "parent-enquiry", category: "form", message: "first" });
    await submit({ source: "tutor-registration", category: "upload", message: "second" });
    await submit({ source: "parent-enquiry", category: "other", message: "third" });

    const all = await list();
    assert.equal(all.statusCode, 200);
    assert.deepEqual(all.payload.records.map((r) => r.message), ["third", "second", "first"]);
    assert.equal(all.payload.total, 3);
    assert.deepEqual(all.payload.counts, { "parent-enquiry": 2, "tutor-registration": 1 });

    const tutors = await list({ source: "tutor-registration" });
    assert.deepEqual(tutors.payload.records.map((r) => r.message), ["second"]);
    assert.equal(tutors.payload.total, 3); // totals stay for all forms
  });
});

// Mounted as in server.js, with JSON parsing and the real admin token check
describe("over HTTP", () => {
  let server;
  let base;
  let signToken;

  before(async () => {
    const express = (await import("express")).default;
    const jwt = (await import("jsonwebtoken")).default;
    signToken = (role) => jwt.sign({ email: "admin@example.com", role }, process.env.JWT_SECRET || "secretkey");
    const app = express();
    app.use(express.json());
    app.use("/api/feedback", router);
    await new Promise((resolve) => { server = app.listen(0, resolve); });
    base = `http://127.0.0.1:${server.address().port}/api/feedback`;
  });

  after(() => server?.close());

  const send = (body) =>
    fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  test("anyone can send an issue, exactly as the feedback form sends it", async () => {
    const res = await send({
      source: "tutor-registration", category: "upload", message: "Photo upload fails", name: "Ravi", phone: "", step: 3,
    });
    assert.equal(res.status, 201);
    assert.equal((await res.json()).success, true);
    assert.equal(store.length, 1);
  });

  test("a bad request gets an error message the form can show", async () => {
    const res = await send({ source: "parent-enquiry", category: "", message: "hi" });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).message, "Please choose what the issue is about.");
  });

  test("only a logged-in admin can read the feedback list", async () => {
    await send({ source: "parent-enquiry", category: "error", message: "Page froze" });

    assert.equal((await fetch(base)).status, 401);
    assert.equal((await fetch(base, { headers: { Authorization: "Bearer not-a-token" } })).status, 401);
    assert.equal((await fetch(base, { headers: { Authorization: `Bearer ${signToken("tutor")}` } })).status, 403);

    const res = await fetch(`${base}?source=parent-enquiry`, { headers: { Authorization: `Bearer ${signToken("admin")}` } });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data.records.map((r) => r.message), ["Page froze"]);
  });
});
