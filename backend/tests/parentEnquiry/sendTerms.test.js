// POST /:id/send-terms from the admin dashboard: the Terms & Conditions
// template to the parent. Every model and outside service is mocked; nothing
// can reach Odoo, WhatsApp, MongoDB or the network.
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

const modulePath = (rel) => new URL(`../../${rel}`, import.meta.url).href;

let lead;
let sends;
let sendResult;
let notes;

function freshLead(extra = {}) {
  return {
    _id: "lead-1",
    requirementId: "REQ-TEST",
    parentName: "Meera",
    phone: "9876543210",
    assignedTutor: "Test Tutor",
    assignedTutorId: "tutor-1",
    odooLeadId: 42,
    termsSentAt: null,
    termsSentBy: "",
    saves: 0,
    async save() { this.saves += 1; return this; },
    ...extra,
  };
}

before(() => {
  mock.module(modulePath("models/ParentEnquiry.js"), {
    defaultExport: { findById: async () => lead, find: async () => [], findByIdAndUpdate: async () => lead },
  });
  for (const m of ["Tutor", "BroadcastLog", "ParentEnquiryDraft", "Attendance", "Assignment", "AnalyticsLog", "TutorRegistrationDraft", "Enquiry", "Booking"]) {
    mock.module(modulePath(`models/${m}.js`), { defaultExport: class {} });
  }
  const noop = async () => null;
  mock.module(modulePath("utils/odooService.js"), {
    namedExports: {
      createLead: noop, updateLead: noop, updateLeadAssignment: noop, syncTutorStats: noop,
      addOdooChatterMessage: async (id, msg) => { notes.push({ id, msg }); },
    },
  });
  mock.module(modulePath("utils/whatsappService.js"), {
    namedExports: {
      sendWhatsAppToTutor: async (opts) => { sends.push(opts); return sendResult; },
      buildBroadcastMessage: () => "", buildAssignmentMessage: () => "",
      buildOnboardingMessage: () => "", isPermanentFailure: () => false,
      getOdooUid: async () => { throw new Error("must not talk to Odoo directly"); },
      callOdooMethod: async () => { throw new Error("must not talk to Odoo directly"); },
      buildRequirementTemplateVarsV3: () => ({}),
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
  lead = freshLead();
  sends = [];
  notes = [];
  sendResult = { success: true, messageId: "77", usedTemplate: true };
  delete process.env.WHATSAPP_TERMS_TEMPLATE_NAME;
});

let handler;
async function sendTerms(body = {}) {
  if (!handler) {
    const { default: router } = await import(modulePath("routes/parentEnquiryRoutes.js"));
    const layer = router.stack.find((l) => l.route?.path === "/:id/send-terms" && l.route.methods.post);
    handler = layer.route.stack.at(-1).handle;
  }
  const res = {
    statusCode: 200, payload: null,
    status(c) { this.statusCode = c; return this; },
    json(d) { this.payload = d; return this; },
  };
  await handler({ params: { id: "lead-1" }, body, user: { email: "admin@example.com" } }, res);
  for (let i = 0; i < 3; i++) await new Promise((resolve) => setImmediate(resolve));
  return res;
}

test("sends Odoo's terms_conditions template to the parent's phone", async () => {
  const res = await sendTerms();
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.sent, true);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].phoneNumber, "9876543210");
  assert.equal(sends[0].templateName, "terms_conditions");
  assert.equal(sends[0].forceTemplate, true);
  assert.deepEqual(sends[0].templateVars, {});
});

test("records when and by whom, and notes it on the Odoo lead", async () => {
  const res = await sendTerms();
  assert.ok(lead.termsSentAt instanceof Date);
  assert.equal(lead.termsSentBy, "admin@example.com");
  assert.equal(lead.saves, 1);
  assert.equal(res.payload.termsSentBy, "admin@example.com");
  assert.equal(notes.length, 1);
  assert.equal(notes[0].id, 42);
  assert.match(notes[0].msg, /Terms & Conditions sent/);
});

test("the template name can be changed without a code change", async () => {
  process.env.WHATSAPP_TERMS_TEMPLATE_NAME = "terms_conditions_v2";
  await sendTerms();
  assert.equal(sends[0].templateName, "terms_conditions_v2");
});

test("no tutor assigned: refused, nothing sent", async () => {
  lead = freshLead({ assignedTutor: "", assignedTutorId: null });
  const res = await sendTerms();
  assert.equal(res.statusCode, 400);
  assert.match(res.payload.message, /Assign a tutor first/);
  assert.equal(sends.length, 0);
});

test("no phone: refused, nothing sent", async () => {
  lead = freshLead({ phone: "" });
  const res = await sendTerms();
  assert.equal(res.statusCode, 400);
  assert.equal(sends.length, 0);
});

test("a template still in Draft says to submit it for approval, and records nothing", async () => {
  sendResult = { success: false, failureReason: "Template Deleted or Inactive" };
  const res = await sendTerms();
  assert.equal(res.statusCode, 502);
  assert.equal(res.payload.sent, false);
  assert.match(res.payload.message, /isn't approved in Odoo yet.*Submit for Approval/);
  assert.equal(lead.termsSentAt, null);
  assert.equal(lead.saves, 0);
  assert.equal(notes.length, 0);
});

test("any other WhatsApp failure is passed on", async () => {
  sendResult = { success: false, failureReason: "Invalid Number" };
  const res = await sendTerms();
  assert.equal(res.statusCode, 502);
  assert.match(res.payload.message, /Invalid Number/);
});

test("a dry run sends nothing", async () => {
  const res = await sendTerms({ dryRun: true });
  assert.equal(res.payload.dryRun, true);
  assert.equal(res.payload.templateName, "terms_conditions");
  assert.equal(sends.length, 0);
  assert.equal(lead.saves, 0);
});

test("a lead not linked to Odoo still sends, with no note", async () => {
  lead = freshLead({ odooLeadId: null });
  const res = await sendTerms();
  assert.equal(res.payload.sent, true);
  assert.equal(notes.length, 0);
});
