import express from "express";
import { FEE_CONFIG } from "../utils/pricing/feeConfig.js";
import { PLAN_IDS, calculateQuote, getPlanOptions, isPlainObject } from "../utils/pricing/feeEngine.js";

// Read-only pricing endpoints. They use the in-code fee configuration only and
// never touch the database. Responses never include internal error details.
const router = express.Router();

const INVALID_REQUEST = "Invalid pricing request.";
const SERVER_ERROR = "Pricing is temporarily unavailable.";

const rulesSummary = () => ({
  subjectPricingEnabled: FEE_CONFIG.subjectPricing.enabled,
  additionalSubjectDiscountPercent: FEE_CONFIG.subjectPricing.additionalSubjectDiscountPercent,
  siblingPercentByStudentCount: FEE_CONFIG.sibling.percentByStudentCount,
  prepaymentEnabled: FEE_CONFIG.prepayment.enabled,
  prepaymentTerms: FEE_CONFIG.prepayment.enabled ? FEE_CONFIG.prepayment.terms : [],
});

const buildOptions = (wards, mode) =>
  PLAN_IDS.map((id) => {
    const options = getPlanOptions(id, wards, mode);
    return { id, available: options.some((o) => o.status === "available"), options };
  });

// ── Request validation (type/shape only; pricing rules live in the engine) ──
const isOptionalString = (v) => v === undefined || v === null || typeof v === "string";
const isNonEmptyString = (v) => typeof v === "string" && v.trim() !== "";
const isScheduleValue = (v) => typeof v === "number" || typeof v === "string";

const validateWards = (wards) => {
  if (!Array.isArray(wards) || wards.length === 0) {
    return [{ field: "wards", message: "must be a non-empty list of students" }];
  }
  const errors = [];
  wards.forEach((ward, i) => {
    if (!isPlainObject(ward)) {
      errors.push({ field: `wards[${i}]`, message: "must be an object" });
      return;
    }
    if (!isNonEmptyString(ward.classGrade)) errors.push({ field: `wards[${i}].classGrade`, message: "must be a non-empty string" });
    if (!isOptionalString(ward.curriculum)) errors.push({ field: `wards[${i}].curriculum`, message: "must be a string" });
    if (!isOptionalString(ward.studentName)) errors.push({ field: `wards[${i}].studentName`, message: "must be a string" });
    if (ward.subjectsNeeded !== undefined && !(Array.isArray(ward.subjectsNeeded) && ward.subjectsNeeded.every((s) => typeof s === "string"))) {
      errors.push({ field: `wards[${i}].subjectsNeeded`, message: "must be a list of strings" });
    }
  });
  return errors;
};

const badRequest = (res, errors) => res.status(400).json({ message: INVALID_REQUEST, errors });

// Runs a handler and turns any unexpected exception into a generic 500.
const safe = (handler) => (req, res) => {
  try {
    handler(req, res);
  } catch (err) {
    console.error("[Pricing] Unexpected error:", err);
    res.status(500).json({ message: SERVER_ERROR });
  }
};

// =============================================================
// GET /api/pricing/options?classGrade=6&curriculum=CBSE&mode=Online
// Plans and schedules for a single student, with monthly prices.
// =============================================================
router.get("/options", safe((req, res) => {
  const { classGrade, curriculum, mode } = req.query || {};
  const errors = [];
  if (!isNonEmptyString(classGrade)) errors.push({ field: "classGrade", message: "must be a non-empty string" });
  if (!isOptionalString(curriculum)) errors.push({ field: "curriculum", message: "must be a string" });
  if (!isOptionalString(mode)) errors.push({ field: "mode", message: "must be a string" });
  if (errors.length) return badRequest(res, errors);

  res.json({ plans: buildOptions([{ classGrade, curriculum }], mode), rules: rulesSummary() });
}));

// =============================================================
// POST /api/pricing/options  { wards: [...], preferredMode }
// Options offered to every student on one enquiry.
// =============================================================
router.post("/options", safe((req, res) => {
  if (!isPlainObject(req.body)) return badRequest(res, [{ field: "body", message: "must be a JSON object" }]);
  const errors = validateWards(req.body.wards);
  if (!isOptionalString(req.body.preferredMode)) errors.push({ field: "preferredMode", message: "must be a string" });
  if (errors.length) return badRequest(res, errors);

  res.json({ plans: buildOptions(req.body.wards, req.body.preferredMode), rules: rulesSummary() });
}));

// =============================================================
// POST /api/pricing/quote
// { planType, daysPerWeek, hoursPerDay, preferredMode, wards: [{ classGrade, curriculum, subjectsNeeded }] }
// =============================================================
router.post("/quote", safe((req, res) => {
  if (!isPlainObject(req.body)) return badRequest(res, [{ field: "body", message: "must be a JSON object" }]);
  const { planType, daysPerWeek, hoursPerDay, preferredMode, wards } = req.body;
  const errors = validateWards(wards);
  if (typeof planType !== "string") errors.push({ field: "planType", message: "must be a string" });
  if (!isScheduleValue(daysPerWeek)) errors.push({ field: "daysPerWeek", message: "must be a number" });
  if (!isScheduleValue(hoursPerDay)) errors.push({ field: "hoursPerDay", message: "must be a number" });
  if (!isOptionalString(preferredMode)) errors.push({ field: "preferredMode", message: "must be a string" });
  if (errors.length) return badRequest(res, errors);

  const quote = calculateQuote({ planType, daysPerWeek, hoursPerDay, preferredMode, wards });
  if (!quote.ok) {
    // Engine errors carry only messages written in the fee engine.
    return res.status(400).json({
      message: "This combination cannot be priced.",
      errors: quote.errors.map(({ code, message, studentIndex }) => ({ code, message, studentIndex })),
    });
  }
  res.json(quote);
}));

// Error handler for /api/pricing (mounted in server.js after the router). Catches
// body-parser failures such as malformed JSON, which happen before the router runs.
// eslint-disable-next-line no-unused-vars
export const pricingErrorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error("[Pricing] Unexpected error:", err);
  res.status(status).json({ message: status === 500 ? SERVER_ERROR : INVALID_REQUEST });
};

export default router;
