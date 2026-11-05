// The dashboard's Edit form: PATCH /parent-enquiries/:id/details with parent, student
// and plan details. Every model and outside service is mocked; nothing can reach
// Odoo, WhatsApp, MongoDB or the network.
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { parseEnquiryDetails, deriveEnquiryFields, joinStudentNames } from "../../utils/enquiryDetails.js";

const modulePath = (rel) => new URL(`../../${rel}`, import.meta.url).href;

let lead;
let leadUpdates;
let attendanceRenames;
let assignmentRenames;
let odooCalls;
let messagesSent;
let odooShouldFail;

function freshLead(extra = {}) {
  return {
    _id: "lead-1",
    requirementId: "REQ-TEST",
    parentName: "Old Parent",
    phone: "9000000001",
    wards: [{ studentName: "Asha", classGrade: "8" }],
    planType: "advance",
    daysPerWeek: 3,
    hoursPerDay: 1.5,
    monthlyFees: 7500,
    finalPrice: 7500,
    totalClasses: 12,
    odooLeadId: 42,
    toObject() { return { ...this }; },
    ...extra,
  };
}

before(() => {
  mock.module(modulePath("models/ParentEnquiry.js"), {
    defaultExport: {
      findById: async () => lead,
      findByIdAndUpdate: async (id, update) => {
        leadUpdates.push(update);
        if (!lead) return null;
        lead = { ...lead, ...update };
        return lead;
      },
    },
  });
  mock.module(modulePath("models/Attendance.js"), {
    defaultExport: { updateMany: async (filter, update) => { attendanceRenames.push({ filter, update }); } },
  });
  mock.module(modulePath("models/Assignment.js"), {
    defaultExport: { updateMany: async (filter, update) => { assignmentRenames.push({ filter, update }); } },
  });
  for (const m of ["ParentEnquiryDraft", "AnalyticsLog", "TutorRegistrationDraft", "Enquiry", "Booking", "BroadcastLog", "Tutor"]) {
    mock.module(modulePath(`models/${m}.js`), { defaultExport: class {} });
  }
  const noop = async () => null;
  mock.module(modulePath("utils/odooService.js"), {
    namedExports: {
      createLead: async (data) => {
        odooCalls.push(data);
        if (odooShouldFail) throw new Error("Odoo is down");
        return { id: data.odooLeadId };
      },
      updateLead: noop, updateLeadAssignment: noop, syncTutorStats: noop, addOdooChatterMessage: noop,
    },
  });
  mock.module(modulePath("utils/whatsappService.js"), {
    namedExports: {
      sendWhatsAppToTutor: async (opts) => { messagesSent.push(opts); return { success: true }; },
      buildBroadcastMessage: () => "", buildAssignmentMessage: () => "",
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
  lead = freshLead();
  leadUpdates = [];
  attendanceRenames = [];
  assignmentRenames = [];
  odooCalls = [];
  messagesSent = [];
  odooShouldFail = false;
});

let handler;
async function patch(body) {
  if (!handler) {
    const { default: router } = await import(modulePath("routes/parentEnquiryRoutes.js"));
    const layer = router.stack.find((l) => l.route?.path === "/:id/details" && l.route.methods.patch);
    handler = layer.route.stack.at(-1).handle;
  }
  const res = {
    statusCode: 200, payload: null,
    status(c) { this.statusCode = c; return this; },
    json(d) { this.payload = d; return this; },
  };
  await handler({ params: { id: "lead-1" }, body }, res);
  // The Odoo sync runs on the next turn of the event loop
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  return res;
}

// ---- Validation ----

test("only the fields sent come back", () => {
  assert.deepEqual(parseEnquiryDetails({ status: "Won", adminNotes: "x" }).value, {});
  assert.deepEqual(parseEnquiryDetails({ parentName: "  Meera  " }).value, { parentName: "Meera" });
});

test("parent name and phone can't be blanked", () => {
  assert.match(parseEnquiryDetails({ parentName: "   " }).error, /Parent name/);
  assert.match(parseEnquiryDetails({ phone: "" }).error, /phone/i);
  assert.match(parseEnquiryDetails({ phone: "12345" }).error, /phone/i);
  assert.equal(parseEnquiryDetails({ phone: "+91 90000 00002" }).value.phone, "+91 90000 00002");
});

test("email is checked, lowercased and may be cleared", () => {
  assert.match(parseEnquiryDetails({ email: "not-an-email" }).error, /email/i);
  assert.equal(parseEnquiryDetails({ email: " Meera@Example.COM " }).value.email, "meera@example.com");
  assert.equal(parseEnquiryDetails({ email: "" }).value.email, "");
});

test("non-text values are refused, not stored", () => {
  assert.ok(parseEnquiryDetails({ parentName: { $ne: "" } }).error);
  assert.ok(parseEnquiryDetails({ phone: 9000000001 }).error);
  assert.ok(parseEnquiryDetails({ city: ["x"] }).error);
  assert.ok(parseEnquiryDetails({ preferredDays: "Monday" }).error);
});

test("numbers arrive as text from the form and blanks save as empty", () => {
  const { value } = parseEnquiryDetails({ daysPerWeek: "5", hoursPerDay: "1.5", monthlyFees: "", totalClasses: "20" });
  assert.deepEqual(value, { daysPerWeek: 5, hoursPerDay: 1.5, monthlyFees: null, totalClasses: 20 });
});

test("bad numbers and unknown plans are refused", () => {
  assert.match(parseEnquiryDetails({ monthlyFees: "-1" }).error, /Monthly fee/);
  assert.match(parseEnquiryDetails({ monthlyFees: "abc" }).error, /Monthly fee/);
  assert.match(parseEnquiryDetails({ totalClasses: "1.5" }).error, /Classes per package/);
  assert.match(parseEnquiryDetails({ daysPerWeek: "9" }).error, /Days per week/);
  assert.match(parseEnquiryDetails({ planType: "platinum" }).error, /plan/);
  assert.equal(parseEnquiryDetails({ planType: "" }).value.planType, "");
});

test("students need a name and at least one must remain", () => {
  assert.match(parseEnquiryDetails({ wards: [] }).error, /at least one/);
  assert.match(parseEnquiryDetails({ wards: [{ studentName: "A" }, { studentName: " " }] }).error, /Student 2/);
});

test("student fields are cleaned and unknown ones dropped", () => {
  const { value } = parseEnquiryDetails({
    wards: [{ studentName: " Asha ", classGrade: "9", subjectsNeeded: [" Physics ", ""], isAdmin: true }],
  });
  assert.deepEqual(value.wards, [{ studentName: "Asha", classGrade: "9", subjectsNeeded: ["Physics"] }]);
});

test("timing: fixed needs a valid range and fills the slot text; flexible clears the clock times", () => {
  assert.deepEqual(parseEnquiryDetails({ classTimingType: "Fixed Timing", startTime: "17:00", endTime: "18:30" }).value, {
    classTimingType: "Fixed Timing", startTime: "17:00", endTime: "18:30", classTimingSlot: "5:00 PM – 6:30 PM",
  });
  assert.deepEqual(parseEnquiryDetails({ classTimingType: "Flexible", startTime: "17:00", endTime: "18:30" }).value, {
    classTimingType: "Flexible", startTime: "", endTime: "", classTimingSlot: "Flexible",
  });
  assert.match(parseEnquiryDetails({ classTimingType: "Fixed Timing", startTime: "18:00", endTime: "17:00" }).error, /after the start/);
  assert.ok(parseEnquiryDetails({ classTimingType: "Fixed Timing", startTime: "", endTime: "" }).error);
  assert.ok(parseEnquiryDetails({ startTime: "17:00", endTime: "18:00" }).error);
});

// ---- Derived fields ----

test("a plan edit rewrites the plan text the same way the enquiry form builds it", () => {
  const derived = deriveEnquiryFields({ daysPerWeek: 5, hoursPerDay: 2 }, freshLead());
  assert.equal(derived.preferredTime, "5 Days • 2 Hr (ADVANCE)");
  assert.equal(derived.classDuration, "2 Hr");
});

test("an edit away from the plan leaves plan text and duration alone", () => {
  assert.deepEqual(deriveEnquiryFields({ parentName: "Meera" }, freshLead({ classDuration: "1.5 Hours" })), {});
});

test("a typed fee updates the final price and drops the old breakdown", () => {
  assert.deepEqual(deriveEnquiryFields({ monthlyFees: 6000 }, freshLead()), {
    finalPrice: 6000, totalBaseFee: 6000, siblingDiscount: 0, siblingConcessionPercent: 0, studentFees: [],
  });
});

test("a fee sent with its breakdown keeps that breakdown", () => {
  const details = { monthlyFees: 9000, totalBaseFee: 12000, siblingDiscount: 3000, siblingConcessionPercent: 25, studentFees: [6000, 6000] };
  assert.deepEqual(deriveEnquiryFields(details, freshLead()), { finalPrice: 9000 });
});

test("clearing the plan falls back to the class time for the preferred time", () => {
  const derived = deriveEnquiryFields({ planType: "" }, freshLead({ classTimingSlot: "5:00 PM – 6:30 PM" }));
  assert.equal(derived.preferredTime, "5:00 PM – 6:30 PM");
  assert.equal(deriveEnquiryFields({ planType: "" }, freshLead({ classTimingSlot: "Flexible" })).preferredTime, "");
});

test("without a plan, a fixed time sets the class duration", () => {
  const derived = deriveEnquiryFields(
    { classTimingType: "Fixed Timing", startTime: "17:00", endTime: "18:30", classTimingSlot: "5:00 PM – 6:30 PM" },
    freshLead({ planType: "", hoursPerDay: null })
  );
  assert.equal(derived.classDuration, "1.5 Hours");
  assert.equal(derived.preferredTime, "5:00 PM – 6:30 PM");
});

test("student names join the way attendance records store them", () => {
  assert.equal(joinStudentNames([{ studentName: "Asha" }, { studentName: "Ravi" }]), "Asha, Ravi");
  assert.equal(joinStudentNames(undefined), "");
});

// ---- Route ----

test("saves the edit, syncs the linked Odoo lead, and messages nobody", async () => {
  const res = await patch({ parentName: "Meera", phone: "9000000002", email: "Meera@Example.com" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.parentName, "Meera");
  assert.equal(res.payload.phone, "9000000002");
  assert.equal(res.payload.email, "meera@example.com");

  assert.equal(odooCalls.length, 1);
  assert.equal(odooCalls[0].parentName, "Meera");
  assert.equal(odooCalls[0].phone, "9000000002");
  assert.equal(odooCalls[0].odooLeadId, 42);
  assert.equal(odooCalls[0].userType, "parent");
  assert.equal(lead.odooSyncStatus, "synced");
  assert.equal(messagesSent.length, 0);
});

test("invalid details save nothing", async () => {
  const res = await patch({ parentName: "Meera", phone: "123" });
  assert.equal(res.statusCode, 400);
  assert.match(res.payload.message, /phone/i);
  assert.equal(leadUpdates.length, 0);
  assert.equal(odooCalls.length, 0);
});

test("a missing enquiry is a 404", async () => {
  lead = null;
  const res = await patch({ parentName: "Meera" });
  assert.equal(res.statusCode, 404);
  assert.equal(leadUpdates.length, 0);
});

test("a failed Odoo sync keeps the edit and shows on the lead", async () => {
  odooShouldFail = true;
  const res = await patch({ parentName: "Meera" });
  assert.equal(res.statusCode, 200);
  assert.equal(lead.parentName, "Meera");
  assert.equal(lead.odooSyncStatus, "failed");
  assert.equal(lead.odooSyncError, "Odoo is down");
});

test("a lead not linked to Odoo is saved without a sync", async () => {
  lead = freshLead({ odooLeadId: null });
  const res = await patch({ parentName: "Meera" });
  assert.equal(res.statusCode, 200);
  assert.equal(odooCalls.length, 0);
  assert.equal(leadUpdates[0].odooSyncStatus, undefined);
});

test("a corrected student name reaches attendance and assignment records", async () => {
  await patch({ wards: [{ studentName: "Aasha", classGrade: "8" }] });
  assert.deepEqual(attendanceRenames, [{ filter: { parentEnquiryId: "lead-1" }, update: { studentName: "Aasha" } }]);
  assert.deepEqual(assignmentRenames, [{ filter: { parentEnquiryId: "lead-1" }, update: { studentName: "Aasha" } }]);
});

test("changing a student's class alone leaves those records alone", async () => {
  await patch({ wards: [{ studentName: "Asha", classGrade: "9" }] });
  assert.equal(attendanceRenames.length, 0);
  assert.equal(assignmentRenames.length, 0);
  assert.equal(odooCalls.length, 1);
});

test("a request with nothing editable saves nothing", async () => {
  const res = await patch({ status: "Won" });
  assert.equal(res.statusCode, 400);
  assert.equal(leadUpdates.length, 0);
  assert.equal(odooCalls.length, 0);
});

test("status, tutor and IDs can't be changed through this route", async () => {
  await patch({ parentName: "Meera", status: "Won", assignedTutor: "Someone", requirementId: "REQ-1", archived: true });
  assert.deepEqual(Object.keys(leadUpdates[0]).sort(), ["odooSyncStatus", "parentName"]);
});
