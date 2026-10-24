// Automatic package cycles (1 cycle = 1 month): POST /api/attendance/mark and the
// daily rollover, with every model and external service mocked. No MongoDB
// connection, Odoo call or real WhatsApp message can happen.
import { test, describe, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

const modulePath = (rel) => new URL(`../../${rel}`, import.meta.url).href;

// ── In-memory stores ──────────────────────────────────────────────
let logs = [];
let leads = new Map();
let whatsappSent = [];

const matches = (doc, q) =>
  Object.entries(q).every(([key, cond]) => {
    if (key === "$or") return cond.some((sub) => matches(doc, sub));
    const value = doc[key];
    if (cond && typeof cond === "object" && !Array.isArray(cond)) {
      if ("$exists" in cond) return cond.$exists ? value !== undefined : value === undefined;
      if ("$nin" in cond) return !cond.$nin.includes(value);
      if ("$in" in cond) return cond.$in.includes(value);
      if ("$gt" in cond) return value != null && value > cond.$gt;
      if ("$ne" in cond) return value !== cond.$ne;
    }
    return cond === null ? value == null : String(value) === String(cond);
  });

class Query {
  constructor(rows, single) { this.rows = rows; this.single = single; }
  sort() { this.rows = [...this.rows].sort((a, b) => a.date.localeCompare(b.date)); return this; }
  select() { return this; }
  lean() { return this; }
  then(resolve, reject) { return Promise.resolve(this.single ? this.rows[0] || null : this.rows).then(resolve, reject); }
}

let nextId = 1;
class FakeAttendance {
  constructor(doc) { Object.assign(this, doc); this._id = `att-${nextId++}`; }
  async save() { if (!logs.includes(this)) logs.push(this); return this; }
  static find(q) { return new Query(logs.filter((l) => matches(l, q)), false); }
  static findOne(q) { return new Query(logs.filter((l) => matches(l, q)), true); }
  static async exists(q) { return logs.some((l) => matches(l, q)) ? { _id: 1 } : null; }
  static async countDocuments(q) { return logs.filter((l) => matches(l, q)).length; }
  static async findById(id) { return logs.find((l) => l._id === id) || null; }
  static async findByIdAndDelete(id) { logs = logs.filter((l) => l._id !== id); }
}

class FakeParentEnquiry {
  static async findById(id) { return leads.get(String(id)) || null; }
  static find(q) { return new Query([...leads.values()].filter((l) => matches(l, q)), false); }
}

const tutor = { _id: "tutor-1", name: "Tutor One" };
const noop = async () => null;

before(() => {
  mock.module(modulePath("models/Attendance.js"), { defaultExport: FakeAttendance });
  mock.module(modulePath("models/ParentEnquiry.js"), { defaultExport: FakeParentEnquiry });
  mock.module(modulePath("models/Tutor.js"), { defaultExport: { findById: async () => tutor } });
  mock.module(modulePath("models/BroadcastLog.js"), { defaultExport: class {} });
  mock.module(modulePath("utils/odooService.js"), {
    namedExports: {
      updateLead: noop, syncAttendanceLogToOdoo: noop, syncLeadAttendanceSummaryToOdoo: noop,
      deleteOdooAttendanceLog: noop,
    },
  });
  mock.module(modulePath("utils/whatsappService.js"), {
    namedExports: {
      sendWhatsAppToTutor: async (opts) => { whatsappSent.push(opts); return { success: true }; },
    },
  });
  mock.module(modulePath("utils/broadcastService.js"), {
    namedExports: { broadcastService: {}, RETRYABLE_FAILURE_REASONS: [] },
  });
  mock.module(modulePath("utils/syncService.js"), { namedExports: { startSyncScheduler: noop } });
  mock.module(modulePath("middleware/authMiddleware.js"), {
    namedExports: { verifyToken: () => (req, res, next) => next() },
  });
  globalThis.fetch = async () => { throw new Error("Network access is disabled in tests"); };
});

// ── Helpers ───────────────────────────────────────────────────────
const fmt = (d) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const daysAgo = (n) => fmt(new Date(Date.now() - n * 86400000));

function makeLead(overrides = {}) {
  const lead = {
    _id: "lead-1",
    parentName: "Parent",
    phone: "9999999999",
    wards: [{ studentName: "Student" }],
    assignedTutorId: "tutor-1",
    status: "Enrolled",
    totalClasses: 12,
    completedClasses: 0,
    currentPackageCycle: 1,
    packageStatus: "active",
    packageHistory: [],
    packageAlertSentForTotal: 0,
    renewalReminderSentForTotal: 0,
    async save() { return this; },
    ...overrides,
  };
  leads.set(lead._id, lead);
  return lead;
}

// `count` logs on consecutive days from `startDate`
function addLogs(startDate, count, { cycle = 1, status = "Done" } = {}) {
  const start = new Date(`${startDate}T00:00:00Z`);
  for (let i = 0; i < count; i++) {
    const d = new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10);
    logs.push(new FakeAttendance({ parentEnquiryId: "lead-1", date: d, status, packageCycle: cycle }));
  }
}

let markHandler;
async function mark(date, status = "Done") {
  if (!markHandler) {
    const { default: router } = await import(modulePath("routes/attendanceRoutes.js"));
    const layer = router.stack.find((l) => l.route?.path === "/mark");
    markHandler = layer.route.stack[layer.route.stack.length - 1].handle;
  }
  const res = {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.payload = data; return this; },
  };
  const body = { parentEnquiryId: "lead-1", tutorId: "tutor-1", status, date, topicsCovered: "Algebra", missedReason: "Sick" };
  await markHandler({ body, headers: {} }, res);
  return res;
}

// Admin routes on /log/:logId
async function adminLog(method, logId, body = {}) {
  const { default: router } = await import(modulePath("routes/attendanceRoutes.js"));
  const layer = router.stack.find((l) => l.route?.path === "/log/:logId" && l.route.methods[method]);
  const handle = layer.route.stack[layer.route.stack.length - 1].handle;
  const res = {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.payload = data; return this; },
  };
  await handle({ params: { logId }, body, headers: {} }, res);
  return res;
}

let scheduler;
async function runRenewalReminderCheck() {
  scheduler ??= await import(modulePath("utils/reminderScheduler.js"));
  await scheduler.checkParentRenewalReminders();
}

beforeEach(() => {
  logs = [];
  leads = new Map();
  whatsappSent = [];
});

// ── Tests ─────────────────────────────────────────────────────────
describe("Cycle ends when all classes are done", () => {
  test("marking the 12th class starts Cycle 2", async () => {
    const lead = makeLead();
    addLogs(daysAgo(11), 11); // 11 done, month still running

    const res = await mark(fmt(new Date()));

    assert.equal(res.statusCode, 200);
    assert.equal(lead.currentPackageCycle, 2);
    assert.equal(lead.completedClasses, 0);
    assert.equal(lead.packageStatus, "active");
    assert.deepEqual(
      lead.packageHistory.map(({ cycle, totalClasses, completedClasses }) => ({ cycle, totalClasses, completedClasses })),
      [{ cycle: 1, totalClasses: 12, completedClasses: 12 }]
    );
    assert.equal(logs.at(-1).packageCycle, 1, "the 12th class belongs to Cycle 1");
    assert.equal(res.payload.message, "Attendance recorded successfully. Month 1 is now completed (12/12 classes)!");
    assert.equal(res.payload.updatedStudentCard.currentPackageCycle, 2);
    assert.equal(whatsappSent.length, 0, "marking attendance sends no WhatsApp itself");
  });

  test("the existing renewal reminder still goes out once for the completed cycle", async () => {
    const lead = makeLead();
    addLogs(daysAgo(11), 11);
    await mark(fmt(new Date()));

    await runRenewalReminderCheck();
    await runRenewalReminderCheck();

    assert.equal(whatsappSent.length, 1);
    assert.match(whatsappSent[0].messageBody, /has been completed \(12\/12 classes completed\)/);
    assert.equal(lead.packageHistory[0].renewalReminderPending, false);
  });

  test("the next class after that is class 1 of Cycle 2", async () => {
    const lead = makeLead();
    addLogs(daysAgo(12), 11);
    await mark(daysAgo(1));
    const res = await mark(fmt(new Date()));

    assert.equal(lead.currentPackageCycle, 2);
    assert.equal(logs.at(-1).packageCycle, 2);
    assert.equal(res.payload.session.sessionNumber, 1);
    assert.equal(res.payload.package.completedClasses, 1);
  });

  test("a cycle already at 12/12 from before auto-advance doesn't get a 13th class", async () => {
    const lead = makeLead({ completedClasses: 12, packageStatus: "completed", renewalReminderSentForTotal: 12 });
    addLogs(daysAgo(14), 12);

    await mark(fmt(new Date()));
    await runRenewalReminderCheck();

    assert.equal(lead.currentPackageCycle, 2);
    assert.equal(logs.at(-1).packageCycle, 2);
    assert.equal(whatsappSent.length, 0, "the parent was already reminded for Cycle 1");
  });
});

describe("Cycle ends when its month is over", () => {
  test("a class after the month ends starts Cycle 2, even with classes missed", async () => {
    const lead = makeLead();
    addLogs("2026-01-05", 8); // month is 5 Jan – 4 Feb

    const res = await mark("2026-02-10");
    await runRenewalReminderCheck();

    assert.equal(lead.currentPackageCycle, 2);
    assert.equal(lead.packageHistory[0].completedClasses, 8);
    assert.equal(logs.at(-1).packageCycle, 2);
    assert.equal(res.payload.session.sessionNumber, 1);
    assert.equal(res.payload.message, "Attendance recorded successfully.");
    assert.equal(whatsappSent.length, 0, "only a 12/12 cycle gets the renewal reminder, as before");
  });

  test("a class inside the month stays in Cycle 1", async () => {
    const lead = makeLead();
    addLogs("2026-01-05", 8);

    await mark("2026-02-04");

    assert.equal(lead.currentPackageCycle, 1);
    assert.equal(logs.at(-1).packageCycle, 1);
  });

  test("editing an existing class after the month doesn't change the cycle", async () => {
    const lead = makeLead();
    addLogs("2026-01-05", 8);

    await mark("2026-01-06", "Missed");

    assert.equal(lead.currentPackageCycle, 1);
    assert.equal(logs.length, 8);
  });
});

describe("Classes marked late for a month that already ended", () => {
  test("a class dated inside the ended month counts toward that month", async () => {
    const lead = makeLead();
    addLogs("2026-01-05", 8); // month is 5 Jan – 4 Feb
    await mark("2026-02-10"); // Cycle 2 starts

    const res = await mark("2026-01-20");

    assert.equal(res.statusCode, 200);
    assert.equal(logs.at(-1).packageCycle, 1);
    assert.equal(res.payload.session.sessionNumber, 9);
    assert.equal(lead.currentPackageCycle, 2);
    assert.equal(lead.completedClasses, 1, "Cycle 2's count is unchanged");
    assert.equal(lead.packageHistory[0].completedClasses, 9);
    assert.equal(res.payload.message, "Attendance recorded successfully. Counted in Month 1 (9/12 classes).");
  });

  test("the current cycle's month doesn't move earlier", async () => {
    const { currentCycleEndDate } = await import(modulePath("utils/packageCycle.js"));
    const lead = makeLead();
    addLogs("2026-01-05", 8);
    await mark("2026-02-10");

    await mark("2026-01-20");

    assert.equal(await currentCycleEndDate(lead), "2026-03-09");
  });

  test("filling an earlier month to 12/12 doesn't start another cycle", async () => {
    const lead = makeLead();
    addLogs("2026-01-05", 11);
    await mark("2026-02-10");

    await mark("2026-01-20");

    assert.equal(lead.currentPackageCycle, 2);
    assert.equal(lead.packageHistory.length, 1);
    assert.equal(lead.packageHistory[0].completedClasses, 12);
  });

  test("re-marking an old record saved without a cycle keeps it in Cycle 1", async () => {
    const lead = makeLead({ currentPackageCycle: 2, packageHistory: [{ cycle: 1, totalClasses: 12, completedClasses: 5 }] });
    addLogs("2026-01-05", 5, { cycle: undefined });
    addLogs("2026-02-10", 1, { cycle: 2 });

    await mark("2026-01-06", "Missed");

    assert.equal(logs[1].packageCycle, 1);
    assert.equal(lead.packageHistory[0].completedClasses, 4);
    assert.equal(lead.completedClasses, 1, "Cycle 2's count is unchanged");
  });

  test("an earlier month that is already full doesn't take more classes", async () => {
    const lead = makeLead({ currentPackageCycle: 2, packageHistory: [{ cycle: 1, totalClasses: 12, completedClasses: 12 }] });
    addLogs("2026-01-01", 12, { cycle: 1 });
    addLogs("2026-01-20", 1, { cycle: 2 });

    await mark("2026-01-15");

    assert.equal(logs.at(-1).packageCycle, 2);
    assert.equal(lead.currentPackageCycle, 2);
  });
});

describe("Admin changes to a class in an ended month", () => {
  function endedMonth() {
    const lead = makeLead({
      currentPackageCycle: 2,
      packageHistory: [{ cycle: 1, totalClasses: 12, completedClasses: 8 }],
    });
    addLogs("2026-01-05", 8, { cycle: 1 });
    addLogs("2026-02-10", 1, { cycle: 2 });
    return lead;
  }

  test("changing a class to Missed lowers that month's count", async () => {
    const lead = endedMonth();
    const res = await adminLog("put", logs[0]._id, { status: "Missed", missedReason: "Student Unavailable" });

    assert.equal(res.statusCode, 200);
    assert.equal(lead.packageHistory[0].completedClasses, 7);
    assert.equal(lead.completedClasses, 0, "the current month is untouched");
  });

  test("deleting a class lowers that month's count", async () => {
    const lead = endedMonth();
    const res = await adminLog("delete", logs[0]._id);

    assert.equal(res.statusCode, 200);
    assert.equal(lead.packageHistory[0].completedClasses, 7);
  });

  test("deleting a class in Month 1 still counts records saved without a cycle", async () => {
    const lead = makeLead({ completedClasses: 5 });
    addLogs("2026-01-05", 5, { cycle: undefined });

    await adminLog("delete", logs[0]._id);

    assert.equal(lead.completedClasses, 4);
  });

  test("a future date is rejected", async () => {
    endedMonth();
    const res = await adminLog("put", logs[0]._id, { date: daysAgo(-1) });

    assert.equal(res.statusCode, 400);
    assert.equal(logs[0].date, "2026-01-05");
  });
});

describe("Class date checks", () => {
  test("a future date is rejected", async () => {
    makeLead();
    const res = await mark(daysAgo(-1));

    assert.equal(res.statusCode, 400);
    assert.equal(res.payload.message, "Attendance can't be marked for a future date.");
    assert.equal(logs.length, 0);
  });

  test("a date in another format is rejected", async () => {
    makeLead();
    const res = await mark("20/01/2026");

    assert.equal(res.statusCode, 400);
    assert.equal(logs.length, 0);
  });
});

describe("Daily rollover", () => {
  test("starts Cycle 2 for a student whose month has ended", async () => {
    const { checkMonthlyCycleRollover } = await import(modulePath("utils/reminderScheduler.js"));
    const lead = makeLead();
    addLogs("2026-01-05", 6);

    await checkMonthlyCycleRollover();

    assert.equal(lead.currentPackageCycle, 2);
    assert.equal(lead.packageHistory[0].completedClasses, 6);
    assert.equal(whatsappSent.length, 0);
  });
});

describe("Cycles without classes", () => {
  test("an empty Cycle 2 never runs out on its own", async () => {
    const { currentCycleEndDate } = await import(modulePath("utils/packageCycle.js"));
    const lead = makeLead({ currentPackageCycle: 2 });
    addLogs("2026-01-05", 12, { cycle: 1 });

    assert.equal(await currentCycleEndDate(lead), "");
  });
});
