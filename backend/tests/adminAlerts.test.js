import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNewEnquiryAlert } from "../utils/adminAlerts.js";

const lead = {
  requirementId: "REQ-00123",
  parentName: "Sunita Sharma",
  phone: "9876543210",
  area: "Andheri West",
  geoInfo: { city: "Mumbai" },
  pincode: "400058",
  preferredMode: "Home Tuition",
  wards: [
    { studentName: "Aarav", classGrade: "8", curriculum: "CBSE", subjectsNeeded: ["Maths", "Science"] },
    { studentName: "Diya", classGrade: "5", curriculum: "ICSE", subjectsNeeded: ["English"] },
  ],
};

test("template values are in {{1}}–{{6}} order", () => {
  const { templateVars } = buildNewEnquiryAlert(lead);
  assert.deepEqual(Object.values(templateVars), [
    "REQ-00123",
    "Sunita Sharma",
    "9876543210",
    "Aarav (Class 8, CBSE: Maths, Science); Diya (Class 5, ICSE: English)",
    "Andheri West, Mumbai, 400058",
    "Home Tuition",
  ]);
});

test("missing details become N/A and line breaks are removed (WhatsApp rejects both)", () => {
  const { templateVars } = buildNewEnquiryAlert({ parentName: "Ravi\nKumar", phone: "", wards: [] });
  assert.equal(templateVars.requirement_id, "N/A");
  assert.equal(templateVars.parent_name, "Ravi Kumar");
  assert.equal(templateVars.phone, "N/A");
  assert.equal(templateVars.students, "Student");
  assert.equal(templateVars.location, "N/A");
  assert.equal(templateVars.mode, "N/A");
});

test("message text", () => {
  const { messageBody } = buildNewEnquiryAlert(lead);
  assert.match(messageBody, /^New parent enquiry received on the website\./);
  assert.match(messageBody, /Requirement ID: REQ-00123/);
  assert.match(messageBody, /Phone: 9876543210/);
  assert.match(messageBody, /Saraswati Tutorials$/);
});
