// Plan content (titles, benefits, FAQs). Prices, availability and discounts
// come from the shared fee engine in ../pricing/.

export const PLANS = [
  {
    id: "foundation",
    title: "Foundation Plan",
    theme: "silver",
    badge: "SAVE UP TO 18%",
    description: "",
    gradient: "from-[#F8FAFC] to-[#CBD5E1]",
    textColor: "text-slate-800",
    badgeTheme: "bg-slate-900/10 text-slate-800 border-slate-900/20",
    keyBenefit: "Background Verified, Homework Support & Beginner-Friendly",
    cardBenefits: [
      "Background Verified Tutors",
      "Homework Support",
      "Beginner-Friendly Tutors"
    ],
    fullDetails: {
      benefits: [
        { title: "Background Verified Tutors" },
        { title: "Homework Support" },
        { title: "Beginner-Friendly Tutors" }
      ],
      features: [],
      faqs: [
        { q: "Can we change classes if we miss a session?", a: "Yes, rescheduling is permitted with a 24-hour notice to the tutor." },
        { q: "Who are the tutors for this plan?", a: "Vetted tutors and university graduates with 0–1 year of teaching experience who excel in explaining core academic concepts." },
        { q: "Is there a curriculum choice?", a: "Supports CBSE, ICSE, IGCSE, IB, NIOS and State Boards." }
      ],
      additionalInfo: "Minimum commitment of 1 month. Free initial coordinator consultation to assess student learning style."
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
    keyBenefit: "Strategy, Monthly Tests, Guidance, Allocation & Support",
    cardBenefits: [
      "Academic Strategy & Deadlines",
      "Internal Test/Assignment — Monthly",
      "Consistent Guidance & Regular Practice",
      "Tutor Allocation (5–8 km)",
      "Tutor Replacement Within 5 Days"
    ],
    fullDetails: {
      benefits: [
        { title: "Academic Strategy & Deadlines" },
        { title: "Internal Test/Assignment — Monthly" },
        { title: "Consistent Guidance & Regular Practice" },
        { title: "Tutor Allocation (5–8 km)" },
        { title: "Tutor Replacement Within 5 Days" }
      ],
      features: [],
      faqs: [
        { q: "How are tutors selected for this plan?", a: "We match tutors with 3 to 10 years of teaching experience, specifically verified for secondary grades." },
        { q: "What if a student struggles with a specific topic?", a: "Tutors will modify the lesson plan to dedicate additional time for remedial teaching." },
        { q: "Are test reports shared?", a: "Yes, monthly test scores and conceptual gap analysis reports are shared with parents." }
      ],
      additionalInfo: "Custom study materials tailored to the student's weak areas are provided free of cost."
    }
  },
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
    experience: "10+ Years",
    keyBenefit: "Priority Allocation, Result-Oriented Mentorship & Support",
    cardBenefits: [
      "Priority Tutor Allocation",
      "Clean Result-Oriented Learning",
      "Online Academic Doubt Support",
      "Bi-Weekly Test/Assignment",
      "Priority Tutor Replacement",
      "Attendance & Compensation Access"
    ],
    fullDetails: {
      benefits: [
        { title: "Priority Tutor Allocation", desc: "Nearest tutor matching from parents' location" },
        { title: "Clean Result-Oriented Learning", desc: "Accuracy, strategy & exam-focused preparation" },
        { title: "Online Academic Doubt Support", desc: "WhatsApp doubt support with the same tutor" },
        { title: "Bi-Weekly Test/Assignment", desc: "Bi-weekly tests and performance tracking" },
        { title: "Priority Tutor Replacement", desc: "Replacement support within 24–48 hours" },
        { title: "Attendance & Compensation Access", desc: "Attendance tracking & missed class support" }
      ],
      features: [],
      faqs: [
        { q: "Who are the Elite Mentors?", a: "They are school coordinators, board examiners, and veteran teachers with 10+ years of teaching experience." },
        { q: "Is the schedule highly flexible?", a: "Yes, elite members receive priority slots, meaning schedules can be adjusted dynamically." },
        { q: "Can this plan cover advanced entrance prep?", a: "Yes, it includes guidance for advanced board preparation and foundational entrance concepts." }
      ],
      additionalInfo: "Includes a dedicated counselor for academic planning and stress management during exams."
    }
  }
];
