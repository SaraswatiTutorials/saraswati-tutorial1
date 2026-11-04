import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTutorOptions } from "../utils/tutorOptionsMessage.js";

const lead = {
  parentName: "Test Parent",
  wards: [{ studentName: "Aarav", classGrade: "8", subjectsNeeded: ["Maths", "Science"] }],
};
const tutors = [
  { name: "Tutor A", experience: "6 yrs", distanceKm: 2 },
  { name: "Tutor B", experience: "5 yrs", distanceKm: 3 },
  { name: "Tutor C", experience: "", distanceKm: 6.5 },
];

test("parent options fill tutor_options_for_parent's seven slots in order", () => {
  const { templateVars, templateName } = buildTutorOptions(lead, tutors);
  assert.equal(templateName, "tutor_options_for_parent");
  assert.deepEqual(Object.values(templateVars), [
    "Test Parent",                    // {{1}}
    "Aarav",                          // {{2}} student's name
    "Grade 8",                        // {{3}}
    "Maths, Science",                 // {{4}}
    "Tutor A - 6 yrs exp - 2 km away", // {{5}}
    "Tutor B - 5 yrs exp - 3 km away", // {{6}}
    "Tutor C - 6.5 km away",          // {{7}}
  ]);
});

test("fewer than three tutors, or no student name: a dash, never empty", () => {
  const { templateVars } = buildTutorOptions({ ...lead, wards: [{ classGrade: "8" }] }, tutors.slice(0, 1));
  assert.equal(templateVars.student_name, "—");
  assert.equal(templateVars.option_2, "—");
  assert.equal(templateVars.option_3, "—");
});

test("dry-run text is worded like the template", () => {
  const { messageBody } = buildTutorOptions(lead, tutors);
  assert.match(messageBody, /^Dear Mr\.\/Ms\. Test Parent,/);
  assert.match(messageBody, /Student's name: Aarav\nGrade: Grade 8\nSubject\(s\): Maths, Science/);
  assert.match(messageBody, /1\. Tutor A.*\n2\. Tutor B.*\n3\. Tutor C/);
});
