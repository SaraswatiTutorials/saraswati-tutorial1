import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { FEE_CONFIG } from "../../utils/pricing/feeConfig.js";
import {
  ERROR_CODES,
  calculateListPrice,
  calculatePlanPrice,
  calculateQuote,
  getAvailableOptions,
  getComboStatus,
  getEffectiveHourlyRate,
  getEliteHourlyRate,
  getGradeGroup,
  getPlanOptions,
  getStruckListPrice,
  isPlanAvailable,
  toEnquiryFields,
} from "../../utils/pricing/feeEngine.js";

const legacy = JSON.parse(readFileSync(new URL("./fixtures/legacyPrices.json", import.meta.url), "utf8"));

const HOME = "Home Tuition / In-Person";
const ONLINE = "Online / One-to-One Tuition";
const JUNIOR = ["1 to 5", "6", "7"];
const SENIOR = ["8", "9", "10", "11", "12", "PUC", "Degree Courses"];
const STANDARD = [[3, 1.5], [3, 2], [5, 1.5], [5, 2]];
const ELITE = [[3, 1], [3, 1.5], [5, 1], [5, 1.5]];

const withConfig = (mutate) => {
  const config = structuredClone(FEE_CONFIG);
  mutate(config);
  return config;
};

const errorCode = (fn) => {
  try {
    fn();
  } catch (err) {
    return err.code;
  }
  return null;
};

describe("existing approved prices are unchanged", () => {
  test(`all ${legacy.prices.length} legacy plan/grade/board/mode/schedule prices match`, () => {
    for (const row of legacy.prices) {
      const actual = calculatePlanPrice(row.plan, row.classGrade, row.curriculum, row.days, row.hours, row.mode);
      assert.equal(actual, row.price, `${row.plan} ${row.classGrade} ${row.curriculum} ${row.mode} ${row.days}x${row.hours}`);
    }
  });

  test("Foundation struck-through list price matches the legacy 'board' price", () => {
    for (const row of legacy.prices.filter((r) => r.plan === "foundation")) {
      assert.equal(calculateListPrice(row.classGrade, row.curriculum, row.days, row.hours, row.mode), row.listPrice);
    }
  });

  test("legacy multi-student totals map onto the same enquiry fields", () => {
    for (const c of legacy.siblingCases) {
      for (const [mode, expected] of Object.entries(c.results)) {
        const quote = calculateQuote({
          planType: c.plan,
          daysPerWeek: c.option.days,
          hoursPerDay: c.option.hours,
          preferredMode: mode,
          wards: c.wards,
        });
        assert.ok(quote.ok, JSON.stringify(quote.errors));
        const fields = toEnquiryFields(quote);
        assert.deepEqual(fields.studentFees, expected.studentFees);
        assert.equal(fields.totalBaseFee, expected.totalBaseFee);
        assert.equal(fields.siblingConcessionPercent, expected.concessionPercent);
        assert.equal(fields.siblingDiscount, expected.siblingDiscount);
        assert.equal(fields.finalPrice, expected.finalPrice);
        assert.equal(fields.monthlyFees, expected.finalPrice);
        assert.equal(fields.costPerClass, expected.costPerClass);
      }
    }
  });
});

describe("availability matrix", () => {
  test("Foundation is unavailable for Classes 1–7 and available for 8–12, PUC and Degree", () => {
    for (const g of JUNIOR) {
      for (const [d, h] of [...STANDARD, [3, 1], [5, 1]]) assert.equal(getComboStatus("foundation", g, d, h), "unavailable");
      assert.equal(isPlanAvailable("foundation", [{ classGrade: g, curriculum: "CBSE" }]), false);
    }
    for (const g of SENIOR) {
      for (const [d, h] of STANDARD) assert.equal(getComboStatus("foundation", g, d, h), "available");
    }
  });

  test("Advance supports the four existing schedules for every grade", () => {
    for (const g of [...JUNIOR, ...SENIOR]) {
      for (const [d, h] of STANDARD) assert.equal(getComboStatus("advance", g, d, h), "available", `${g} ${d}x${h}`);
    }
  });

  test("Advance 1-hour (3 and 5 days) is offered for Classes 1–7 at the document's base prices", () => {
    // [class, 3×1 home, 5×1 home]: base × 1.18 (Advance up to Class 7), nearest ₹100
    for (const [g, d3, d5] of [["1 to 5", 5300, 7100], ["6", 5900, 7100], ["7", 6500, 7700]]) {
      assert.equal(getComboStatus("advance", g, 3, 1), "available");
      assert.equal(getComboStatus("advance", g, 5, 1), "available");
      assert.equal(calculatePlanPrice("advance", g, "CBSE", 3, 1, HOME), d3);
      assert.equal(calculatePlanPrice("advance", g, "CBSE", 5, 1, HOME), d5);
    }
    assert.equal(calculatePlanPrice("advance", "6", "CBSE", 3, 1, ONLINE), 4150); // 5000 × 1.18 × 0.7, nearest ₹50
  });

  test("Advance 1-hour is unavailable for Class 8 to Degree", () => {
    for (const g of SENIOR) {
      assert.equal(getComboStatus("advance", g, 3, 1), "unavailable");
      assert.equal(getComboStatus("advance", g, 5, 1), "unavailable");
      assert.equal(errorCode(() => calculatePlanPrice("advance", g, "CBSE", 3, 1, HOME)), ERROR_CODES.UNAVAILABLE);
    }
  });

  test("1-hour sessions in Classes 8–12 exist only on the configured Elite schedules", () => {
    for (const g of SENIOR) {
      for (const plan of ["foundation", "advance"]) {
        assert.equal(getComboStatus(plan, g, 3, 1), "unavailable");
        assert.equal(getComboStatus(plan, g, 5, 1), "unavailable");
      }
      assert.equal(getComboStatus("elite", g, 3, 1), "available");
      assert.equal(getComboStatus("elite", g, 5, 1), "available");
    }
  });

  test("Elite keeps its four schedules for every grade; 2-hour Elite stays unavailable", () => {
    for (const g of [...JUNIOR, ...SENIOR]) {
      for (const [d, h] of ELITE) assert.equal(getComboStatus("elite", g, d, h), "available");
      assert.equal(getComboStatus("elite", g, 3, 2), "unavailable");
      assert.equal(getComboStatus("elite", g, 5, 2), "unavailable");
    }
  });

  test("a missing 1-hour price hides that schedule for that grade only", () => {
    const config = withConfig((c) => {
      c.pendingBasePrices.advance["3_1.0"]["Grade 6"] = null;
    });
    assert.equal(getComboStatus("advance", "6", 3, 1, config), "pending");
    assert.equal(errorCode(() => calculatePlanPrice("advance", "6", "CBSE", 3, 1, HOME, config)), ERROR_CODES.PRICE_PENDING);
    assert.ok(!getAvailableOptions("advance", [{ classGrade: "6", curriculum: "CBSE" }], HOME, config)
      .some((o) => o.days === 3 && o.hours === 1));
    assert.equal(getComboStatus("advance", "7", 3, 1, config), "available");
    assert.equal(getComboStatus("foundation", "6", 3, 1, config), "unavailable");
  });

  test("display order matches the existing plan option order", () => {
    const student = [{ classGrade: "9", curriculum: "CBSE" }];
    assert.deepEqual(getAvailableOptions("foundation", student, HOME).map((o) => [o.days, o.hours]), STANDARD);
    assert.deepEqual(getAvailableOptions("advance", student, HOME).map((o) => [o.days, o.hours]), STANDARD);
    assert.deepEqual(getAvailableOptions("elite", student, HOME).map((o) => [o.days, o.hours]), ELITE);
    assert.deepEqual(
      getAvailableOptions("advance", [{ classGrade: "6", curriculum: "CBSE" }], HOME).map((o) => [o.days, o.hours]),
      [[3, 1], [3, 1.5], [3, 2], [5, 1], [5, 1.5], [5, 2]]
    );
  });

  test("siblings in Class 6 and Class 9 are not offered Advance 1-hour (needs every student eligible)", () => {
    const wards = [{ classGrade: "6", curriculum: "CBSE" }, { classGrade: "9", curriculum: "CBSE" }];
    assert.deepEqual(getAvailableOptions("advance", wards, HOME).map((o) => [o.days, o.hours]), STANDARD);
  });
});

describe("missing prices and invalid input are rejected, never substituted", () => {
  test("unknown grade, plan and unavailable schedules raise explicit errors", () => {
    assert.equal(errorCode(() => calculatePlanPrice("advance", "", "CBSE", 3, 1.5, HOME)), ERROR_CODES.UNKNOWN_GRADE);
    assert.equal(errorCode(() => calculatePlanPrice("advance", "Class 13", "CBSE", 3, 1.5, HOME)), ERROR_CODES.UNKNOWN_GRADE);
    assert.equal(errorCode(() => calculatePlanPrice("platinum", "9", "CBSE", 3, 1.5, HOME)), ERROR_CODES.UNKNOWN_PLAN);
    assert.equal(errorCode(() => calculatePlanPrice("foundation", "9", "CBSE", 3, 1, HOME)), ERROR_CODES.UNAVAILABLE);
    assert.equal(errorCode(() => calculatePlanPrice("advance", "9", "CBSE", 4, 1.5, HOME)), ERROR_CODES.INVALID_SCHEDULE);
    assert.equal(errorCode(() => calculatePlanPrice("advance", "9", "CBSE", null, null, HOME)), ERROR_CODES.INVALID_SCHEDULE);
  });

  test("a schedule whose price is missing from the table becomes pending and cannot be priced", () => {
    const config = withConfig((c) => {
      delete c.masterPrices["Grade 9"]["5_2.0"];
    });
    assert.equal(errorCode(() => calculatePlanPrice("advance", "9", "CBSE", 5, 2, HOME, config)), ERROR_CODES.PRICE_PENDING);
    assert.equal(getComboStatus("advance", "9", 5, 2, config), "pending");
  });

  test("the old fallback (3×1 charged at the 3×1.5 price) is gone", () => {
    const quote = calculateQuote({
      planType: "advance", daysPerWeek: 3, hoursPerDay: 1, preferredMode: HOME,
      wards: [{ classGrade: "6", curriculum: "CBSE", subjectsNeeded: ["Mathematics"] }],
    });
    assert.ok(quote.ok, JSON.stringify(quote.errors));
    assert.equal(quote.monthlyPayable, 5900); // its own 1-hour price, not the 3×1.5 price (8600)
  });
});

describe("session-length and schedule validation", () => {
  test("off-grid or wrongly typed hours are rejected, never rounded", () => {
    for (const hours of [1.46, 1.4999, 1.55, 1.05, 2.5, 0.5, 0, -1.5, NaN, Infinity, true, [1.5], {}, "1.5abc", "", " ", "1,5", null, undefined]) {
      assert.equal(
        errorCode(() => calculatePlanPrice("advance", "9", "CBSE", 3, hours, HOME)),
        ERROR_CODES.INVALID_SCHEDULE,
        `hours ${JSON.stringify(hours)}`
      );
      assert.equal(getComboStatus("advance", "9", 3, hours), "unavailable");
      assert.equal(calculateListPrice("9", "CBSE", 3, hours, HOME), null);
    }
  });

  test("off-grid or wrongly typed days are rejected", () => {
    for (const days of [3.04, 4, 2, 6, 0, -3, true, [3], "3x", ""]) {
      assert.equal(
        errorCode(() => calculatePlanPrice("advance", "9", "CBSE", days, 1.5, HOME)),
        ERROR_CODES.INVALID_SCHEDULE,
        `days ${JSON.stringify(days)}`
      );
    }
  });

  test("supported values still calculate, including numeric strings", () => {
    assert.equal(calculatePlanPrice("advance", "9", "CBSE", 3, 1.5, HOME), 9000);
    assert.equal(calculatePlanPrice("advance", "9", "CBSE", "3", "1.5", HOME), 9000);
    assert.equal(calculatePlanPrice("advance", "9", "CBSE", 5, 2, HOME), 13600);
    assert.equal(calculatePlanPrice("elite", "9", "CBSE", 3, 1, HOME), 6600);
    const q = calculateQuote({ planType: "advance", daysPerWeek: "3", hoursPerDay: "1.5", preferredMode: HOME,
      wards: [{ classGrade: "9", curriculum: "CBSE" }] });
    assert.equal(q.ok, true);
    assert.equal(q.hoursPerDay, 1.5);
    assert.equal(q.daysPerWeek, 3);
  });

  test("a quote with 1.46 hours is rejected", () => {
    const q = calculateQuote({ planType: "advance", daysPerWeek: 3, hoursPerDay: 1.46, preferredMode: HOME,
      wards: [{ classGrade: "9", curriculum: "CBSE" }] });
    assert.equal(q.ok, false);
    assert.equal(q.errors[0].code, ERROR_CODES.INVALID_SCHEDULE);
  });
});

describe("malformed student input", () => {
  const base = { planType: "advance", daysPerWeek: 3, hoursPerDay: 1.5, preferredMode: HOME };

  test("null, primitive and array students give a safe INVALID_STUDENT error", () => {
    for (const ward of [null, 5, "x", [], true]) {
      const q = calculateQuote({ ...base, wards: [ward] });
      assert.equal(q.ok, false);
      assert.equal(q.errors[0].code, ERROR_CODES.INVALID_STUDENT);
      assert.equal(q.errors[0].message, "Student details are invalid.");
    }
  });

  test("non-string class or board values are not coerced", () => {
    assert.equal(getGradeGroup(["6"]), null);
    assert.equal(getGradeGroup(6), null);
    const q = calculateQuote({ ...base, wards: [{ classGrade: ["9"], curriculum: "CBSE" }] });
    assert.equal(q.errors[0].code, ERROR_CODES.UNKNOWN_GRADE);
  });

  test("non-string subjects are ignored", () => {
    const config = withConfig((c) => {
      c.subjectPricing.enabled = true;
    });
    const q = calculateQuote({ ...base, wards: [{ classGrade: "9", curriculum: "CBSE", subjectsNeeded: [{}, 5, "Maths", null] }] }, config);
    assert.deepEqual(q.students[0].subjects.map((s) => s.name), ["Maths"]);
  });

  test("getPlanOptions tolerates malformed students instead of throwing", () => {
    const opts = getPlanOptions("advance", [null, 7, { classGrade: "9" }], HOME);
    assert.ok(opts.every((o) => o.status === "unavailable"));
  });

  test("error messages never contain internal exception text", () => {
    const q = calculateQuote({ ...base, wards: [null, { classGrade: "9" }, { classGrade: {} }] });
    for (const e of q.errors) assert.doesNotMatch(e.message, /Cannot read|TypeError|undefined|null/);
  });
});

describe("effective hourly rate (display)", () => {
  test("home Elite: equals the configured hourly rate for every legacy case", () => {
    for (const row of legacy.prices.filter((r) => r.plan === "elite" && r.mode === HOME)) {
      assert.equal(getEffectiveHourlyRate(row.price, row.days, row.hours), getEliteHourlyRate(row.classGrade, row.curriculum));
    }
  });

  test("online: derived from the actual online monthly price", () => {
    const price = calculatePlanPrice("elite", "9", "CBSE", 3, 1, ONLINE); // 6600 × 0.7 → ₹4,600
    assert.equal(price, 4600);
    assert.equal(getEffectiveHourlyRate(price, 3, 1), Math.round(4600 / 12));
  });

  test("invalid schedule or price returns null", () => {
    assert.equal(getEffectiveHourlyRate(4600, 3, 1.46), null);
    assert.equal(getEffectiveHourlyRate(null, 3, 1), null);
  });
});

describe("grade labels", () => {
  test("homepage and enquiry-form labels resolve to the same group and price", () => {
    const pairs = [["Grade 1–5", "1 to 5"], ["Grade 6", "6"], ["Grade 7", "7"], ["Grade 12", "12"], ["Degree", "Degree Courses"]];
    for (const [home, form] of pairs) {
      assert.equal(getGradeGroup(home), getGradeGroup(form));
      for (const plan of ["advance", "elite"]) {
        assert.equal(
          calculatePlanPrice(plan, home, "CBSE", 3, 1.5, HOME),
          calculatePlanPrice(plan, form, "CBSE", 3, 1.5, HOME)
        );
      }
    }
  });

  test("homepage 'Grade 1–5' Advance now matches the enquiry form (legacy homepage showed ₹6,400)", () => {
    assert.equal(calculatePlanPrice("advance", "Grade 1–5", "CBSE", 3, 1.5, HOME), 7500);
  });
});

describe("subject-wise pricing", () => {
  const enabled = withConfig((c) => {
    c.subjectPricing.enabled = true;
  });
  const quoteFor = (subjects, config = enabled, extra = {}) =>
    calculateQuote(
      {
        planType: "advance", daysPerWeek: 3, hoursPerDay: 1.5, preferredMode: HOME,
        wards: [{ classGrade: "6", curriculum: "CBSE", subjectsNeeded: subjects }],
        ...extra,
      },
      config
    );

  test("disabled by default: one fee covers all subjects (existing behaviour)", () => {
    const q = quoteFor(["Mathematics", "Science", "English"], FEE_CONFIG);
    assert.equal(q.rules.subjectPricingEnabled, false);
    assert.equal(q.monthlyPayable, 8600);
    assert.ok(q.students[0].subjects.every((s) => s.included === true));
  });

  test("one subject receives no additional-subject discount", () => {
    const q = quoteFor(["Mathematics"]);
    assert.equal(q.students[0].subjects[0].discountPercent, 0);
    assert.equal(q.monthlyPayable, 8600);
  });

  test("two subjects: the second is 10% off", () => {
    const q = quoteFor(["Mathematics", "Science"]);
    const [first, second] = q.students[0].subjects;
    assert.deepEqual([first.finalPrice, second.discountPercent, second.discountAmount, second.finalPrice], [8600, 10, 860, 7740]);
    assert.equal(q.monthlyPayable, 16340);
  });

  test("three or more: every subject after the first is 10% off, and totals equal the sum of lines", () => {
    const q = quoteFor(["Mathematics", "Science", "English", "Hindi"]);
    const lines = q.students[0].subjects;
    assert.deepEqual(lines.map((l) => l.discountPercent), [0, 10, 10, 10]);
    assert.equal(q.students[0].monthlyFee, lines.reduce((s, l) => s + l.finalPrice, 0));
    assert.equal(q.subjectDiscountTotal, 860 * 3);
    assert.equal(q.totalBeforeSubjectDiscount, 8600 * 4);
    assert.equal(q.monthlyPayable, 8600 + 7740 * 3);
  });

  test("subjects for students in different grades use each student's own price", () => {
    const q = calculateQuote(
      {
        planType: "advance", daysPerWeek: 5, hoursPerDay: 2, preferredMode: HOME,
        wards: [
          { classGrade: "1 to 5", curriculum: "CBSE", subjectsNeeded: ["Mathematics", "English"] },
          { classGrade: "11", curriculum: "IB", subjectsNeeded: ["Physics"] },
        ],
      },
      enabled
    );
    const p1 = calculatePlanPrice("advance", "1 to 5", "CBSE", 5, 2, HOME);
    const p2 = calculatePlanPrice("advance", "11", "IB", 5, 2, HOME);
    assert.deepEqual(q.studentFees, [p1 + (p1 - Math.round(p1 * 0.1)), p2]);
  });

  test("a student with no subjects cannot be priced while subject pricing is enabled", () => {
    const q = quoteFor([]);
    assert.equal(q.ok, false);
    assert.equal(q.errors[0].code, ERROR_CODES.SUBJECTS_REQUIRED);
  });

  test("plans outside appliesToPlans keep a single fee", () => {
    const config = withConfig((c) => {
      c.subjectPricing.enabled = true;
      c.subjectPricing.appliesToPlans = ["foundation", "advance"];
    });
    const q = calculateQuote(
      { planType: "elite", daysPerWeek: 3, hoursPerDay: 1, preferredMode: HOME,
        wards: [{ classGrade: "9", curriculum: "CBSE", subjectsNeeded: ["Mathematics", "Science"] }] },
      config
    );
    assert.equal(q.rules.subjectPricingEnabled, false);
    assert.equal(q.monthlyPayable, calculatePlanPrice("elite", "9", "CBSE", 3, 1, HOME));
  });
});

describe("sibling concession", () => {
  const ward = (classGrade) => ({ classGrade, curriculum: "CBSE", subjectsNeeded: ["Mathematics"] });
  const quote = (wards, config) =>
    calculateQuote({ planType: "advance", daysPerWeek: 3, hoursPerDay: 1.5, preferredMode: HOME, wards }, config);

  test("existing rates stay live: none for one student, 25% for two, 35% for three or more", () => {
    assert.equal(quote([ward("6")]).siblingConcessionPercent, 0);
    assert.equal(quote([ward("6"), ward("9")]).siblingConcessionPercent, 25);
    assert.equal(quote([ward("6"), ward("9"), ward("12")]).siblingConcessionPercent, 35);
    assert.equal(quote([ward("6"), ward("9"), ward("12"), ward("8")]).siblingConcessionPercent, 35);
  });

  test("applied once to the combined monthly total", () => {
    const q = quote([ward("6"), ward("9")]);
    assert.equal(q.totalBaseFee, 8600 + 9000);
    assert.equal(q.siblingDiscount, Math.round(17600 * 0.25));
    assert.equal(q.monthlyPayable, q.totalBaseFee - q.siblingDiscount);
  });

  test("the requested 10% rate works when configured", () => {
    const config = withConfig((c) => {
      c.sibling.percentByStudentCount = { 2: 10, 3: 10 };
    });
    const q = quote([ward("6"), ward("9")], config);
    assert.equal(q.siblingDiscount, 1760);
    assert.equal(q.monthlyPayable, 15840);
  });

  test("with subject pricing enabled, the sibling discount applies after subject discounts", () => {
    const config = withConfig((c) => {
      c.subjectPricing.enabled = true;
    });
    const q = quote([{ ...ward("6"), subjectsNeeded: ["Mathematics", "Science"] }, ward("9")], config);
    assert.equal(q.totalBaseFee, 8600 + 7740 + 9000);
    assert.equal(q.siblingDiscount, Math.round(25340 * 0.25));
  });

  test("options are limited to those every student qualifies for", () => {
    const opts = getPlanOptions("foundation", [{ classGrade: "6" }, { classGrade: "10" }], HOME);
    assert.ok(opts.every((o) => o.status === "unavailable"));
    assert.equal(isPlanAvailable("foundation", [{ classGrade: "9" }, { classGrade: "10" }], HOME), true);
  });
});

describe("prepayment", () => {
  const base = { planType: "advance", daysPerWeek: 3, hoursPerDay: 1.5, preferredMode: HOME,
    wards: [{ classGrade: "6", curriculum: "CBSE", subjectsNeeded: ["Mathematics"] }] };

  test("disabled by default: no prepayment options are returned", () => {
    assert.deepEqual(calculateQuote(base).prepaymentOptions, []);
  });

  test("3, 6 and 12 months at 5%, 10% and 15% of the monthly payable", () => {
    const config = withConfig((c) => {
      c.prepayment.enabled = true;
    });
    const q = calculateQuote(base, config);
    assert.deepEqual(
      q.prepaymentOptions.map((o) => [o.months, o.discountPercent, o.grossTotal, o.discountAmount, o.total]),
      [
        [3, 5, 25800, 1290, 24510],
        [6, 10, 51600, 5160, 46440],
        [12, 15, 103200, 15480, 87720],
      ]
    );
  });

  test("prepayment never changes the stored monthly fields", () => {
    const config = withConfig((c) => {
      c.prepayment.enabled = true;
    });
    const fields = toEnquiryFields(calculateQuote(base, config));
    assert.equal(fields.finalPrice, 8600);
    assert.equal(fields.monthlyFees, 8600);
  });
});

describe("rounding", () => {
  test("home Foundation/Advance round to ₹100, online to ₹50, Elite home to ₹1", () => {
    for (const row of legacy.prices) {
      if (row.mode === ONLINE) assert.equal(row.price % 50, 0);
      else if (row.plan !== "elite") assert.equal(row.price % 100, 0);
      assert.equal(calculatePlanPrice(row.plan, row.classGrade, row.curriculum, row.days, row.hours, row.mode) % 1, 0);
    }
  });

  test("discounts are whole rupees and use the configured rounding step", () => {
    const config = withConfig((c) => {
      c.subjectPricing.enabled = true;
      c.prepayment.enabled = true;
    });
    const q = calculateQuote(
      { planType: "elite", daysPerWeek: 3, hoursPerDay: 1.5, preferredMode: HOME,
        wards: [
          { classGrade: "1 to 5", curriculum: "IB", subjectsNeeded: ["Mathematics", "Science"] },
          { classGrade: "9", curriculum: "IGCSE", subjectsNeeded: ["English"] },
          { classGrade: "7", curriculum: "CBSE", subjectsNeeded: ["Hindi"] },
        ] },
      config
    );
    const amounts = [
      q.siblingDiscount,
      ...q.students.flatMap((s) => s.subjects.map((l) => l.discountAmount)),
      ...q.prepaymentOptions.map((o) => o.discountAmount),
    ];
    assert.ok(amounts.every(Number.isInteger));

    const tens = withConfig((c) => {
      c.prepayment.enabled = true;
      c.rounding.discountRoundTo = 10;
    });
    const q10 = calculateQuote(
      { planType: "elite", daysPerWeek: 3, hoursPerDay: 1, preferredMode: HOME,
        wards: [{ classGrade: "9", curriculum: "IGCSE" }] },
      tens
    );
    assert.ok(q10.prepaymentOptions.every((o) => o.discountAmount % 10 === 0));
  });
});

describe("struck-through list price (display)", () => {
  const quoteFor = (planType, classGrade, days, hours, mode = HOME) =>
    calculateQuote({ planType, daysPerWeek: days, hoursPerDay: hours, preferredMode: mode,
      wards: [{ classGrade, curriculum: "CBSE" }] });

  test("valid Foundation fee shows the list price beside it", () => {
    const quote = quoteFor("foundation", "9", "3", "2");
    assert.equal(quote.ok, true);
    assert.equal(quote.monthlyPayable, 8700);
    assert.equal(getStruckListPrice(quote), 10626);
  });

  test("invalid saved Foundation plan (Class 6) shows no list price", () => {
    const quote = quoteFor("foundation", "6", "3", "2");
    assert.equal(quote.ok, false);
    assert.equal(getStruckListPrice(quote), null);
    // The list price itself still exists, so the guard is what hides it.
    assert.notEqual(calculateListPrice("6", "CBSE", "3", "2", HOME), null);
  });

  test("unsupported schedule, missing quote or missing fee shows no list price", () => {
    assert.equal(getStruckListPrice(quoteFor("foundation", "9", "3", "1")), null);
    assert.equal(getStruckListPrice(undefined), null);
    assert.equal(getStruckListPrice(null), null);
    const quote = quoteFor("foundation", "9", "3", "2");
    for (const monthlyPayable of [null, undefined, 0, NaN, "8700"]) {
      assert.equal(getStruckListPrice({ ...quote, monthlyPayable }), null);
    }
  });

  test("Advance and Elite never show a list price", () => {
    assert.equal(getStruckListPrice(quoteFor("advance", "9", "3", "2")), null);
    assert.equal(getStruckListPrice(quoteFor("elite", "9", "3", "1.5")), null);
  });

  test("helper does not change the quoted fee", () => {
    const quote = quoteFor("foundation", "9", "3", "2");
    const before = JSON.stringify(quote);
    getStruckListPrice(quote);
    assert.equal(JSON.stringify(quote), before);
  });
});
