import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { calculateQuote, toEnquiryFields } from "../../utils/pricing/feeEngine.js";
import {
  ENQUIRY_FEE_FIELDS,
  applyPricingPolicy,
  resolveEnforcementMode,
  validateSubmittedPricing,
} from "../../utils/pricing/submissionValidation.js";

const HOME = "Home Tuition / In-Person";

// A submission as the enquiry form sends it today (fee fields included).
const honestSubmission = (overrides = {}) => {
  const body = {
    parentName: "Test Parent",
    phone: "9999999999",
    planType: "advance",
    daysPerWeek: 3,
    hoursPerDay: 1.5,
    preferredMode: HOME,
    preferredDays: ["Monday", "Wednesday", "Friday"],
    wards: [
      { studentName: "A", classGrade: "6", curriculum: "CBSE", subjectsNeeded: ["Mathematics"] },
      { studentName: "B", classGrade: "9", curriculum: "IB", subjectsNeeded: ["Physics", "Chemistry"] },
    ],
    pricingConsent: true,
    discount: null,
    ...overrides,
  };
  const quote = calculateQuote(body);
  const { costPerClass, ...fields } = toEnquiryFields(quote);
  return { ...body, ...fields, costPerClass, ...overrides };
};

const silentLogger = () => {
  const calls = [];
  return { calls, warn: (...args) => calls.push(args) };
};

describe("validateSubmittedPricing", () => {
  test("an honest submission is valid", () => {
    const result = validateSubmittedPricing(honestSubmission());
    assert.equal(result.status, "valid");
    assert.deepEqual(result.mismatches, []);
  });

  test("no plan selected is skipped (existing behaviour allows it)", () => {
    assert.equal(validateSubmittedPricing({ planType: "" }).status, "skipped");
  });

  for (const [label, tamper] of [
    ["lowered finalPrice", { finalPrice: 100 }],
    ["lowered monthlyFees", { monthlyFees: 100 }],
    ["edited studentFees", { studentFees: [1, 1] }],
    ["inflated sibling percent", { siblingConcessionPercent: 50 }],
    ["inflated sibling discount", { siblingDiscount: 99999 }],
    ["edited totalBaseFee", { totalBaseFee: 5 }],
    ["missing fee fields", { finalPrice: undefined, monthlyFees: null }],
    ["numeric strings with wrong values", { finalPrice: "100" }],
  ]) {
    test(`detects tampering: ${label}`, () => {
      const submission = { ...honestSubmission(), ...tamper };
      const result = validateSubmittedPricing(submission);
      assert.equal(result.status, "mismatch");
      for (const field of Object.keys(tamper)) {
        assert.ok(result.mismatches.some((m) => m.field === field), `expected mismatch on ${field}`);
      }
    });
  }

  test("a prepayment total stored in finalPrice is rejected as a mismatch", () => {
    const honest = honestSubmission();
    const result = validateSubmittedPricing({ ...honest, finalPrice: honest.finalPrice * 12 });
    assert.equal(result.status, "mismatch");
  });

  test("unavailable combinations are invalid: Foundation for Class 6", () => {
    const result = validateSubmittedPricing(honestSubmission({ planType: "foundation" }));
    assert.equal(result.status, "invalid");
    assert.equal(result.errors[0].code, "UNAVAILABLE");
  });

  test("Advance 3×1 for Class 6 is valid at its own 1-hour price", () => {
    const result = validateSubmittedPricing({
      planType: "advance", daysPerWeek: 3, hoursPerDay: 1, preferredMode: HOME,
      wards: [{ classGrade: "6", curriculum: "CBSE", subjectsNeeded: ["Mathematics"] }],
      finalPrice: 5500, monthlyFees: 5500,
    });
    assert.notEqual(result.status, "invalid", JSON.stringify(result.errors));
  });

  test("1-hour Advance for Class 11 is invalid", () => {
    const result = validateSubmittedPricing({
      planType: "advance", daysPerWeek: 3, hoursPerDay: 1, preferredMode: HOME,
      wards: [{ classGrade: "11", curriculum: "CBSE", subjectsNeeded: ["Mathematics"] }],
    });
    assert.equal(result.status, "invalid");
    assert.equal(result.errors[0].code, "UNAVAILABLE");
  });

  test("1-hour Advance for Degree is invalid", () => {
    const result = validateSubmittedPricing({
      planType: "advance", daysPerWeek: 5, hoursPerDay: 1, preferredMode: HOME,
      wards: [{ classGrade: "Degree Courses", curriculum: "CBSE" }],
    });
    assert.equal(result.status, "invalid");
  });

  test("off-grid hours (1.46) are invalid, not priced as 1.5", () => {
    const result = validateSubmittedPricing(honestSubmission({ hoursPerDay: 1.46 }));
    assert.equal(result.status, "invalid");
    assert.equal(result.errors[0].code, "INVALID_SCHEDULE");
    const out = applyPricingPolicy(honestSubmission({ hoursPerDay: 1.46 }), "enforce", silentLogger());
    assert.equal(out.action, "reject");
  });

  test("null students are invalid with a safe message", () => {
    const result = validateSubmittedPricing(honestSubmission({ wards: [null] }));
    assert.equal(result.status, "invalid");
    assert.equal(result.errors[0].message, "Student details are invalid.");
  });

  test("only existing ParentEnquiry fee fields are compared", () => {
    assert.deepEqual(ENQUIRY_FEE_FIELDS, [
      "studentFees", "totalBaseFee", "siblingDiscount", "siblingConcessionPercent", "monthlyFees", "finalPrice",
    ]);
  });
});

describe("applyPricingPolicy", () => {
  test("mode defaults to off, and unknown values fall back to off", () => {
    assert.equal(resolveEnforcementMode(undefined), "off");
    assert.equal(resolveEnforcementMode("ENFORCE"), "enforce");
    assert.equal(resolveEnforcementMode("strict"), "off");
  });

  test("off: the submitted body object is passed through untouched, even if tampered", () => {
    const body = { ...honestSubmission(), finalPrice: 1 };
    const out = applyPricingPolicy(body, undefined);
    assert.equal(out.action, "allow");
    assert.equal(out.body, body);
    assert.equal(out.result, null);
  });

  test("log: problems are reported, the body is saved unchanged", () => {
    const logger = silentLogger();
    const body = { ...honestSubmission(), finalPrice: 1 };
    const out = applyPricingPolicy(body, "log", logger);
    assert.equal(out.action, "allow");
    assert.equal(out.body, body);
    assert.equal(logger.calls.length, 1);
  });

  test("log: honest submissions produce no log", () => {
    const logger = silentLogger();
    applyPricingPolicy(honestSubmission(), "log", logger);
    assert.equal(logger.calls.length, 0);
  });

  test("enforce: tampered fee fields are replaced with server values; nothing else changes", () => {
    const honest = honestSubmission();
    const tampered = { ...honest, finalPrice: 1, monthlyFees: 1, studentFees: [1, 1], siblingConcessionPercent: 90 };
    const out = applyPricingPolicy(tampered, "enforce", silentLogger());
    assert.equal(out.action, "allow");
    for (const field of ["finalPrice", "monthlyFees", "studentFees", "siblingConcessionPercent", "siblingDiscount", "totalBaseFee"]) {
      assert.deepEqual(out.body[field], honest[field], field);
    }
    for (const field of ["parentName", "phone", "wards", "preferredDays", "pricingConsent", "planType"]) {
      assert.deepEqual(out.body[field], tampered[field], field);
    }
    assert.deepEqual(Object.keys(out.body).sort(), Object.keys(tampered).sort(), "no new keys added");
  });

  test("enforce: unavailable combinations are rejected", () => {
    const out = applyPricingPolicy(honestSubmission({ planType: "foundation" }), "enforce", silentLogger());
    assert.equal(out.action, "reject");
    assert.match(out.message, /not available/);
  });

  test("enforce: enquiries without a plan are allowed unchanged", () => {
    const body = { parentName: "X", planType: "" };
    const out = applyPricingPolicy(body, "enforce", silentLogger());
    assert.equal(out.action, "allow");
    assert.equal(out.body, body);
  });
});
