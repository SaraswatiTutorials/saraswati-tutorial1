// Partial tutors (short sign-up form) logging in to the tutor portal. Every
// model and outside service is mocked; nothing can reach MongoDB, Odoo,
// WhatsApp or the network.
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

const modulePath = (rel) => new URL(`../${rel}`, import.meta.url).href;
const PARTIAL_ID = "65f0000000000000000000a1";

let tutors, partials, codeCalls, photoSaves;

const fieldMatches = (doc, cond) => Object.entries(cond).every(([k, v]) =>
  v instanceof RegExp ? typeof doc[k] === "string" && v.test(doc[k]) : doc[k] === v);
const firstMatch = (rows, query) => rows.find((r) => (query.$or || [query]).some((c) => fieldMatches(r, c))) || null;

before(async () => {
  mock.module(modulePath("models/Tutor.js"), {
    defaultExport: {
      findOne: async (q) => firstMatch(tutors, q),
      findById: (id) => {
        const t = tutors.find((x) => x._id === String(id)) || null;
        const p = Promise.resolve(t);
        p.select = () => Promise.resolve(t);
        return p;
      },
    },
  });
  mock.module(modulePath("models/PartialTutor.js"), {
    defaultExport: {
      findOne: (q) => ({ sort: async () => firstMatch(partials, q) }),
      findById: async (id) => partials.find((p) => p._id === String(id)) || null,
    },
  });
  mock.module(modulePath("utils/tutorCodes.js"), {
    namedExports: {
      assignPartialTutorCode: async (p) => { codeCalls.push(p._id); p.tutorCode = "TUT0301"; return p.tutorCode; },
    },
  });
  const noop = async () => null;
  mock.module(modulePath("utils/odooService.js"), {
    namedExports: {
      updateLead: noop, syncAttendanceLogToOdoo: noop, syncLeadAttendanceSummaryToOdoo: noop,
      deleteOdooAttendanceLog: noop, listOdooTutorCodes: async () => { throw new Error("must not reach Odoo"); },
    },
  });
  for (const m of ["ParentEnquiry", "Attendance", "Assignment", "BroadcastLog"]) {
    mock.module(modulePath(`models/${m}.js`), { defaultExport: { findById: async () => null, find: async () => [] } });
  }
  mock.module(modulePath("utils/whatsappService.js"), { namedExports: { sendWhatsAppToTutor: noop } });
  mock.module(modulePath("utils/broadcastService.js"), { namedExports: { broadcastService: {}, RETRYABLE_FAILURE_REASONS: [] } });
  mock.module(modulePath("utils/syncService.js"), { namedExports: { startSyncScheduler: noop } });
  mock.module(modulePath("utils/photoUpload.js"), {
    namedExports: {
      receivePhoto: (req, res, next) => next(),
      storePhoto: async (file, folder) => `https://img.test/${folder}/photo.jpg`,
    },
  });
  mock.module(modulePath("middleware/authMiddleware.js"), {
    namedExports: { verifyToken: () => (req, res, next) => next() },
  });
  globalThis.fetch = async () => { throw new Error("Network access is disabled in tests"); };
  process.env.JWT_SECRET = "test-secret";
});

beforeEach(() => {
  tutors = [
    { _id: "t-approved", name: "Annu", tutorCode: "TUT0169", phone: "9000000001", whatsapp: "9000000001", status: "approved" },
    { _id: "t-pending", name: "Pending Pat", tutorCode: "TUT0170", phone: "9000000002", status: "pending" },
  ];
  partials = [
    { _id: PARTIAL_ID, name: "Priya Rao", whatsapp: "9876543210", tutorCode: "TUT0250", photo: "",
      async save() { photoSaves.push(this.photo); return this; } },
    { _id: "65f0000000000000000000a2", name: "Pat (form)", whatsapp: "9000000002", tutorCode: "TUT0170" },
    { _id: "65f0000000000000000000a3", name: "No ID Yet", whatsapp: "9811111111", tutorCode: "" },
  ];
  codeCalls = [];
  photoSaves = [];
});

const handlerOf = async (file, path, method) => {
  const { default: router } = await import(modulePath(file));
  const layer = router.stack.find((l) => l.route?.path === path && l.route.methods[method]);
  return layer.route.stack.at(-1).handle;
};
const run = async (handler, req) => {
  const res = { statusCode: 200, payload: null, status(c) { this.statusCode = c; return this; }, json(d) { this.payload = d; return this; } };
  await handler(req, res);
  return res;
};
const login = async (identifier) => run(await handlerOf("routes/attendanceRoutes.js", "/tutor-login", "post"), { body: { identifier } });

test("a partial tutor logs in with their tutor ID", async () => {
  const res = await login("tut0250");
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.tutor.id, PARTIAL_ID);
  assert.equal(res.payload.tutor.tutorCode, "TUT0250");
  assert.equal(res.payload.tutor.isPartial, true);
  const token = jwt.verify(res.payload.token, "test-secret");
  assert.equal(token.id, PARTIAL_ID);
  assert.equal(token.role, "tutor");
});

test("...or with their WhatsApp number, however it is written", async () => {
  const res = await login("+91 98765 43210");
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.tutor.name, "Priya Rao");
});

test("an approved registered tutor still logs in as themselves", async () => {
  const res = await login("TUT0169");
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.tutor.id, "t-approved");
  assert.equal(res.payload.tutor.isPartial, undefined);
});

test("someone pending approval who filled the partial form gets in as a partial tutor", async () => {
  const res = await login("9000000002");
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.tutor.name, "Pat (form)");
  assert.equal(res.payload.tutor.isPartial, true);
});

test("a partial tutor without an ID yet is given one when they log in", async () => {
  const res = await login("9811111111");
  assert.equal(res.statusCode, 200);
  assert.deepEqual(codeCalls, ["65f0000000000000000000a3"]);
  assert.equal(res.payload.tutor.tutorCode, "TUT0301");
});

test("nobody by that ID or number: refused as before", async () => {
  const res = await login("TUT9999");
  assert.equal(res.statusCode, 401);
});

test("the portal header shows a partial tutor's name and ID", async () => {
  const res = await run(await handlerOf("routes/portalRoutes.js", "/tutor/me", "get"), { user: { id: PARTIAL_ID, role: "tutor" } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload.tutor, { id: PARTIAL_ID, name: "Priya Rao", tutorCode: "TUT0250", photo: "" });
});

test("a partial tutor's photo is saved on their sign-up record", async () => {
  const res = await run(await handlerOf("routes/portalRoutes.js", "/tutor/photo", "post"),
    { user: { id: PARTIAL_ID, role: "tutor" }, file: { mimetype: "image/jpeg" } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.photo, "https://img.test/saraswati-tutors/profile/photo.jpg");
  assert.deepEqual(photoSaves, ["https://img.test/saraswati-tutors/profile/photo.jpg"]);
});

test("attendance finds a partial tutor by their id, like a registered one", async () => {
  const { findTutorAccount } = await import(modulePath("utils/tutorAccount.js"));
  const account = await findTutorAccount(PARTIAL_ID);
  assert.equal(account.isPartial, true);
  assert.equal(account.name, "Priya Rao");
  assert.equal(account.tutorCode, "TUT0250");
  assert.equal((await findTutorAccount("t-approved")).name, "Annu");
  assert.equal(await findTutorAccount("not-an-id"), null);
});
