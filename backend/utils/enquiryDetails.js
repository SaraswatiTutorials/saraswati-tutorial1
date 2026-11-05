// What an admin may change on a parent enquiry from the dashboard's Edit form.
// Only fields present in the request are checked and changed, so a partial update
// never touches (or fails on) the rest of an older record.

import { PLAN_IDS } from "./pricing/feeEngine.js";
import { classMinutes, formatClassTimeRange, parseClassTime } from "./classTime.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const OPTIONAL_TEXT = {
  address: "Address",
  area: "Area",
  city: "City",
  pincode: "PIN code",
  preferredMode: "Tuition mode",
  preferredGender: "Tutor gender",
};

// A blank value saves as `blank`
const NUMBERS = {
  daysPerWeek: { label: "Days per week", min: 1, max: 7, integer: true, blank: null },
  hoursPerDay: { label: "Hours per class", min: 0.5, max: 12, blank: null },
  monthlyFees: { label: "Monthly fee", min: 0, blank: null },
  totalClasses: { label: "Classes per package", min: 1, integer: true, blank: null },
  totalBaseFee: { label: "Total base fee", min: 0, blank: null },
  siblingDiscount: { label: "Sibling discount", min: 0, blank: 0 },
  siblingConcessionPercent: { label: "Sibling concession", min: 0, max: 100, blank: 0 },
};

const WARD_TEXT = ["schoolName", "classGrade", "curriculum", "currentPerformance", "specialNeeds"];

const isBlank = (value) => value === null || value === "";

function parseNumber(raw, { label, min, max = Infinity, integer = false, blank }) {
  if (isBlank(raw)) return { value: blank };
  const isNumeric = typeof raw === "number" || (typeof raw === "string" && raw.trim() !== "");
  const number = isNumeric ? Number(raw) : NaN;
  if (!Number.isFinite(number) || (integer && !Number.isInteger(number))) {
    return { error: `${label} must be a ${integer ? "whole " : ""}number.` };
  }
  if (number < min || number > max) {
    return { error: max === Infinity ? `${label} must be at least ${min}.` : `${label} must be between ${min} and ${max}.` };
  }
  return { value: number };
}

const isTextList = (value) => Array.isArray(value) && value.every((item) => typeof item === "string");

function parseWards(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return { error: "Add at least one student." };

  const wards = [];
  for (const [index, ward] of raw.entries()) {
    const label = `Student ${index + 1}`;
    if (ward === null || typeof ward !== "object" || Array.isArray(ward)) return { error: `${label} details are invalid.` };

    const studentName = typeof ward.studentName === "string" ? ward.studentName.trim() : "";
    if (!studentName) return { error: `${label} needs a name.` };

    const clean = { studentName };
    for (const key of WARD_TEXT) {
      if (ward[key] === undefined || ward[key] === null) continue;
      if (typeof ward[key] !== "string") return { error: `${label} details are invalid.` };
      clean[key] = ward[key].trim();
    }

    const subjects = ward.subjectsNeeded ?? [];
    if (!isTextList(subjects)) return { error: `${label} subjects are invalid.` };
    clean.subjectsNeeded = subjects.map((subject) => subject.trim()).filter(Boolean);

    wards.push(clean);
  }
  return { value: wards };
}

// The three timing fields only make sense together, and the slot text comes from them
function parseTiming(body) {
  const type = body.classTimingType;
  if (type === "Flexible") {
    return { value: { classTimingType: type, startTime: "", endTime: "", classTimingSlot: "Flexible" } };
  }
  if (type !== "Fixed Timing") return { error: "Choose Fixed Timing or Flexible for the class timing." };

  const time = parseClassTime(body.startTime, body.endTime);
  if (!time.ok) return { error: time.message };
  if (!time.provided) return { error: "Enter both the class start and end time." };
  return {
    value: {
      classTimingType: type,
      startTime: time.start,
      endTime: time.end,
      classTimingSlot: formatClassTimeRange(time.start, time.end),
    },
  };
}

// Returns { value } holding only the fields that were sent, or { error } with a message for the admin
export function parseEnquiryDetails(body = {}) {
  const value = {};

  if (body.parentName !== undefined) {
    const name = typeof body.parentName === "string" ? body.parentName.trim() : "";
    if (!name) return { error: "Parent name is required." };
    value.parentName = name;
  }

  if (body.phone !== undefined) {
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const digits = phone.replace(/\D/g, "").length;
    if (digits < 10 || digits > 15) return { error: "Enter a valid phone number with at least 10 digits." };
    value.phone = phone;
  }

  if (body.email !== undefined) {
    if (typeof body.email !== "string" && body.email !== null) return { error: "Enter a valid email address." };
    const email = (body.email || "").trim().toLowerCase();
    if (email && !EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
    value.email = email;
  }

  for (const [key, label] of Object.entries(OPTIONAL_TEXT)) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== "string" && body[key] !== null) return { error: `${label} is invalid.` };
    value[key] = (body[key] || "").trim();
  }

  if (body.planType !== undefined) {
    if (!isBlank(body.planType) && !PLAN_IDS.includes(body.planType)) return { error: "Choose a valid plan." };
    value.planType = body.planType || "";
  }

  for (const [key, rule] of Object.entries(NUMBERS)) {
    if (body[key] === undefined) continue;
    const parsed = parseNumber(body[key], rule);
    if (parsed.error) return { error: parsed.error };
    value[key] = parsed.value;
  }

  if (body.studentFees !== undefined) {
    const fees = body.studentFees;
    if (!Array.isArray(fees) || !fees.every((fee) => typeof fee === "number" && Number.isFinite(fee) && fee >= 0)) {
      return { error: "Student fees are invalid." };
    }
    value.studentFees = fees;
  }

  if (body.preferredDays !== undefined) {
    if (!isTextList(body.preferredDays)) return { error: "Preferred days are invalid." };
    value.preferredDays = body.preferredDays;
  }

  if (body.wards !== undefined) {
    const parsed = parseWards(body.wards);
    if (parsed.error) return { error: parsed.error };
    value.wards = parsed.value;
  }

  if (body.classTimingType !== undefined || body.startTime !== undefined || body.endTime !== undefined) {
    const parsed = parseTiming(body);
    if (parsed.error) return { error: parsed.error };
    Object.assign(value, parsed.value);
  }

  return { value };
}

const has = (details, key) => Object.prototype.hasOwnProperty.call(details, key);

// Saved fields that are worked out from the edited ones, the same way the enquiry form does it.
// `current` is the enquiry before the edit.
export function deriveEnquiryFields(details, current = {}) {
  const derived = {};
  const merged = (key) => (has(details, key) ? details[key] : current[key]);

  // A typed fee replaces the worked-out one, so its breakdown no longer applies
  if (has(details, "monthlyFees")) {
    derived.finalPrice = details.monthlyFees;
    if (!has(details, "totalBaseFee")) {
      derived.totalBaseFee = details.monthlyFees;
      derived.siblingDiscount = 0;
      derived.siblingConcessionPercent = 0;
      derived.studentFees = [];
    }
  }

  const plan = merged("planType");
  const days = merged("daysPerWeek");
  const hours = merged("hoursPerDay");
  const planEdited = ["planType", "daysPerWeek", "hoursPerDay"].some((key) => has(details, key));
  const timingEdited = has(details, "classTimingSlot");

  if (plan && planEdited) {
    derived.preferredTime = days && hours ? `${days} Days • ${hours} Hr (${plan.toUpperCase()})` : plan.toUpperCase();
  } else if (!plan && (planEdited || timingEdited)) {
    const slot = merged("classTimingSlot");
    derived.preferredTime = slot && slot !== "Flexible" ? slot : "";
  }

  if (has(details, "hoursPerDay") && hours) {
    derived.classDuration = `${hours} Hr`;
  } else if (!hours && has(details, "startTime") && details.startTime) {
    const classHours = classMinutes(details.startTime, details.endTime) / 60;
    derived.classDuration = `${classHours} Hour${classHours === 1 ? "" : "s"}`;
  }

  return derived;
}

// "Asha, Ravi", the form attendance and assignment records keep a copy of
export const joinStudentNames = (wards) => (wards || []).map((ward) => ward.studentName).filter(Boolean).join(", ");
