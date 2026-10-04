import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Zap,
  Star,
  Award,
  TrendingUp,
  UserCheck,
  ShieldCheck,
  Clock,
  BookOpen,
  ArrowRight,
  ChevronDown,
  X,
  ChevronLeft,
  ChevronRight,
  Info,
  Smile,
  Compass,
  FileText,
  MapPin,
  RefreshCw,
  MessageSquare,
  Calendar
} from "lucide-react";

import { PLANS, calculatePrice, calculateEliteHourlyPrice } from "../data/plansConfig";
import { trackEvent } from "../utils/analytics";

const TIMELINE_STEPS = [
  {
    number: "1",
    title: "Choose Your Plan",
    desc: "Select the plan that best suits your goals, style, and schedule."
  },
  {
    number: "2",
    title: "Get Matched With the Right Tutor",
    desc: "We match a tutor based on your grade, board, and learning needs."
  },
  {
    number: "3",
    title: "Start Personalized Learning",
    desc: "Begin 1-on-1 classes with a customized study approach."
  },
  {
    number: "4",
    title: "Weekly Progress Tracking",
    desc: "Weekly tests and homework reviews ensure steady improvement."
  },
  {
    number: "5",
    title: "Monthly Parent Review",
    desc: "Receive regular progress reports to stay informed of growth."
  }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1]
    }
  }
};

export default function PlansSection() {
  const [activePlan, setActivePlan] = useState(null);
  const [selectedClass, setSelectedClass] = useState(() => localStorage.getItem("selectedClass") || "Grade 6");
  const [selectedBoard, setSelectedBoard] = useState(() => localStorage.getItem("selectedBoard") || "CBSE");
  const detailsRef = useRef(null);
  
  // Smooth scroll to the details section when activePlan changes
  useEffect(() => {
    if (activePlan && detailsRef.current) {
      setTimeout(() => {
        detailsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [activePlan]);

  const handleCardClick = (planId) => {
    if (activePlan === planId) {
      setActivePlan(null);
    } else {
      setActivePlan(planId);
      trackEvent("explore_plan", planId);
    }
  };

  const handleScrollToEnquiry = () => {
    if (activePlan) {
      trackEvent("choose_plan", activePlan);
      trackEvent("book_demo", activePlan);
      localStorage.setItem("prefilledPlan", activePlan);
      localStorage.setItem("prefilledClass", selectedClass);
      localStorage.setItem("prefilledBoard", selectedBoard);
    }
    const enquirySection = document.getElementById("parent-enquiry");
    if (enquirySection) {
      enquirySection.scrollIntoView({ behavior: "smooth" });
    } else {
      window.location.href = "/parent-enquiry";
    }
  };

  const activePlanData = PLANS.find((p) => p.id === activePlan);

  return (
    <section id="plans" className="relative overflow-hidden bg-slate-950 py-12 text-white border-t border-b border-white/5">
      {/* CSS Styles for animations */}
      <style>{`
        @keyframes shineEffect {
          0% {
            transform: translateX(-150%) skewX(-15deg);
          }
          100% {
            transform: translateX(150%) skewX(-15deg);
          }
        }
        .shine-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.15),
            transparent
          );
          transform: translateX(-150%) skewX(-15deg);
        }
        .premium-shine-card:hover .shine-overlay {
          animation: shineEffect 1.5s ease-in-out forwards;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Background Gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-1/4 -top-1/4 h-[700px] w-[700px] rounded-full bg-blue-600/10 blur-[150px]" />
        <div className="absolute -right-1/4 -bottom-1/4 h-[700px] w-[700px] rounded-full bg-indigo-600/10 blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-5 md:px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h2 className="text-4xl font-black tracking-tight text-white md:text-6xl">
            Choose Your Learning Path
          </h2>
          <p className="mt-4 text-base font-semibold text-slate-400 md:text-lg max-w-2xl mx-auto">
            Flexible Plans • Expert Mentorship • Better Results
          </p>

          {/* Interactive Class & Board Selectors */}
          <div className="mt-8 flex flex-wrap justify-center gap-4 max-w-lg mx-auto z-30 relative px-4">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 text-left pl-1">
                Student Class
              </label>
              <select
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  localStorage.setItem("selectedClass", e.target.value);
                }}
                className="w-full bg-slate-900/80 border border-white/10 rounded-2xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition duration-300 cursor-pointer shadow-inner backdrop-blur-md"
              >
                {["Grade 1–5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12", "Degree"].map((cg) => (
                  <option key={cg} value={cg} className="bg-slate-950 text-white">{cg}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 text-left pl-1">
                Syllabus / Board
              </label>
              <select
                value={selectedBoard}
                onChange={(e) => {
                  setSelectedBoard(e.target.value);
                  localStorage.setItem("selectedBoard", e.target.value);
                }}
                className="w-full bg-slate-900/80 border border-white/10 rounded-2xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-blue-500 transition duration-300 cursor-pointer shadow-inner backdrop-blur-md"
              >
                {["CBSE", "ICSE / ISC", "IGCSE", "IB", "State Board / PUC", "NIOS"].map((b) => (
                  <option key={b} value={b} className="bg-slate-950 text-white">{b}</option>
                ))}
              </select>
            </div>
          </div>
        </motion.div>

        {/* Carousel / Cards Layout Wrapper */}
        <PlanCarousel
          plans={PLANS}
          activePlan={activePlan}
          onCardClick={handleCardClick}
        />

        {/* Expandable Details Section */}
        <div ref={detailsRef} className="mt-4">
          <AnimatePresence mode="wait">
            {activePlan && activePlanData && (
              <motion.div
                key={activePlan}
                initial={{ opacity: 0, height: 0, y: 30 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -20 }}
                transition={{ duration: 0.45, ease: "easeInOut" }}
                className="overflow-hidden mt-4 max-w-6xl mx-auto"
              >
                <div className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-6 md:p-10 shadow-2xl relative backdrop-blur-xl">
                  {/* Close button */}
                  <button
                    onClick={() => setActivePlan(null)}
                    className="absolute top-6 right-6 p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white transition"
                    aria-label="Collapse Details"
                  >
                    <X className="h-5 w-5" />
                  </button>

                  <PlanDetails
                    plan={activePlanData}
                    onCTA={handleScrollToEnquiry}
                    selectedClass={selectedClass}
                    selectedBoard={selectedBoard}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

// Infinite Carousel Component
function PlanCarousel({ plans, activePlan, onCardClick }) {
  const scrollRef = useRef(null);
  const cardRef = useRef(null);
  const autoplayTimeoutRef = useRef(null);
  const targetIndexRef = useRef(12); // Start in the middle
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const [isHovered, setIsHovered] = useState(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [cardWidth, setCardWidth] = useState(390);
  const [containerWidth, setContainerWidth] = useState(0);
  const [centeredIndex, setCenteredIndex] = useState(12); // Track centered card index

  // Repeat the plans array 10 times to enable seamless infinite scroll in both directions
  const slides = [];
  for (let i = 0; i < 10; i++) {
    slides.push(...plans);
  }

  // Calculate centered scroll position for a specific card index
  const getScrollPositionForIndex = (idx) => {
    return idx * cardWidth - (containerWidth - cardWidth) / 2;
  };

  // Measure card and container width dynamically with ResizeObserver
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const handleResize = () => {
      if (scrollEl) {
        setContainerWidth(scrollEl.offsetWidth);
      }
      if (cardRef.current) {
        setCardWidth(cardRef.current.offsetWidth);
      } else {
        const firstCard = scrollEl.querySelector(".flex-shrink-0");
        if (firstCard) {
          setCardWidth(firstCard.offsetWidth);
        }
      }
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(scrollEl);

    // Initial measurement
    handleResize();

    return () => {
      observer.disconnect();
    };
  }, []);

  // Initialize and recalibrate scroll position
  useEffect(() => {
    if (scrollRef.current && cardWidth > 0 && containerWidth > 0) {
      const targetScrollLeft = getScrollPositionForIndex(targetIndexRef.current);
      scrollRef.current.scrollLeft = targetScrollLeft;
    }
  }, [cardWidth, containerWidth]);

  // Pause autoplay for 5 seconds on user click/interaction
  const triggerInteractionPause = () => {
    setIsUserInteracting(true);
    if (autoplayTimeoutRef.current) {
      clearTimeout(autoplayTimeoutRef.current);
    }
    autoplayTimeoutRef.current = setTimeout(() => {
      setIsUserInteracting(false);
    }, 5000);
  };

  // Clean up timeout
  useEffect(() => {
    return () => {
      if (autoplayTimeoutRef.current) {
        clearTimeout(autoplayTimeoutRef.current);
      }
    };
  }, []);

  // Autoplay effect (smooth scroll card-by-card every 4 seconds)
  useEffect(() => {
    if (isHovered || activePlan !== null || isUserInteracting || isDragging) {
      return;
    }

    const interval = setInterval(() => {
      handleNext();
    }, 4000);

    return () => clearInterval(interval);
  }, [isHovered, activePlan, isUserInteracting, isDragging, cardWidth]);

  const handleNext = () => {
    if (!scrollRef.current || cardWidth === 0) return;
    triggerInteractionPause();
    targetIndexRef.current += 1;
    const targetScrollLeft = getScrollPositionForIndex(targetIndexRef.current);
    scrollRef.current.scrollTo({
      left: targetScrollLeft,
      behavior: "smooth"
    });
  };

  const handlePrev = () => {
    if (!scrollRef.current || cardWidth === 0) return;
    triggerInteractionPause();
    targetIndexRef.current -= 1;
    const targetScrollLeft = getScrollPositionForIndex(targetIndexRef.current);
    scrollRef.current.scrollTo({
      left: targetScrollLeft,
      behavior: "smooth"
    });
  };

  const handleScroll = () => {
    if (!scrollRef.current || cardWidth === 0 || containerWidth === 0) return;

    const scrollLeft = scrollRef.current.scrollLeft;
    const singleCycleWidth = plans.length * cardWidth;

    // Wrap around boundaries
    if (!isUserInteracting || isDragging) {
      if (scrollLeft >= 7 * singleCycleWidth) {
        scrollRef.current.scrollLeft -= 3 * singleCycleWidth;
        targetIndexRef.current -= 3 * plans.length;
      } else if (scrollLeft <= 2 * singleCycleWidth) {
        scrollRef.current.scrollLeft += 3 * singleCycleWidth;
        targetIndexRef.current += 3 * plans.length;
      }
    }

    // Calculate current index
    const currentIndex = Math.round(
      (scrollRef.current.scrollLeft + (containerWidth - cardWidth) / 2) / cardWidth
    );

    if (isDragging || !isUserInteracting) {
      targetIndexRef.current = currentIndex;
    }

    if (currentIndex !== centeredIndex) {
      setCenteredIndex(currentIndex);
    }
  };

  const handleMouseDown = (e) => {
    if (e.target.closest("button")) return;
    setIsDragging(true);
    startXRef.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeftRef.current = scrollRef.current.scrollLeft;
    triggerInteractionPause();
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    scrollRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      if (scrollRef.current) {
        const currentScrollLeft = scrollRef.current.scrollLeft;
        const currentIndex = Math.round(
          (currentScrollLeft + (containerWidth - cardWidth) / 2) / cardWidth
        );
        targetIndexRef.current = currentIndex;
        const targetScrollLeft = getScrollPositionForIndex(currentIndex);
        scrollRef.current.scrollTo({
          left: targetScrollLeft,
          behavior: "smooth"
        });
      }
    }
  };

  const centeredPlan = slides[centeredIndex];

  return (
    <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 xl:gap-12 items-start max-w-6xl mx-auto w-full">
      {/* Left Column: Carousel */}
      <div
        className="relative w-full max-w-[340px] sm:max-w-[500px] md:max-w-[620px] mx-auto px-5 sm:px-8 md:px-12 flex items-center justify-center lg:-translate-x-16 xl:-translate-x-20 transition-transform duration-300"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Left Navigation Button */}
        <motion.button
          onClick={handlePrev}
          whileHover={{ scale: 1.08, boxShadow: "0 0 15px rgba(255, 255, 255, 0.15)" }}
          whileTap={{ scale: 0.95 }}
          style={{
            background: "rgba(255, 255, 255, 0.08)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.15)"
          }}
          className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-full text-white shadow-lg cursor-pointer"
          aria-label="Previous Slide"
        >
          <ChevronLeft className="h-4.5 w-4.5 md:h-5 md:w-5" />
        </motion.button>

        {/* Carousel Viewport (Native scroll container with hidden scrollbars) */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onTouchStart={() => triggerInteractionPause()}
          onWheel={() => triggerInteractionPause()}
          className="relative w-full overflow-x-auto py-6 no-scrollbar flex select-none"
          style={{ cursor: isDragging ? "grabbing" : "grab" }}
        >
          {slides.map((plan, idx) => (
            <div
              key={`${plan.id}-${idx}`}
              ref={idx === 0 ? cardRef : null}
              className="w-[230px] min-w-[230px] sm:w-[300px] md:w-[355px] px-1.5 sm:px-2 md:px-2.5 flex-shrink-0"
              style={{
                perspective: "1000px"
              }}
            >
              <PlanCard
                plan={plan}
                isActive={activePlan === plan.id}
                isSelectedAny={activePlan !== null}
                isCenter={idx === centeredIndex}
                position={idx === centeredIndex ? "center" : idx < centeredIndex ? "left" : "right"}
                onClick={() => onCardClick(plan.id)}
              />
            </div>
          ))}
        </div>

        {/* Right Navigation Button */}
        <motion.button
          onClick={handleNext}
          whileHover={{ scale: 1.08, boxShadow: "0 0 15px rgba(255, 255, 255, 0.15)" }}
          whileTap={{ scale: 0.95 }}
          style={{
            background: "rgba(255, 255, 255, 0.08)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.15)"
          }}
          className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-full text-white shadow-lg cursor-pointer"
          aria-label="Next Slide"
        >
          <ChevronRight className="h-4.5 w-4.5 md:h-5 md:w-5" />
        </motion.button>
      </div>

      {/* Right Column: "How It Works" Timeline Panel */}
      <div className="w-full max-w-[460px] lg:max-w-none mx-auto lg:mx-0 px-4 mt-4 lg:mt-0 relative z-30">
        <div className="rounded-[2rem] sm:rounded-[2.2rem] border border-white/10 bg-slate-900/40 px-5 py-5 sm:px-7 sm:py-5.5 backdrop-blur-xl relative overflow-hidden shadow-[0_15px_35px_-5px_rgba(0,0,0,0.6)] min-h-[300px] sm:h-[460px] md:h-[500px] flex flex-col justify-between">
          {/* Dynamic background glow matching the plan theme */}
          <div className={`absolute -right-24 -top-24 h-48 w-48 rounded-full blur-[80px] opacity-[0.12] transition-colors duration-700 pointer-events-none ${
            centeredPlan?.theme === "silver" ? "bg-slate-400" :
            centeredPlan?.theme === "gold" ? "bg-amber-500" : "bg-blue-500"
          }`} />

          <div className="relative z-10 flex flex-col h-full justify-between">
            {/* Section Header */}
            <div>
              <h3 className="text-base sm:text-[17px] font-black uppercase tracking-[0.2em] text-blue-500">
                HOW IT WORKS
              </h3>
              <p className="mt-1.5 text-xs sm:text-[12.5px] font-semibold text-slate-400 leading-normal">
                A simple and structured learning journey designed to ensure consistent academic growth and personalized guidance.
              </p>
            </div>

            {/* Premium Vertical Timeline */}
            <motion.div
              key={activePlan || "none"}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="relative flex-1 flex flex-col justify-between mt-4 py-1"
            >
              {/* Elegant connecting line */}
              <div className="absolute left-[12.5px] top-3 bottom-3 w-[1px] bg-gradient-to-b from-blue-500 via-indigo-500/30 to-blue-500/5 pointer-events-none" />

              {TIMELINE_STEPS.map((step, idx) => (
                <motion.div
                  key={idx}
                  variants={itemVariants}
                  className="relative flex items-start gap-3.5 pl-0.5"
                >
                  {/* Circular Numbered Icon */}
                  <div className="relative z-10 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-slate-950 border border-blue-500 text-[11px] font-bold text-white shadow-[0_0_8px_rgba(59,130,246,0.3)]">
                    {step.number}
                  </div>
                  
                  <div className="flex flex-col min-w-0 justify-center">
                    <h4 className="text-xs sm:text-[13px] font-bold text-white leading-tight">
                      {step.title}
                    </h4>
                    <p className="text-[10px] sm:text-[11px] font-medium text-slate-400 leading-normal mt-0.5">
                      {step.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Minimal vector SVG illustration components for plans
const FoundationImage = () => (
  <svg
    viewBox="0 0 120 120"
    className="w-full h-full text-current opacity-[0.18] pointer-events-none transition-all duration-700 group-hover:scale-110 group-hover:opacity-25"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
  >
    {/* Book 1 (Bottom) */}
    <path d="M20 90 L70 105 L110 90 L60 75 Z" />
    <path d="M20 90 L20 96 C20 99, 60 114, 70 114 C80 114, 110 99, 110 96 L110 90" />
    <path d="M70 105 L70 114" />
    {/* Book 2 (Middle) */}
    <path d="M25 73 L75 88 L105 75 L55 60 Z" />
    <path d="M25 73 L25 79 C25 82, 65 97, 75 97 C85 97, 105 82, 105 79 L105 73" />
    <path d="M75 88 L75 97" />
    {/* Book 3 (Top) */}
    <path d="M35 55 L75 67 L95 57 L55 45 Z" />
    <path d="M35 55 L35 60 C35 63, 65 75, 75 75 C85 75, 95 63, 95 60 L95 55" />
    <path d="M75 67 L75 75" />
    {/* Graduation Cap / Star */}
    <path d="M65 20 L80 26 L65 32 L50 26 Z" fill="currentColor" opacity="0.3" />
    <path d="M50 26 L50 36" />
    <path d="M65 32 L65 40" />
    <circle cx="65" cy="26" r="2" fill="currentColor" />
  </svg>
);

const AdvanceImage = () => (
  <svg
    viewBox="0 0 120 120"
    className="w-full h-full text-current opacity-[0.18] pointer-events-none transition-all duration-700 group-hover:scale-110 group-hover:opacity-25"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
  >
    {/* Grid lines */}
    <line x1="20" y1="100" x2="100" y2="100" strokeDasharray="3 3" />
    <line x1="20" y1="80" x2="100" y2="80" strokeDasharray="3 3" />
    <line x1="20" y1="60" x2="100" y2="60" strokeDasharray="3 3" />
    <line x1="20" y1="40" x2="100" y2="40" strokeDasharray="3 3" />
    <line x1="20" y1="20" x2="100" y2="20" strokeDasharray="3 3" />
    {/* Growth curve */}
    <path d="M20 90 Q 40 85, 55 60 T 90 25" strokeWidth="2.5" strokeLinecap="round" />
    {/* Target circle at top right */}
    <circle cx="90" cy="25" r="6" strokeWidth="1.5" />
    <circle cx="90" cy="25" r="2" fill="currentColor" />
    {/* Area gradient under curve */}
    <path d="M20 100 L20 90 Q 40 85, 55 60 T 90 25 L 90 100 Z" fill="currentColor" opacity="0.08" />
    {/* Growth bar indicator */}
    <rect x="30" y="85" width="8" height="15" rx="1" fill="currentColor" opacity="0.3" />
    <rect x="50" y="65" width="8" height="35" rx="1" fill="currentColor" opacity="0.3" />
    <rect x="70" y="45" width="8" height="55" rx="1" fill="currentColor" opacity="0.3" />
  </svg>
);

const EliteImage = () => (
  <svg
    viewBox="0 0 120 120"
    className="w-full h-full text-current opacity-[0.18] pointer-events-none transition-all duration-700 group-hover:scale-110 group-hover:rotate-6 group-hover:opacity-25"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
  >
    {/* Premium shield outline */}
    <path d="M60 15 C 75 15, 95 20, 95 35 C 95 65, 75 90, 60 105 C 45 90, 25 65, 25 35 C 25 20, 45 15, 60 15 Z" strokeWidth="1.5" />
    {/* Inner shield accent */}
    <path d="M60 22 C 71 22, 87 26, 87 37 C 87 61, 71 83, 60 96 C 49 83, 33 61, 33 37 C 33 26, 49 22, 60 22 Z" opacity="0.5" />
    {/* Stars */}
    <circle cx="60" cy="35" r="3" fill="currentColor" />
    <circle cx="48" cy="39" r="2.5" fill="currentColor" />
    <circle cx="72" cy="39" r="2.5" fill="currentColor" />
    {/* Graduation Cap */}
    <path d="M60 48 L76 53 L60 58 L44 53 Z" strokeWidth="1.5" />
    <path d="M50 56.5 L50 63 C 50 66, 70 66, 70 63 L70 56.5" />
    <path d="M72 54.5 L72 65" />
    <circle cx="72" cy="65" r="1.5" fill="currentColor" />
    {/* Laurels / Leaves */}
    <path d="M40 75 Q 48 85, 60 85 Q 72 85, 80 75" />
  </svg>
);


// Plan Card Component
function PlanCard({ plan, isActive, isSelectedAny, isCenter, position, onClick }) {
  const isSilver = plan.theme === "silver";
  const isGold = plan.theme === "gold";
  const isBlack = plan.theme === "black";
  const [showMore, setShowMore] = React.useState(false);

  // Card theme classes
  const getCardThemeClasses = () => {
    if (isSilver) {
      return "bg-gradient-to-br from-[#F8FAFC] to-[#CBD5E1] dark:from-[#1e293b] dark:to-[#0f172a] border-white/30 dark:border-slate-700/50 text-slate-800 dark:text-slate-100 shadow-[0_15px_30px_-5px_rgba(203,213,225,0.15)] dark:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.5)] premium-shine-card";
    }
    if (isGold) {
      return "bg-gradient-to-br from-[#FFE082] via-[#F59E0B] to-[#D97706] border-[#FFE082]/30 text-slate-950 shadow-[0_20px_40px_-5px_rgba(245,158,11,0.3)] premium-shine-card";
    }
    return "bg-gradient-to-br from-[#111827] to-[#000000] border-white/12 text-white shadow-[0_15px_35px_-5px_rgba(0,0,0,0.6)] premium-shine-card";
  };

  // Badge theme classes
  const getBadgeThemeClasses = () => {
    if (isSilver) {
      return "bg-slate-900/10 text-slate-800 border-slate-900/20";
    }
    if (isGold) {
      return "bg-black/10 text-slate-950 border-black/20";
    }
    return "bg-white/10 text-white border-white/10";
  };

  // Highlight rings/shadows when card is active
  const getActiveStateClasses = () => {
    if (!isActive) return "";
    if (isSilver) {
      return "ring-[3px] ring-slate-400/80 shadow-[0_0_30px_rgba(203,213,225,0.3)]";
    }
    if (isGold) {
      return "ring-[3px] ring-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.4)]";
    }
    return "ring-[3px] ring-white/60 shadow-[0_0_30px_rgba(255,255,255,0.15)]";
  };

  const getCardStyle = () => {
    const style = {
      transition: "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), filter 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
      transformStyle: "preserve-3d"
    };

    if (isSelectedAny) {
      if (isActive) {
        return {
          ...style,
          transform: "perspective(1000px) rotateY(0deg) scale(1)",
          opacity: 1,
          filter: "blur(0px)"
        };
      } else {
        return {
          ...style,
          transform: "perspective(1000px) rotateY(0deg) scale(0.92)",
          opacity: 0.3,
          filter: "blur(1px)"
        };
      }
    }

    if (isCenter) {
      return {
        ...style,
        transform: "perspective(1000px) rotateY(0deg) scale(1)",
        opacity: 1,
        filter: "blur(0px)"
      };
    } else {
      const rotateDeg = position === "left" ? 8 : -8;
      return {
        ...style,
        transform: `perspective(1000px) rotateY(${rotateDeg}deg) scale(0.88)`,
        opacity: 0.45,
        filter: "blur(2px)"
      };
    }
  };

  const renderIllustration = () => {
    switch (plan.id) {
      case "foundation":
        return <FoundationImage />;
      case "advance":
        return <AdvanceImage />;
      case "elite":
        return <EliteImage />;
      default:
        return null;
    }
  };


  const getBenefitTitleColor = () => {
    if (isSilver) return "text-slate-700 dark:text-slate-100";
    if (isGold) return "text-slate-900";
    return "text-white";
  };

  const getBenefitDescColor = () => {
    if (isSilver) return "text-slate-500 dark:text-slate-400";
    if (isGold) return "text-slate-700";
    return "text-slate-400";
  };

  const getCTAClasses = () => {
    if (isSilver) return "bg-slate-800 text-white hover:bg-slate-700";
    if (isGold) return "bg-slate-900 text-white hover:bg-slate-800";
    return "bg-white text-black hover:bg-slate-100";
  };

  const getBadgeBg = () => {
    if (isSilver) return "bg-slate-900/10 dark:bg-white/10 text-slate-700 dark:text-slate-200 border-slate-400/20 dark:border-white/20";
    if (isGold) return "bg-black/10 text-slate-900 border-black/20";
    return "bg-white/10 text-white border-white/20";
  };

  const getStarColor = () => {
    if (isSilver) return "text-slate-600 fill-slate-600 dark:text-slate-300 dark:fill-slate-300";
    if (isGold) return "text-slate-900 fill-slate-900";
    return "text-white fill-white";
  };


  const benefits = plan.fullDetails?.benefits || [];

  return (
    <div
      onClick={onClick}
      style={getCardStyle()}
      className={`relative overflow-hidden rounded-[2rem] sm:rounded-[2.2rem] border flex flex-col min-h-[460px] h-auto sm:min-h-[500px] md:min-h-[520px] pb-4 cursor-pointer group ${getCardThemeClasses()} ${getActiveStateClasses()} ${
        isSelectedAny && !isActive ? "pointer-events-none md:pointer-events-auto" : ""
      }`}
    >
      {/* Subtle shine effect overlay on hover */}
      <div className="shine-overlay pointer-events-none" />

      {/* Glow layer behind active card */}
      {isActive && (
        <div className="absolute inset-0 rounded-[2.2rem] ring-4 ring-current/10 blur-md pointer-events-none" />
      )}

      {/* === TOP SECTION: Badge + Title + Illustration === */}
      <div className="relative z-10 flex items-start justify-between px-4 sm:px-6 md:px-7 pt-5 sm:pt-6 md:pt-7">
        {/* Left: Badge + Title + Description */}
        <div className="flex-1 min-w-0 pr-2">
          {/* Badge with star */}
          <div className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-full px-2.5 sm:px-3 py-1 text-[8px] sm:text-[9px] font-black uppercase tracking-wider border mb-3 sm:mb-4 ${getBadgeBg()}`}>
            <Star className={`h-2 w-2 sm:h-2.5 sm:w-2.5 shrink-0 ${getStarColor()}`} />
            <span className="truncate">{plan.badge}</span>
          </div>

          {/* Plan Name */}
          <h3 className="text-[17px] sm:text-[20px] md:text-2xl font-black tracking-tight leading-snug">{plan.title}</h3>

          {/* Key Benefit tag line */}
          <p className="mt-1 text-[10px] sm:text-[11px] font-bold leading-snug opacity-90">
            {plan.keyBenefit}
          </p>

          {/* Description */}
          <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] leading-relaxed font-medium opacity-70">
            {plan.description}
          </p>
        </div>

        {/* Right: Illustration — smaller on mobile */}
        <div className="shrink-0 relative w-[60px] h-[60px] sm:w-[80px] sm:h-[80px] md:w-[90px] md:h-[90px] -mt-1 -mr-1">
          {renderIllustration()}
        </div>
      </div>

      {/* === MIDDLE SECTION: Benefits with circular icons === */}
      <div className="relative z-10 flex flex-col gap-2.5 sm:gap-3 px-4 sm:px-6 md:px-7 mt-3 sm:mt-4 flex-1">
        {/* Always show first 2 benefits */}
        {benefits.slice(0, 2).map((benefit, idx) => (
          <div key={idx} className="flex items-start gap-2.5 sm:gap-3">
            {/* Circular icon badge */}
            <div className="shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center">
              {getBenefitIcon(benefit.title, plan.theme)}
            </div>
            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className={`text-[10px] sm:text-[11px] font-bold leading-snug ${getBenefitTitleColor()}`}>
                {benefit.title}
              </div>
              {benefit.desc && (
                <div className={`text-[9px] sm:text-[10px] leading-relaxed font-medium mt-0.5 ${getBenefitDescColor()}`}>
                  {benefit.desc}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Extra benefits shown only when showMore is true */}
        {showMore && benefits.slice(2).map((benefit, idx) => (
          <div key={idx + 2} className="flex items-start gap-2.5 sm:gap-3 animate-fadeIn">
            <div className="shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center">
              {getBenefitIcon(benefit.title, plan.theme)}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-[10px] sm:text-[11px] font-bold leading-snug ${getBenefitTitleColor()}`}>
                {benefit.title}
              </div>
              {benefit.desc && (
                <div className={`text-[9px] sm:text-[10px] leading-relaxed font-medium mt-0.5 ${getBenefitDescColor()}`}>
                  {benefit.desc}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* See More / Show Less toggle */}
        {benefits.length > 2 && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowMore(prev => !prev); }}
            className={`mt-1 self-start flex items-center gap-1 text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all duration-200 ${
              isSilver ? "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white" :
              isGold   ? "text-slate-900/70 hover:text-slate-900" :
                         "text-white/50 hover:text-white"
            }`}
          >
            <span>{showMore ? "Show Less" : `+${benefits.length - 2} More`}</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${showMore ? "rotate-180" : ""}`}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        )}
      </div>

      {/* === BOTTOM SECTION: Full-width CTA Button === */}
      <div className="relative z-10 px-4 pb-4 sm:px-5 sm:pb-5 md:px-6 md:pb-6 mt-3 sm:mt-4">
        <div className={`w-full flex items-center justify-center gap-2 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-[11px] md:text-xs transition-all duration-300 shadow-lg ${getCTAClasses()}`}>
          <span className="flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-current/20 shrink-0">
            <ArrowRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
          </span>
          <span className="truncate">Explore Plan Details</span>
          <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
        </div>
      </div>
    </div>
  );
}

const SimpleBenefitIcon = ({ title, planTheme }) => {
  const t = String(title || "").trim().toLowerCase();
  
  // Choose theme values based on planTheme
  let glowColor = "#64748B";       // Silver default
  let glassStart = "#F8FAFC";
  let glassMid = "#CBD5E1";
  let glassEnd = "#475569";
  let themeLight = "#E2E8F0";
  
  if (planTheme === "gold") {
    // Rich warm molten liquid gold theme colors
    glowColor = "#F59E0B";
    glassStart = "#FFF9DB";
    glassMid = "#F59E0B";
    glassEnd = "#B45309";
    themeLight = "#FBBF24";
  } else if (planTheme === "black") {
    // Elite uses high-end premium blue glass glow to contrast with dark theme card
    glowColor = "#3B82F6";
    glassStart = "#EFF6FF";
    glassMid = "#3B82F6";
    glassEnd = "#1D4ED8";
    themeLight = "#60A5FA";
  }
  
  // Decide which inner path markup to render
  let innerPaths = null;
  
  if (t.includes("verified") && !t.includes("allocation")) {
    // ShieldCheck
    innerPaths = (
      <>
        <path d="M40 22 C40 22 52 26 52 32 V44 C52 50 44 56 40 58 C36 56 28 50 28 44 V32 C28 26 40 22 40 22 Z" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M34 38 L38 42 L46 34" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    );
  } else if (t.includes("homework")) {
    // BookOpen
    innerPaths = (
      <>
        <path d="M40 52 V26 C40 26 34 22 26 22 H24 V48 C24 48 30 48 38 52 Z" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M40 52 V26 C40 26 46 22 54 22 H56 V48 C56 48 50 48 42 52 Z" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    );
  } else if (t.includes("beginner-friendly")) {
    // Smile
    innerPaths = (
      <>
        <circle cx="40" cy="40" r="16" stroke="white" strokeWidth="3.5" fill="none" />
        <circle cx="34" cy="36" r="2.5" fill="white" />
        <circle cx="46" cy="36" r="2.5" fill="white" />
        <path d="M32 44 Q40 50 48 44" stroke="white" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      </>
    );
  } else if (t.includes("strategy") || t.includes("deadline")) {
    // Compass
    innerPaths = (
      <>
        <circle cx="40" cy="40" r="16" stroke="white" strokeWidth="3.5" fill="none" />
        <path d="M40 28 L45 39 L40 43 L35 39 Z" fill="white" />
        <circle cx="40" cy="40" r="1.5" fill="#111827" />
      </>
    );
  } else if (t.includes("internal test") || t.includes("bi-weekly test") || t.includes("assignment")) {
    // FileText
    innerPaths = (
      <>
        <rect x="28" y="24" width="24" height="32" rx="3" stroke="white" strokeWidth="3.5" fill="none" />
        <line x1="34" y1="32" x2="46" y2="32" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="34" y1="40" x2="46" y2="40" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="34" y1="48" x2="40" y2="48" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
      </>
    );
  } else if (t.includes("guidance") || t.includes("practice")) {
    // TrendingUp
    innerPaths = (
      <>
        <path d="M26 46 L34 38 L40 44 L54 28" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M46 28 H54 V36" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    );
  } else if (t.includes("allocation") || t.includes("km")) {
    // Premium Location Pin with pulse ring
    innerPaths = (
      <>
        {/* Outer pulse ring */}
        <circle cx="40" cy="33" r="14" stroke="white" strokeWidth="1.2" strokeOpacity="0.35" fill="none" strokeDasharray="3 3" />
        {/* Pin body */}
        <path d="M40 57 C40 57 27 44 27 34 C27 26.82 32.82 21 40 21 C47.18 21 53 26.82 53 34 C53 44 40 57 40 57 Z" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="white" fillOpacity="0.15" />
        {/* Inner filled dot */}
        <circle cx="40" cy="34" r="5.5" fill="white" />
        {/* Inner ring around dot */}
        <circle cx="40" cy="34" r="9" stroke="white" strokeWidth="1.5" fill="none" strokeOpacity="0.5" />
      </>
    );
  } else if (t.includes("replacement")) {
    // Premium circular sync — center(40,40) r=21, each arc 150°, 30° gap
    // Arc 1: 165°(20,45) → clockwise over TOP → 315°(55,25) [arrowhead V tangent-aligned]
    // Arc 2: 345°(60,35) → clockwise under BOTTOM → 135°(25,55) [arrowhead V tangent-aligned]
    innerPaths = (
      <>
        {/* Arc 1: over the top */}
        <path d="M 20 45 A 21 21 0 0 1 55 25" stroke="white" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        {/* V arrowhead at 315° (55,25): both arms go backward = upper-left; tip points lower-right ↘ */}
        <polyline points="47,24 55,25 54,17" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {/* Arc 2: under the bottom */}
        <path d="M 60 35 A 21 21 0 0 1 25 55" stroke="white" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        {/* V arrowhead at 135° (25,55): tangent direction 225° = upper-left */}
        <polyline points="33,56 25,55 26,63" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    );
  } else if (t.includes("result-oriented") || t.includes("learning")) {
    // Award
    innerPaths = (
      <>
        <circle cx="40" cy="32" r="9" stroke="white" strokeWidth="3.5" fill="none" />
        <path d="M35 41 L31 58 L40 52 L49 58 L45 41" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    );
  } else if (t.includes("doubt")) {
    // MessageSquare
    innerPaths = (
      <>
        <path d="M52 25 H28 C25.8 25 24 26.8 24 29 V43 C24 45.2 25.8 47 28 47 H44 L52 53 V29 C52 26.8 50.2 25 48 25 Z" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    );
  } else if (t.includes("attendance") || t.includes("compensation")) {
    // Calendar
    innerPaths = (
      <>
        <rect x="26" y="24" width="28" height="28" rx="3" stroke="white" strokeWidth="3.5" fill="none" />
        <line x1="26" y1="34" x2="54" y2="34" stroke="white" strokeWidth="3.5" />
        <line x1="33" y1="20" x2="33" y2="26" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="47" y1="20" x2="47" y2="26" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
      </>
    );
  }
  
  const cleanId = planTheme + t.replace(/[^a-z]/g, "");

  return (
    <svg viewBox="0 0 80 80" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Soft colorful glowing drop shadow */}
        <filter id={`glassShad-${cleanId}`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor={glowColor} floodOpacity="0.45" />
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity="0.22" />
        </filter>
        
        {/* Inner raised white icon emboss shadow */}
        <filter id={`iconShad-${cleanId}`} x="-35%" y="-35%" width="170%" height="170%">
          <feDropShadow dx="0" dy="3.5" stdDeviation="2" floodColor="#000000" floodOpacity="0.5" />
        </filter>
        
        {/* Glass base radial gradient representing volumetric light reflection */}
        <radialGradient id={`glassBody-${cleanId}`} cx="30" cy="30" r="45" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={glassStart} stopOpacity="0.95" />
          <stop offset="60%" stopColor={glassMid} stopOpacity="0.75" />
          <stop offset="100%" stopColor={glassEnd} stopOpacity="0.35" />
        </radialGradient>
        
        {/* Glass border gradient representing refraction edges */}
        <linearGradient id={`glassBorder-${cleanId}`} x1="20" y1="10" x2="60" y2="70" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="30%" stopColor={themeLight} stopOpacity="0.55" />
          <stop offset="70%" stopColor="#000000" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.65" />
        </linearGradient>
        
        {/* Dynamic diagonal glossy sheen */}
        <linearGradient id={`glossSheen-${cleanId}`} x1="16" y1="16" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.6" />
          <stop offset="35%" stopColor="#FFFFFF" stopOpacity="0.22" />
          <stop offset="35.1%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      
      {/* Outer ambient border ring */}
      <circle cx="40" cy="40" r="33.5" stroke={themeLight} strokeWidth="1.2" strokeOpacity="0.25" fill="none" />
      
      {/* 3D Glassy base circle */}
      <circle cx="40" cy="40" r="32" fill={`url(#glassBody-${cleanId})`} filter={`url(#glassShad-${cleanId})`} />
      
      {/* Bevel reflection ring */}
      <circle cx="40" cy="40" r="31.8" stroke={`url(#glassBorder-${cleanId})`} strokeWidth="2" fill="none" />
      
      {/* Gel-button highlight overlay */}
      <path d="M11.6 34 C 18 18, 62 18, 68.4 34 A 32 32 0 0 0 11.6 34 Z" fill={`url(#glossSheen-${cleanId})`} />
      
      {/* Volumetric bottom shadow overlay */}
      <path d="M11.6 46 A 32 32 0 0 0 68.4 46 A 34 34 0 0 1 11.6 46 Z" fill="#000000" opacity="0.32" />
      
      {/* Raised white 3D Embossed Icon */}
      <g filter={`url(#iconShad-${cleanId})`}>
        {innerPaths}
      </g>
    </svg>
  );
};

const getBenefitIcon = (title, planTheme) => {
  return <SimpleBenefitIcon title={title} planTheme={planTheme} />;
};
// Plan Details Component
function PlanDetails({ plan, onCTA, selectedClass, selectedBoard }) {
  const { fullDetails, title, theme } = plan;

  const getHeaderBadgeClasses = () => {
    switch (theme) {
      case "silver":
        return "bg-slate-100 text-slate-800 border-slate-200";
      case "gold":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "black":
        return "bg-white/5 text-white border-white/10";
      default:
        return "bg-white/5 text-white border-white/10";
    }
  };

  const getCTABtnClasses = () => {
    switch (theme) {
      case "silver":
        return "bg-slate-100 text-slate-900 hover:bg-slate-200 shadow-slate-100/10";
      case "gold":
        return "bg-white text-black hover:bg-slate-100 shadow-white/5";
      case "black":
        return "bg-white text-black hover:bg-slate-100 shadow-white/5";
      default:
        return "bg-white text-black hover:bg-slate-100";
    }
  };

  // Pricing configuration calculation
  const pricingOptions = plan.pricingOptions || [];

  return (
    <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr] text-white">
      {/* Left Column: Benefits & FAQs */}
      <div className="space-y-8 order-2 lg:order-1">
        <div>
          <h3 className="text-3xl font-black tracking-tight text-white md:text-4xl">
            Complete Plan Overview
          </h3>
          <p className="mt-3 text-sm text-slate-400 leading-relaxed">
            {plan.description}
          </p>
        </div>

        {/* Benefits Grid */}
        <div>
          <div className="relative mb-6">
            <h4 className="text-base font-extrabold text-white uppercase tracking-widest">Core Benefits</h4>
            <div className="flex items-center gap-1 mt-1.5">
              <div className="h-[2px] w-14 bg-gradient-to-r from-amber-500 to-amber-300 rounded-full" />
              <div className="h-[3px] w-[3px] rounded-full bg-amber-400 animate-pulse" />
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {(fullDetails.benefits || []).map((benefit, idx) => {
              return (
                <div
                  key={idx}
                  className="flex gap-4 items-start rounded-3xl bg-gradient-to-br from-[#0B1528] to-[#050B15] border border-blue-900/30 p-5 hover:border-blue-700/40 hover:shadow-[0_8px_30px_rgba(59,130,246,0.08)] transition duration-300 group"
                >
                  <div className="shrink-0 w-14 h-14 flex items-center justify-center">
                    {getBenefitIcon(benefit.title, plan.theme)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="text-base font-bold text-white tracking-tight">{benefit.title}</h5>
                    {benefit.desc && (
                      <>
                        <div className="h-[2px] w-6 bg-amber-500 rounded-full my-1.5" />
                        <p className="text-xs font-semibold text-slate-400 leading-relaxed">{benefit.desc}</p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* FAQs */}
        <div className="mt-8 border-t border-white/5 pt-8">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Frequently Asked Questions</h4>
          <FAQAccordion faqs={fullDetails.faqs} />
        </div>
      </div>

      {/* Right Column: Pricing Table & CTA */}
      <div className="order-1 lg:order-2 rounded-3xl border border-white/5 bg-slate-950/70 p-6 flex flex-col justify-between h-fit lg:sticky lg:top-28">
        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Complete Pricing Breakdown</h4>
          
          {plan.id === 'elite' && (
            (() => {
              const hrRate = calculateEliteHourlyPrice(selectedClass, selectedBoard);
              return (
                <div className="mb-6 bg-slate-900 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-inner">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Hourly Rate</span>
                  <span className="text-2xl font-black tracking-tight text-amber-400 mt-1">
                    ₹{hrRate.toLocaleString('en-IN')}/hour
                  </span>
                  <span className="text-[10px] font-medium text-slate-400 block mt-1">
                    Estimated Monthly Tuition calculated below
                  </span>
                </div>
              );
            })()
          )}

          <table className="w-full text-sm border-collapse text-left">
            <tbody>
              {pricingOptions.map((opt, idx) => {
                // Dynamically calculate the price on the landing page based on state selectors
                const calculatedRowPrice = calculatePrice(plan.id, selectedClass, selectedBoard, opt.days, opt.hours);
                return (
                  <tr key={idx} className="border-b border-white/5 last:border-0">
                    <td className="py-3.5 font-semibold text-slate-400">
                      {opt.days} Days / {opt.hours} Hour{opt.hours !== 1 ? "s" : ""}
                    </td>
                    <td className="py-3.5 text-right font-black text-white">
                      ₹{calculatedRowPrice.toLocaleString('en-IN')}{" "}
                      <span className="text-[10px] text-slate-500 font-bold">/ month</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button
          onClick={onCTA}
          className={`mt-8 w-full flex h-14 items-center justify-center gap-2 rounded-2xl font-black text-sm transition-all duration-300 active:scale-[0.98] shadow-xl ${getCTABtnClasses()}`}
        >
          Book Demo
          <ArrowRight className="h-4 w-4" />
        </button>

      </div>
    </div>
  );
}

// FAQ Accordion Helper Component
function FAQAccordion({ faqs }) {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <div className="space-y-3 mt-4">
      {faqs.map((faq, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div key={idx} className="border-b border-white/5 pb-3">
            <button
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              className="w-full flex items-center justify-between text-left py-2 text-sm font-semibold text-slate-200 hover:text-white transition-colors"
            >
              <span>{faq.q}</span>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <p className="text-xs text-slate-400 leading-relaxed mt-1 pb-1">{faq.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
