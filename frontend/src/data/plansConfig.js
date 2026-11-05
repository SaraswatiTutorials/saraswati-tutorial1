// Plan content (titles, benefits). Prices, availability and discounts
// come from the shared fee engine in ../pricing/.

export const PLANS = [
  {
    id: "elite",
    title: "Elite Mentor Plan",
    theme: "black",
    badge: "Best Choice",
    description: "",
    gradient: "from-[#111827] to-[#000000]",
    textColor: "text-white",
    textDarkColor: "text-white",
    badgeTheme: "bg-white/10 text-white border-white/10",
    // Modal header only; the plan cards keep the black gradient above
    modalGradient: "from-[#0B1229] via-[#1E2A5A] to-[#0B1229]",
    experience: "5.1–12 Years",
    keyPoints: ["Tutor Experience: 5.1–12 Years", "Priority Tutor Replacement"],
    cardBenefits: [
      "Tutor Experience: 5.1–12 Years",
      "Priority Tutor Allocation",
      "Clean Result-Oriented Learning",
      "Online Academic Doubt Support",
      "Bi-Weekly Test/Assignment",
      "Priority Tutor Replacement",
      "Attendance & Compensation Access"
    ],
    fullDetails: {
      benefits: [
        { title: "Tutor Experience: 5.1–12 Years", desc: "Senior mentors, school coordinators & board examiners", highlight: true },
        { title: "Priority Tutor Allocation", desc: "Nearest tutor matching from parents' location" },
        { title: "Clean Result-Oriented Learning", desc: "Accuracy, strategy & exam-focused preparation" },
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
    keyPoints: ["Tutor Experience: 2–5 Years", "Tutor Replacement Within 5 Days"],
    cardBenefits: [
      "Tutor Experience: 2–5 Years",
      "Complete Background Verified Tutors",
      "Academic Strategy & Deadlines",
      "Internal Test/Assignment — Monthly",
      "Consistent Guidance & Regular Practice",
      "Tutor Allocation (5–8 km)",
      "Tutor Replacement Within 5 Days"
    ],
    fullDetails: {
      benefits: [
        { title: "Tutor Experience: 2–5 Years", desc: "Experienced tutors verified for secondary grades", highlight: true },
        { title: "Complete Background Verified Tutors", desc: "Complete background verified tutor (Gov. ID & Education Certificate)" },
        { title: "Academic Strategy & Deadlines" },
        { title: "Internal Test/Assignment — Monthly" },
        { title: "Consistent Guidance & Regular Practice" },
        { title: "Tutor Allocation (5–8 km)" },
        { title: "Tutor Replacement Within 5 Days" }
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
    keyPoints: ["Beginner-Friendly Tutors", "Tutor Replacement Within 2 Weeks"],
    cardBenefits: [
      "Background Verified Tutors",
      "Homework Support",
      "Beginner-Friendly Tutors",
      "Tutor Replacement Within 2 Weeks"
    ],
    fullDetails: {
      benefits: [
        { title: "Beginner-Friendly Tutors", desc: "Patient tutors who explain core concepts simply", highlight: true },
        { title: "Background Verified Tutors" },
        { title: "Homework Support" },
        { title: "Tutor Replacement Within 2 Weeks" }
      ],
      features: [],
      additionalInfo: "Minimum commitment of 1 month. Free initial coordinator consultation to assess student learning style."
    }
  }
];
