import { test } from "node:test";
import assert from "node:assert/strict";
import { parseClassTime, toTime24, usualClassTime, formatClassTimeRange } from "../../utils/classTime.js";

test("no time sent is allowed (older app versions)", () => {
  assert.deepEqual(parseClassTime(undefined, undefined), { ok: true, provided: false });
  assert.deepEqual(parseClassTime("", "  "), { ok: true, provided: false });
});

test("valid start and end are accepted", () => {
  assert.deepEqual(parseClassTime("17:00", "18:30"), { ok: true, provided: true, start: "17:00", end: "18:30" });
  assert.deepEqual(parseClassTime(" 09:05 ", "10:00"), { ok: true, provided: true, start: "09:05", end: "10:00" });
});

test("only one of the two times is rejected", () => {
  assert.equal(parseClassTime("17:00", "").ok, false);
  assert.equal(parseClassTime("", "18:30").ok, false);
});

test("bad formats are rejected", () => {
  for (const [s, e] of [["5 PM", "6 PM"], ["24:00", "25:00"], ["17:60", "18:00"], ["1700", "1830"], [17, 18]]) {
    assert.equal(parseClassTime(s, e).ok, false, `${s}-${e}`);
  }
});

test("end must be after start", () => {
  assert.equal(parseClassTime("18:30", "17:00").ok, false);
  assert.equal(parseClassTime("17:00", "17:00").ok, false);
});

test("12-hour times convert to 24-hour", () => {
  assert.equal(toTime24("5:00 PM"), "17:00");
  assert.equal(toTime24("5 pm"), "17:00");
  assert.equal(toTime24("12:30 AM"), "00:30");
  assert.equal(toTime24("12:00 PM"), "12:00");
  assert.equal(toTime24("17:00"), "17:00");
  assert.equal(toTime24("evening"), "");
});

test("usual class time comes from the enquiry", () => {
  assert.deepEqual(usualClassTime({ startTime: "17:00", endTime: "18:30" }), { start: "17:00", end: "18:30" });
  assert.deepEqual(usualClassTime({ classTimingSlot: "5:00 PM – 6:30 PM" }), { start: "17:00", end: "18:30" });
  assert.deepEqual(usualClassTime({ classTimingSlot: "Flexible" }), { start: "", end: "" });
  assert.deepEqual(usualClassTime(null), { start: "", end: "" });
});

test("display format", () => {
  assert.equal(formatClassTimeRange("17:00", "18:30"), "5:00 PM – 6:30 PM");
  assert.equal(formatClassTimeRange("09:00", "10:00"), "9:00 AM – 10:00 AM");
  assert.equal(formatClassTimeRange("", ""), "");
});
