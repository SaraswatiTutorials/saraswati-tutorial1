// A partial tutor completing the full registration from the tutor portal, and
// logging in afterwards. Every model and outside service is mocked; nothing
// can reach MongoDB, Odoo, WhatsApp or the network.
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

const modulePath = (rel) => new URL(`../${rel}`, import.meta.url).href;
const PARTIAL_ID = "65f0000000000000000000a1";
const NEW_TUTOR_ID = "65f0000000000000000000b1";

let tutors, partials, registered, moved, registerFails;

const matchOne = (doc, cond) => Object.entries(cond).every(([k, v]) => {
  if (k === "$or") return v.some((c) => matchOne(doc, c));
  return v instanceof RegExp ? typeof doc[k] === "string" && v.test(doc[k]) : String(doc[k]) === String(v);
});
const lookup = (rows, q) => { const hit = rows.find((r) => matchOne(r, q)) || null; const p = Promise.resolve(hit); p.lean = async () => hit; p.sort = async () => hit; return p; };
const updateManyOf = (name) => async (filter, update) => { moved.push({ name, filter, update }); return { modifiedCount: 1 }; };

before(async () => {
  mock.module(modulePath("models/Tutor.js"), {
    defaultExport: {
      findOne: (q) => lookup(tutors, q),
      findById: (id) => { const t = tutors.find((x) => x._id === String(id)) || null; const p = Promise.resolve(t); p.select = async () => t; p.catch = (f) => Promise.resolve(t).catch(f); return p; },
    },
  });
  mock.module(modulePath("models/PartialTutor.js"), {
    defaultExport: {
      findOne: (q) => lookup(partials, q),
      findById: async (id) => partials.find((p) => p._id === String(id)) || null,
    },
  });
  for (const m of ["ParentEnquiry", "Attendance", "Assignment", "BroadcastLog"]) {
    mock.module(modulePath(`models/${m}.js`), { defaultExport: { findById: async () => null, find: async () => [], updateMany: updateManyOf(m) } });
  }
  mock.module(modulePath("utils/tutorRegistration.js"), {
    namedExports: {
      registerTutor: async (body, opts) => {
        if (registerFails) throw new Error("Odoo and Mongo both down");
        registered.push({ body, opts });
        const t = { _id: NEW_TUTOR_ID, ...body, tutorCode: opts.preferredCode, createdAt: new Date() };
        tutors.push(t);
        return t;
      },
    },
  });
  mock.module(modulePath("utils/tutorCodes.js"), {
    namedExports: { assignPartialTutorCode: async (p) => { p.tutorCode = "TUT0301"; return p.tutorCode; } },
  });
  const noop = async () => null;
  mock.module(modulePath("utils/odooService.js"), {
    namedExports: {
      updateLead: noop, syncAttendanceLogToOdoo: noop, syncLeadAttendanceSummaryToOdoo: noop,
      deleteOdooAttendanceLog: noop, listOdooTutorCodes: async () => { throw new Error("must not reach Odoo"); },
    },
  });
  mock.module(modulePath("utils/whatsappService.js"), { namedExports: { sendWhatsAppToTutor: noop } });
  mock.module(modulePath("utils/broadcastService.js"), { namedExports: { broadcastService: {}, RETRYABLE_FAILURE_REASONS: [] } });
  mock.module(modulePath("utils/syncService.js"), { namedExports: { startSyncScheduler: noop } });
  mock.module(modulePath("utils/photoUpload.js"), { namedExports: { receivePhoto: (q, s, n) => n(), storePhoto: async () => "" } });
  mock.module(modulePath("middleware/authMiddleware.js"), { namedExports: { verifyToken: () => (req, res, next) => next() } });
  globalThis.fetch = async () => { throw new Error("Network access is disabled in tests"); };
  process.env.JWT_SECRET = "test-secret";
});

beforeEach(() => {
  tutors = [{ _id: "t-approved", name: "Annu", tutorCode: "TUT0169", phone: "9000000001", status: "approved" }];
  partials = [{
    _id: PARTIAL_ID, name: "Priya Rao", whatsapp: "9876543210", experience: "3 year", occupation: "Student",
    tutorCode: "TUT0250", status: "new", registeredTutorId: null, photo: "",
    location: { city: "Bangalore", area: "Koramangala", pincode: "560034", latitude: 12.93, longitude: 77.62, houseDetails: "Flat 4B", placeLabel: "Koramangala" },
    saves: 0, async save() { this.saves += 1; return this; },
  }];
  registered = [];
  moved = [];
  registerFails = false;
});

const handlerOf = async (file, path, method) => {
  const { default: router } = await import(modulePath(file));
  return router.stack.find((l) => l.route?.path === path && l.route.methods[method]).route.stack.at(-1).handle;
};
const run = async (handler, req) => {
  const res = { statusCode: 200, payload: null, status(c) { this.statusCode = c; return this; }, json(d) { this.payload = d; return this; } };
  await handler(req, res);
  return res;
};
const profile = async (id) => run(await handlerOf("routes/portalRoutes.js", "/tutor/full-profile", "get"), { user: { id, role: "tutor" } });
const complete = async (body, id = PARTIAL_ID) => run(await handlerOf("routes/portalRoutes.js", "/tutor/complete-profile", "post"), { user: { id, role: "tutor" }, body });
const login = async (identifier) => run(await handlerOf("routes/attendanceRoutes.js", "/tutor-login", "post"), { body: { identifier } });

const form = () => ({
  email: "priya@example.test", gender: "Female", qualification: "M.Sc Physics",
  grades: ["Class 9-10 (Secondary)"], boards: ["CBSE"], subjects: ["Physics"],
  hasOccupation: "yes", occupation: "School Teacher", maxTravelDistance: "10 km",
  hasVehicle: "no", timings: ["5-6 PM"],
  photo: "https://res.cloudinary.test/p.jpg", idProof: "https://res.cloudinary.test/id.pdf", expCert: "https://res.cloudinary.test/c.pdf",
  agreement: true, attendanceAgreement: true,
});

test("a partial tutor is told what is still needed and what is already known", async () => {
  const res = await profile(PARTIAL_ID);
  assert.equal(res.payload.stage, "partial");
  assert.equal(res.payload.known.name, "Priya Rao");
  assert.ok(res.payload.needed.some((n) => n.key === "documents"));
});

test("a registered tutor sees nothing to complete", async () => {
  assert.equal((await profile("t-approved")).payload.stage, "full");
});

test("an incomplete form is refused and nothing is registered", async () => {
  const res = await complete({ ...form(), idProof: "" });
  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.message, "ID Proof is required");
  assert.equal(registered.length, 0);
  assert.equal(partials[0].registeredTutorId, null);
});

test("sending it registers them like the website form, keeping their tutor ID", async () => {
  const res = await complete(form());
  assert.equal(res.statusCode, 200, JSON.stringify(res.payload));
  assert.equal(registered.length, 1);
  const { body, opts } = registered[0];
  assert.equal(opts.preferredCode, "TUT0250");
  assert.equal(body.status, "pending");
  assert.equal(body.phone, "9876543210");
  assert.equal(body.fromPartialTutorId, PARTIAL_ID);
  assert.equal(res.payload.tutor.tutorCode, "TUT0250");
  assert.equal(res.payload.stage, "submitted");
  assert.equal(jwt.verify(res.payload.token, "test-secret").id, NEW_TUTOR_ID);
});

test("the form entry is marked registered, and students, classes, homework and invites move with them", async () => {
  await complete(form());
  assert.equal(partials[0].status, "registered");
  assert.equal(String(partials[0].registeredTutorId), NEW_TUTOR_ID);
  assert.ok(partials[0].registeredAt instanceof Date);
  const byModel = Object.fromEntries(moved.map((m) => [m.name, m]));
  assert.deepEqual(Object.keys(byModel).sort(), ["Assignment", "Attendance", "BroadcastLog", "ParentEnquiry"]);
  assert.deepEqual(byModel.ParentEnquiry.filter, { assignedTutorId: PARTIAL_ID });
  assert.deepEqual(byModel.ParentEnquiry.update, { $set: { assignedTutorId: NEW_TUTOR_ID } });
  assert.deepEqual(byModel.Attendance.filter, { tutorId: PARTIAL_ID });
});

test("sending twice is refused the second time", async () => {
  await complete(form());
  const again = await complete(form());
  assert.equal(again.statusCode, 409);
  assert.equal(registered.length, 1);
});

test("an approved tutor with the same number is never overwritten", async () => {
  partials[0].whatsapp = "9000000001";
  const res = await complete(form());
  assert.equal(res.statusCode, 409);
  assert.equal(registered.length, 0);
});

test("if saving fails, the form entry is left as it was", async () => {
  registerFails = true;
  const res = await complete(form());
  assert.equal(res.statusCode, 500);
  assert.equal(partials[0].registeredTutorId, null);
  assert.equal(moved.length, 0);
});

test("afterwards: their panel says it is with the team", async () => {
  await complete(form());
  assert.equal((await profile(NEW_TUTOR_ID)).payload.stage, "submitted");
  assert.equal((await profile(PARTIAL_ID)).payload.stage, "relogin"); // an old session on another device
});

test("afterwards: they log in as their new record while it waits for approval", async () => {
  await complete(form());
  const byPhone = await login("9876543210");
  assert.equal(byPhone.statusCode, 200, JSON.stringify(byPhone.payload));
  assert.equal(byPhone.payload.tutor.id, NEW_TUTOR_ID);
  assert.equal(byPhone.payload.tutor.isPartial, undefined);
  const byCode = await login("TUT0250");
  assert.equal(byCode.payload.tutor.id, NEW_TUTOR_ID);
});

test("a website registration waiting for approval logs in, and is told it is pending", async () => {
  tutors.push({ _id: "t-web", name: "Web Pending", phone: "9111111111", status: "pending" });
  const res = await login("9111111111");
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.tutor.id, "t-web");
  const stage = (await profile("t-web")).payload;
  assert.equal(stage.stage, "submitted");
  assert.equal(stage.fromPartialForm, false);
});

test("once approved, the panel says so", async () => {
  await complete(form());
  tutors.find((t) => t._id === NEW_TUTOR_ID).status = "approved";
  assert.equal((await profile(NEW_TUTOR_ID)).payload.stage, "full");
});

test("an open session of a tutor who was then rejected is told so", async () => {
  tutors.push({ _id: "t-rej", name: "Rex", phone: "9222222222", status: "rejected" });
  assert.equal((await profile("t-rej")).payload.stage, "rejected");
});

test("a converted tutor who is rejected can't log in", async () => {
  await complete(form());
  tutors.find((t) => t._id === NEW_TUTOR_ID).status = "rejected";
  assert.equal((await login("9876543210")).statusCode, 403);
});
