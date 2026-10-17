import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { FEE_CONFIG } from "../../utils/pricing/feeConfig.js";
import {
  ERROR_CODES,
  calculateListPrice,
  calculatePlanPrice,
  calculateQuote,
  getAvailableOptions,
  getComboStatus,
  getEffectiveHourlyRate,
  getGradeGroup,
  getPlanOptions,
  getStruckListPrice,
  isPlanAvailable,
  toEnquiryFields,
} from "../../utils/pricing/feeEngine.js";

const HOME = "Home Tuition / In-Person";
const ONLINE = "Online / One-to-One Tuition";
const JUNIOR = ["1", "2", "3", "4", "5", "6", "7"];
const SENIOR = ["8", "9", "10", "11", "12", "PUC", "Degree Courses"];
const ONE_HOUR = [...JUNIOR, "8", "9", "10"];
const NO_ONE_HOUR = ["11", "12", "PUC", "Degree Courses"];
const STANDARD = [[3, 1.5], [3, 2], [5, 1.5], [5, 2]];
const ELITE = [[3, 1], [3, 1.5], [5, 1], [5, 1.5]];
const ADVANCE_ORDER = [[3, 1], [3, 1.5], [3, 2], [5, 1], [5, 1.5], [5, 2]];

// Grades 1–5: 1-hour Advanced base anchors [class, 3×1, 5-day base]; longer sessions are
// the 1-hour price × hours, nearest ₹50. 5×1 (Grades 1–10) is the 3×1 hourly rate
// × 20 hours, nearest ₹50.
const ONE_HOUR_ANCHORS = [
  ["1", 4500, 6000], ["2", 4500, 6000], ["3", 4500, 6000], ["4", 4750, 6250],
  ["5", 5000, 6500],
];
const r50 = (v) => Math.round(v / 50) * 50;

// Advance fee tables (CBSE/ICSE home tuition), [class, 3×1, 3×1.5, 3×2, 5×1, 5×1.5, 5×2].
// Grades 1–5: from the anchors; Grades 6–10: table 3.2 for 3 days, 5 days at the
// 3-day hourly rate (× 5/3, nearest ₹50); Grades 11, 12, Graduation:
// table 3.4 (no 1-hour).
const ADVANCE_TABLE = [
  ...ONE_HOUR_ANCHORS.map(([g, d3, d5]) => [g, d3, r50(d3 * 1.5), d3 * 2, r50((d3 * 5) / 3), r50(d5 * 1.5), d5 * 2]),
  ["6", 5500, 6750, 7800, 9150, 11250, 13000],
  ["7", 6000, 7200, 8500, 10000, 12000, 14150],
  ["8", 5700, 7500, 9000, 9500, 12500, 15000],
  ["9", 6500, 8000, 9500, 10850, 13350, 15850],
  ["10", 7000, 8500, 10200, 11650, 14150, 17000],
  ["11", null, 9500, 11200, null, 12500, 14500],
  ["12", null, 10500, 12500, null, 14000, 16000],
  ["Degree Courses", null, 11000, 13000, null, 15000, 17500],
];

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

describe("plan prices", () => {
  test("Advance (CBSE and ICSE, home) matches the fee tables for Grade 1 to Graduation", () => {
    for (const [g, ...prices] of ADVANCE_TABLE) {
      ADVANCE_ORDER.forEach(([d, h], i) => {
        if (prices[i] === null) return;
        for (const board of ["CBSE", "ICSE"]) {
          assert.equal(calculatePlanPrice("advance", g, board, d, h, HOME), prices[i], `${g} ${board} ${d}x${h}`);
        }
      });
    }
  });

  test("Grades 1–5: longer sessions are the 1-hour price × hours", () => {
    assert.deepEqual(
      ADVANCE_ORDER.map(([d, h]) => calculatePlanPrice("advance", "5", "CBSE", d, h, HOME)),
      [5000, 7500, 10000, 8350, 9750, 13000]
    );
    assert.equal(calculatePlanPrice("advance", "4", "CBSE", 3, 1.5, HOME), 7150); // 4750 × 1.5 = 7125
  });

  test("on the same days a week, a longer session always costs more", () => {
    for (const plan of ["foundation", "advance", "elite"]) {
      for (const [g] of ADVANCE_TABLE) {
        for (const board of ["CBSE", "IGCSE", "IB"]) {
          for (const mode of [HOME, ONLINE]) {
            for (const d of [3, 5]) {
              const prices = [1, 1.5, 2]
                .filter((h) => getComboStatus(plan, g, d, h) === "available")
                .map((h) => calculatePlanPrice(plan, g, board, d, h, mode));
              prices.slice(1).forEach((p, i) => assert.ok(p > prices[i], `${plan} ${g} ${board} ${mode} ${d} days: ${prices}`));
            }
          }
        }
      }
    }
  });

  test("Foundation is Advance − 18% and Elite is Advance + 35%, nearest ₹50", () => {
    for (const [g, ...prices] of ADVANCE_TABLE) {
      ADVANCE_ORDER.forEach(([d, h], i) => {
        if (prices[i] === null) return;
        if (getComboStatus("foundation", g, d, h) === "available") {
          assert.equal(calculatePlanPrice("foundation", g, "CBSE", d, h, HOME), Math.round((prices[i] * 0.82) / 50) * 50);
        }
        if (getComboStatus("elite", g, d, h) === "available") {
          assert.equal(calculatePlanPrice("elite", g, "CBSE", d, h, HOME), Math.round((prices[i] * 1.35) / 50) * 50);
        }
      });
    }
    assert.equal(calculatePlanPrice("foundation", "9", "CBSE", 3, 2, HOME), 7800); // 9500 × 0.82 = 7790
    assert.equal(calculatePlanPrice("elite", "6", "CBSE", 3, 1.5, HOME), 9100); // 6750 × 1.35 = 9112.5
  });

  test("board multipliers and online pricing apply on top of the plan price", () => {
    assert.equal(calculatePlanPrice("advance", "9", "IGCSE", 3, 1.5, HOME), 10000); // 8000 × 1.25
    assert.equal(calculatePlanPrice("advance", "9", "IB", 3, 1.5, HOME), 11200); // 8000 × 1.4
    assert.equal(calculatePlanPrice("advance", "9", "CBSE", 3, 1.5, ONLINE), 5600); // 8000 × 0.7
    assert.equal(calculatePlanPrice("elite", "9", "CBSE", 3, 1, ONLINE), 6150); // 6500 × 1.35 × 0.7 = 6142.5
  });
});

describe("availability matrix", () => {
  test("Foundation is unavailable for Classes 1–5 and available for 6–12, PUC and Degree", () => {
    for (const g of ["1", "2", "3", "4", "5"]) {
      for (const [d, h] of [...STANDARD, [3, 1], [5, 1]]) assert.equal(getComboStatus("foundation", g, d, h), "unavailable");
      assert.equal(isPlanAvailable("foundation", [{ classGrade: g, curriculum: "CBSE" }]), false);
    }
    for (const g of ["6", "7", ...SENIOR]) {
      for (const [d, h] of STANDARD) assert.equal(getComboStatus("foundation", g, d, h), "available");
    }
  });

  test("Advance supports the four existing schedules for every grade", () => {
    for (const g of [...JUNIOR, ...SENIOR]) {
      for (const [d, h] of STANDARD) assert.equal(getComboStatus("advance", g, d, h), "available", `${g} ${d}x${h}`);
    }
  });

  test("Advance and Elite 1-hour (3 and 5 days) are offered for Classes 1–10", () => {
    for (const g of ONE_HOUR) {
      for (const plan of ["advance", "elite"]) {
        assert.equal(getComboStatus(plan, g, 3, 1), "available", `${plan} ${g}`);
        assert.equal(getComboStatus(plan, g, 5, 1), "available", `${plan} ${g}`);
      }
    }
    assert.equal(calculatePlanPrice("advance", "6", "CBSE", 3, 1, ONLINE), 3850); // 5500 × 0.7
  });

  test("1-hour sessions are unavailable for Class 11 to Degree on every plan", () => {
    for (const g of NO_ONE_HOUR) {
      for (const plan of ["foundation", "advance", "elite"]) {
        assert.equal(getComboStatus(plan, g, 3, 1), "unavailable");
        assert.equal(getComboStatus(plan, g, 5, 1), "unavailable");
        assert.equal(errorCode(() => calculatePlanPrice(plan, g, "CBSE", 3, 1, HOME)), ERROR_CODES.UNAVAILABLE);
      }
    }
  });

  test("Foundation never offers 1-hour sessions", () => {
    for (const g of SENIOR) {
      assert.equal(getComboStatus("foundation", g, 3, 1), "unavailable");
      assert.equal(getComboStatus("foundation", g, 5, 1), "unavailable");
    }
  });

  test("Elite offers 1.5 hours for every grade; 2-hour Elite stays unavailable", () => {
    for (const g of [...JUNIOR, ...SENIOR]) {
      assert.equal(getComboStatus("elite", g, 3, 1.5), "available");
      assert.equal(getComboStatus("elite", g, 5, 1.5), "available");
      assert.equal(getComboStatus("elite", g, 3, 2), "unavailable");
      assert.equal(getComboStatus("elite", g, 5, 2), "unavailable");
    }
  });

  test("a missing 1-hour price hides that schedule for that grade only", () => {
    const config = withConfig((c) => {
      delete c.advancePrices["Grade 6"]["3_1.0"];
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
    assert.deepEqual(getAvailableOptions("advance", student, HOME).map((o) => [o.days, o.hours]), ADVANCE_ORDER);
    assert.deepEqual(getAvailableOptions("elite", student, HOME).map((o) => [o.days, o.hours]), ELITE);
    const senior = [{ classGrade: "11", curriculum: "CBSE" }];
    assert.deepEqual(getAvailableOptions("advance", senior, HOME).map((o) => [o.days, o.hours]), STANDARD);
    assert.deepEqual(getAvailableOptions("elite", senior, HOME).map((o) => [o.days, o.hours]), [[3, 1.5], [5, 1.5]]);
  });

  test("siblings in Class 6 and Class 11 are not offered 1-hour (needs every student eligible)", () => {
    const wards = [{ classGrade: "6", curriculum: "CBSE" }, { classGrade: "11", curriculum: "CBSE" }];
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
      delete c.advancePrices["Grade 9"]["5_2.0"];
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
    assert.equal(quote.monthlyPayable, 5500); // its own 1-hour price, not the 3×1.5 price (6750)
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
    assert.equal(calculatePlanPrice("advance", "9", "CBSE", 3, 1.5, HOME), 8000);
    assert.equal(calculatePlanPrice("advance", "9", "CBSE", "3", "1.5", HOME), 8000);
    assert.equal(calculatePlanPrice("advance", "9", "CBSE", 5, 2, HOME), 12000);
    assert.equal(calculatePlanPrice("elite", "9", "CBSE", 3, 1, HOME), 8800);
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
  test("derived from the monthly price over 4 weeks", () => {
    const price = calculatePlanPrice("elite", "9", "CBSE", 3, 1, HOME); // ₹8,800
    assert.equal(getEffectiveHourlyRate(price, 3, 1), Math.round(8800 / 12));
  });

  test("online: derived from the actual online monthly price", () => {
    const price = calculatePlanPrice("elite", "9", "CBSE", 3, 1, ONLINE); // ₹6,150
    assert.equal(price, 6150);
    assert.equal(getEffectiveHourlyRate(price, 3, 1), Math.round(6150 / 12));
  });

  test("invalid schedule or price returns null", () => {
    assert.equal(getEffectiveHourlyRate(4600, 3, 1.46), null);
    assert.equal(getEffectiveHourlyRate(null, 3, 1), null);
  });
});

describe("grade labels", () => {
  test("homepage and enquiry-form labels resolve to the same group and price", () => {
    const pairs = [["Grade 1", "1"], ["Grade 5", "5"], ["Grade 6", "6"], ["Grade 7", "7"], ["Grade 12", "12"], ["Degree", "Degree Courses"]];
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

  test("the retired combined 'Class 1–5' value is an unknown class", () => {
    for (const g of ["1 to 5", "Grade 1–5"]) assert.equal(errorCode(() => calculatePlanPrice("advance", g, "CBSE", 3, 1.5, HOME)), ERROR_CODES.UNKNOWN_GRADE);
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
    assert.equal(q.monthlyPayable, 6750);
    assert.ok(q.students[0].subjects.every((s) => s.included === true));
  });

  test("one subject receives no additional-subject discount", () => {
    const q = quoteFor(["Mathematics"]);
    assert.equal(q.students[0].subjects[0].discountPercent, 0);
    assert.equal(q.monthlyPayable, 6750);
  });

  test("two subjects: the second is 10% off", () => {
    const q = quoteFor(["Mathematics", "Science"]);
    const [first, second] = q.students[0].subjects;
    assert.deepEqual([first.finalPrice, second.discountPercent, second.discountAmount, second.finalPrice], [6750, 10, 675, 6075]);
    assert.equal(q.monthlyPayable, 12825);
  });

  test("three or more: every subject after the first is 10% off, and totals equal the sum of lines", () => {
    const q = quoteFor(["Mathematics", "Science", "English", "Hindi"]);
    const lines = q.students[0].subjects;
    assert.deepEqual(lines.map((l) => l.discountPercent), [0, 10, 10, 10]);
    assert.equal(q.students[0].monthlyFee, lines.reduce((s, l) => s + l.finalPrice, 0));
    assert.equal(q.subjectDiscountTotal, 675 * 3);
    assert.equal(q.totalBeforeSubjectDiscount, 6750 * 4);
    assert.equal(q.monthlyPayable, 6750 + 6075 * 3);
  });

  test("subjects for students in different grades use each student's own price", () => {
    const q = calculateQuote(
      {
        planType: "advance", daysPerWeek: 5, hoursPerDay: 2, preferredMode: HOME,
        wards: [
          { classGrade: "3", curriculum: "CBSE", subjectsNeeded: ["Mathematics", "English"] },
          { classGrade: "11", curriculum: "IB", subjectsNeeded: ["Physics"] },
        ],
      },
      enabled
    );
    const p1 = calculatePlanPrice("advance", "3", "CBSE", 5, 2, HOME);
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
    assert.equal(q.totalBaseFee, 6750 + 8000);
    assert.equal(q.siblingDiscount, Math.round(14750 * 0.25));
    assert.equal(q.monthlyPayable, q.totalBaseFee - q.siblingDiscount);
  });

  test("the requested 10% rate works when configured", () => {
    const config = withConfig((c) => {
      c.sibling.percentByStudentCount = { 2: 10, 3: 10 };
    });
    const q = quote([ward("6"), ward("9")], config);
    assert.equal(q.siblingDiscount, 1475);
    assert.equal(q.monthlyPayable, 13275);
  });

  test("with subject pricing enabled, the sibling discount applies after subject discounts", () => {
    const config = withConfig((c) => {
      c.subjectPricing.enabled = true;
    });
    const q = quote([{ ...ward("6"), subjectsNeeded: ["Mathematics", "Science"] }, ward("9")], config);
    assert.equal(q.totalBaseFee, 6750 + 6075 + 8000);
    assert.equal(q.siblingDiscount, Math.round(20825 * 0.25));
  });

  test("options are limited to those every student qualifies for", () => {
    const opts = getPlanOptions("foundation", [{ classGrade: "5" }, { classGrade: "10" }], HOME);
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
        [3, 5, 20250, 1013, 19237],
        [6, 10, 40500, 4050, 36450],
        [12, 15, 81000, 12150, 68850],
      ]
    );
  });

  test("prepayment never changes the stored monthly fields", () => {
    const config = withConfig((c) => {
      c.prepayment.enabled = true;
    });
    const fields = toEnquiryFields(calculateQuote(base, config));
    assert.equal(fields.finalPrice, 6750);
    assert.equal(fields.monthlyFees, 6750);
  });
});

describe("rounding", () => {
  test("every plan rounds to ₹50, home and online", () => {
    for (const plan of ["foundation", "advance", "elite"]) {
      for (const g of [...JUNIOR, ...SENIOR]) {
        for (const board of ["CBSE", "IGCSE", "IB"]) {
          for (const mode of [HOME, ONLINE]) {
            for (const o of getAvailableOptions(plan, [{ classGrade: g, curriculum: board }], mode)) {
              assert.equal(o.price % 50, 0, `${plan} ${g} ${board} ${mode} ${o.days}x${o.hours}`);
            }
          }
        }
      }
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
          { classGrade: "3", curriculum: "IB", subjectsNeeded: ["Mathematics", "Science"] },
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

  test("valid Foundation fee shows the Advance price beside it", () => {
    const quote = quoteFor("foundation", "9", "3", "2");
    assert.equal(quote.ok, true);
    assert.equal(quote.monthlyPayable, 7800);
    assert.equal(getStruckListPrice(quote), 9500);
  });

  test("invalid saved Foundation plan (Class 5) shows no list price", () => {
    const quote = quoteFor("foundation", "5", "3", "2");
    assert.equal(quote.ok, false);
    assert.equal(getStruckListPrice(quote), null);
    // The list price itself still exists, so the guard is what hides it.
    assert.notEqual(calculateListPrice("5", "CBSE", "3", "2", HOME), null);
  });

  test("unsupported schedule, missing quote or missing fee shows no list price", () => {
    assert.equal(getStruckListPrice(quoteFor("foundation", "9", "3", "1")), null);
    assert.equal(getStruckListPrice(undefined), null);
    assert.equal(getStruckListPrice(null), null);
    const quote = quoteFor("foundation", "9", "3", "2");
    for (const monthlyPayable of [null, undefined, 0, NaN, "7800"]) {
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
