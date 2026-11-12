// Tutors whose Odoo record failed at registration get it on a retry, with a
// tutor ID nobody else has. MongoDB and Odoo are stand-ins in memory; .env is
// never loaded and nothing leaves this process.
import { test, mock, before } from "node:test";
import assert from "node:assert/strict";

let retryTutorOdooSync, NEEDS_LOOK;

before(async () => {
  mock.module("dotenv", { defaultExport: { config: () => ({}) }, namedExports: { config: () => ({}) } });
  ({ retryTutorOdooSync, NEEDS_LOOK } = await import(new URL("../utils/tutorOdooRetry.js", import.meta.url).href));
});

const quiet = { log() {}, warn() {}, error() {} };

/** A small world: registered tutors, partial tutors and Odoo records. */
function world({ tutors = [], partials = [], odoo = [], upsert } = {}) {
  let counter = 0;
  const saved = [];
  const failed = [];
  const upserts = [];
  const holders = (list, code, notId) => list.filter((x) => String(x.tutorCode || "").toUpperCase() === code && String(x._id) !== String(notId));
  const deps = {
    log: quiet,
    findPending: async () => tutors.filter((t) => !t.tutorCode || (t.odooSyncStatus === "failed" && !t.odooLeadId)),
    readOdooCodes: async () => odoo.map((r) => r.tutor_id).filter(Boolean),
    nextCode: async (odooCodes) => {
      const all = [...tutors, ...partials].map((x) => x.tutorCode).concat(odooCodes);
      counter = Math.max(counter, ...all.map((c) => Number(/^TUT(\d+)$/.exec(c || "")?.[1] || 0)));
      counter += 1;
      return `TUT${String(counter).padStart(4, "0")}`;
    },
    reservedCodes: async () => [...tutors, ...partials].map((x) => x.tutorCode).filter(Boolean),
    partialCode: async (id) => partials.find((p) => String(p._id) === String(id))?.tutorCode || "",
    tutorsWithCode: async (code, notId) => holders(tutors, code, notId),
    partialsWithCode: async (code, notId) => holders(partials, code, notId),
    odooRecordsWithCode: async (code) => odoo.filter((r) => String(r.tutor_id || "").toUpperCase() === code),
    upsert: upsert || (async (t, opts) => {
      upserts.push({ t, opts });
      const rec = { id: 500 + odoo.length, tutor_id: opts.preferredCode, mobile: t.phone };
      odoo.push(rec);
      return { id: rec.id, tutorCode: rec.tutor_id };
    }),
    saveCode: async (id, { code, odooId, had = "" }) => {
      const t = tutors.find((x) => x._id === id);
      if ((t.tutorCode || "") !== had) return false;
      Object.assign(t, { tutorCode: code, odooLeadId: odooId });
      saved.push({ id, code, odooId });
      return true;
    },
    markFailed: async (id, error, odooId) => { failed.push({ id, error, odooId }); },
  };
  return { deps, saved, failed, upserts, odoo };
}

test("a tutor without an ID gets a brand-new one above every ID anywhere", async () => {
  const w = world({
    tutors: [{ _id: "a", name: "Asha", phone: "9800000001" }, { _id: "b", tutorCode: "TUT0040" }],
    partials: [{ _id: "p1", tutorCode: "TUT0090" }],
    odoo: [{ id: 1, tutor_id: "TUT0075" }],
  });
  const r = await retryTutorOdooSync(w.deps);
  assert.equal(r.fixed, 1);
  assert.deepEqual(w.saved, [{ id: "a", code: "TUT0091", odooId: 501 }]);
});

test("two tutors in one run never get the same ID", async () => {
  const w = world({ tutors: [{ _id: "a", phone: "1" }, { _id: "b", phone: "2" }], odoo: [{ id: 1, tutor_id: "TUT0005" }] });
  await retryTutorOdooSync(w.deps);
  assert.deepEqual(w.saved.map((s) => s.code), ["TUT0006", "TUT0007"]);
});

test("a tutor from the partial form keeps that entry's ID when nobody else has it", async () => {
  const w = world({ tutors: [{ _id: "a", fromPartialTutorId: "p1" }], partials: [{ _id: "p1", tutorCode: "TUT0200" }] });
  await retryTutorOdooSync(w.deps);
  assert.equal(w.saved[0].code, "TUT0200");
});

test("…but not when another registered tutor already has it", async () => {
  const w = world({
    tutors: [{ _id: "a", fromPartialTutorId: "p1" }, { _id: "b", tutorCode: "TUT0200" }],
    partials: [{ _id: "p1", tutorCode: "TUT0200" }],
  });
  await retryTutorOdooSync(w.deps);
  assert.equal(w.saved[0].code, "TUT0201");
});

test("a tutor who already has a partial-form ID but no Odoo record gets Odoo created with that same ID", async () => {
  const w = world({
    tutors: [{ _id: "t", name: "Teju", tutorCode: "TUT0701", odooSyncStatus: "failed", odooLeadId: null, fromPartialTutorId: "p1" }],
    partials: [{ _id: "p1", tutorCode: "TUT0701" }],
    odoo: [{ id: 1, tutor_id: "TUT0800" }],
  });
  const r = await retryTutorOdooSync(w.deps);
  assert.equal(r.fixed, 1);
  assert.equal(w.upserts[0].opts.preferredCode, "TUT0701");
  assert.deepEqual(w.saved, [{ id: "t", code: "TUT0701", odooId: 501 }]);
});

test("…but Odoo is not touched when someone else also holds that ID", async () => {
  const w = world({
    tutors: [
      { _id: "t", name: "Teju", tutorCode: "TUT0701", odooSyncStatus: "failed" },
      { _id: "x", name: "Other", tutorCode: "TUT0701", odooLeadId: 9 },
    ],
  });
  const r = await retryTutorOdooSync(w.deps);
  assert.equal(r.needsLook, 1);
  assert.equal(w.upserts.length, 0);
  assert.match(w.failed[0].error, /TUT0701 is also held by tutor Other/);
});

test("…nor when an Odoo record already has it", async () => {
  const w = world({
    tutors: [{ _id: "t", tutorCode: "TUT0701", odooSyncStatus: "failed" }],
    odoo: [{ id: 33, tutor_id: "TUT0701" }],
  });
  await retryTutorOdooSync(w.deps);
  assert.equal(w.upserts.length, 0);
  assert.match(w.failed[0].error, /Odoo record #33/);
});

test("…and their ID is never swapped for the one Odoo has for their number", async () => {
  const w = world({
    tutors: [{ _id: "t", tutorCode: "TUT0701", odooSyncStatus: "failed" }],
    upsert: async () => ({ id: 40, tutorCode: "TUT0123" }),
  });
  const r = await retryTutorOdooSync(w.deps);
  assert.equal(r.needsLook, 1);
  assert.equal(w.saved.length, 0);
  assert.match(w.failed[0].error, /has TUT0123, but they have TUT0701/);
});

test("tutors already linked to Odoo, or synced, are left alone", async () => {
  const w = world({
    tutors: [
      { _id: "a", tutorCode: "TUT0001", odooSyncStatus: "failed", odooLeadId: 5 },
      { _id: "b", tutorCode: "TUT0002", odooSyncStatus: "synced", odooLeadId: 6 },
    ],
  });
  const r = await retryTutorOdooSync(w.deps);
  assert.equal(r.checked, 0);
});

test("an Odoo record that comes back with someone else's ID is not copied", async () => {
  const w = world({
    tutors: [{ _id: "a", name: "Asha" }, { _id: "b", name: "Ravi", tutorCode: "TUT0003" }],
    upsert: async () => ({ id: 77, tutorCode: "TUT0003" }),
  });
  const r = await retryTutorOdooSync(w.deps);
  assert.equal(r.needsLook, 1);
  assert.equal(w.saved.length, 0);
  assert.match(w.failed[0].error, new RegExp(`^${NEEDS_LOOK}.*TUT0003.*Ravi`));
  assert.equal(w.failed[0].odooId, 77);
});

test("nor one held by a partial-form tutor", async () => {
  const w = world({
    tutors: [{ _id: "a" }],
    partials: [{ _id: "p9", name: "Meena", tutorCode: "TUT0010" }],
    upsert: async () => ({ id: 77, tutorCode: "TUT0010" }),
  });
  await retryTutorOdooSync(w.deps);
  assert.equal(w.saved.length, 0);
  assert.match(w.failed[0].error, /partial-form tutor Meena/);
});

test("nor one another Odoo record also has", async () => {
  const w = world({
    tutors: [{ _id: "a" }],
    odoo: [{ id: 12, tutor_id: "TUT0012" }],
    upsert: async () => ({ id: 77, tutorCode: "TUT0012" }),
  });
  await retryTutorOdooSync(w.deps);
  assert.equal(w.saved.length, 0);
  assert.match(w.failed[0].error, /Odoo record #12/);
});

test("an Odoo record with no ID is flagged, not saved", async () => {
  const w = world({ tutors: [{ _id: "a" }], upsert: async () => ({ id: 77, tutorCode: false }) });
  const r = await retryTutorOdooSync(w.deps);
  assert.equal(r.needsLook, 1);
  assert.equal(w.saved.length, 0);
});

test("when Odoo can't be read nothing is tried and no ID is handed out", async () => {
  const w = world({ tutors: [{ _id: "a" }] });
  w.deps.readOdooCodes = async () => null;
  const r = await retryTutorOdooSync(w.deps);
  assert.equal(r.odooDown, true);
  assert.equal(w.upserts.length, 0);
  assert.equal(w.failed.length, 0);
});

test("Odoo going offline mid-run stops the run and records the error", async () => {
  const w = world({
    tutors: [{ _id: "a" }, { _id: "b" }],
    upsert: async () => { throw new Error("request failed, reason: connect EHOSTUNREACH 1.2.3.4:443"); },
  });
  const r = await retryTutorOdooSync(w.deps);
  assert.equal(r.failed, 1);
  assert.equal(r.odooDown, true);
  assert.equal(w.failed.length, 1);
  assert.match(w.failed[0].error, /EHOSTUNREACH/);
});
