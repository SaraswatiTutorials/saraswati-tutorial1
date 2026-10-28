// Checks for the assignment and test records tutors keep in the tutor portal

export const ASSIGNMENT_KINDS = ["Assignment", "Test"];
export const ASSIGNMENT_STATUSES = ["Pending", "Checked", "Not submitted"];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TEXT_LIMITS = { title: 120, subject: 60, details: 2000, remark: 1000 };

function readMarks(raw) {
  if (raw === null || raw === undefined || raw === "") return { value: null };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return { error: true };
  return { value: Math.round(n * 100) / 100 };
}

// Reads the fields a tutor sent. On create every field gets a value (defaults for the
// optional ones); with `partial`, only the fields present in the body are returned.
// Returns { value } or { error }.
export function parseAssignmentInput(body = {}, { partial = false } = {}) {
  const value = {};
  const has = (key) => body[key] !== undefined;

  for (const [key, max] of Object.entries(TEXT_LIMITS)) {
    if (!partial || has(key)) value[key] = String(body[key] ?? "").trim().slice(0, max);
  }
  if ("title" in value && !value.title) return { error: "Give it a title, e.g. \"Chapter 4 worksheet\"." };

  if (!partial || has("kind")) {
    value.kind = has("kind") ? String(body.kind) : "Assignment";
    if (!ASSIGNMENT_KINDS.includes(value.kind)) return { error: "Choose Assignment or Test." };
  }
  if (!partial || has("status")) {
    value.status = has("status") ? String(body.status) : "Pending";
    if (!ASSIGNMENT_STATUSES.includes(value.status)) return { error: "Choose a valid status." };
  }

  if (!partial || has("givenDate")) {
    value.givenDate = String(body.givenDate ?? "");
    if (!DATE_RE.test(value.givenDate)) return { error: "Select the date." };
  }
  if (!partial || has("dueDate")) {
    value.dueDate = String(body.dueDate ?? "");
    if (value.dueDate && !DATE_RE.test(value.dueDate)) return { error: "The due date isn't a valid date." };
  }

  for (const key of ["maxMarks", "marks"]) {
    if (partial && !has(key)) continue;
    const parsed = readMarks(body[key]);
    if (parsed.error) return { error: key === "marks" ? "Marks must be a number of 0 or more." : "Total marks must be a number." };
    value[key] = parsed.value;
  }

  return { value };
}

// Rules across fields, checked on the record as it will be saved. Returns an error message or "".
export function assignmentProblem(record) {
  if (record.dueDate && record.givenDate && record.dueDate < record.givenDate) {
    return "The due date can't be before the date it was given.";
  }
  if (record.maxMarks !== null && record.maxMarks !== undefined && record.maxMarks <= 0) {
    return "Total marks must be more than 0.";
  }
  if (record.marks !== null && record.marks !== undefined) {
    if (record.maxMarks === null || record.maxMarks === undefined) return "Enter the total marks too.";
    if (record.marks > record.maxMarks) return `Marks can't be more than the total (${record.maxMarks}).`;
  }
  return "";
}

// Work that wasn't handed in has no marks; marks or a remark mean it has been checked
export function settleStatus(record, statusWasSent) {
  if (record.status === "Not submitted") {
    record.marks = null;
  } else if (!statusWasSent && record.status === "Pending" && (record.marks !== null || record.remark)) {
    record.status = "Checked";
  }
  return record;
}
