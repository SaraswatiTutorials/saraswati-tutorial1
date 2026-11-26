// POST /:id/send-feedback from the admin panel ("Send feedback form" on a parent
// enquiry): the admin writes the tutor who went for the demo and the parent
// gets the Tutor Feedback template. Every model and outside service is
// mocked; nothing can reach Odoo, WhatsApp, MongoDB or the network.
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

const modulePath = (rel) => new URL(`../../${rel}`, import.meta.url).href;

let lead, sends, sendResult, notes, calls, feedbackResult;

function freshLead(extra = {}) {
  return { _id: "lead-1", requirementId: "REQ-TEST", parentName: "Meera", phone: "9876543210",
    assignedTutor: "", assignedTutorId: null, async save() { return this; }, ...extra };
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
      prepareTutorCards: async () => [], sendTutorCards: async () => ({ sent: 0, results: [] }), chooseCardTemplate: async () => "tutor_profile_card",
    },
  });
  mock.module(modulePath("utils/tutorFeedback.js"), {
    namedExports: { sendFeedbackLink: async (l, opts) => { calls.push(opts); return feedbackResult(opts); } },
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
  sends = []; notes = []; calls = [];
  sendResult = { success: true };
  feedbackResult = (opts) => (opts.dryRun
    ? { ok: true, dryRun: true, willSend: true, tutorName: opts.tutorName, templateName: "tutor_feedback_request", templateApproved: true }
    : { ok: true, dryRun: false, sent: true, tutorName: opts.tutorName });
});

let handler;
async function sendFeedback(body = {}) {
  if (!handler) {
    const { default: router } = await import(modulePath("routes/parentEnquiryRoutes.js"));
    const layer = router.stack.find((l) => l.route?.path === "/:id/send-feedback" && l.route.methods.post);
    handler = layer.route.stack.at(-1).handle;
  }
  const res = { statusCode: 200, payload: null,
    status(c) { this.statusCode = c; return this; }, json(d) { this.payload = d; return this; } };
  await handler({ params: { id: "lead-1" }, body, user: { email: "admin@example.com" } }, res);
  return res;
}

test("needs the name of the tutor who went for the demo", async () => {
  const res = await sendFeedback({ tutorName: "   " });
  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0);
});

test("checks first by default (dry run): nothing is sent", async () => {
  const res = await sendFeedback({ tutorName: "Niraj Kumar Singh" });
  assert.equal(res.statusCode, 200);
  assert.equal(calls[0].dryRun, true);
  assert.equal(res.payload.templateName, "tutor_feedback_request");
  assert.equal(sends.length, 0);
});

test("sends with the typed tutor and the picked tutor id", async () => {
  const res = await sendFeedback({ tutorName: "Niraj Kumar Singh", tutorId: "t29", dryRun: false });
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.sent, true);
  assert.deepEqual(calls[0], { dryRun: false, resend: false, tutorId: "t29", tutorName: "Niraj Kumar Singh" });
});

test("a blocked send (e.g. parent already answered) is a 409 with the reason", async () => {
  feedbackResult = () => ({ ok: false, blocked: true, reason: "Meera already gave feedback on Niraj." });
  const res = await sendFeedback({ tutorName: "Niraj", dryRun: false });
  assert.equal(res.statusCode, 409);
  assert.match(res.payload.message, /already gave feedback/);
});

test("a failed WhatsApp send is reported, not hidden", async () => {
  feedbackResult = () => ({ ok: true, sent: false, willSend: true, failureReason: "template not approved" });
  const res = await sendFeedback({ tutorName: "Niraj", dryRun: false });
  assert.equal(res.statusCode, 502);
  assert.match(res.payload.message, /not approved/);
});

test("unknown enquiry is a 404", async () => {
  lead = null;
  const res = await sendFeedback({ tutorName: "Niraj", dryRun: false });
  assert.equal(res.statusCode, 404);
});
