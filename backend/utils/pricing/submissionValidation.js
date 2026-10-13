// Server-side check of the fees submitted with a parent enquiry.
// Pure functions: they never read from or write to the database.

import { FEE_CONFIG } from "./feeConfig.js";
import { calculateQuote, toEnquiryFields } from "./feeEngine.js";

// Existing ParentEnquiry fee fields compared against the server calculation.
export const ENQUIRY_FEE_FIELDS = [
  "studentFees",
  "totalBaseFee",
  "siblingDiscount",
  "siblingConcessionPercent",
  "monthlyFees",
  "finalPrice",
];

export const ENFORCEMENT_MODES = ["off", "log", "enforce"];

const sameValue = (submitted, expected) => {
  if (Array.isArray(expected)) {
    return (
      Array.isArray(submitted) &&
      submitted.length === expected.length &&
      submitted.every((v, i) => Number(v) === expected[i])
    );
  }
  return submitted !== null && submitted !== undefined && submitted !== "" && Number(submitted) === expected;
};

// Returns { status, errors, expected, mismatches }.
// status: "skipped" (no plan chosen) | "invalid" (combination cannot be priced)
//       | "mismatch" (submitted amounts differ) | "valid".
export const validateSubmittedPricing = (body = {}, config = FEE_CONFIG) => {
  if (!body.planType) {
    return { status: "skipped", errors: [], expected: null, mismatches: [] };
  }

  const quote = calculateQuote(body, config);
  if (!quote.ok) {
    return { status: "invalid", errors: quote.errors, expected: null, mismatches: [] };
  }

  const all = toEnquiryFields(quote);
  const expected = Object.fromEntries(ENQUIRY_FEE_FIELDS.map((f) => [f, all[f]]));
  const mismatches = ENQUIRY_FEE_FIELDS.filter((f) => !sameValue(body[f], expected[f])).map((field) => ({
    field,
    submitted: body[field] ?? null,
    expected: expected[field],
  }));

  return { status: mismatches.length ? "mismatch" : "valid", errors: [], expected, mismatches };
};

export const resolveEnforcementMode = (value) => {
  const mode = String(value || "off").trim().toLowerCase();
  return ENFORCEMENT_MODES.includes(mode) ? mode : "off";
};

// Decides what the enquiry route does with a submission.
//   off     — no check; the body is saved exactly as today (default).
//   log     — check and log problems; the body is saved unchanged.
//   enforce — reject unpriceable combinations; replace submitted fee fields with
//             server-calculated values (same fields, same meanings).
// Returns { action: "allow" | "reject", body, result, message? }.
export const applyPricingPolicy = (body, mode, logger = console, config = FEE_CONFIG) => {
  const resolved = resolveEnforcementMode(mode);
  if (resolved === "off") return { action: "allow", body, result: null };

  const result = validateSubmittedPricing(body, config);

  if (resolved === "log") {
    if (result.status === "invalid" || result.status === "mismatch") {
      logger.warn("[Pricing] Submitted enquiry fees failed validation:", {
        status: result.status,
        errors: result.errors,
        mismatches: result.mismatches,
      });
    }
    return { action: "allow", body, result };
  }

  if (result.status === "invalid") {
    return {
      action: "reject",
      body,
      result,
      message: result.errors.map((e) => e.message).join(" ") || "The selected plan is not available.",
    };
  }
  if (result.status === "skipped") return { action: "allow", body, result };

  return { action: "allow", body: { ...body, ...result.expected }, result };
};
