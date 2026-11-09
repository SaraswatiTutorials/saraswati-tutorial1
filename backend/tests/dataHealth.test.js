// Panel 2 data checks: the rules that decide whether a record arrived complete,
// and the promise that one source failing never hides the others.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mobileOf, phoneProblem, hasCoordinates, toDate, runRules, sourceStatus, buildDataHealth, SOURCES, MAX_HOURS,
} from "../utils/dataHealth.js";

test("a mobile number is found however it was typed", () => {
  for (const typed of ["9876543210", "+91 98765 43210", "09876543210", "91-9876-543-210", "091 9876543210"]) {
    assert.equal(mobileOf(typed), "9876543210", typed);
  }
  assert.equal(mobileOf("12345"), "");
  assert.equal(mobileOf(""), "");
});

test("phone problems are named, and a good number has none", () => {
  assert.equal(phoneProblem("+91 98765 43210"), "");
  assert.equal(phoneProblem(""), "No number");
  assert.equal(phoneProblem(null), "No number");
  assert.equal(phoneProblem("98765"), "Has 5 digits");
  assert.equal(phoneProblem("0801234567"), "Not a mobile number"); // a landline cannot get WhatsApp
});

test("coordinates count only when both are real numbers and not 0,0", () => {
  assert.equal(hasCoordinates(12.97, 77.64), true);
  assert.equal(hasCoordinates("12.97", "77.64"), true);
  assert.equal(hasCoordinates(null, 77.64), false);
  assert.equal(hasCoordinates("", ""), false);
  assert.equal(hasCoordinates(0, 0), false);
  assert.equal(hasCoordinates("abc", 1), false);
});

test("dates are read from Date objects and strings, and junk is ignored", () => {
  assert.equal(toDate("2026-11-09T10:00:00Z").toISOString(), "2026-11-09T10:00:00.000Z");
  assert.equal(toDate(null), null);
  assert.equal(toDate("not a date"), null);
});

test("rules count every failing row but list only a few examples", () => {
  const rows = Array.from({ length: 8 }, (_, i) => ({ id: `R${i}`, phone: i % 2 ? "" : "9876543210" }));
  const [noPhone, fine] = runRules(rows, [
    { key: "no_phone", label: "No phone", level: "bad", test: (r) => !r.phone && `Row ${r.id}` },
    { key: "fine", label: "Never fails", level: "warn", test: () => false },
  ], (r) => ({ ref: r.id }));
  assert.equal(noPhone.count, 4);
  assert.equal(noPhone.examples.length, 4);
  assert.deepEqual(noPhone.examples[0], { ref: "R1", name: "", note: "Row R1", at: null });
  assert.equal(fine.count, 0);

  const many = runRules(Array.from({ length: 30 }, (_, i) => ({ id: i })), [
    { key: "all", label: "All", level: "bad", test: () => true },
  ], (r) => ({ ref: String(r.id) }))[0];
  assert.equal(many.count, 30);
  assert.equal(many.examples.length, 5);
});

test("a problem outranks a warning, and notes never change the status", () => {
  const check = (level, count) => ({ level, count });
  assert.equal(sourceStatus({ count: 3, checks: [check("warn", 1), check("bad", 1)] }), "bad");
  assert.equal(sourceStatus({ count: 3, checks: [check("warn", 2), check("bad", 0)] }), "warn");
  assert.equal(sourceStatus({ count: 3, checks: [check("info", 9)] }), "ok");
  assert.equal(sourceStatus({ count: 0, checks: [check("bad", 0)] }), "quiet");
  assert.equal(sourceStatus({ count: null, checks: [] }), "ok"); // the sync is not a stream, so never quiet
  assert.equal(sourceStatus({ error: "timed out", checks: [check("bad", 5)] }), "unknown");
});

test("one source failing is reported on its own and the rest still answer", async () => {
  // A database whose every collection fails: each source must say so,
  // none may throw, and the ping still reports the connection.
  const db = {
    databaseName: "test",
    command: async () => ({ ok: 1 }),
    collection: () => { throw new Error("operation exceeded time limit"); },
  };
  const out = await buildDataHealth(db, { hours: 99999, now: new Date("2026-11-09T12:00:00Z"), env: {} });
  assert.equal(out.hours, MAX_HOURS);
  assert.equal(out.database.connected, true);
  assert.equal(out.sources.length, SOURCES.length);
  assert.ok(out.sources.every((s) => s.status === "unknown"));
  assert.match(out.sources[0].error, /took too long/);
  assert.equal(out.summary.unknown, SOURCES.length);
});

test("a database that does not answer the ping is reported as not connected", async () => {
  const db = {
    command: async () => { throw new Error("not connected"); },
    collection: () => { throw new Error("not connected"); },
  };
  const out = await buildDataHealth(db, { hours: 24, env: {} });
  assert.equal(out.database.connected, false);
  assert.equal(out.hours, 24);
});
