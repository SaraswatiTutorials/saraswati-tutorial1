// Plan content (titles, benefits). Prices, availability and discounts
// come from the shared fee engine in ../pricing/.

export const PLANS = [
  {
    id: "elite",
    title: "Elite Mentor Plan",
    theme: "black",
    badge: "Premium Mentors",
    description: "",
    gradient: "from-[#111827] to-[#000000]",
    textColor: "text-white",
    textDarkColor: "text-white",
    badgeTheme: "bg-white/10 text-white border-white/10",
    // Modal header only; the plan cards keep the black gradient above
    modalGradient: "from-[#0B1229] via-[#1E2A5A] to-[#0B1229]",
    experience: "5.1–12 Years",
    keyPoints: ["Tutor Experience: 5.1–12 Years", "Priority Tutor Replacement"],
    defaultSchedule: { days: 3, hours: 1 },
    cardBenefits: [
      "Tutor Experience: 5.1–12 Years",
      "Priority Tutor Allocation",
      "Online Academic Doubt Support",
      "Bi-Weekly Test/Assignment",
      "Priority Tutor Replacement",
      "Attendance & Compensation Access"
    ],
    fullDetails: {
      benefits: [
        { title: "Tutor Experience: 5.1–12 Years", desc: "Senior mentors, school coordinators & board examiners", highlight: true },
        { title: "Priority Tutor Allocation", desc: "Nearest tutor matching from parents' location" },
        { title: "Online Academic Doubt Support", desc: "WhatsApp doubt support with the same tutor" },
        { title: "Bi-Weekly Test/Assignment", desc: "Bi-weekly tests and performance tracking" },
        { title: "Priority Tutor Replacement", desc: "Replacement support within 24–48 hours" },
        { title: "Attendance & Compensation Access", desc: "Attendance tracking & missed class support" }
      ],
      features: [],
      additionalInfo: "Includes a dedicated counselor for academic planning and stress management during exams."
    }
  },
  {
    id: "advance",
    title: "Advance Growth Plan",
    theme: "gold",
    badge: "Most Recommended",
    description: "",
    gradient: "from-[#FFE082] via-[#F59E0B] to-[#D97706]",
    textColor: "text-slate-950",
    textDarkColor: "text-slate-950",
    badgeTheme: "bg-black/10 text-slate-950 border-black/20",
    experience: "2–5 Years",
    keyPoints: ["Tutor Experience: 2–5 Years", "Tutor Replacement Within 2–4 Days"],
    defaultSchedule: { days: 3, hours: 2 },
    cardBenefits: [
      "Tutor Experience: 2–5 Years",
      "Complete Background Verified Tutors",
      "Academic Strategy, Deadlines & Monthly Internal Test/Assignment",
      "Tutor Allocation (5–8 km)",
      "Tutor Replacement Within 2–4 Days"
    ],
    fullDetails: {
      benefits: [
        { title: "Tutor Experience: 2–5 Years", desc: "Experienced tutors verified for secondary grades", highlight: true },
        { title: "Complete Background Verified Tutors", desc: "Complete background verified tutor (Gov. ID & Education Certificate)" },
        { title: "Academic Strategy, Deadlines & Monthly Internal Test/Assignment" },
        { title: "Tutor Allocation (5–8 km)" },
        { title: "Tutor Replacement Within 2–4 Days" }
      ],
      features: [],
      additionalInfo: "Custom study materials tailored to the student's weak areas are provided free of cost."
    }
  },
  {
    id: "foundation",
    title: "Foundation Plan",
    theme: "silver",
    badge: "SAVE UP TO 18%",
    description: "",
    gradient: "from-[#F8FAFC] to-[#CBD5E1]",
    textColor: "text-slate-800",
    badgeTheme: "bg-slate-900/10 text-slate-800 border-slate-900/20",
    keyPoints: ["Tutor Experience: 0–2 Years", "Beginner-Friendly Tutors", "Tutor Replacement Within 2 Weeks"],
    defaultSchedule: { days: 5, hours: 1.5 },
    cardBenefits: [
      "Tutor Experience: 0–2 Years",
      "Beginner-Friendly Tutors",
      "Background Verified Tutors",
      "Homework Support",
      "Tutor Replacement Within 2 Weeks"
    ],
    fullDetails: {
      benefits: [
        { title: "Tutor Experience: 0–2 Years", desc: "Beginner-friendly tutors who explain core concepts simply", highlight: true },
        { title: "Background Verified Tutors" },
        { title: "Homework Support" },
        { title: "Tutor Replacement Within 2 Weeks" }
      ],
      features: [],
      additionalInfo: "Minimum commitment of 1 month. Free initial coordinator consultation to assess student learning style."
    }
  }
];

// Pricing rows in plan details: highest price first. Sorting by price rather than days keeps the
// list in order for classes where, say, 3 days x 2 hours costs more than 5 days x 1 hour.
export const sortOptionsForDisplay = (options) =>
  [...options].sort((a, b) => b.price - a.price || b.days - a.days || b.hours - a.hours);

// The option picked when plan details open. A class that doesn't offer the plan's usual
// schedule gets its first available option instead.
export const getDefaultOption = (plan, options) =>
  options.find((opt) => opt.days === plan?.defaultSchedule?.days && opt.hours === plan?.defaultSchedule?.hours) || options[0];
