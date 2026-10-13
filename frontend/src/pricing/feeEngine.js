// Fee engine — pure pricing calculations. No I/O, no database access.
//
// SHARED FILE: an identical copy lives at frontend/src/pricing/feeEngine.js.
// Edit the backend copy, then run `npm run sync:pricing` in backend/.

import { FEE_CONFIG, GRADE_GROUPS } from "./feeConfig.js";

export const PLAN_IDS = ["foundation", "advance", "elite"];

const JUNIOR_GROUPS = ["Grades 1–5", "Grade 6", "Grade 7"];

export const ERROR_CODES = {
  UNKNOWN_PLAN: "UNKNOWN_PLAN",
  UNKNOWN_GRADE: "UNKNOWN_GRADE",
  INVALID_SCHEDULE: "INVALID_SCHEDULE",
  UNAVAILABLE: "UNAVAILABLE",
  PRICE_PENDING: "PRICE_PENDING",
  PRICE_MISSING: "PRICE_MISSING",
  NO_STUDENTS: "NO_STUDENTS",
  INVALID_STUDENT: "INVALID_STUDENT",
  SUBJECTS_REQUIRED: "SUBJECTS_REQUIRED",
  PRICING_FAILED: "PRICING_FAILED",
};

class PricingError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

const roundTo = (value, step) => Math.round(value / step) * step;

export const comboKey = (days, hours) => `${Number(days)}_${Number(hours).toFixed(1)}`;

export const parseComboKey = (key) => {
  const [days, hours] = key.split("_");
  return { days: Number(days), hours: Number(hours) };
};

export const isOnlineMode = (mode) => typeof mode === "string" && mode.toLowerCase().includes("online");

export const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

// Accepts numbers and plain numeric strings ("1.5"); every other type is invalid.
const toScheduleNumber = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && /^\d+(\.\d+)?$/.test(value.trim())) return Number(value.trim());
  return null;
};

// Returns { days, hours } only when both are explicitly supported values;
// off-grid values such as 1.46 hours return null instead of being rounded.
export const parseSchedule = (days, hours, config = FEE_CONFIG) => {
  const d = toScheduleNumber(days);
  const h = toScheduleNumber(hours);
  const { daysPerWeek, sessionHours } = config.supportedSchedule;
  if (d === null || h === null || !daysPerWeek.includes(d) || !sessionHours.includes(h)) return null;
  return { days: d, hours: h };
};

// User-supplied values are echoed only as short strings.
const unknownPlanMessage = (planId) =>
  typeof planId === "string" && planId.trim() ? `Unknown plan "${planId.trim().slice(0, 40)}".` : "Plan is required.";

const scheduleError = (config) => {
  const { daysPerWeek, sessionHours } = config.supportedSchedule;
  return new PricingError(
    ERROR_CODES.INVALID_SCHEDULE,
    `Choose ${daysPerWeek.join(" or ")} days per week and ${sessionHours.join(", ")} hours per session.`
  );
};

// Maps both enquiry-form values ("1 to 5", "6", "PUC", "Degree Courses") and
// homepage values ("Grade 1–5", "Grade 6", "Degree") to a grade group.
// Unknown values return null rather than defaulting to a group.
export const getGradeGroup = (classGrade) => {
  if (typeof classGrade !== "string") return null;
  const cg = classGrade
    .trim()
    .replace(/^Grades?\s+/i, "")
    .replace(/[–—]/g, "-");

  if (cg === "1 to 5" || cg === "1-5") return "Grades 1–5";
  if (["6", "7", "8", "9", "10", "11", "12"].includes(cg)) return `Grade ${cg}`;
  if (cg === "PUC") return "Grade 12";
  if (cg.toLowerCase().includes("degree")) return "Degree";
  return null;
};

export const isJuniorGroup = (group) => JUNIOR_GROUPS.includes(group);

const boardKey = (curriculum) => {
  if (typeof curriculum !== "string") return null;
  const b = curriculum.trim().replace(/\s+/g, "");
  if (b.includes("CBSE")) return "CBSE";
  if (b.includes("ICSE") || b.includes("ISC")) return "ICSE";
  if (b.includes("IGCSE")) return "IGCSE";
  if (b.includes("IB")) return "IB";
  if (b.includes("StateBoard") || b.includes("PUC")) return "StateBoard";
  if (b.includes("NIOS")) return "NIOS";
  return null;
};

const boardMultiplier = (curriculum, table) => {
  const key = boardKey(curriculum);
  return key && table[key] !== undefined ? table[key] : 1.0;
};

export const getEliteHourlyRate = (classGrade, curriculum, config = FEE_CONFIG) => {
  const group = getGradeGroup(classGrade);
  if (!group) return null;
  return Math.round(config.eliteHourlyRates[group] * boardMultiplier(curriculum, config.eliteBoardMultipliers));
};

const findAvailabilityEntry = (planId, key, config) =>
  (config.availability[planId] || []).find((entry) => entry.combo === key);

const getBasePrice = (planId, group, key, config) => {
  const approved = config.masterPrices[group]?.[key];
  if (typeof approved === "number") return approved;
  const pending = config.pendingBasePrices?.[planId]?.[key];
  if (pending && typeof pending[group] === "number") return pending[group];
  return null;
};

// Availability status of one plan/grade/schedule:
// "available" | "pending" (approved combination, price not yet approved) | "unavailable".
export const getComboStatus = (planId, classGrade, days, hours, config = FEE_CONFIG) => {
  const group = getGradeGroup(classGrade);
  const schedule = parseSchedule(days, hours, config);
  if (!group || !schedule || !PLAN_IDS.includes(planId)) return "unavailable";
  const key = comboKey(schedule.days, schedule.hours);
  const entry = findAvailabilityEntry(planId, key, config);
  if (!entry || !entry.groups.includes(group)) return "unavailable";
  if (planId === "elite") return "available";
  return getBasePrice(planId, group, key, config) === null ? "pending" : "available";
};

// Monthly plan price for one student (one subject when subject pricing is enabled).
// Throws a PricingError for unknown, unavailable or unpriced combinations — never
// substitutes another combination's price.
export const calculatePlanPrice = (planId, classGrade, curriculum, days, hours, mode, config = FEE_CONFIG) => {
  if (!PLAN_IDS.includes(planId)) {
    throw new PricingError(ERROR_CODES.UNKNOWN_PLAN, unknownPlanMessage(planId));
  }
  const group = getGradeGroup(classGrade);
  if (!group) {
    throw new PricingError(
      ERROR_CODES.UNKNOWN_GRADE,
      typeof classGrade === "string" && classGrade.trim()
        ? `Unknown class "${classGrade.trim().slice(0, 40)}".`
        : "Class is required."
    );
  }
  const schedule = parseSchedule(days, hours, config);
  if (!schedule) throw scheduleError(config);
  const { days: d, hours: h } = schedule;

  const status = getComboStatus(planId, classGrade, d, h, config);
  if (status === "unavailable") {
    throw new PricingError(
      ERROR_CODES.UNAVAILABLE,
      `${d} days × ${h} hour${h === 1 ? "" : "s"} is not available on this plan for ${group}.`,
      { planId, group, days: d, hours: h }
    );
  }
  if (status === "pending") {
    throw new PricingError(
      ERROR_CODES.PRICE_PENDING,
      `${d} days × ${h} hour${h === 1 ? "" : "s"} is awaiting price approval for ${group}.`,
      { planId, group, days: d, hours: h }
    );
  }

  const online = isOnlineMode(mode);
  const { rounding } = config;

  if (planId === "elite") {
    const hourly = getEliteHourlyRate(classGrade, curriculum, config);
    const monthly = Math.round(hourly * h * d * 4);
    return online ? roundTo(monthly * rounding.onlineFactor, rounding.onlineRoundTo) : monthly;
  }

  const base = getBasePrice(planId, group, comboKey(d, h), config);
  if (base === null) {
    throw new PricingError(ERROR_CODES.PRICE_MISSING, `No approved price for ${group}.`, { planId, group });
  }
  const planMult =
    planId === "foundation"
      ? config.planMultipliers.foundation
      : isJuniorGroup(group)
        ? config.planMultipliers.advance.upToClass7
        : config.planMultipliers.advance.class8Plus;

  const price = base * boardMultiplier(curriculum, config.boardMultipliers) * planMult;
  return online
    ? roundTo(price * rounding.onlineFactor, rounding.onlineRoundTo)
    : roundTo(price, rounding.homeRoundTo);
};

// Board price before the plan multiplier — shown struck through next to the
// Foundation price (existing "18% off" display).
export const calculateListPrice = (classGrade, curriculum, days, hours, mode, config = FEE_CONFIG) => {
  const group = getGradeGroup(classGrade);
  const schedule = parseSchedule(days, hours, config);
  const base = group && schedule ? config.masterPrices[group]?.[comboKey(schedule.days, schedule.hours)] : undefined;
  if (typeof base !== "number") return null;
  const price = base * boardMultiplier(curriculum, config.boardMultipliers);
  return isOnlineMode(mode)
    ? roundTo(price * config.rounding.onlineFactor, config.rounding.onlineRoundTo)
    : Math.round(price);
};

// Struck-through list price for the selected plan, or null when none should be
// shown. Only for a valid Foundation quote with a monthly fee: an invalid or
// unavailable plan (e.g. a stale draft) never shows a list price beside "—".
export const getStruckListPrice = (quote, config = FEE_CONFIG) => {
  if (!quote?.ok || quote.planType !== "foundation" || quote.rules?.subjectPricingEnabled) return null;
  const fee = quote.monthlyPayable;
  if (typeof fee !== "number" || !Number.isFinite(fee) || fee <= 0) return null;
  const first = quote.students?.[0];
  if (!first) return null;
  const listPrice = calculateListPrice(first.classGrade, first.curriculum, quote.daysPerWeek, quote.hoursPerDay, quote.preferredMode, config);
  return listPrice !== null && listPrice !== fee ? listPrice : null;
};

// Average hourly rate implied by a monthly price (4 weeks a month), for display.
// For home Elite tuition this equals the configured hourly rate exactly.
export const getEffectiveHourlyRate = (monthlyPrice, days, hours, config = FEE_CONFIG) => {
  const schedule = parseSchedule(days, hours, config);
  if (!schedule || typeof monthlyPrice !== "number" || !Number.isFinite(monthlyPrice)) return null;
  return Math.round(monthlyPrice / (schedule.days * schedule.hours * 4));
};

const safePlanPrice = (...args) => {
  try {
    return calculatePlanPrice(...args);
  } catch {
    return null;
  }
};

// Options for a plan, given every student on the enquiry. An option is offered
// only if it is available for all students. Pending options are returned with
// status "pending" so callers can hide them; their price is always null.
export const getPlanOptions = (planId, students = [], mode, config = FEE_CONFIG) => {
  const list = (Array.isArray(students) && students.length > 0 ? students : [{}]).map((s) =>
    isPlainObject(s) ? s : {}
  );
  return (config.availability[planId] || []).map(({ combo }) => {
    const { days, hours } = parseComboKey(combo);
    const statuses = list.map((s) => getComboStatus(planId, s.classGrade, days, hours, config));
    const status = statuses.includes("unavailable")
      ? "unavailable"
      : statuses.includes("pending")
        ? "pending"
        : "available";
    const first = list[0];
    const price =
      status === "available" ? safePlanPrice(planId, first.classGrade, first.curriculum, days, hours, mode, config) : null;
    return { days, hours, status, price };
  });
};

export const getAvailableOptions = (planId, students, mode, config = FEE_CONFIG) =>
  getPlanOptions(planId, students, mode, config).filter((opt) => opt.status === "available");

export const isPlanAvailable = (planId, students, mode, config = FEE_CONFIG) =>
  getAvailableOptions(planId, students, mode, config).length > 0;

export const getSiblingPercent = (studentCount, config = FEE_CONFIG) => {
  const table = config.sibling.percentByStudentCount;
  if (studentCount >= 3) return table[3] || 0;
  if (studentCount === 2) return table[2] || 0;
  return 0;
};

const subjectPricingApplies = (planId, config) =>
  config.subjectPricing.enabled && config.subjectPricing.appliesToPlans.includes(planId);

const buildSubjectLines = (planId, planPrice, subjects, config) => {
  const names = Array.isArray(subjects) ? subjects.filter((s) => typeof s === "string" && s.trim()) : [];
  if (!subjectPricingApplies(planId, config)) {
    return { lines: names.map((name) => ({ name, included: true })), fee: planPrice, gross: planPrice, discount: 0 };
  }
  const pct = config.subjectPricing.additionalSubjectDiscountPercent;
  const lines = names.map((name, idx) => {
    const discountPercent = idx === 0 ? 0 : pct;
    const discountAmount = roundTo(planPrice * (discountPercent / 100), config.rounding.discountRoundTo);
    return { name, basePrice: planPrice, discountPercent, discountAmount, finalPrice: planPrice - discountAmount };
  });
  const gross = lines.reduce((sum, l) => sum + l.basePrice, 0);
  const discount = lines.reduce((sum, l) => sum + l.discountAmount, 0);
  return { lines, fee: gross - discount, gross, discount };
};

// Full fee quote for an enquiry. Returns { ok: true, ... } or { ok: false, errors }.
//
// Order: plan price per student → subject discount (per student, when enabled)
// → sibling concession on the combined monthly total → prepayment totals (display only).
export const calculateQuote = (
  { planType, daysPerWeek, hoursPerDay, preferredMode, wards } = {},
  config = FEE_CONFIG
) => {
  const students = Array.isArray(wards) ? wards : [];
  const errors = [];
  if (!PLAN_IDS.includes(planType)) {
    errors.push({ code: ERROR_CODES.UNKNOWN_PLAN, message: unknownPlanMessage(planType) });
  }
  if (students.length === 0) {
    errors.push({ code: ERROR_CODES.NO_STUDENTS, message: "At least one student is required." });
  }
  if (errors.length) return { ok: false, errors };

  const subjectsRequired = subjectPricingApplies(planType, config);
  const studentResults = students.map((ward, index) => {
    if (!isPlainObject(ward)) {
      errors.push({ code: ERROR_CODES.INVALID_STUDENT, message: "Student details are invalid.", studentIndex: index });
      return null;
    }
    try {
      const planPrice = calculatePlanPrice(
        planType, ward.classGrade, ward.curriculum, daysPerWeek, hoursPerDay, preferredMode, config
      );
      const subjects = Array.isArray(ward.subjectsNeeded)
        ? ward.subjectsNeeded.filter((s) => typeof s === "string" && s.trim())
        : [];
      if (subjectsRequired && subjects.length === 0) {
        throw new PricingError(ERROR_CODES.SUBJECTS_REQUIRED, "Select at least one subject.");
      }
      const { lines, fee, gross, discount } = buildSubjectLines(planType, planPrice, subjects, config);
      return {
        index,
        studentName: ward.studentName || "",
        classGrade: ward.classGrade,
        curriculum: ward.curriculum,
        gradeGroup: getGradeGroup(ward.classGrade),
        planPrice,
        subjects: lines,
        feeBeforeSubjectDiscount: gross,
        subjectDiscount: discount,
        monthlyFee: fee,
      };
    } catch (err) {
      // Only messages written in this module are returned; anything unexpected is generic.
      errors.push(
        err instanceof PricingError
          ? { code: err.code, message: err.message, studentIndex: index }
          : { code: ERROR_CODES.PRICING_FAILED, message: "This selection could not be priced.", studentIndex: index }
      );
      return null;
    }
  });
  if (errors.length) return { ok: false, errors };

  const studentFees = studentResults.map((s) => s.monthlyFee);
  const totalBaseFee = studentFees.reduce((sum, fee) => sum + fee, 0);
  const siblingConcessionPercent = getSiblingPercent(students.length, config);
  const siblingDiscount = roundTo(totalBaseFee * (siblingConcessionPercent / 100), config.rounding.discountRoundTo);
  const monthlyPayable = totalBaseFee - siblingDiscount;
  const { days, hours } = parseSchedule(daysPerWeek, hoursPerDay, config);
  const totalClasses = days * 4;

  const prepaymentOptions = config.prepayment.enabled
    ? config.prepayment.terms.map(({ months, discountPercent }) => {
        const grossTotal = monthlyPayable * months;
        const discountAmount = roundTo(grossTotal * (discountPercent / 100), config.rounding.discountRoundTo);
        return { months, discountPercent, grossTotal, discountAmount, total: grossTotal - discountAmount };
      })
    : [];

  return {
    ok: true,
    planType,
    daysPerWeek: days,
    hoursPerDay: hours,
    preferredMode,
    students: studentResults,
    totalBeforeSubjectDiscount: studentResults.reduce((sum, s) => sum + s.feeBeforeSubjectDiscount, 0),
    subjectDiscountTotal: studentResults.reduce((sum, s) => sum + s.subjectDiscount, 0),
    studentFees,
    totalBaseFee,
    siblingConcessionPercent,
    siblingDiscount,
    monthlyPayable,
    totalClasses,
    costPerClass: Math.round(monthlyPayable / totalClasses),
    prepaymentOptions,
    rules: {
      subjectPricingEnabled: subjectsRequired,
      additionalSubjectDiscountPercent: config.subjectPricing.additionalSubjectDiscountPercent,
      prepaymentEnabled: config.prepayment.enabled,
    },
  };
};

// Maps a quote onto the existing ParentEnquiry fields, keeping their meanings:
// studentFees = each student's monthly fee; totalBaseFee = their sum before the
// sibling concession; monthlyFees = finalPrice = monthly payable (never a prepayment total).
export const toEnquiryFields = (quote) => ({
  monthlyFees: quote.monthlyPayable,
  finalPrice: quote.monthlyPayable,
  totalBaseFee: quote.totalBaseFee,
  studentFees: quote.studentFees,
  siblingDiscount: quote.siblingDiscount,
  siblingConcessionPercent: quote.siblingConcessionPercent,
  costPerClass: quote.costPerClass,
});

export { GRADE_GROUPS };
