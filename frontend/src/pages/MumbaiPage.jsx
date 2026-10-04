import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import PlansSection from "../components/PlansSection";
import DemoParentDashboard from "./DemoParentDashboard";
import ThemeToggle from "../components/ThemeToggle";
import {
  Star,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Clock,
  BookOpen,
  CreditCard,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Phone,
  Mail,
  Menu,
  X,
  Award,
  HelpCircle,
  Users,
  Check,
  MessageCircle,
  Calendar,
  User,
  Globe,
  GraduationCap,
  Rocket
} from "lucide-react";

const MotionLink = motion(Link);

const handleLocationRedirect = (city) => {
  localStorage.setItem("userLocation", city);
  const currentHost = window.location.hostname;

  if (city === "Mumbai") {
    if (currentHost.includes("localhost")) {
      window.location.href = "/mumbai";
    } else {
      window.location.href = "https://mumbai.saraswatitutorial.com/";
    }
  } else {
    if (currentHost.includes("localhost")) {
      window.location.href = "/";
    } else {
      window.location.href = "https://saraswatitutorial.com/";
    }
  }
};

function LocationSelector({ activeCity }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayLabel = activeCity === "Bangalore" ? "BLR" : activeCity === "Mumbai" ? "MUM" : activeCity;

  return (
    <div ref={dropdownRef} className="relative inline-block z-30 select-none">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 py-1.5 px-2.5 text-xs font-black rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 transition duration-300 cursor-pointer shadow-sm hover:border-slate-300 dark:hover:border-slate-600"
      >
        <MapPin className="h-3.5 w-3.5 text-blue-600 animate-pulse" />
        <span>{displayLabel}</span>
        <ChevronDown className={`h-3 w-3 text-slate-500 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-36 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 shadow-xl py-1.5 text-slate-700 dark:text-slate-200 animate-slideFade">
          {[
            { id: "Bangalore", label: "Bangalore / BLR" },
            { id: "Mumbai", label: "Mumbai" }
          ].map((city) => {
            const isSelected = activeCity === city.id;
            return (
              <button
                key={city.id}
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  if (activeCity !== city.id) {
                    handleLocationRedirect(city.id);
                  }
                }}
                className={`flex items-center justify-between w-full text-left px-3.5 py-2 text-xs font-bold transition duration-150 cursor-pointer ${
                  isSelected 
                    ? "text-blue-600 bg-blue-50/50" 
                    : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>{city.label}</span>
                {isSelected && <Check className="h-3.5 w-3.5 text-blue-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ResourcesDropdown({ activeSection }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isResourcesActive = activeSection === "faqs" || window.location.pathname.startsWith("/blogs");

  return (
    <div ref={dropdownRef} className="relative inline-block z-30 select-none">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 py-1.5 transition duration-300 whitespace-nowrap shrink-0 font-bold cursor-pointer relative ${
          isResourcesActive ? "text-blue-600 font-extrabold" : "text-slate-600 hover:text-slate-950"
        }`}
      >
        <span>Resources</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${isOpen ? "rotate-180" : ""} ${isResourcesActive ? "text-blue-600" : "text-slate-500"}`} />
        {isResourcesActive && (
          <motion.div
            layoutId="navUnderline"
            className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-blue-600 rounded-full"
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-32 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 shadow-xl py-1.5 text-slate-700 dark:text-slate-200 animate-slideFade">
          <a
            href="#faqs"
            onClick={() => setIsOpen(false)}
            className="block w-full text-left px-4 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition duration-150"
          >
            FAQ
          </a>
          <Link
            to="/blogs"
            onClick={() => setIsOpen(false)}
            className="block w-full text-left px-4 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition duration-150"
          >
            Blog
          </Link>
        </div>
      )}
    </div>
  );
}

export default function MumbaiPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileResourcesOpen, setMobileResourcesOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState(null);
  const [activeSection, setActiveSection] = useState("home");
  const [showDemoPreview, setShowDemoPreview] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const sections = ["home", "why-choose", "plans", "subjects", "boards", "areas", "faqs"];
      const scrollPosition = window.scrollY + 160;

      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const offsetTop = el.offsetTop;
          const offsetHeight = el.offsetHeight;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section);
            break;
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleFaq = (index) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  // 5 exact FAQs
  const faqs = [
    {
      q: "Do you provide home tuition across all areas of Mumbai?",
      a: "Yes, Saraswati Tutorials provides home tuition services across major areas of Mumbai including Andheri, Bandra, Powai, Borivali, Thane, Navi Mumbai and nearby locations."
    },
    {
      q: "Which boards do your tutors cover?",
      a: "Our tutors teach students from CBSE, ICSE, IGCSE, IB and Maharashtra State Board for Classes 6 to 12."
    },
    {
      q: "Is online tuition also available?",
      a: "Yes, we provide both home tuition and live online tuition classes with personalized one-to-one teaching support."
    },
    {
      q: "Can I book a demo class before hiring a tutor?",
      a: "Yes, parents can request a free demo class to evaluate the teaching style and subject expertise of the tutor."
    },
    {
      q: "Which subjects are available for tuition in Mumbai?",
      a: "We provide tuition for Maths, Science, Physics, Chemistry, Biology, English, Accounts, Economics and other major subjects."
    }
  ];

  // FAQ Schema JSON-LD
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((faq) => ({
      "@type": "Question",
      "name": faq.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.a
      }
    }))
  };

  // Local Business / Educational Organization Schema
  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "name": "Saraswati Tutorials",
    "url": "https://mumbai.saraswatitutorial.com/",
    "logo": "https://mumbai.saraswatitutorial.com/logo.png",
    "description": "Looking for home tuition in Mumbai? Saraswati Tutorials provides expert home tutors for CBSE, ICSE, IGCSE, IB & Maharashtra State Board students from Class 6 to 12 across Mumbai.",
    "telephone": "+91 9041157689",
    "email": "services@saraswatitutorial.com",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Mumbai",
      "addressRegion": "Maharashtra",
      "addressCountry": "IN"
    },
    "areaServed": {
      "@type": "AdministrativeArea",
      "name": "Mumbai"
    },
    "serviceType": "Home Tuition",
    "provider": {
      "@type": "LocalBusiness",
      "name": "Saraswati Tutorials",
      "url": "https://mumbai.saraswatitutorial.com/"
    }
  };
  const whyChooseUs = [
    { title: "Verified & Experienced Tutors", desc: "All our tutors undergo strict background checks and academic evaluations.", icon: ShieldCheck },
    { title: "One-to-One Personalized Classes", desc: "Customized attention mapping to your child's learning pace.", icon: Users },
    { title: "Home & Online Tuition Available", desc: "Flexible modes—learn offline at home or online via live interactive classes.", icon: Award },
    { title: "Bi-Weekly Tests & Tracking", desc: "Bi-weekly academic tests, progress reviews, and parent updates for close performance monitoring.", icon: CheckCircle2 },
    { title: "Flexible Timings", desc: "Sessions scheduled around your child's school and daily routine.", icon: Clock },
    { title: "Tutors for All Major Boards", desc: "Expert syllabus mapping for CBSE, ICSE, IGCSE, IB, and State Board.", icon: BookOpen },
    { title: "Affordable Fee Structure", desc: "High-quality academic support customized to fit family budgets.", icon: CreditCard },
    { title: "Free Demo Class Available", desc: "Book a trial class with no commitment to test compatibility.", icon: Sparkles },
    { title: "Priority Tutor Allocation", desc: "Accelerated tutor matchmaking from areas near you.", icon: Rocket },
    { title: "Personalized Academic Planning", desc: "Tailored study maps and milestones designed around the student's curriculum goals.", icon: GraduationCap },
    { title: "24-Hour Online Support", desc: "Access to online academic guidance and doubt solving within 24 hours.", icon: Clock },
    { title: "Priority Tutor Replacement", desc: "Hassle-free tutor replacement matching within 24 to 48 hours.", icon: Users },
    { title: "Performance-Focused Mentoring", desc: "Target-oriented guidance focusing on high academic precision and result orientation.", icon: Star }
  ];

  const schoolSubjects = [
    {
      title: "Mathematics Tuition",
      desc: "Master algebra, calculus, and geometry with step-by-step guidance from expert maths home tutors in Mumbai.",
      image: "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&q=80&w=600"
    },
    {
      title: "Science Tuition",
      desc: "Build a strong foundation in physics, chemistry, and biology for classes 6 to 10 with interactive home tutoring.",
      image: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&q=80&w=600"
    },
    {
      title: "Physics Tuition",
      desc: "Simplify complex equations, mechanics, and electricity concepts for board exams and competitive entrance tests.",
      image: "https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&q=80&w=600"
    },
    {
      title: "Chemistry Tuition",
      desc: "Understand chemical equations, periodic tables, organic chemistry, and reactions with clear personal guidance.",
      image: "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&q=80&w=600"
    },
    {
      title: "Biology Tuition",
      desc: "Excel in life sciences, anatomy, and plant physiology with detailed diagrams, memory aids, and expert tutoring.",
      image: "https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&q=80&w=600"
    },
    {
      title: "English Tuition",
      desc: "Improve grammar, literature understanding, essays, and communication skills with patient native educators.",
      image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&q=80&w=600"
    },
    {
      title: "Hindi Tuition",
      desc: "Enhance vocabulary, grammar rules, script writing, and comprehension scores with professional Hindi tutors.",
      image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=600"
    },
    {
      title: "Social Science Tuition",
      desc: "Score high in history, geography, civics, and economics with structured note-taking and concept maps.",
      image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=600"
    }
  ];

  const commerceSubjects = [
    {
      title: "Accounts Tuition",
      desc: "Demystify ledger entries, balance sheets, and financial statements for class 11, 12, and college levels.",
      image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=600"
    },
    {
      title: "Economics Tuition",
      desc: "Analyze micro and macroeconomics principles, supply-demand curves, and statistics with expert assistance.",
      image: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&q=80&w=600"
    },
    {
      title: "Business Studies Tuition",
      desc: "Understand business operations, management theories, case studies, and trade practices with home tuition.",
      image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=600"
    }
  ];

  const boards = [
    { name: "CBSE Board", desc: "Comprehensive coverage of the NCERT curriculum, focusing on board exam preparation, daily practice papers, and thorough revision for classes 6 to 12." },
    { name: "ICSE Board", desc: "Rigorous focus on the detailed ICSE/ISC syllabus, enhancing conceptual depth in science and mathematics, literature understanding, and mock tests." },
    { name: "IGCSE Board", desc: "International curriculum support focusing on analytical skills, exam patterns, past paper practice, and concept application for Cambridge assessments." },
    { name: "IB Board", desc: "In-depth guidance for IB Diploma and MYP programmes, assisting with Internal Assessments (IAs), Extended Essays (EE), and advanced concept mastery." },
    { name: "Maharashtra State Board", desc: "Aligned syllabus support for SSC and HSC exams, highlighting textbook exercises, board-pattern tests, and high-yield scoring topics." }
  ];

  const classesList = [
    {
      title: "Class 6 Home Tuition",
      desc: "Strengthening basics in Maths, Science, and English to transition smoothly to secondary levels.",
      image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=400"
    },
    {
      title: "Class 7 Home Tuition",
      desc: "Developing analytical and problem-solving skills for growing academic curriculums.",
      image: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=400"
    },
    {
      title: "Class 8 Home Tuition",
      desc: "Focusing on conceptual depth to prepare a solid launchpad for high school boards.",
      image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=400"
    },
    {
      title: "Class 9 Home Tuition",
      desc: "Crucial concept building mapping directly to class 10 boards and foundation exams.",
      image: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&q=80&w=400"
    },
    {
      title: "Class 10 Home Tuition",
      desc: "Rigorous mock tests, revision cycles, and board paper solving to secure top grades.",
      image: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&q=80&w=400"
    },
    {
      title: "Class 11 Home Tuition",
      desc: "Specialized guidance for Science (PCM/B) and Commerce streams during the board transition.",
      image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&q=80&w=400"
    },
    {
      title: "Class 12 Home Tuition",
      desc: "Dedicated syllabus completion, revision, and practice to score maximum percentages.",
      image: "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&q=80&w=400"
    },
    {
      title: "Graduation Tuition",
      desc: "Expert guidance for university courses, engineering, commerce, sciences, and degree syllabus matching.",
      image: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=400"
    }
  ];

  const areas = [
    "Andheri", "Bandra", "Powai", "Dadar", "Borivali",
    "Kandivali", "Malad", "Goregaon", "Thane", "Navi Mumbai",
    "Chembur", "Vashi", "Ghatkopar", "Mulund", "Colaba"
  ];

  const testimonials = [
    {
      name: "Mrs. Ananya Sen",
      location: "Bandra",
      role: "Parent of Class 9 ICSE Student",
      text: "The ICSE curriculum is very demanding. We hired an Advance plan home tutor for history and chemistry. The tutor from Bandra did a phenomenal job mapping lessons to class notes and conducting weekly practice tests."
    },
    {
      name: "Mr. Vikram Malhotra",
      location: "Andheri West",
      role: "Parent of Class 12 IB HL Math Student",
      text: "Saraswati Tutorials matched us with an exceptional veteran IB Diploma tutor in Andheri West. Under their guidance, my daughter's score improved from a 4 to a 7 in HL Math. High precision mentoring!"
    },
    {
      name: "Mrs. Priya Gokhale",
      location: "Powai",
      role: "Parent of Class 10 CBSE Science Student",
      text: "We had a wonderful experience. The science tutor from Powai has a unique teaching method that turned complex physics and chemistry concepts into simple everyday models. Grade-wise mock tests were extremely helpful."
    }
  ];

  const steps = [
    { title: "Submit Requirement", desc: "Share your child's class, board, subjects, location, and budget with us." },
    { title: "Tutor Shortlisting", desc: "Our team selects the most suitable and experienced tutors for your requirements." },
    { title: "Demo Class", desc: "Evaluate the teacher's style and chemistry with a free, no-obligation demo class." },
    { title: "Start Learning", desc: "Begin classes at home or online with scheduled progress reviews." }
  ];

  // Update FAQ Schema mainEntity specifically for index 0 to match exactly
  const updatedFaqSchema = {
    ...faqSchema,
    mainEntity: faqSchema.mainEntity.map((item, idx) => {
      if (idx === 0) {
        return {
          ...item,
          acceptedAnswer: {
            "@type": "Answer",
            "text": "Yes, Saraswati Tutorials provides home tuition services across major areas of Mumbai."
          }
        };
      }
      return item;
    })
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#eff6ff,transparent_50%),radial-gradient(ellipse_at_bottom,#f5f3ff,transparent_50%),linear-gradient(to_bottom,#f8fafc,#f1f5f9)] dark:bg-none dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 selection:bg-blue-600 selection:text-white">
      <Helmet>
        <title>Home Tuition in Mumbai | Best Home Tutors for Class 6-12</title>
        <meta
          name="description"
          content="Looking for home tuition in Mumbai? Saraswati Tutorials provides expert home tutors for CBSE, ICSE, IGCSE, IB & State Board students from Class 6 to 12 across Mumbai."
        />
        <link rel="canonical" href="https://mumbai.saraswatitutorial.com/" />

        {/* Schemas */}
        <script type="application/ld+json">{JSON.stringify(updatedFaqSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(localBusinessSchema)}</script>
      </Helmet>
      <header className="sticky top-0 z-50 w-full py-3 px-4 sm:px-6 lg:px-8 bg-transparent">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 xl:px-6 py-2.5 xl:py-3.5 bg-white/95 dark:bg-[#0c1a2e]/95 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 rounded-[1.75rem] shadow-[0_8px_30px_rgba(0,0,0,0.05)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-2 xl:gap-3 shrink-0">
            <Link to="/" className="flex items-center gap-2 xl:gap-3 group shrink-0">
              <motion.div
                whileHover={{ scale: 1.08, rotate: [0, -3, 3, 0] }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="h-[72px] w-[72px] sm:h-[60px] sm:w-[60px] shrink-0 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700 shadow-sm flex items-center justify-center cursor-pointer"
              >
                <img
                  src="/logo.png"
                  alt="ST"
                  className="h-[56px] w-[56px] sm:h-[48px] sm:w-[48px] rounded-xl object-contain"
                  onError={(e) => {
                    e.target.src = "https://placehold.co/100x100?text=ST";
                  }}
                />
              </motion.div>
              <div className="hidden sm:block shrink-0 leading-tight">
                <motion.div 
                  whileHover={{ x: 2 }}
                  className="text-lg xl:text-xl font-black tracking-tight text-slate-900 dark:text-white transition-all duration-300 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                >
                  Saraswati Tutorials
                </motion.div>
                <div className="text-[10px] xl:text-[11px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                  “Beyond Tuition”
                </div>
              </div>
            </Link>

            <div className="hidden sm:block h-8 w-px bg-slate-200 dark:bg-slate-700 mx-2 xl:mx-3 shrink-0" />

            <div className="shrink-0">
              <LocationSelector activeCity="Mumbai" />
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-2 xl:gap-3.5 2xl:gap-5 text-xs xl:text-[13px] 2xl:text-[14px] font-bold text-slate-600 dark:text-slate-300 xl:flex shrink-0">
            {[
              { href: "#home", label: "Home", id: "home" },
              { href: "#why-choose", label: "Why Us", id: "why-choose" },
              { href: "#plans", label: "Plans", id: "plans" },
              { href: "#subjects", label: "Subjects", id: "subjects" },
              { href: "#boards", label: "Boards", id: "boards" },
              { href: "#areas", label: "Areas", id: "areas" },
            ].map((link) => {
              const isActive = activeSection === link.id;
              return (
                <a
                  key={link.id}
                  href={link.href}
                  className={`relative py-1.5 transition duration-300 whitespace-nowrap shrink-0 ${
                    isActive ? "text-blue-600 dark:text-blue-400 font-extrabold" : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <motion.div
                      layoutId="navUnderline"
                      className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-blue-600 rounded-full"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </a>
              );
            })}
            <ResourcesDropdown activeSection={activeSection} />
          </nav>

          <div className="hidden items-center gap-2 xl:gap-3 xl:flex shrink-0">
            <MotionLink
              to="/parent-enquiry"
              onClick={() => trackEvent("book_demo")}
              whileHover={{ scale: 1.05, translateY: -2, boxShadow: "0 10px 20px rgba(37,99,235,0.25)" }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className="whitespace-nowrap flex items-center gap-1.5 xl:gap-2 rounded-xl xl:rounded-[14px] bg-blue-600 px-4 xl:px-5.5 py-2 xl:py-2.5 text-[11px] xl:text-xs font-black text-white shadow-md transition-all duration-300 hover:bg-blue-700 shrink-0"
            >
              <Calendar className="h-3.5 w-3.5 xl:h-4 xl:w-4 text-white" />
              Book Demo
            </MotionLink>
            <MotionLink
              to="/tutor-register"
              onClick={() => trackEvent("become_tutor")}
              whileHover={{ scale: 1.05, translateY: -2, boxShadow: "0 8px 16px rgba(15,23,42,0.06)" }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className="whitespace-nowrap flex items-center gap-1.5 xl:gap-2 rounded-xl xl:rounded-[14px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 xl:px-5 py-2 xl:py-2.5 text-[11px] xl:text-xs font-black text-slate-800 dark:text-slate-200 shadow-sm transition-all duration-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 shrink-0"
            >
              <User className="h-3.5 w-3.5 xl:h-4 xl:w-4 text-slate-500 dark:text-slate-400" />
              Become a Tutor
            </MotionLink>
            <ThemeToggle />
          </div>

          <div className="flex items-center gap-2 xl:hidden">
            <ThemeToggle />
            <motion.button
              onClick={() => setMenuOpen(!menuOpen)}
              whileTap={{ scale: 0.95, backgroundColor: "rgba(15, 23, 42, 0.1)" }}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-800 dark:text-slate-200 cursor-pointer"
              aria-label="Open Navigation Menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </motion.button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-white/20 dark:border-slate-700/50 bg-white/80 dark:bg-[#0c1a2e]/95 backdrop-blur-lg px-6 py-4 xl:hidden shadow-xl"
            >
              <div className="flex flex-col gap-4 text-base font-bold text-slate-800 dark:text-slate-200">
                <div className="flex items-center justify-between py-2 border-b border-white/20 dark:border-slate-700/50">
                  <span className="text-xs font-black uppercase text-slate-400 dark:text-slate-500">Select City:</span>
                  <LocationSelector activeCity="Mumbai" />
                </div>
                <a href="#home" onClick={() => setMenuOpen(false)} className="py-2 hover:text-blue-600 dark:hover:text-blue-400 transition">Home</a>
                <a href="#why-choose" onClick={() => setMenuOpen(false)} className="py-2 hover:text-blue-600 dark:hover:text-blue-400 transition">Why Us</a>
                <a href="#plans" onClick={() => setMenuOpen(false)} className="py-2 hover:text-blue-600 dark:hover:text-blue-400 transition">Plans</a>
                <a href="#subjects" onClick={() => setMenuOpen(false)} className="py-2 hover:text-blue-600 dark:hover:text-blue-400 transition">Subjects</a>
                <a href="#boards" onClick={() => setMenuOpen(false)} className="py-2 hover:text-blue-600 dark:hover:text-blue-400 transition">Boards</a>
                <a href="#areas" onClick={() => setMenuOpen(false)} className="py-2 hover:text-blue-600 dark:hover:text-blue-400 transition">Areas We Serve</a>
                
                <div className="flex flex-col">
                  <button 
                    type="button"
                    onClick={() => setMobileResourcesOpen(!mobileResourcesOpen)}
                    className="flex items-center justify-between py-2 text-left font-bold text-slate-800 dark:text-slate-200"
                  >
                    <span>Resources</span>
                    <ChevronDown className={`h-4 w-4 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${mobileResourcesOpen ? "rotate-180" : ""}`} />
                  </button>
                  {mobileResourcesOpen && (
                    <div className="pl-4 flex flex-col gap-2 border-l border-slate-100 dark:border-slate-700 my-1 animate-slideFade">
                      <a href="#faqs" onClick={() => { setMenuOpen(false); setMobileResourcesOpen(false); }} className="py-1.5 text-slate-600 dark:text-slate-400 font-bold text-sm">FAQ</a>
                      <Link to="/blogs" onClick={() => { setMenuOpen(false); setMobileResourcesOpen(false); }} className="py-1.5 text-slate-600 dark:text-slate-400 font-bold text-sm">Blog</Link>
                    </div>
                  )}
                </div>

                <MotionLink
                  to="/parent-enquiry"
                  onClick={() => { setMenuOpen(false); trackEvent("book_demo"); }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-xl border border-transparent bg-blue-600 py-3 text-center text-white font-black transition-all duration-300 shadow-md"
                >
                  Book Demo
                </MotionLink>
                <MotionLink
                  to="/tutor-register"
                  onClick={() => { setMenuOpen(false); trackEvent("become_tutor"); }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-3 text-center text-slate-800 dark:text-slate-200 font-black transition-all duration-300 shadow-sm"
                >
                  Become a Tutor
                </MotionLink>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Hero Section */}
      <section
        id="home"
        className="relative overflow-hidden bg-[#030d22] py-20 text-white md:py-32"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,#1e3a8a30,transparent_50%),radial-gradient(circle_at_70%_60%,#3b82f615,transparent_50%)]" />
        <div className="mx-auto max-w-7xl px-6 relative z-10">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-7"
            >
              {/* Eyebrow Pill */}
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-400 mb-6">
                <Star className="h-3.5 w-3.5 fill-current text-blue-400" />
                <span>TRUSTED BY 10,623+ PARENTS</span>
              </div>

              <h1 className="text-4xl font-black tracking-tight text-white md:text-6xl lg:leading-tight">
                Home Tuition in <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Mumbai</span> for Class 6 to 12 → Graduation
              </h1>

              {/* Tagline Description with connector line */}
              <div className="relative pl-6 border-l-2 border-blue-500/20 mt-6">
                <div className="absolute left-[-5px] top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                <p className="text-lg leading-relaxed text-slate-300">
                  Expert home tutors and online classes for CBSE, ICSE, IGCSE, IB & State Board students across Mumbai. Personalized one-to-one tuition for Maths, Science, English and Commerce subjects.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-4">
                <MotionLink
                  to="/parent-enquiry"
                  whileHover={{ scale: 1.03, translateY: -2, boxShadow: "0 10px 25px rgba(59,130,246,0.3)" }}
                  whileTap={{ scale: 0.97 }}
                  className="group inline-flex items-center gap-2 rounded-2xl border border-transparent bg-blue-600 px-7 py-4 font-black text-white shadow-xl shadow-blue-900/40 transition-all duration-300 hover:bg-blue-500"
                >
                  Book Demo
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </MotionLink>

                <button
                  id="parents-dashboard-btn"
                  type="button"
                  onClick={() => setShowDemoPreview(true)}
                  className="rounded-2xl border border-slate-700/80 bg-slate-900/90 px-7 py-4 font-black text-white backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:bg-slate-800 hover:border-slate-600 shadow-lg shadow-slate-950/40 flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <span className="relative flex h-2.5 w-2.5 items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                  </span>
                  Parents Dashboard
                </button>
              </div>
              {/* Quick Stats Grid */}
              <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1 */}
                <div className="relative overflow-hidden rounded-2xl border border-blue-500/10 bg-[#060c18] p-3.5 flex items-center gap-2.5 transition-all duration-300 hover:border-blue-500/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.08)] group">
                  <div className="relative flex items-center justify-center w-10 h-10 shrink-0 rounded-full bg-blue-950/30 border border-blue-500/15 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                    {/* Dashed outer ring */}
                    <div className="absolute inset-[-2.5px] rounded-full border border-dashed border-blue-500/30 animate-[spin_60s_linear_infinite]" />
                    <svg className="w-5 h-5 relative z-10 filter drop-shadow-[0_2px_8px_rgba(59,130,246,0.4)]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 12 12 22 12 22Z" stroke="url(#blueGradCard1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M8.5 11.5l2.5 2.5 5-5" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      <defs>
                        <linearGradient id="blueGradCard1" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#1d4ed8" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-lg xl:text-xl font-black text-blue-400">3200+</div>
                    <div className="text-[11px] font-semibold text-slate-300 leading-tight">Verified Tutors</div>
                  </div>
                </div>

                {/* Card 2 */}
                <div className="relative overflow-hidden rounded-2xl border border-blue-500/10 bg-[#060c18] p-3.5 flex items-center gap-2.5 transition-all duration-300 hover:border-blue-500/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.08)] group">
                  <div className="relative flex items-center justify-center w-10 h-10 shrink-0 rounded-full bg-blue-950/30 border border-blue-500/15 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                    <div className="absolute inset-[-2.5px] rounded-full border border-dashed border-blue-500/30 animate-[spin_60s_linear_infinite]" />
                    <svg className="w-5 h-5 relative z-10 filter drop-shadow-[0_2px_8px_rgba(59,130,246,0.4)]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 19.5c-2-1.5-5.5-1.5-8-1.5h-1V4h1c2.5 0 6 0 8 1.5v14z" fill="url(#bookPageGrad)" stroke="url(#blueGradCard2)" strokeWidth="1.5" strokeLinejoin="round"/>
                      <path d="M12 19.5c2-1.5 5.5-1.5 8-1.5h1V4h-1c-2.5 0-6 0-8 1.5v14z" fill="url(#bookPageGrad)" stroke="url(#blueGradCard2)" strokeWidth="1.5" strokeLinejoin="round"/>
                      <path d="M14 7h4M14 10h4M14 13h4" stroke="url(#blueGradCard2)" strokeWidth="2" strokeLinecap="round"/>
                      <defs>
                        <linearGradient id="blueGradCard2" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#1d4ed8" />
                        </linearGradient>
                        <linearGradient id="bookPageGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.6" />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-lg xl:text-xl font-black text-blue-400">25+</div>
                    <div className="text-[11px] font-semibold text-slate-300 leading-tight">Subjects Covered</div>
                  </div>
                </div>

                {/* Card 3 */}
                <div className="relative overflow-hidden rounded-2xl border border-blue-500/10 bg-[#060c18] p-3.5 flex items-center gap-2.5 transition-all duration-300 hover:border-blue-500/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.08)] group">
                  <div className="relative flex items-center justify-center w-10 h-10 shrink-0 rounded-full bg-blue-950/30 border border-blue-500/15 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                    <div className="absolute inset-[-2.5px] rounded-full border border-dashed border-blue-500/30 animate-[spin_60s_linear_infinite]" />
                    <svg className="w-6 h-6 relative z-10 filter drop-shadow-[0_2px_8px_rgba(59,130,246,0.4)]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 9l10-7 10 7H2z" fill="url(#blueGradCard3)" stroke="url(#blueGradCard3)" strokeWidth="1" strokeLinejoin="round" />
                      <path d="M3.5 9h17v2h-17V9z" fill="url(#blueGradCard3)" />
                      <rect x="5.5" y="11" width="2" height="7" rx="0.5" fill="url(#blueGradCard3)" />
                      <rect x="11" y="11" width="2" height="7" rx="0.5" fill="url(#blueGradCard3)" />
                      <rect x="16.5" y="11" width="2" height="7" rx="0.5" fill="url(#blueGradCard3)" />
                      <path d="M3 18h18v2H3v-2zm-1 2h20v2H2v-2z" fill="url(#blueGradCard3)" />
                      <defs>
                        <linearGradient id="blueGradCard3" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#1d4ed8" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-lg xl:text-xl font-extrabold text-blue-400">All Boards</div>
                    <div className="text-[11px] font-semibold text-slate-300 leading-tight">Comprehensive Syllabus</div>
                  </div>
                </div>

                {/* Card 4 */}
                <div className="relative rounded-2xl border border-blue-500/10 bg-[#060c18] p-3.5 flex items-center gap-2.5 transition-all duration-300 hover:border-blue-500/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.08)] group">
                  <div className="relative flex items-center justify-center w-10 h-10 shrink-0 rounded-full bg-blue-950/30 border border-blue-500/15 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                    <div className="absolute inset-[-2.5px] rounded-full border border-dashed border-blue-500/30 animate-[spin_60s_linear_infinite]" />
                    <svg className="w-6 h-6 relative z-10 filter drop-shadow-[0_2px_8px_rgba(59,130,246,0.4)]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" fill="url(#blueGradCard4)" stroke="url(#blueGradCard4)" strokeWidth="1" strokeLinejoin="round"/>
                      <path d="M6 10v4c0 3 2.5 5 6 5s6-2 6-5v-4" fill="url(#capInnerGrad)" stroke="url(#blueGradCard4)" strokeWidth="1.5" strokeLinejoin="round"/>
                      <path d="M20.5 8.5v5.5M20.5 14v2" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round"/>
                      <circle cx="20.5" cy="17" r="1.5" fill="#60a5fa" />
                      <defs>
                        <linearGradient id="blueGradCard4" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#1d4ed8" />
                        </linearGradient>
                        <linearGradient id="capInnerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.7" />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-lg xl:text-xl font-extrabold text-blue-400">Free Trial</div>
                    <div className="text-[11px] font-semibold text-slate-300 leading-tight">Demo Class</div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Quick Consultation Feature Panel with Realistic Hero Image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="lg:col-span-5 w-full mt-10 lg:mt-0"
            >
              <div className="relative overflow-hidden rounded-[1.5rem] sm:rounded-[2.5rem] border border-slate-800 bg-[#081229]/80 p-4 sm:p-5 shadow-2xl backdrop-blur-xl">
                {/* Tuition realistic picture */}
                <div className="relative h-60 w-full overflow-hidden rounded-[1.2rem] sm:rounded-[2rem] shadow-inner">
                  <img
                    src="/mumbai_tutor_hero.png"
                    alt="Saraswati Home Tuition in Mumbai"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                  <div className="absolute bottom-4 left-4 rounded-xl bg-blue-600/90 px-3.5 py-1.5 text-[10px] font-black tracking-wide text-white backdrop-blur flex items-center gap-1.5 border border-blue-400/20">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verified Home Tutors
                  </div>
                </div>

                <div className="mt-6 p-2">
                  <h3 className="text-xl font-black text-white">Mumbai Parent Consultation</h3>
                  <p className="mt-2 text-xs text-slate-400">
                    Get in touch with our curriculum coordinator to discuss syllabus tracking, tutor preferences, and timings.
                  </p>

                  <div className="mt-6 space-y-3">
                    <a
                      href="tel:+919041157689"
                      className="flex items-center gap-3 rounded-2xl bg-[#0b1b36] border border-slate-800 p-3.5 transition hover:bg-[#102447] cursor-pointer"
                    >
                      <Phone className="h-5 w-5 text-blue-400" />
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Call / WhatsApp</div>
                        <div className="text-xs font-black text-white">+91 9041157689</div>
                      </div>
                    </a>

                    <div className="flex items-center gap-3 rounded-2xl bg-[#0b1b36] border border-slate-800 p-3.5">
                      <Mail className="h-5 w-5 text-blue-400" />
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</div>
                        <div className="text-xs font-black text-white">services@saraswatitutorial.com</div>
                      </div>
                    </div>
                  </div>

                  <MotionLink
                    to="/parent-enquiry"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-full border border-transparent bg-white text-sm font-black text-slate-950 transition hover:bg-slate-100 py-3.5 shadow-lg"
                  >
                    Enquire Now
                    <ArrowRight className="h-4 w-4" />
                  </MotionLink>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <PlansSection />

      {/* SEO Intro Section */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="rounded-[1.5rem] sm:rounded-[2.5rem] border border-white/50 dark:border-slate-700/50 bg-white/30 dark:bg-slate-800/30 backdrop-blur-xl p-5 sm:p-8 shadow-xl shadow-slate-100/10 dark:shadow-none md:p-12">
          <div className="max-w-4xl">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Overview</h2>
            <h3 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-4xl">
              Home Tuition in Mumbai for Class 6 to 12
            </h3>

            <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-600 dark:text-slate-400">
              <p>
                Saraswati Tutorials provides trusted and result-oriented home tuition in Mumbai for students from Class 6 to 12. We offer experienced private tutors for CBSE, ICSE, IGCSE, IB and Maharashtra State Board students across major areas of Mumbai including Andheri, Bandra, Powai, Borivali, Thane, Navi Mumbai and more. Our personalized one-to-one teaching approach helps students improve conceptual understanding, confidence and academic performance.
              </p>
              <p>
                Whether your child needs help in Maths, Science, Physics, Chemistry, Biology, English or Commerce subjects, our expert tutors provide customized learning plans, regular assessments and dedicated doubt-solving support at home or online.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Section */}
      <section id="why-choose" className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-600 dark:text-blue-400">Core Benefits</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-5xl">
              Why Parents Prefer Saraswati Tutorials in Mumbai
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-400">
              We stand apart through our student-first philosophy, matching children with vetted subject-matter experts who act as academic mentors.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {whyChooseUs.map((item, idx) => {
              const IconComp = item.icon;
              const glassThemes = [
                // 1. Verified Tutors (Blue Glass)
                { bg: "bg-blue-500/12 dark:bg-blue-500/20", border: "border-blue-300/70 dark:border-blue-400/30", icon: "text-blue-600 dark:text-blue-400", glow: "group-hover:shadow-[0_12px_28px_rgba(37,99,235,0.18)] dark:group-hover:shadow-[0_12px_28px_rgba(59,130,246,0.25)]" },
                // 2. One-to-One (Purple Glass)
                { bg: "bg-purple-500/12 dark:bg-purple-500/20", border: "border-purple-300/70 dark:border-purple-400/30", icon: "text-purple-600 dark:text-purple-400", glow: "group-hover:shadow-[0_12px_28px_rgba(147,51,234,0.18)] dark:group-hover:shadow-[0_12px_28px_rgba(168,85,247,0.25)]" },
                // 3. Home & Online (Orange Glass)
                { bg: "bg-orange-500/12 dark:bg-orange-500/20", border: "border-orange-300/70 dark:border-orange-400/30", icon: "text-orange-500 dark:text-orange-400", glow: "group-hover:shadow-[0_12px_28px_rgba(249,115,22,0.18)] dark:group-hover:shadow-[0_12px_28px_rgba(251,146,60,0.25)]" },
                // 4. Bi-Weekly Tests (Green Glass)
                { bg: "bg-emerald-500/12 dark:bg-emerald-500/20", border: "border-emerald-300/70 dark:border-emerald-400/30", icon: "text-emerald-600 dark:text-emerald-400", glow: "group-hover:shadow-[0_12px_28px_rgba(16,185,129,0.18)] dark:group-hover:shadow-[0_12px_28px_rgba(52,211,153,0.25)]" },
                // 5. Flexible Timings (Pink Glass)
                { bg: "bg-rose-500/12 dark:bg-rose-500/20", border: "border-rose-300/70 dark:border-rose-400/30", icon: "text-rose-500 dark:text-rose-400", glow: "group-hover:shadow-[0_12px_28px_rgba(244,63,94,0.18)] dark:group-hover:shadow-[0_12px_28px_rgba(251,113,133,0.25)]" },
                // 6. All Boards (Blue Glass)
                { bg: "bg-blue-500/12 dark:bg-blue-500/20", border: "border-blue-300/70 dark:border-blue-400/30", icon: "text-blue-600 dark:text-blue-400", glow: "group-hover:shadow-[0_12px_28px_rgba(37,99,235,0.18)] dark:group-hover:shadow-[0_12px_28px_rgba(59,130,246,0.25)]" },
                // 7. Affordable Fee (Amber Glass)
                { bg: "bg-amber-500/12 dark:bg-amber-500/20", border: "border-amber-300/70 dark:border-amber-400/30", icon: "text-amber-500 dark:text-amber-400", glow: "group-hover:shadow-[0_12px_28px_rgba(245,158,11,0.18)] dark:group-hover:shadow-[0_12px_28px_rgba(251,191,36,0.25)]" },
                // 8. Free Demo (Pink Glass)
                { bg: "bg-pink-500/12 dark:bg-pink-500/20", border: "border-pink-300/70 dark:border-pink-400/30", icon: "text-pink-500 dark:text-pink-400", glow: "group-hover:shadow-[0_12px_28px_rgba(236,72,153,0.18)] dark:group-hover:shadow-[0_12px_28px_rgba(244,114,182,0.25)]" },
                // 9. Fast Progress (Teal Glass)
                { bg: "bg-teal-500/12 dark:bg-teal-500/20", border: "border-teal-300/70 dark:border-teal-400/30", icon: "text-teal-600 dark:text-teal-400", glow: "group-hover:shadow-[0_12px_28px_rgba(20,184,166,0.18)] dark:group-hover:shadow-[0_12px_28px_rgba(45,212,191,0.25)]" },
                // 10. Expert Teachers (Purple Glass)
                { bg: "bg-purple-500/12 dark:bg-purple-500/20", border: "border-purple-300/70 dark:border-purple-400/30", icon: "text-purple-600 dark:text-purple-400", glow: "group-hover:shadow-[0_12px_28px_rgba(147,51,234,0.18)] dark:group-hover:shadow-[0_12px_28px_rgba(168,85,247,0.25)]" },
                // 11. Regular Attendance (Blue Glass)
                { bg: "bg-blue-500/12 dark:bg-blue-500/20", border: "border-blue-300/70 dark:border-blue-400/30", icon: "text-blue-600 dark:text-blue-400", glow: "group-hover:shadow-[0_12px_28px_rgba(37,99,235,0.18)] dark:group-hover:shadow-[0_12px_28px_rgba(59,130,246,0.25)]" },
                // 12. Parent Support (Cyan Glass)
                { bg: "bg-cyan-500/12 dark:bg-cyan-500/20", border: "border-cyan-300/70 dark:border-cyan-400/30", icon: "text-cyan-600 dark:text-cyan-400", glow: "group-hover:shadow-[0_12px_28px_rgba(6,182,212,0.18)] dark:group-hover:shadow-[0_12px_28px_rgba(34,211,238,0.25)]" },
              ];
              const theme = glassThemes[idx % glassThemes.length];

              return (
                <motion.div
                  whileHover={{ y: -6, scale: 1.02 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  key={idx}
                  className="group relative overflow-hidden rounded-3xl border border-slate-200/90 dark:border-slate-700/60 bg-white dark:bg-slate-900 p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all duration-300 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-[0_20px_35px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_20px_35px_rgba(0,0,0,0.4)]"
                >
                  {/* 3D Transparent Water Glass Badge Container */}
                  <div className={`relative flex h-16 w-16 items-center justify-center rounded-[1.35rem] ${theme.bg} backdrop-blur-xl border ${theme.border} shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.9),0_6px_16px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.1),0_6px_16px_rgba(0,0,0,0.3)] transition-all duration-300 group-hover:scale-105 group-hover:-rotate-2 ${theme.glow}`}>
                    {/* Water gloss highlight reflection */}
                    <div className="absolute top-1 left-2.5 right-2.5 h-[3px] rounded-full bg-gradient-to-r from-transparent via-white/90 to-transparent pointer-events-none" />
                    {/* Inner glass bevel rim */}
                    <div className="absolute inset-0 rounded-[1.35rem] ring-1 ring-inset ring-white/60 dark:ring-white/10 pointer-events-none" />
                    <IconComp className={`relative z-10 h-7 w-7 ${theme.icon} filter drop-shadow-[0_2px_3px_rgba(0,0,0,0.08)] stroke-[2.2]`} />
                  </div>

                  <h4 className="mt-5 text-lg font-black text-slate-900 dark:text-white leading-snug">
                    {item.title}
                  </h4>
                  <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
                    {item.desc}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Subjects Section */}
      <section id="subjects" className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-600 dark:text-blue-400">Tuition Programs</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-5xl">
            Subjects Available for Home Tuition in Mumbai
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-400">
            Comprehensive curriculum guidance covering science, mathematics, literature, and accounting.
          </p>
        </div>

        <div className="mt-12 space-y-12">
          {/* School Subjects */}
          <div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white border-l-4 border-blue-600 pl-3 mb-6">
              School Subjects
            </h3>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {schoolSubjects.map((subj, idx) => (
                <div
                  key={idx}
                  className="overflow-hidden group rounded-3xl border border-white/60 dark:border-slate-700/60 bg-white/30 dark:bg-slate-900/80 backdrop-blur-md shadow-sm shadow-slate-100/20 dark:shadow-none transition hover:bg-white/50 dark:hover:bg-slate-800/80 hover:shadow-xl dark:hover:shadow-blue-900/10 hover:scale-[1.03] duration-300"
                >
                  <div className="h-44 w-full overflow-hidden">
                    <img
                      src={subj.image}
                      alt={subj.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/20 font-black text-blue-600 dark:text-blue-400 transition group-hover:bg-blue-100 dark:group-hover:bg-blue-500/30">
                      {idx + 1}
                    </div>
                    <h4 className="mt-4 text-xl font-black text-slate-950 dark:text-white">{subj.title}</h4>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                      {subj.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Commerce Subjects */}
          <div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white border-l-4 border-indigo-600 pl-3 mb-6">
              Commerce Subjects
            </h3>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {commerceSubjects.map((subj, idx) => (
                <div
                  key={idx}
                  className="overflow-hidden group rounded-3xl border border-white/60 dark:border-slate-700/60 bg-white/30 dark:bg-slate-900/80 backdrop-blur-md shadow-sm shadow-slate-100/20 dark:shadow-none transition hover:bg-white/50 dark:hover:bg-slate-800/80 hover:shadow-xl dark:hover:shadow-indigo-900/10 hover:scale-[1.03] duration-300"
                >
                  <div className="h-44 w-full overflow-hidden">
                    <img
                      src={subj.image}
                      alt={subj.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-500/20 font-black text-indigo-600 dark:text-indigo-400 transition group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/30">
                      {idx + 1}
                    </div>
                    <h4 className="mt-4 text-xl font-black text-slate-950 dark:text-white">{subj.title}</h4>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                      {subj.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Boards Section */}
      <section id="boards" className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 py-16 text-white md:py-24 border-t border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1),transparent_60%)]" />
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-400">Board Coverage</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-white md:text-5xl">
              Boards We Cover
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-400">
              Our teachers are thoroughly familiar with board assessment blueprints, question patterns, and formatting guidelines.
            </p>
          </div>

          <div className="mt-12 grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            {boards.map((board, idx) => (
              <div
                key={idx}
                className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition hover:bg-white/10 hover:border-white/20 hover:scale-[1.02] duration-300"
              >
                <div className="text-xs font-bold text-blue-400 uppercase tracking-widest">Syllabus</div>
                <h4 className="mt-2 text-xl font-black text-white">{board.name}</h4>
                <p className="mt-3 text-xs leading-relaxed text-slate-400">{board.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Classes Section */}
      <section className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-600 dark:text-blue-400">Structured Modules</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-5xl">
            Tuition Classes Available
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-400">
            Tailored grade-wise guidance designed to secure high scores and bolster conceptual foundations.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {classesList.map((cls, idx) => (
            <div
              key={idx}
              className="overflow-hidden group rounded-3xl border border-white/60 dark:border-slate-700/60 bg-white/30 dark:bg-slate-900/80 backdrop-blur-md shadow-sm shadow-slate-100/20 dark:shadow-none transition hover:bg-white/50 dark:hover:bg-slate-800/80 hover:shadow-xl dark:hover:shadow-blue-900/10 hover:scale-[1.03] duration-300"
            >
              <div className="h-32 w-full overflow-hidden">
                <img
                  src={cls.image}
                  alt={cls.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="p-6">
                <h4 className="mt-4 text-lg font-black text-slate-950 dark:text-white">{cls.title}</h4>
                <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{cls.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Areas We Serve */}
      <section id="areas" className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-600 dark:text-blue-400">Locations</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-5xl">
              Home Tuition Available Across Mumbai
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-400">
              Our network of verified home tutors reaches all major commercial and residential pockets in Mumbai.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
            {areas.map((area, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-2xl border border-white/50 dark:border-slate-700/60 bg-white/40 dark:bg-slate-800/50 backdrop-blur-sm p-4 transition hover:bg-white/60 dark:hover:bg-slate-700/60 hover:scale-[1.02]"
              >
                <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{area}</span>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-8 max-w-3xl text-center text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            <p>
              Saraswati Tutorials has a widespread network of home tutors spanning across the entire Mumbai metropolitan region. Whether you live in South Mumbai, the Western Suburbs, the Eastern Suburbs, or neighboring areas like Thane and Navi Mumbai, we can match you with an experienced private tutor who can conduct offline classes at your residence. In addition to offline sessions, our tutors are equipped to offer highly engaging and interactive online live classes, providing flexibility for busy student schedules.
            </p>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-600 dark:text-blue-400">Process Flow</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-5xl">
            How Our Tutor Matching Process Works
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-400">
            Four simple steps to match your child with their perfect private home tutor.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, idx) => (
            <div key={idx} className="relative rounded-3xl border border-white/60 dark:border-slate-700/60 bg-white/30 dark:bg-slate-900/80 backdrop-blur-md p-6 shadow-sm dark:shadow-none transition hover:bg-white/50 dark:hover:bg-slate-800/80 hover:scale-[1.02]">
              <div className="absolute -top-4 left-6 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-black text-white shadow">
                {idx + 1}
              </div>
              <h4 className="mt-4 text-lg font-black text-slate-950 dark:text-white">{step.title}</h4>
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Parent Trust / Testimonials */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 py-16 text-white md:py-24 border-t border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08),transparent_65%)]" />
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-400">Testimonials</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-white md:text-5xl">
              Trusted by Parents Across Mumbai
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-400">
              We focus on conceptual clarity, academic improvement and personalized attention for every student. Our tutors regularly track student performance and help children become more confident in exams and school studies.
            </p>
          </div>

          <div className="mt-12 grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t, idx) => (
              <div key={idx} className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition hover:bg-white/10 hover:border-white/20 hover:scale-[1.02]">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="mt-4 text-sm leading-relaxed text-slate-300">{t.text}</p>
                <div className="mt-6 border-t border-white/10 pt-4">
                  <div className="font-black text-white">{t.name}</div>
                  <div className="text-xs text-slate-400">{t.role} ({t.location})</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faqs" className="mx-auto max-w-4xl px-6 py-16 md:py-24">
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-600 dark:text-blue-400">Questions</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-5xl">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="mt-12 space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div
                key={idx}
                className="overflow-hidden rounded-2xl border border-white/60 dark:border-slate-700/60 bg-white/30 dark:bg-slate-900/80 backdrop-blur-md shadow-sm dark:shadow-none transition hover:bg-white/40 dark:hover:bg-slate-800/80"
              >
                <motion.button
                  onClick={() => toggleFaq(idx)}
                  whileTap={{ scale: 0.99 }}
                  className="flex w-full items-center justify-between px-6 py-5 text-left font-black text-slate-950 dark:text-white hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                >
                  <span>{faq.q}</span>
                  {isOpen ? <ChevronUp className="h-5 w-5 text-blue-600 dark:text-blue-400" /> : <ChevronDown className="h-5 w-5 text-slate-400 dark:text-slate-500" />}
                </motion.button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="border-t border-white/20 dark:border-slate-700/50 bg-white/20 dark:bg-slate-800/40 px-6 py-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 py-20 text-white border-t border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#3b82f615,transparent_60%)]" />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-black tracking-tight md:text-5xl">
            Book a Demo Class Today
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-400">
            Get matched with experienced home tutors in Mumbai for your child’s academic needs.
          </p>
          <div className="mt-8">
            <MotionLink
              to="/parent-enquiry"
              whileTap={{ scale: 0.95, backgroundColor: "rgba(255, 255, 255, 0.15)", borderColor: "rgba(255, 255, 255, 0.4)", color: "#ffffff" }}
              className="inline-flex items-center gap-2 rounded-2xl border border-transparent bg-white px-8 py-4 font-black text-slate-950 shadow-xl transition hover:-translate-y-0.5 hover:bg-slate-100"
            >
              Enquire Now
              <ArrowRight className="h-5 w-5" />
            </MotionLink>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/20 dark:border-slate-700/50 bg-white/30 dark:bg-[#060f1e]/95 backdrop-blur-md py-12 text-slate-600 dark:text-slate-400">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="Saraswati Tutorial Logo"
                  className="h-10 w-10 rounded-xl object-contain"
                  onError={(e) => {
                    e.target.src = "https://placehold.co/100x100?text=ST";
                  }}
                />
                <span className="text-lg font-black text-slate-950 dark:text-white">Saraswati Tutorial</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Expert tutoring services mapping local academic boards across Bangalore and Mumbai.
              </p>
            </div>

            <div>
              <h5 className="font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider text-xs">Direct Services</h5>
              <ul className="mt-4 space-y-2 text-sm">
                <li><Link to="/parent-enquiry" className="hover:text-blue-600 dark:hover:text-blue-400 transition">Parent Enquiry</Link></li>
                <li><Link to="/tutor-register" className="hover:text-blue-600 dark:hover:text-blue-400 transition">Become a Tutor</Link></li>
                <li><a href="https://saraswatitutorial.com/" className="hover:text-blue-600 dark:hover:text-blue-400 transition">Home Tuition Services</a></li>
                <li><a href="https://saraswatitutorial.com/#tutors" className="hover:text-blue-600 dark:hover:text-blue-400 transition">Online Tuition</a></li>
              </ul>
            </div>

            <div>
              <h5 className="font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider text-xs">Legal Details</h5>
              <ul className="mt-4 space-y-2 text-sm">
                <li><Link to="/terms-conditions" className="hover:text-blue-600 dark:hover:text-blue-400 transition">Terms & Conditions</Link></li>
                <li><Link to="/privacy-policy" className="hover:text-blue-600 dark:hover:text-blue-400 transition">Privacy Policy</Link></li>
                <li><Link to="/disclaimer" className="hover:text-blue-600 dark:hover:text-blue-400 transition">Disclaimer</Link></li>
              </ul>
            </div>

            <div>
              <h5 className="font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider text-xs">Support Contact</h5>
              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>+91 9041157689</span>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>services@saraswatitutorial.com</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t border-slate-100 dark:border-slate-800 pt-6 text-center text-xs text-slate-400 dark:text-slate-500">
            &copy; {new Date().getFullYear()} Saraswati Tutorials. All rights reserved.
          </div>
        </div>
      </footer>

      <motion.a
        href="https://wa.me/919041157689"
        target="_blank"
        rel="noopener noreferrer"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95, backgroundColor: "rgba(37, 211, 102, 0.2)", borderColor: "rgba(37, 211, 102, 0.5)" }}
        transition={{
          y: {
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          },
          default: { duration: 0.3 }
        }}
        className="group fixed bottom-6 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-[#25D366] shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition hover:bg-[#128C7E]"
        aria-label="Contact WhatsApp"
      >
        <svg
          className="h-8 w-8"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* White speech bubble background */}
          <path
            fill="white"
            d="M12.004 2C6.48 2 2 6.48 2 12c0 2.17.69 4.19 1.86 5.86L2 22l4.27-1.13C7.9 21.58 9.9 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"
          />
          {/* Phone handset inside (transitions green color on hover to match background) */}
          <path
            className="fill-[#25D366] transition-colors duration-200 group-hover:fill-[#128C7E]"
            d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"
          />
        </svg>
      </motion.a>
      {showDemoPreview && (
        <DemoParentDashboard onClose={() => setShowDemoPreview(false)} />
      )}
    </div>
  );
}
