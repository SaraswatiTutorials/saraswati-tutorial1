// Fee configuration — single source of pricing rules for the frontend and backend.
//
// SHARED FILE: an identical copy lives at frontend/src/pricing/feeConfig.js.
// Edit the backend copy, then run `npm run sync:pricing` in backend/.
// The backend test suite fails if the two copies differ.
//
// Pricing lives in code only. Nothing here is read from or written to the database.

export const GRADE_GROUPS = [
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
  "Degree",
];

const ALL_GROUPS = GRADE_GROUPS;
const CLASS_6_PLUS = GRADE_GROUPS.slice(GRADE_GROUPS.indexOf("Grade 6"));
// 1-hour sessions: Grade 1 to Grade 10 (not Grade 11, 12 or Degree)
const ONE_HOUR_GROUPS = GRADE_GROUPS.slice(0, GRADE_GROUPS.indexOf("Grade 11"));

// Grades 1–5: the 1-hour Advance anchors (3 and 5 days a week); longer sessions
// are the 1-hour price × hours, nearest ₹50 (e.g. 4750 × 1.5 = 7125 → 7150).
const byHours = (oneHour, hours) => Math.round((oneHour * hours) / 50) * 50;
const fromOneHour = (d3, d5) => ({
  "3_1.0": d3, "3_1.5": byHours(d3, 1.5), "3_2.0": byHours(d3, 2),
  "5_1.0": d5, "5_1.5": byHours(d5, 1.5), "5_2.0": byHours(d5, 2),
});

// Combination keys are `${daysPerWeek}_${hoursPerSession.toFixed(1)}`.
export const FEE_CONFIG = {
  // Advance plan monthly fees, home tuition, CBSE/ICSE (board multiplier 1.0).
  // Grades 1–5: the proposed 1-hour Advanced base anchors, scaled by hours.
  // Grade 6 to Degree: the ICSE base fee tables (3.2 Grades 6–10, 3.4 Grades 11,
  // 12 and Graduation).
  // Foundation and Elite are derived from these (see planMultipliers).
  // A missing value keeps that grade's combination hidden and unquotable.
  advancePrices: {
    "Grade 1": fromOneHour(4500, 6000),
    "Grade 2": fromOneHour(4500, 6000),
    "Grade 3": fromOneHour(4500, 6000),
    "Grade 4": fromOneHour(4750, 6250),
    "Grade 5": fromOneHour(5000, 6500),
    "Grade 6": { "3_1.0": 5500, "3_1.5": 6750, "3_2.0": 7800, "5_1.0": 6500, "5_1.5": 8250, "5_2.0": 9000 },
    "Grade 7": { "3_1.0": 6000, "3_1.5": 7200, "3_2.0": 8500, "5_1.0": 7000, "5_1.5": 9000, "5_2.0": 10000 },
    "Grade 8": { "3_1.0": 5700, "3_1.5": 7500, "3_2.0": 9000, "5_1.0": 7500, "5_1.5": 9750, "5_2.0": 11000 },
    "Grade 9": { "3_1.0": 6500, "3_1.5": 8000, "3_2.0": 9500, "5_1.0": 8000, "5_1.5": 10500, "5_2.0": 12000 },
    "Grade 10": { "3_1.0": 7000, "3_1.5": 8500, "3_2.0": 10200, "5_1.0": 8500, "5_1.5": 11200, "5_2.0": 13000 },
    "Grade 11": { "3_1.5": 9500, "3_2.0": 11200, "5_1.5": 12500, "5_2.0": 14500 },
    "Grade 12": { "3_1.5": 10500, "3_2.0": 12500, "5_1.5": 14000, "5_2.0": 16000 },
    "Degree": { "3_1.5": 11000, "3_2.0": 13000, "5_1.5": 15000, "5_2.0": 17500 },
  },

  // Applied to the Advance price: Foundation = Advance − 18%, Elite = Advance + 35%.
  planMultipliers: { foundation: 0.82, advance: 1.0, elite: 1.35 },

  boardMultipliers: { CBSE: 1.0, ICSE: 1.0, IGCSE: 1.25, IB: 1.4, StateBoard: 1.0, NIOS: 1.0 },

  rounding: {
    homeRoundTo: 50, // home tuition, all plans
    onlineFactor: 0.7,
    onlineRoundTo: 50,
    discountRoundTo: 1, // sibling discount (existing); subject and prepayment discounts (pending U7)
  },

  // Explicitly supported schedule values. Anything else (e.g. 1.46 hours) is
  // rejected, never rounded to the nearest supported value.
  supportedSchedule: {
    daysPerWeek: [3, 5],
    sessionHours: [1, 1.5, 2],
  },

  // Approved availability matrix. Order of combos is the display order.
  availability: {
    foundation: [
      { combo: "3_1.5", groups: CLASS_6_PLUS },
      { combo: "3_2.0", groups: CLASS_6_PLUS },
      { combo: "5_1.5", groups: CLASS_6_PLUS },
      { combo: "5_2.0", groups: CLASS_6_PLUS },
    ],
    advance: [
      { combo: "3_1.0", groups: ONE_HOUR_GROUPS },
      { combo: "3_1.5", groups: ALL_GROUPS },
      { combo: "3_2.0", groups: ALL_GROUPS },
      { combo: "5_1.0", groups: ONE_HOUR_GROUPS },
      { combo: "5_1.5", groups: ALL_GROUPS },
      { combo: "5_2.0", groups: ALL_GROUPS },
    ],
    elite: [
      { combo: "3_1.0", groups: ONE_HOUR_GROUPS },
      { combo: "3_1.5", groups: ALL_GROUPS },
      { combo: "5_1.0", groups: ONE_HOUR_GROUPS },
      { combo: "5_1.5", groups: ALL_GROUPS },
    ],
  },

  // PENDING APPROVAL (U1): each additional subject is discounted, with every subject
  // charged the plan price. Disabled until the business meaning is approved;
  // while disabled a student's fee covers all of their subjects (existing behaviour).
  subjectPricing: {
    enabled: false,
    additionalSubjectDiscountPercent: 10,
    appliesToPlans: ["foundation", "advance", "elite"], // Elite applicability pending (U1)
  },

  // Existing sibling concession, applied to the combined monthly total of all
  // students on one enquiry. The requested 10% rate is PENDING APPROVAL (U4).
  sibling: {
    percentByStudentCount: { 2: 25, 3: 35 }, // 3 = three or more students
    requestedPercentPendingApproval: 10,
  },

  // PENDING APPROVAL (U5/U6): informational prepayment totals, monthly payable ×
  // months, less the term discount. Display only; the term is never saved.
  prepayment: {
    enabled: false,
    terms: [
      { months: 3, discountPercent: 5 },
      { months: 6, discountPercent: 10 },
      { months: 12, discountPercent: 15 },
    ],
  },
};
