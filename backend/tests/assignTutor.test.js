// POST /:id/assign-tutor from the admin dashboard must not message the tutor:
// a tutor hears they were picked only when the parent picks them from the
// top 3. Every model and outside service is mocked; nothing can reach Odoo,
// WhatsApp, MongoDB or the network.
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

const modulePath = (rel) => new URL(`../${rel}`, import.meta.url).href;

const sent = [];
let lead;
const tutor = { _id: "tutor-1", name: "Test Tutor", whatsapp: "919999999999" };

function freshLead(extra = {}) {
  return {
    _id: "lead-1",
    requirementId: "REQ-TEST",
    area: "Area", city: "City",
    wards: [{ classGrade: "10", subjectsNeeded: ["Mathematics"] }],
    async save() { return this; },
    ...extra,
  };
}

before(() => {
  mock.module(modulePath("models/ParentEnquiry.js"), { defaultExport: { findById: async () => lead } });
  mock.module(modulePath("models/Tutor.js"), { defaultExport: { findById: async () => tutor } });
  mock.module(modulePath("models/BroadcastLog.js"), { defaultExport: { updateMany: async () => ({}) } });
  for (const m of ["ParentEnquiryDraft", "Attendance", "AnalyticsLog", "TutorRegistrationDraft", "Enquiry", "Booking"]) {
    mock.module(modulePath(`models/${m}.js`), { defaultExport: class {} });
  }
  const noop = async () => null;
  mock.module(modulePath("utils/odooService.js"), {
    namedExports: { createLead: noop, updateLead: noop, updateLeadAssignment: noop, syncTutorStats: noop, addOdooChatterMessage: noop },
  });
  mock.module(modulePath("utils/whatsappService.js"), {
    namedExports: {
      sendWhatsAppToTutor: async (opts) => { sent.push(opts); return { success: true }; },
      buildBroadcastMessage: () => "", buildAssignmentMessage: () => "assignment text",
      buildOnboardingMessage: () => "", isPermanentFailure: () => false, getOdooUid: noop,
      callOdooMethod: noop, buildRequirementTemplateVarsV3: () => ({}),
      chooseRequirementTemplate: async () => ({ templateName: "x", buildVars: () => ({}) }),
    },
  });
  mock.module(modulePath("utils/tutorOptionsMessage.js"), {
    namedExports: {
      buildTutorOptions: () => ({}), sendTutorOptions: noop,
      buildTutorCard: () => ({ templateVars: {}, messageBody: "" }), TUTOR_CARD_TEMPLATE: "tutor_option_card_1",
    },
  });
  mock.module(modulePath("utils/topThreeScheduler.js"), { namedExports: { WAIT_HOURS: 7 } });
  mock.module(modulePath("utils/matchingEngine.js"), {
    namedExports: { buildCentralizedQuery: () => ({}), calculateTutorScore: () => ({}), compareTutors: () => 0, parseAddress: () => ({}) },
  });
  mock.module(modulePath("utils/recommendationEngine.js"), {
    namedExports: { getRecommendations: async () => [], buildParamsFromLead: () => ({}) },
  });
  mock.module(modulePath("utils/adminAlerts.js"), { namedExports: { notifyAdminOfNewEnquiry: noop } });
  mock.module(modulePath("utils/geoLookup.js"), { namedExports: { resolveGeo: async () => ({}) } });
  mock.module(modulePath("middleware/authMiddleware.js"), {
    namedExports: { verifyToken: () => (req, res, next) => next() },
  });
  globalThis.fetch = async () => { throw new Error("Network access is disabled in tests"); };
});

beforeEach(() => {
  sent.length = 0;
  lead = freshLead();
  delete process.env.ASSIGN_TUTOR_SENDS_WHATSAPP;
});

let handler;
async function assign(body) {
  if (!handler) {
    const { default: router } = await import(modulePath("routes/parentEnquiryRoutes.js"));
    const layer = router.stack.find((l) => l.route?.path === "/:id/assign-tutor" && l.route.methods.post);
    handler = layer.route.stack.at(-1).handle;
  }
  const res = {
    statusCode: 200, payload: null,
    status(c) { this.statusCode = c; return this; },
    json(d) { this.payload = d; return this; },
  };
  await handler({ params: { id: "lead-1" }, body }, res);
  return res;
}

test("dashboard assign records the tutor and sends NO WhatsApp", async () => {
  const res = await assign({ tutorId: "tutor-1" });
  assert.equal(res.statusCode, 200);
  assert.equal(sent.length, 0);
  assert.equal(res.payload.parentDetailsSent, false);
  assert.equal(res.payload.whatsappEnabled, false);
  assert.equal(lead.assignedTutorId, "tutor-1");
  assert.equal(lead.status, "Demo Scheduled");
});

test("no WhatsApp even when a demo date and time are given", async () => {
  await assign({ tutorId: "tutor-1", demoDate: "2026-11-10", demoTime: "17:00" });
  assert.equal(sent.length, 0);
  assert.equal(lead.demoDate, "2026-11-10");
});

test("pressing Assign three times sends nothing", async () => {
  for (let i = 0; i < 3; i++) await assign({ tutorId: "tutor-1" });
  assert.equal(sent.length, 0);
});

test("if sending is switched back on: never without a demo date and time", async () => {
  process.env.ASSIGN_TUTOR_SENDS_WHATSAPP = "true";
  const res = await assign({ tutorId: "tutor-1" });
  assert.equal(sent.length, 0);
  assert.match(res.payload.parentDetailsError, /demo date and time/);
});

test("if sending is switched back on: once per tutor, not on every press", async () => {
  process.env.ASSIGN_TUTOR_SENDS_WHATSAPP = "true";
  await assign({ tutorId: "tutor-1", demoDate: "2026-11-10", demoTime: "17:00" });
  await assign({ tutorId: "tutor-1", demoDate: "2026-11-10", demoTime: "17:00" });
  await assign({ tutorId: "tutor-1", demoDate: "2026-11-10", demoTime: "17:00" });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].templateVars.demo_slot, "2026-11-10 at 17:00");
});

// ── select-tutor: the automatic message when the PARENT picks from the top 3 ──
let selectHandler;
async function select(body) {
  if (!selectHandler) {
    const { default: router } = await import(modulePath("routes/parentEnquiryRoutes.js"));
    const layer = router.stack.find((l) => l.route?.path === "/:id/select-tutor" && l.route.methods.post);
    selectHandler = layer.route.stack.at(-1).handle;
  }
  const res = {
    statusCode: 200, payload: null,
    status(c) { this.statusCode = c; return this; },
    json(d) { this.payload = d; return this; },
  };
  await selectHandler({ params: { id: "lead-1" }, body }, res);
  return res;
}

test("select-tutor fills demo_confirmation_tutor's five slots in order (subject is not the location)", async () => {
  delete process.env.WHATSAPP_SELECTION_TEMPLATE_NAME;
  const res = await select({ tutorId: "tutor-1" });
  assert.equal(res.statusCode, 200);
  assert.equal(sent.length, 1); // mocked: nothing leaves the test
  assert.equal(sent[0].templateName, "demo_confirmation_tutor");
  assert.deepEqual(Object.values(sent[0].templateVars), [
    "Test Tutor",   // {{1}}
    "REQ-TEST",     // {{2}} ID
    "Grade 10",     // {{3}}
    "Mathematics",  // {{4}} subject
    "Area, City",   // {{5}} location
  ]);
  assert.match(sent[0].messageBody, /^Hello \*Test Tutor's - Demo Selection Update!\*/);
  assert.match(sent[0].messageBody, /The parent \*\(ID - REQ-TEST\)\*/);
});

test("select-tutor pressed twice for the same tutor tells them once", async () => {
  await select({ tutorId: "tutor-1" });
  await select({ tutorId: "tutor-1" });
  assert.equal(sent.length, 1);
});
