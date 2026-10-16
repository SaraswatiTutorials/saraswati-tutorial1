// Fee configuration — single source of pricing rules for the frontend and backend.
//
// SHARED FILE: an identical copy lives at frontend/src/pricing/feeConfig.js.
// Edit the backend copy, then run `npm run sync:pricing` in backend/.
// The backend test suite fails if the two copies differ.
//
// Pricing lives in code only. Nothing here is read from or written to the database.

export const GRADE_GROUPS = [
  "Grades 1–5",
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
const CLASS_8_PLUS = GRADE_GROUPS.slice(3);
// Advance 1-hour sessions: Classes 1–7 only (not Class 8 to Degree)
const ADVANCE_ONE_HOUR_GROUPS = GRADE_GROUPS.slice(0, 3);

// Combination keys are `${daysPerWeek}_${hoursPerSession.toFixed(1)}`.
export const FEE_CONFIG = {
  // Approved CBSE base prices per grade group (unchanged from the pre-P1 pricing).
  masterPrices: {
    "Grades 1–5": { "3_1.5": 6353, "3_2.0": 7277, "5_1.5": 8663, "5_2.0": 9240 },
    "Grade 6": { "3_1.5": 7277, "3_2.0": 8432, "5_1.5": 8663, "5_2.0": 9240 },
    "Grade 7": { "3_1.5": 7796, "3_2.0": 9009, "5_1.5": 9529, "5_2.0": 10395 },
    "Grade 8": { "3_1.5": 8316, "3_2.0": 9818, "5_1.5": 10395, "5_2.0": 11550 },
    "Grade 9": { "3_1.5": 9009, "3_2.0": 10626, "5_1.5": 11781, "5_2.0": 13629 },
    "Grade 10": { "3_1.5": 9818, "3_2.0": 11781, "5_1.5": 12936, "5_2.0": 15015 },
    "Grade 11": { "3_1.5": 10973, "3_2.0": 12936, "5_1.5": 14438, "5_2.0": 16748 },
    "Grade 12": { "3_1.5": 12128, "3_2.0": 14438, "5_1.5": 16170, "5_2.0": 18480 },
    "Degree": { "3_1.5": 13860, "3_2.0": 16170, "5_1.5": 18480, "5_2.0": 20790 },
  },

  // Plan-only base prices for schedules not in masterPrices: Advance 1-hour sessions
  // (Classes 1–7). Values are the 1-hour Advanced base anchors from the pricing
  // document (Grades 1–5 use the Grades 1–3 anchor). They are CBSE base prices in the
  // same form as masterPrices (before the plan multiplier, board multiplier and rounding).
  // A null or missing value keeps that grade's combination hidden and unquotable.
  pendingBasePrices: {
    advance: {
      "3_1.0": { "Grades 1–5": 4500, "Grade 6": 5000, "Grade 7": 5500 },
      "5_1.0": { "Grades 1–5": 6000, "Grade 6": 6000, "Grade 7": 6500 },
    },
  },

  boardMultipliers: { CBSE: 1.0, ICSE: 1.0, IGCSE: 1.25, IB: 1.4, StateBoard: 1.0, NIOS: 1.0 },

  planMultipliers: {
    foundation: 0.82,
    advance: { upToClass7: 1.18, class8Plus: 1.0 },
  },

  eliteHourlyRates: {
    "Grades 1–5": 350,
    "Grade 6": 400,
    "Grade 7": 450,
    "Grade 8": 500,
    "Grade 9": 550,
    "Grade 10": 650,
    "Grade 11": 750,
    "Grade 12": 850,
    "Degree": 950,
  },
  eliteBoardMultipliers: { CBSE: 1.0, ICSE: 1.0, IGCSE: 1.2, IB: 1.3, StateBoard: 1.0, NIOS: 1.0 },

  // Existing rounding conventions.
  rounding: {
    homeRoundTo: 100, // Foundation and Advance, home tuition
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
      { combo: "3_1.5", groups: CLASS_8_PLUS },
      { combo: "3_2.0", groups: CLASS_8_PLUS },
      { combo: "5_1.5", groups: CLASS_8_PLUS },
      { combo: "5_2.0", groups: CLASS_8_PLUS },
    ],
    advance: [
      { combo: "3_1.0", groups: ADVANCE_ONE_HOUR_GROUPS },
      { combo: "3_1.5", groups: ALL_GROUPS },
      { combo: "3_2.0", groups: ALL_GROUPS },
      { combo: "5_1.0", groups: ADVANCE_ONE_HOUR_GROUPS },
      { combo: "5_1.5", groups: ALL_GROUPS },
      { combo: "5_2.0", groups: ALL_GROUPS },
    ],
    elite: [
      { combo: "3_1.0", groups: ALL_GROUPS },
      { combo: "3_1.5", groups: ALL_GROUPS },
      { combo: "5_1.0", groups: ALL_GROUPS },
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
