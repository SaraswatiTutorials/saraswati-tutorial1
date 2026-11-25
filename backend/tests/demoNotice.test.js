// The "demo assigned" templates sent by hand from the admin panel.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemoNotices, formatDemoSlot } from "../utils/demoNotice.js";

test("demo slot reads like a person wrote it", () => {
  assert.equal(formatDemoSlot("2026-11-28", "17:00"), "Sat, 28 Nov 2026 at 5:00 PM");
  assert.equal(formatDemoSlot("2026-11-28", "09:30"), "Sat, 28 Nov 2026 at 9:30 AM");
  assert.equal(formatDemoSlot("2026-11-28", "00:15"), "Sat, 28 Nov 2026 at 12:15 AM");
});

test("tutor and parent values follow each template's placeholders", () => {
  const lead = {
    parentName: "Rashmi", area: "Marathahalli", city: "Bangalore",
    wards: [{ classGrade: "7", subjectsNeeded: ["Maths", "Science"] }],
  };
  const { tutor, parent } = buildDemoNotices(lead, { name: "Niraj" }, "2026-11-28", "17:00");
  assert.equal(tutor.templateName, "Demo Assigned To Tutor");
  assert.deepEqual(tutor.templateVars, {
    "{{1}}": "Niraj", "{{2}}": "Grade 7", "{{3}}": "Maths, Science",
    "{{4}}": "Marathahalli, Bangalore", "{{5}}": "Sat, 28 Nov 2026 at 5:00 PM",
  });
  assert.equal(parent.templateName, "Demo Scheduled Message");
  assert.deepEqual(parent.templateVars, {
    "{{1}}": "Rashmi", "{{2}}": "Niraj", "{{3}}": "Maths, Science",
    "{{4}}": "Sat, 28 Nov 2026 at 5:00 PM", "{{5}}": "Grade 7",
  });
});
