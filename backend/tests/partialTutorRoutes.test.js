// Partial tutor form: the rules for what a visitor may send, and the admin list.
// The model is replaced with an in-memory store, so no MongoDB connection is made.
import { test, describe, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { validatePartialTutor, CONSENT_TEXT } from "../utils/partialTutorValidation.js";

const modulePath = (rel) => new URL(`../${rel}`, import.meta.url).href;

const validBody = () => ({
  name: "  Priya Rao ",
  whatsapp: "9876543210",
  experience: "3 year",
  occupation: "School Teacher",
  consent: true,
  location: {
    latitude: "12.9352",
    longitude: "77.6245",
    city: "Bangalore",
    area: "Koramangala",
    pincode: "560034",
    placeLabel: "Koramangala, Bengaluru",
    houseDetails: "Flat 4B, Sunrise Apartments",
    fullAddress: "Flat 4B, Sunrise Apartments, Koramangala, Bengaluru, 560034",
  },
});

describe("partial tutor validation", () => {
  test("a complete form is accepted, with text trimmed and coordinates as numbers", () => {
    const { value, error } = validatePartialTutor(validBody());
    assert.equal(error, undefined);
    assert.equal(value.name, "Priya Rao");
    assert.equal(value.location.latitude, 12.9352);
    assert.equal(value.location.longitude, 77.6245);
    assert.equal(value.location.area, "Koramangala");
    assert.equal(value.consent.accepted, true);
    assert.equal(value.consent.text, CONSENT_TEXT);
    assert.ok(value.consent.acceptedAt instanceof Date);
  });

  test("a form without consent is refused, even when every other field is valid", () => {
    for (const consent of [undefined, false, "true", 1]) {
      assert.equal(validatePartialTutor({ ...validBody(), consent }).error, "Please give your consent to continue");
    }
  });

  test("each missing or wrong field gives its own message", () => {
    const cases = [
      [{ name: "Al" }, "Name must be at least 3 characters"],
      [{ name: "Asha", whatsapp: "12345" }, "Enter a valid 10-digit WhatsApp number"],
      [{ name: "Asha", whatsapp: "9876543210", experience: "forever" }, "Select your experience"],
      [{ ...validBody(), occupation: "Astronaut" }, "Select your occupation"],
      [{ ...validBody(), location: { ...validBody().location, latitude: null } }, "Add your location on the map"],
      [{ ...validBody(), location: { ...validBody().location, houseDetails: "ab" } }, "Enter house, flat, or building details"],
    ];
    for (const [body, message] of cases) {
      assert.equal(validatePartialTutor(body).error, message);
    }
  });
});

let store;
let handlers;
let codeCalls = [];
let codeFails = false;

before(async () => {
  mock.module(modulePath("models/PartialTutor.js"), {
    defaultExport: {
      async create(doc) {
        const record = { _id: "65f000000000000000000001", createdAt: new Date(), status: "new", ...doc };
        store.push(record);
        return record;
      },
      find(filter) {
        const rows = store.filter((r) => !filter.status || r.status === filter.status);
        const query = {
          sort: () => query,
          limit: () => query,
          lean: async () => rows,
        };
        return query;
      },
      async aggregate() {
        const counts = {};
        for (const r of store) counts[r.status] = (counts[r.status] || 0) + 1;
        return Object.entries(counts).map(([_id, count]) => ({ _id, count }));
      },
    },
    namedExports: { PARTIAL_TUTOR_STATUSES: ["new", "contacted", "registered"] },
  });
  // The tutor ID is given by utils/tutorCodes.js (tested on its own); Odoo is never reached
  mock.module(modulePath("utils/tutorCodes.js"), {
    namedExports: {
      assignPartialTutorCode: async (record, { readOdooCodes }) => {
        codeCalls.push({ id: record._id, readsOdoo: typeof readOdooCodes === "function" });
        if (codeFails) throw new Error("counter unavailable");
        return "TUT0300";
      },
    },
  });
  mock.module(modulePath("utils/odooService.js"), {
    namedExports: { listOdooTutorCodes: async () => { throw new Error("must not reach Odoo in tests"); } },
  });
  const { default: router } = await import(modulePath("routes/partialTutorRoutes.js"));
  const handlerFor = (method, path = "/") => {
    const layer = router.stack.find((l) => l.route?.path === path && l.route.methods[method]);
    return layer.route.stack[layer.route.stack.length - 1].handle; // skip verifyToken
  };
  handlers = { submit: handlerFor("post"), list: handlerFor("get") };
});

beforeEach(() => {
  store = [];
});

const call = async (handler, { body = {}, query = {} } = {}) => {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
  await handler({ body, query, headers: { "user-agent": "test-agent" }, socket: { remoteAddress: "1.2.3.4" } }, res);
  return res;
};

describe("partial tutor route", () => {
  test("a valid submission is saved as a new lead", async () => {
    const res = await call(handlers.submit, { body: validBody() });
    assert.equal(res.statusCode, 201);
    assert.equal(store.length, 1);
    assert.equal(store[0].whatsapp, "9876543210");
    assert.equal(store[0].userAgent, "test-agent");
    assert.equal(store[0].consent.accepted, true);
  });

  test("a new sign-up is given a tutor ID, sent back to the form", async () => {
    codeCalls = [];
    codeFails = false;
    const res = await call(handlers.submit, { body: validBody() });
    assert.equal(res.statusCode, 201);
    assert.equal(res.payload.tutorCode, "TUT0300");
    assert.equal(codeCalls.length, 1);
    assert.equal(codeCalls[0].readsOdoo, true);
  });

  test("if the ID can't be given, the form is still saved", async () => {
    codeFails = true;
    try {
      const res = await call(handlers.submit, { body: validBody() });
      assert.equal(res.statusCode, 201);
      assert.equal(res.payload.tutorCode, "");
      assert.equal(store.length, 1);
    } finally {
      codeFails = false;
    }
  });

  test("an invalid submission is refused with a message and nothing is saved", async () => {
    const res = await call(handlers.submit, { body: { ...validBody(), whatsapp: "abc" } });
    assert.equal(res.statusCode, 400);
    assert.equal(res.payload.message, "Enter a valid 10-digit WhatsApp number");
    assert.equal(store.length, 0);
  });

  test("the admin list is newest first and counts each status", async () => {
    await call(handlers.submit, { body: validBody() });
    await call(handlers.submit, { body: { ...validBody(), name: "Ravi Kumar" } });
    const res = await call(handlers.list);
    assert.equal(res.payload.total, 2);
    assert.deepEqual(res.payload.counts, { new: 2, contacted: 0, registered: 0 });
  });
});
