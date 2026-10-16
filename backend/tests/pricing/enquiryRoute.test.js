// Route-level test of POST /api/parent-enquiries with every model and external
// service mocked. No MongoDB connection, Odoo call, WhatsApp call or network
// request can happen: all of those modules are replaced before the route loads.
import { test, describe, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { calculateQuote, toEnquiryFields } from "../../utils/pricing/feeEngine.js";

const modulePath = (rel) => new URL(`../../${rel}`, import.meta.url).href;

const calls = { saved: [], analytics: 0, draftsDeleted: 0, createLead: 0, constructed: 0, adminAlerts: 0 };

class FakeParentEnquiry {
  constructor(doc) {
    calls.constructed += 1;
    Object.assign(this, doc);
    this._id = "fake-id";
  }
  async save() {
    calls.saved.push({ ...this });
    return this;
  }
  static async countDocuments() { return 0; }
  static findOne() { return { sort: () => ({ select: () => ({ lean: async () => null }) }) }; }
  static async exists() { return null; }
  static async findById() { return null; } // makes auto-broadcast exit immediately
  static async findByIdAndUpdate() { return null; }
}

class FakeAnalyticsLog {
  async save() { calls.analytics += 1; }
}

const emptyModel = class {};
const noop = async () => null;

before(async () => {
  mock.module(modulePath("models/ParentEnquiry.js"), { defaultExport: FakeParentEnquiry });
  mock.module(modulePath("models/AnalyticsLog.js"), { defaultExport: FakeAnalyticsLog });
  mock.module(modulePath("models/ParentEnquiryDraft.js"), {
    defaultExport: { deleteMany: async () => { calls.draftsDeleted += 1; } },
  });
  for (const m of ["Attendance", "Tutor", "TutorRegistrationDraft", "Enquiry", "Booking", "BroadcastLog"]) {
    mock.module(modulePath(`models/${m}.js`), { defaultExport: emptyModel });
  }
  mock.module(modulePath("utils/odooService.js"), {
    namedExports: {
      createLead: async () => { calls.createLead += 1; return { id: 1 }; },
      updateLead: noop, updateLeadAssignment: noop, syncTutorStats: noop, addOdooChatterMessage: noop,
    },
  });
  mock.module(modulePath("utils/whatsappService.js"), {
    namedExports: {
      sendWhatsAppToTutor: noop, buildBroadcastMessage: () => "", buildAssignmentMessage: () => "",
      buildOnboardingMessage: () => "", isPermanentFailure: () => false, getOdooUid: noop,
      callOdooMethod: noop, buildRequirementTemplateVars: () => ({}),
    },
  });
  mock.module(modulePath("utils/matchingEngine.js"), {
    namedExports: { buildCentralizedQuery: () => ({}), calculateTutorScore: () => ({}), compareTutors: () => 0, parseAddress: () => ({}) },
  });
  mock.module(modulePath("utils/recommendationEngine.js"), {
    namedExports: { getRecommendations: async () => [], buildParamsFromLead: () => ({}) },
  });
  mock.module(modulePath("utils/adminAlerts.js"), {
    namedExports: { notifyAdminOfNewEnquiry: async () => { calls.adminAlerts += 1; } },
  });
  mock.module(modulePath("utils/geoLookup.js"), {
    namedExports: { resolveGeo: async () => ({ city: "Unknown City" }) },
  });
  mock.module(modulePath("middleware/authMiddleware.js"), {
    namedExports: { verifyToken: () => (req, res, next) => next() },
  });

  // Any stray network call fails the test instead of leaving the machine.
  globalThis.fetch = async () => {
    throw new Error("Network access is disabled in tests");
  };
});

let postHandler;
const getPostHandler = async () => {
  if (!postHandler) {
    const { default: router } = await import(modulePath("routes/parentEnquiryRoutes.js"));
    const layer = router.stack.find((l) => l.route?.path === "/" && l.route.methods.post);
    postHandler = layer.route.stack[0].handle;
  }
  return postHandler;
};

const submit = async (body) => {
  const handler = await getPostHandler();
  const res = {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.payload = data; return this; },
  };
  const req = { body: structuredClone(body), headers: {}, socket: { remoteAddress: "127.0.0.1" } };
  await handler(req, res);
  await new Promise((resolve) => setImmediate(resolve)); // let the mocked Odoo sync finish
  return res;
};

const submission = (overrides = {}) => {
  const body = {
    parentName: "Test Parent",
    phone: "9999999999",
    planType: "advance",
    daysPerWeek: 3,
    hoursPerDay: 1.5,
    preferredMode: "Home Tuition / In-Person",
    wards: [{ studentName: "A", classGrade: "6", curriculum: "CBSE", subjectsNeeded: ["Mathematics"] }],
    geoInfo: { city: "Bangalore" },
  };
  const { costPerClass, ...fields } = toEnquiryFields(calculateQuote(body));
  return { ...body, ...fields, costPerClass, ...overrides };
};

beforeEach(() => {
  Object.assign(calls, { saved: [], analytics: 0, draftsDeleted: 0, createLead: 0, constructed: 0, adminAlerts: 0 });
  delete process.env.PRICING_ENFORCEMENT;
});

describe("POST /api/parent-enquiries (mocked models)", () => {
  test("default (off): a tampered price is saved exactly as submitted — today's behaviour", async () => {
    const res = await submit(submission({ finalPrice: 1, monthlyFees: 1 }));
    assert.equal(res.statusCode, 201);
    assert.equal(calls.saved.length, 1);
    assert.equal(calls.saved[0].finalPrice, 1);
    assert.equal(calls.saved[0].monthlyFees, 1);
    assert.equal(calls.createLead, 1);
    assert.equal(calls.adminAlerts, 1);
  });

  test("default (off): an honest submission saves the same fee fields the form sent", async () => {
    const body = submission();
    const res = await submit(body);
    assert.equal(res.statusCode, 201);
    for (const f of ["studentFees", "totalBaseFee", "siblingDiscount", "siblingConcessionPercent", "monthlyFees", "finalPrice"]) {
      assert.deepEqual(calls.saved[0][f], body[f], f);
    }
  });

  test("log: the tampered price is still saved unchanged", async () => {
    process.env.PRICING_ENFORCEMENT = "log";
    const warn = mock.method(console, "warn", () => {});
    const res = await submit(submission({ finalPrice: 1 }));
    warn.mock.restore();
    assert.equal(res.statusCode, 201);
    assert.equal(calls.saved[0].finalPrice, 1);
    assert.equal(warn.mock.callCount(), 1);
  });

  test("enforce: a tampered price is replaced with the server price before saving", async () => {
    process.env.PRICING_ENFORCEMENT = "enforce";
    const res = await submit(submission({ finalPrice: 1, monthlyFees: 1 }));
    assert.equal(res.statusCode, 201);
    assert.equal(calls.saved[0].finalPrice, 6750);
    assert.equal(calls.saved[0].monthlyFees, 6750);
  });

  test("enforce: an unavailable combination is rejected before anything is written", async () => {
    process.env.PRICING_ENFORCEMENT = "enforce";
    const res = await submit(submission({ planType: "foundation", wards: [{ studentName: "A", classGrade: "5", curriculum: "CBSE", subjectsNeeded: ["Mathematics"] }] }));
    assert.equal(res.statusCode, 400);
    assert.equal(calls.constructed, 0);
    assert.equal(calls.saved.length, 0);
    assert.equal(calls.analytics, 0);
    assert.equal(calls.draftsDeleted, 0);
    assert.equal(calls.createLead, 0);
  });
});
