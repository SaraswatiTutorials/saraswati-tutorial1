// Assignment and photo routes of the parent and tutor portals, run through the real token check,
// with the models and Cloudinary replaced by in-memory fakes. No MongoDB connection is made.
import { test, describe, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import "dotenv/config"; // the same JWT secret the token check uses

const modulePath = (rel) => new URL(`../${rel}`, import.meta.url).href;
const SECRET = process.env.JWT_SECRET || "secretkey";

const LEAD_ID = "64b000000000000000000001";
const OTHER_LEAD_ID = "64b000000000000000000002";
const TUTOR_ID = "64b0000000000000000000a1";
const OTHER_TUTOR_ID = "64b0000000000000000000a2";

let leads;
let tutors;
let assignments;

const withSave = (doc) => Object.assign(doc, { async save() { return this; } });

const FakeParentEnquiry = { async findById(id) { return leads.find((l) => l._id === String(id)) || null; } };
const FakeTutor = {
  findById(id) {
    const tutor = tutors.find((t) => t._id === String(id)) || null;
    const result = Promise.resolve(tutor);
    result.select = () => Promise.resolve(tutor);
    return result;
  },
};
const FakeAssignment = {
  async create(doc) {
    const record = withSave({ _id: `64b0000000000000000000${String(assignments.length + 10)}`, ...doc });
    record.toObject = () => ({ ...record });
    record.deleteOne = async () => { assignments = assignments.filter((a) => a !== record); };
    assignments.push(record);
    return record;
  },
  async findById(id) { return assignments.find((a) => a._id === String(id)) || null; },
  find(filter) {
    const rows = assignments.filter((a) => String(a.parentEnquiryId) === String(filter.parentEnquiryId));
    return { sort: async () => rows };
  },
};

let router;

before(async () => {
  mock.module(modulePath("models/ParentEnquiry.js"), { defaultExport: FakeParentEnquiry });
  mock.module(modulePath("models/Tutor.js"), { defaultExport: FakeTutor });
  mock.module(modulePath("models/Assignment.js"), { defaultExport: FakeAssignment });
  mock.module(modulePath("utils/photoUpload.js"), {
    namedExports: {
      receivePhoto: (req, res, next) => { req.file = { mimetype: "image/jpeg", buffer: Buffer.from("x") }; next(); },
      storePhoto: async (file, folder) => `https://img.test/${folder}/photo.jpg`,
    },
  });
  ({ default: router } = await import(modulePath("routes/portalRoutes.js")));
});

beforeEach(() => {
  leads = [
    withSave({ _id: LEAD_ID, assignedTutorId: TUTOR_ID, assignedTutor: "Ananya Rao", phone: "+91 98765 43210", requirementId: "REQ-1", wards: [{ studentName: "Aarav" }] }),
    withSave({ _id: OTHER_LEAD_ID, assignedTutorId: OTHER_TUTOR_ID, phone: "9000000000", requirementId: "REQ-2", wards: [{ studentName: "Meera" }] }),
  ];
  tutors = [withSave({ _id: TUTOR_ID, name: "Ananya Rao", photo: "" }), withSave({ _id: OTHER_TUTOR_ID, name: "Rahul", photo: "" })];
  assignments = [];
});

const tokens = {
  tutor: jwt.sign({ id: TUTOR_ID, role: "tutor" }, SECRET),
  parent: jwt.sign({ role: "parent", phone: "9876543210" }, SECRET),
  otherParent: jwt.sign({ role: "parent", phone: "9111111111" }, SECRET),
  admin: jwt.sign({ email: "a@b.c", role: "admin" }, SECRET),
};

// Runs every handler on the matching route in order, like Express would
async function call(method, path, { token, body = {} } = {}) {
  const layer = router.stack.find((l) => l.route?.methods[method] && l.match(path));
  assert.ok(layer, `no route for ${method} ${path}`);
  const req = { method: method.toUpperCase(), params: layer.params, body, headers: token ? { authorization: `Bearer ${token}` } : {} };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; this.done = true; return this; },
  };
  for (const { handle } of layer.route.stack) {
    let nextCalled = false;
    await handle(req, res, () => { nextCalled = true; });
    if (res.done || !nextCalled) break;
  }
  return res;
}

const newWork = { title: "Weekly test – Fractions", kind: "Test", givenDate: "2026-10-24", maxMarks: 25 };

describe("assignments", () => {
  test("a tutor adds work for their own student and the parent can read it", async () => {
    const created = await call("post", `/students/${LEAD_ID}/assignments`, { token: tokens.tutor, body: newWork });
    assert.equal(created.statusCode, 201);
    assert.equal(created.payload.assignment.tutorName, "Ananya Rao");
    assert.equal(created.payload.assignment.studentName, "Aarav");
    assert.equal(created.payload.assignment.status, "Pending");

    const seen = await call("get", `/students/${LEAD_ID}/assignments`, { token: tokens.parent });
    assert.equal(seen.statusCode, 200);
    assert.equal(seen.payload.assignments.length, 1);
  });

  test("a tutor can't add work for another tutor's student", async () => {
    const res = await call("post", `/students/${OTHER_LEAD_ID}/assignments`, { token: tokens.tutor, body: newWork });
    assert.equal(res.statusCode, 403);
    assert.equal(assignments.length, 0);
  });

  test("parents can read but not add, and only for their own number", async () => {
    assert.equal((await call("post", `/students/${LEAD_ID}/assignments`, { token: tokens.parent, body: newWork })).statusCode, 403);
    assert.equal((await call("get", `/students/${LEAD_ID}/assignments`, { token: tokens.otherParent })).statusCode, 403);
    assert.equal((await call("get", `/students/${LEAD_ID}/assignments`)).statusCode, 401);
  });

  test("adding marks checks the work; marks above the total are refused", async () => {
    const { payload } = await call("post", `/students/${LEAD_ID}/assignments`, { token: tokens.tutor, body: newWork });
    const id = payload.assignment._id;

    const tooHigh = await call("patch", `/assignments/${id}`, { token: tokens.tutor, body: { marks: 30 } });
    assert.equal(tooHigh.statusCode, 400);

    const marked = await call("patch", `/assignments/${id}`, { token: tokens.tutor, body: { marks: 21, remark: "Very good" } });
    assert.equal(marked.statusCode, 200);
    assert.equal(marked.payload.assignment.status, "Checked");
    assert.equal(marked.payload.assignment.marks, 21);
    assert.ok(marked.payload.assignment.checkedAt instanceof Date);
  });

  test("another tutor can't change or delete it; the owner can delete it", async () => {
    const { payload } = await call("post", `/students/${LEAD_ID}/assignments`, { token: tokens.tutor, body: newWork });
    const id = payload.assignment._id;
    const otherTutor = jwt.sign({ id: OTHER_TUTOR_ID, role: "tutor" }, SECRET);

    assert.equal((await call("patch", `/assignments/${id}`, { token: otherTutor, body: { marks: 1 } })).statusCode, 403);
    assert.equal((await call("delete", `/assignments/${id}`, { token: otherTutor })).statusCode, 403);
    assert.equal((await call("delete", `/assignments/${id}`, { token: tokens.tutor })).statusCode, 200);
    assert.equal(assignments.length, 0);
  });

  test("an admin adds work on behalf of the student's tutor", async () => {
    const res = await call("post", `/students/${LEAD_ID}/assignments`, { token: tokens.admin, body: newWork });
    assert.equal(res.statusCode, 201);
    assert.equal(String(res.payload.assignment.tutorId), TUTOR_ID);
  });
});

describe("photos", () => {
  test("a parent adds their child's photo, not another family's", async () => {
    const ok = await call("post", `/students/${LEAD_ID}/photo`, { token: tokens.parent });
    assert.equal(ok.statusCode, 200);
    assert.equal(leads[0].studentPhoto, "https://img.test/saraswati-students/photo.jpg");

    assert.equal((await call("post", `/students/${OTHER_LEAD_ID}/photo`, { token: tokens.parent })).statusCode, 403);
    assert.equal((await call("post", `/students/${LEAD_ID}/photo`, { token: tokens.tutor })).statusCode, 403);
  });

  test("a tutor changes their own profile photo and reads it back", async () => {
    const res = await call("post", "/tutor/photo", { token: tokens.tutor });
    assert.equal(res.statusCode, 200);
    const me = await call("get", "/tutor/me", { token: tokens.tutor });
    assert.equal(me.payload.tutor.photo, "https://img.test/saraswati-tutors/profile/photo.jpg");
    assert.equal((await call("post", "/tutor/photo", { token: tokens.parent })).statusCode, 403);
  });
});
