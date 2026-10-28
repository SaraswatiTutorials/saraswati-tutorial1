// Assignment input checks and who may open a student's portal records
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseAssignmentInput, assignmentProblem, settleStatus } from "../utils/assignments.js";
import { canAccessStudent } from "../utils/portalAccess.js";

const base = { title: "Chapter 4 worksheet", givenDate: "2026-10-20" };

describe("parseAssignmentInput", () => {
  test("fills defaults on create", () => {
    const { value, error } = parseAssignmentInput(base);
    assert.equal(error, undefined);
    assert.deepEqual(value, {
      title: "Chapter 4 worksheet", subject: "", details: "", remark: "",
      kind: "Assignment", status: "Pending", givenDate: "2026-10-20", dueDate: "", maxMarks: null, marks: null,
    });
  });

  test("needs a title and a date on create", () => {
    assert.match(parseAssignmentInput({ givenDate: "2026-10-20" }).error, /title/);
    assert.match(parseAssignmentInput({ title: "Test" }).error, /date/);
  });

  test("rejects an unknown kind, status or bad numbers", () => {
    assert.ok(parseAssignmentInput({ ...base, kind: "Quiz" }).error);
    assert.ok(parseAssignmentInput({ ...base, status: "Done" }).error);
    assert.ok(parseAssignmentInput({ ...base, marks: "-3" }).error);
    assert.ok(parseAssignmentInput({ ...base, maxMarks: "abc" }).error);
  });

  test("reads marks given as text and blank marks as none", () => {
    const { value } = parseAssignmentInput({ ...base, maxMarks: "25", marks: "18.5" });
    assert.equal(value.maxMarks, 25);
    assert.equal(value.marks, 18.5);
    assert.equal(parseAssignmentInput({ ...base, marks: "" }).value.marks, null);
  });

  test("partial update returns only the fields sent", () => {
    assert.deepEqual(parseAssignmentInput({ marks: 7, remark: " Good work " }, { partial: true }).value, { marks: 7, remark: "Good work" });
    assert.match(parseAssignmentInput({ title: "  " }, { partial: true }).error, /title/);
  });
});

describe("assignmentProblem", () => {
  test("accepts a sensible record", () => {
    assert.equal(assignmentProblem({ givenDate: "2026-10-20", dueDate: "2026-10-27", maxMarks: 20, marks: 15 }), "");
  });

  test("catches a due date before the given date", () => {
    assert.match(assignmentProblem({ givenDate: "2026-10-20", dueDate: "2026-10-19" }), /due date/);
  });

  test("marks need a total and can't exceed it", () => {
    assert.match(assignmentProblem({ marks: 5, maxMarks: null }), /total/);
    assert.match(assignmentProblem({ marks: 21, maxMarks: 20 }), /more than the total/);
    assert.match(assignmentProblem({ maxMarks: 0 }), /more than 0/);
  });
});

describe("settleStatus", () => {
  test("marks or a remark turn a pending record into checked", () => {
    assert.equal(settleStatus({ status: "Pending", marks: 8, remark: "" }, false).status, "Checked");
    assert.equal(settleStatus({ status: "Pending", marks: null, remark: "Neat work" }, false).status, "Checked");
    assert.equal(settleStatus({ status: "Pending", marks: null, remark: "" }, false).status, "Pending");
  });

  test("keeps a status the tutor chose", () => {
    assert.equal(settleStatus({ status: "Pending", marks: 8, remark: "" }, true).status, "Pending");
  });

  test("work not submitted has no marks", () => {
    const record = settleStatus({ status: "Not submitted", marks: 8, remark: "Ask again" }, true);
    assert.equal(record.marks, null);
    assert.equal(record.status, "Not submitted");
  });
});

describe("canAccessStudent", () => {
  const lead = { assignedTutorId: "t1", phone: "+91 98765-43210" };

  test("admins see every student", () => {
    assert.equal(canAccessStudent({ role: "admin" }, lead), true);
  });

  test("tutors see only students assigned to them", () => {
    assert.equal(canAccessStudent({ role: "tutor", id: "t1" }, lead), true);
    assert.equal(canAccessStudent({ role: "tutor", id: "t2" }, lead), false);
    assert.equal(canAccessStudent({ role: "tutor", id: "t1" }, { phone: "9876543210" }), false);
  });

  test("parents see only enquiries made with their number", () => {
    assert.equal(canAccessStudent({ role: "parent", phone: "9876543210" }, lead), true);
    assert.equal(canAccessStudent({ role: "parent", phone: "9876543211" }, lead), false);
    assert.equal(canAccessStudent({ role: "parent", phone: "98765" }, lead), false);
  });

  test("anyone else is refused", () => {
    assert.equal(canAccessStudent({ role: "blog-editor" }, lead), false);
    assert.equal(canAccessStudent(undefined, lead), false);
    assert.equal(canAccessStudent({ role: "admin" }, null), false);
  });
});
