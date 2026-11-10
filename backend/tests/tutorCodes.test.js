// Tutor IDs for partial tutors (utils/tutorCodes.js). MongoDB is replaced by
// in-memory stand-ins; Odoo's IDs are passed in, so Odoo is never reached.
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

const modulePath = (rel) => new URL(`../${rel}`, import.meta.url).href;

// ---- a tiny Mongo-like matcher for the filters tutorCodes.js uses ----
function matches(doc, filter) {
  return Object.entries(filter).every(([key, cond]) => {
    if (key === "$or") return cond.some((f) => matches(doc, f));
    const val = doc[key];
    if (cond instanceof RegExp) return typeof val === "string" && cond.test(val);
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("$ne" in cond) return String(val) !== String(cond.$ne);
      if ("$exists" in cond) return cond.$exists ? val !== undefined : val === undefined;
    }
    return String(val ?? "") === String(cond ?? "") && (val !== undefined || cond === "" ? true : false);
  });
}
const query = (rows) => {
  const q = { sort: (s) => { const [[k, dir]] = Object.entries(s); rows = [...rows].sort((a, b) => (a[k] > b[k] ? dir : -dir)); return q; },
    lean: async () => rows, then: (res, rej) => Promise.resolve(rows).then(res, rej) };
  return q;
};
function fakeCollection(rows) {
  return {
    rows,
    find: (f = {}) => query(rows.filter((r) => matches(r, f))),
    findOne: (f = {}) => { const q = query(rows.filter((r) => matches(r, f))); const one = { sort: (s) => { q.sort(s); return one; }, lean: async () => (await q.lean())[0] || null }; return one; },
    findById: (id) => ({ lean: async () => rows.find((r) => String(r._id) === String(id)) || null }),
    exists: async (f) => rows.some((r) => matches(r, f)),
    updateOne: async (f, u) => {
      const r = rows.find((x) => matches(x, f));
      if (!r) return { modifiedCount: 0 };
      Object.assign(r, u.$set);
      return { modifiedCount: 1 };
    },
  };
}

let tutors, partials, counter;
const Tutor = fakeCollection([]);
const PartialTutor = fakeCollection([]);
const Counter = {
  updateOne: async (f, u) => { counter = Math.max(counter, u.$max.seq); },
  findOneAndUpdate: async () => { counter += 1; return { seq: counter }; },
};

let mod;
before(async () => {
  mock.module(modulePath("models/Tutor.js"), { defaultExport: Tutor });
  mock.module(modulePath("models/PartialTutor.js"), { defaultExport: PartialTutor });
  mock.module(modulePath("models/Counter.js"), { defaultExport: Counter });
  mod = await import(modulePath("utils/tutorCodes.js"));
});

beforeEach(() => {
  counter = 0;
  tutors = [
    { _id: "t1", name: "Annu", phone: "9000000001", whatsapp: "9000000001", tutorCode: "TUT0169" },
    { _id: "t2", name: "Esther", phone: "+91 90000 00002", tutorCode: "TUT0187" },
  ];
  partials = [];
  Tutor.rows.splice(0, Infinity, ...tutors);
  PartialTutor.rows.splice(0, Infinity, ...partials);
});

const addPartial = (p) => { const row = { tutorCode: "", createdAt: new Date(), ...p }; PartialTutor.rows.push(row); return row; };

test("format and parse", () => {
  assert.equal(mod.formatTutorCode(7), "TUT0007");
  assert.equal(mod.formatTutorCode(12345), "TUT12345");
  assert.equal(mod.tutorCodeNumber("tut0231"), 231);
  assert.equal(mod.tutorCodeNumber("TUT-5"), 0);
});

test("a new partial tutor gets the next number above everything in Odoo and here", async () => {
  const p = addPartial({ _id: "p1", whatsapp: "9811111111" });
  const code = await mod.assignPartialTutorCode(p, { odooCodes: ["TUT0001", "TUT0201"] });
  assert.equal(code, "TUT0202");
  assert.equal(PartialTutor.rows[0].tutorCode, "TUT0202");
});

test("numbers in Odoo or already taken here are skipped", async () => {
  counter = 199; // the counter is behind what Odoo has used
  const p = addPartial({ _id: "p1", whatsapp: "9811111111" });
  addPartial({ _id: "p0", whatsapp: "9822222222", tutorCode: "TUT0200" });
  assert.equal(await mod.assignPartialTutorCode(p, { odooCodes: ["TUT0199"] }), "TUT0201");
});

test("someone who is already a registered tutor still gets their own new ID", async () => {
  const p = addPartial({ _id: "p1", whatsapp: "90000 00002" });
  assert.equal(await mod.assignPartialTutorCode(p, { odooCodes: ["TUT0500"] }), "TUT0501");
});

test("the same number filling the form twice gets two different IDs", async () => {
  addPartial({ _id: "p1", whatsapp: "9811111111", tutorCode: "TUT0210" });
  const again = addPartial({ _id: "p2", whatsapp: "+91 98111 11111" });
  assert.equal(await mod.assignPartialTutorCode(again, { odooCodes: ["TUT0200"] }), "TUT0211");
});

test("no number is handed out when Odoo's IDs can't be read", async () => {
  const p = addPartial({ _id: "p1", whatsapp: "9811111111" });
  const known = addPartial({ _id: "p2", whatsapp: "9000000001" });
  assert.equal(await mod.assignPartialTutorCode(p, { readOdooCodes: async () => null, quiet: true }), "");
  assert.equal(await mod.assignPartialTutorCode(known, { readOdooCodes: async () => null, quiet: true }), "");
  assert.deepEqual(PartialTutor.rows.map((r) => r.tutorCode), ["", ""]);
});

test("an ID already given is never changed", async () => {
  const p = addPartial({ _id: "p1", whatsapp: "9811111111", tutorCode: "TUT0250" });
  assert.equal(await mod.assignPartialTutorCode(p, { odooCodes: ["TUT0900"] }), "TUT0250");
});

test("start-up pass: everyone without an ID gets their own, oldest first, none shared", async () => {
  addPartial({ _id: "new", whatsapp: "9833333333", createdAt: new Date("2026-11-01") });
  addPartial({ _id: "old", whatsapp: "9844444444", createdAt: new Date("2026-01-01") });
  addPartial({ _id: "tutor", whatsapp: "9000000001", createdAt: new Date("2026-06-01") });
  addPartial({ _id: "twice", whatsapp: "9844444444", createdAt: new Date("2026-08-01") });
  addPartial({ _id: "had", whatsapp: "9855555555", tutorCode: "TUT0205", createdAt: new Date("2025-01-01") });
  const r = await mod.backfillPartialTutorCodes({ readOdooCodes: async () => ["TUT0201"] });
  assert.equal(r.assigned, 4);
  const byId = Object.fromEntries(PartialTutor.rows.map((p) => [p._id, p.tutorCode]));
  assert.deepEqual(byId, { new: "TUT0209", old: "TUT0206", tutor: "TUT0207", twice: "TUT0208", had: "TUT0205" });
  const all = [...PartialTutor.rows.map((p) => p.tutorCode), ...Tutor.rows.map((t) => t.tutorCode)];
  assert.equal(new Set(all).size, all.length, "every ID is different");
  assert.equal((await mod.backfillPartialTutorCodes({ readOdooCodes: async () => ["TUT0201"] })).assigned, 0);
});

test("start-up pass with Odoo down: nobody gets a number yet", async () => {
  addPartial({ _id: "stranger", whatsapp: "9833333333" });
  addPartial({ _id: "tutor", whatsapp: "9000000001" });
  const r = await mod.backfillPartialTutorCodes({ readOdooCodes: async () => null });
  assert.equal(r.assigned, 0);
  assert.equal(r.odooRead, false);
  assert.deepEqual(PartialTutor.rows.map((p) => p.tutorCode), ["", ""]);
});

test("partial tutors' IDs are listed for Odoo to skip", async () => {
  addPartial({ _id: "a", whatsapp: "9833333333", tutorCode: "TUT0206" });
  addPartial({ _id: "b", whatsapp: "9844444444", tutorCode: "tut0207" });
  addPartial({ _id: "c", whatsapp: "9855555555" });
  assert.deepEqual((await mod.partialTutorCodes()).sort(), ["TUT0206", "TUT0207"]);
});
