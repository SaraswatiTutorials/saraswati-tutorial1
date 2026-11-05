// POST /:id/unassign-tutor from the admin dashboard. Every model and outside
// service is mocked; nothing can reach Odoo, WhatsApp, MongoDB or the network.
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

const modulePath = (rel) => new URL(`../../${rel}`, import.meta.url).href;

let lead;
let tutor;
let logUpdates;
let odooWrites;
let statusSyncs;
let statsSyncs;
let leadUpdates;
let messagesSent;
let odooWriteFails;

function freshLead(extra = {}) {
  return {
    _id: "lead-1",
    requirementId: "REQ-TEST",
    parentName: "Meera",
    assignedTutor: "Test Tutor",
    assignedTutorId: "tutor-1",
    status: "Demo Scheduled",
    demoDate: "2026-11-10",
    demoTime: "17:00",
    odooLeadId: 42,
    saves: 0,
    async save() { this.saves += 1; return this; },
    ...extra,
  };
}

before(() => {
  mock.module(modulePath("models/ParentEnquiry.js"), {
    defaultExport: {
      findById: async () => lead,
      find: async () => [],
      findByIdAndUpdate: async (id, update) => { leadUpdates.push(update); return lead; },
    },
  });
  mock.module(modulePath("models/Tutor.js"), { defaultExport: { findById: async () => tutor } });
  mock.module(modulePath("models/BroadcastLog.js"), {
    defaultExport: { updateMany: async (filter, update) => { logUpdates.push({ filter, update }); } },
  });
  for (const m of ["ParentEnquiryDraft", "Attendance", "Assignment", "AnalyticsLog", "TutorRegistrationDraft", "Enquiry", "Booking"]) {
    mock.module(modulePath(`models/${m}.js`), { defaultExport: class {} });
  }
  const noop = async () => null;
  mock.module(modulePath("utils/odooService.js"), {
    namedExports: {
      createLead: noop,
      updateLead: async (id, values) => { statusSyncs.push({ id, values }); return true; },
      updateLeadAssignment: async () => { throw new Error("must not be used to clear a tutor"); },
      syncTutorStats: async (id) => { statsSyncs.push(id); },
      addOdooChatterMessage: noop,
    },
  });
  mock.module(modulePath("utils/whatsappService.js"), {
    namedExports: {
      sendWhatsAppToTutor: async (opts) => { messagesSent.push(opts); return { success: true }; },
      buildBroadcastMessage: () => "", buildAssignmentMessage: () => "",
      buildOnboardingMessage: () => "", isPermanentFailure: () => false,
      getOdooUid: async () => 7,
      callOdooMethod: async (uid, model, method, args) => {
        if (odooWriteFails) throw new Error("Odoo is down");
        odooWrites.push({ uid, model, method, args });
      },
      buildRequirementTemplateVarsV3: () => ({}),
      chooseRequirementTemplate: async () => ({ templateName: "x", buildVars: () => ({}) }),
    },
  });
  mock.module(modulePath("utils/tutorOptionsMessage.js"), {
    namedExports: {
      buildTutorOptions: () => ({}), sendTutorOptions: async (...args) => { messagesSent.push(args); },
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
  tutor = { _id: "tutor-1", name: "Test Tutor", odooLeadId: 99 };
  logUpdates = [];
  odooWrites = [];
  statusSyncs = [];
  statsSyncs = [];
  leadUpdates = [];
  messagesSent = [];
  odooWriteFails = false;
});

let handler;
async function unassign() {
  if (!handler) {
    const { default: router } = await import(modulePath("routes/parentEnquiryRoutes.js"));
    const layer = router.stack.find((l) => l.route?.path === "/:id/unassign-tutor" && l.route.methods.post);
    handler = layer.route.stack.at(-1).handle;
  }
  const res = {
    statusCode: 200, payload: null,
    status(c) { this.statusCode = c; return this; },
    json(d) { this.payload = d; return this; },
  };
  await handler({ params: { id: "lead-1" }, body: {}, user: { email: "admin@example.com" } }, res);
  // The Odoo sync runs on the next turns of the event loop
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
  return res;
}

test("clears the tutor and the demo, and records who removed them", async () => {
  const res = await unassign();
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.tutorName, "Test Tutor");
  assert.equal(lead.assignedTutor, "");
  assert.equal(lead.assignedTutorId, null);
  assert.equal(lead.demoDate, "");
  assert.equal(lead.demoTime, "");
  assert.equal(lead.tutorUnassignedFrom, "Test Tutor");
  assert.equal(lead.tutorUnassignedBy, "admin@example.com");
  assert.ok(lead.tutorUnassignedAt instanceof Date);
  assert.equal(lead.saves, 1);
});

test("messages nobody", async () => {
  await unassign();
  assert.equal(messagesSent.length, 0);
});

for (const status of ["Demo Scheduled", "Feedback Pending"]) {
  test(`${status} goes back to New Lead, and Odoo hears about it`, async () => {
    lead = freshLead({ status });
    await unassign();
    assert.equal(lead.status, "New Lead");
    assert.deepEqual(statusSyncs, [{ id: 42, values: { status: "New Lead" } }]);
  });
}

for (const status of ["Enrolled", "Won", "Fees Finalized", "Lost", "Rejected", "Demo Cancelled", "New Lead"]) {
  test(`${status} stays as it is`, async () => {
    lead = freshLead({ status });
    await unassign();
    assert.equal(lead.status, status);
    assert.equal(statusSyncs.length, 0);
  });
}

test("only that tutor's Assigned log is reset", async () => {
  await unassign();
  assert.deepEqual(logUpdates, [{
    filter: { leadId: "lead-1", tutorId: "tutor-1", responseStatus: "Assigned" },
    update: { $set: { responseStatus: "No Response" } },
  }]);
});

test("clears the tutor fields on the linked Odoo lead and marks it synced", async () => {
  await unassign();
  assert.equal(odooWrites.length, 1);
  const { model, method, args } = odooWrites[0];
  assert.equal(model, "crm.lead");
  assert.equal(method, "write");
  assert.deepEqual(args[0], [42]);
  assert.deepEqual(args[1], {
    x_studio_assigned_tutor: false,
    x_studio_tutor_code: false,
    x_studio_assigned_tutor_phone: false,
    x_studio_demo_date: false,
    x_studio_demo_time: false,
  });
  assert.equal(leadUpdates.at(-1).odooSyncStatus, "synced");
  assert.deepEqual(statsSyncs, [99]);
});

test("an Odoo failure keeps the removal and shows on the lead", async () => {
  odooWriteFails = true;
  const res = await unassign();
  assert.equal(res.statusCode, 200);
  assert.equal(lead.assignedTutorId, null);
  assert.equal(leadUpdates.at(-1).odooSyncStatus, "failed");
  assert.match(leadUpdates.at(-1).odooSyncError, /Tutor removed here.*Odoo is down/);
});

test("a lead not linked to Odoo isn't sent there", async () => {
  lead = freshLead({ odooLeadId: null });
  const res = await unassign();
  assert.equal(res.statusCode, 200);
  assert.equal(odooWrites.length, 0);
  assert.equal(statusSyncs.length, 0);
  assert.equal(leadUpdates.length, 0);
});

test("an older lead with only a tutor name can be unassigned", async () => {
  lead = freshLead({ assignedTutorId: null });
  const res = await unassign();
  assert.equal(res.statusCode, 200);
  assert.equal(lead.assignedTutor, "");
  assert.equal(logUpdates.length, 0);
});

test("a student with no tutor is refused and nothing changes", async () => {
  lead = freshLead({ assignedTutor: "", assignedTutorId: null });
  const res = await unassign();
  assert.equal(res.statusCode, 400);
  assert.equal(lead.saves, 0);
  assert.equal(odooWrites.length, 0);
});

test("a missing lead is a 404", async () => {
  lead = null;
  const res = await unassign();
  assert.equal(res.statusCode, 404);
});
