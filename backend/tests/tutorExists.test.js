// "Is this tutor already registered?" for the full and partial registration
// forms. The models are in-memory fakes; nothing reaches MongoDB or the network.
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

const modulePath = (rel) => new URL(`../${rel}`, import.meta.url).href;

let tutors, partials, registered, posted;

const fieldMatches = (doc, cond) => Object.entries(cond).every(([k, v]) => {
  if (k === "$or") return v.some((c) => fieldMatches(doc, c));
  if (v === null) return doc[k] == null;
  return v instanceof RegExp ? typeof doc[k] === "string" && v.test(doc[k]) : doc[k] === v;
});
const findOneIn = (rows) => (q) => {
  const hit = rows().find((r) => fieldMatches(r, q)) || null;
  return { lean: async () => hit };
};

let findExistingTutor, tutorExistsBody;

before(async () => {
  mock.module(modulePath("models/Tutor.js"), { defaultExport: { findOne: findOneIn(() => tutors) } });
  mock.module(modulePath("models/PartialTutor.js"), { defaultExport: { findOne: findOneIn(() => partials) } });
  ({ findExistingTutor, tutorExistsBody } = await import(modulePath("utils/tutorExists.js")));
});

beforeEach(() => {
  tutors = [
    { _id: "t1", phone: "98765 43210", whatsapp: "", email: "Asha@Example.test", status: "approved" },
    { _id: "t2", phone: "9000000002", whatsapp: "+91 90000-00099", email: "pending@example.test", status: "pending" },
    { _id: "t3", phone: "9000000003", email: "rex@example.test", status: "rejected" },
  ];
  partials = [
    { _id: "p1", whatsapp: "9811111111", registeredTutorId: null },
    { _id: "p2", whatsapp: "9822222222", registeredTutorId: "t9" }, // already became a full tutor
  ];
});

test("a new person is not registered", async () => {
  assert.equal(await findExistingTutor({ phones: ["9123456789"], email: "new@example.test" }), null);
});

test("the same number, however it is written, is found", async () => {
  for (const phone of ["9876543210", "+91 98765 43210", "098765-43210"]) {
    assert.deepEqual(await findExistingTutor({ phones: [phone] }), { matchedOn: "phone", source: "tutor" }, phone);
  }
});

test("a number saved as someone's WhatsApp counts too", async () => {
  assert.deepEqual(await findExistingTutor({ phones: ["9000000099"] }), { matchedOn: "phone", source: "tutor" });
});

test("the WhatsApp number given on the form is checked as well as the phone", async () => {
  assert.deepEqual(await findExistingTutor({ phones: ["9123456789", "9000000002"] }), { matchedOn: "phone", source: "tutor" });
});

test("the same email, in any capitals, is found", async () => {
  assert.deepEqual(await findExistingTutor({ phones: ["9123456789"], email: " asha@example.TEST " }), { matchedOn: "email", source: "tutor" });
});

test("pending and rejected tutors count as registered", async () => {
  assert.ok(await findExistingTutor({ phones: ["9000000002"] }));
  assert.ok(await findExistingTutor({ email: "rex@example.test" }));
});

test("a short-form sign-up counts, until it has become a full tutor", async () => {
  assert.deepEqual(await findExistingTutor({ phones: ["9811111111"] }), { matchedOn: "phone", source: "partial" });
  assert.equal(await findExistingTutor({ phones: ["9822222222"] }), null);
});

test("part of a number, or a pattern in the email, never matches someone", async () => {
  assert.equal(await findExistingTutor({ phones: ["43210"] }), null);
  assert.equal(await findExistingTutor({ email: ".*@example.test" }), null);
  assert.equal(await findExistingTutor({ email: "not an email" }), null);
  assert.equal(await findExistingTutor({}), null);
});

test("the answer says what matched, never who", async () => {
  const body = tutorExistsBody({ matchedOn: "email", source: "tutor" });
  assert.deepEqual(Object.keys(body).sort(), ["code", "exists", "matchedOn", "message", "source", "success"]);
  assert.equal(body.code, "TUTOR_EXISTS");
  assert.equal(body.message, "A tutor with this email address is already registered.");
  assert.equal(tutorExistsBody({ matchedOn: "phone", source: "partial" }).message, "A tutor with this phone number is already registered.");
});
