import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import PlansSection from "../components/PlansSection";
import ThemeToggle from "../components/ThemeToggle";
import { API_BASE } from "../config";
import { trackEvent } from "../utils/analytics";
import {
  Search,
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
  Clock3,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  Globe,
  GraduationCap,
  Rocket,
  Home,
  ClipboardCheck,
  TrendingUp,
  IndianRupee,
  Tv,
  CalendarCheck
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import DemoParentDashboard from "./DemoParentDashboard";



const MotionLink = motion(Link);

const categories = [
  {
    name: "Academic Tutors",
    icon: Users,
    description: "School & college academics",
  },
  {
    name: "Spoken English",
    icon: MessageCircle,
    description: "Fluency and confidence",
  },
  {
    name: "Music Classes",
    icon: Sparkles,
    description: "Creative learning at home",
  },
  {
    name: "Programming",
    icon: BookOpen,
    description: "Coding and technology",
  },
  {
    name: "Fitness Trainers",
    icon: Award,
    description: "Personal training support",
  },
  {
    name: "Soft Skills",
    icon: CheckCircle2,
    description: "Communication and personality",
  },
];

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
        <ChevronDown className={`h-3 w-3 text-slate-500 dark:text-slate-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
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
          isResourcesActive ? "text-blue-600 font-extrabold" : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
        }`}
      >
        <span>Resources</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${isOpen ? "rotate-180" : ""} ${isResourcesActive ? "text-blue-600" : "text-slate-500 dark:text-slate-400"}`} />
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

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function getInitials(name = "ST") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getTutorImage(photo) {
  if (!photo) return "";

  return photo.includes("/upload/")
    ? photo.replace("/upload/", "/upload/f_auto,q_auto,w_220/")
    : photo;
}

function InfoPill({ icon: Icon, text, highlight }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
      <Icon
        className={cn(
          "h-4 w-4 flex-shrink-0",
          highlight ? "text-amber-500" : "text-slate-500 dark:text-slate-400"
        )}
      />
      <span className="truncate font-semibold text-slate-700 dark:text-slate-200 text-xs">{text}</span>
    </div>
  );
}

const LawScaleSVG = () => (
  <svg className="h-3.5 w-3.5 text-[#E2B755]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v17" />
    <path d="M12 5l-8 3" />
    <path d="M12 5l8 3" />
    <path d="M4 17a4 4 0 0 0 8 0" />
    <path d="M12 17a4 4 0 0 0 8 0" />
  </svg>
);

const MathSVG = () => (
  <svg className="h-3.5 w-3.5 text-[#E2B755]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <line x1="8" y1="6" x2="16" y2="6" />
    <line x1="16" y1="14" x2="16" y2="18" />
    <line x1="8" y1="14" x2="12" y2="14" />
    <line x1="8" y1="18" x2="12" y2="18" />
  </svg>
);

const ScienceSVG = () => (
  <svg className="h-3.5 w-3.5 text-[#E2B755]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 21a9 9 0 0 0 0-18 9 9 0 0 0 0 18z" />
    <path d="M12 3v18" />
    <path d="M3 12h18" />
  </svg>
);

const AcademicSVG = () => (
  <svg className="h-3.5 w-3.5 text-[#E2B755]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);

const RatingShieldIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-[#CAA036]" strokeWidth="1.5">
    <path d="M 12 2 C 12 2 20 4 20 8 C 20 14 15 20 12 22 C 9 20 4 14 4 8 C 4 4 12 2 12 2 Z" />
    <path d="M 9 11 L 11 13 L 15 9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="stroke-[#CAA036]" />
  </svg>
);

const ExperienceCalendarIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-emerald-600" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <path d="m9 16 2 2 4-4" />
  </svg>
);

const ColumnIcon = () => (
  <svg className="h-4 w-4 text-[#E2B755]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 2h16M4 22h16M8 6v12M12 6v12M16 6v12M6 6h12M6 18h12" />
  </svg>
);

const getSubjectBadgeIcon = (subjectStr = "") => {
  const s = subjectStr.toLowerCase();
  if (s.includes("law") || s.includes("legal") || s.includes("constitution")) {
    return <LawScaleSVG />;
  }
  if (s.includes("math") || s.includes("algebra") || s.includes("geometry") || s.includes("stat")) {
    return <MathSVG />;
  }
  if (s.includes("science") || s.includes("physic") || s.includes("chemist") || s.includes("biolog")) {
    return <ScienceSVG />;
  }
  return <AcademicSVG />;
};

function TutorCard({ tutor, onViewProfile, onBook, swipeMode = false }) {
  const subjectIcon = getSubjectBadgeIcon(tutor.subject || tutor.category || "");

  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ duration: 0.22 }}
      className={
        swipeMode
          ? "w-[88vw] max-w-sm flex-shrink-0 snap-start sm:w-[420px]"
          : ""
      }
    >
      <Card className="group h-full overflow-hidden rounded-[2rem] border-0 bg-white dark:bg-slate-900 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] ring-1 ring-slate-100 dark:ring-slate-800 transition hover:shadow-2xl hover:shadow-slate-200/80 dark:hover:shadow-blue-900/20">
        <CardContent className="p-0 flex flex-col h-full">
          {/* Header section (Dark cosmic background) */}
          <div className="relative overflow-hidden bg-gradient-to-br from-[#061530] via-[#091f42] to-[#041126] p-6 text-white rounded-t-[2rem] z-10 shrink-0">
            {/* Ambient glows */}
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-8 h-20 w-20 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

            <div className="relative flex flex-wrap items-center justify-between gap-3 sm:gap-4 z-10">
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                {/* Hexagon image container */}
                <div className="relative shrink-0 select-none">
                  <div 
                    className="h-[84px] w-[84px] bg-gradient-to-br from-[#E2B755] to-[#B88728] flex items-center justify-center p-[2.5px] shadow-lg"
                    style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
                  >
                    <div 
                      className="h-full w-full bg-[#081730] flex items-center justify-center p-[1px]"
                      style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
                    >
                      {tutor.photo ? (
                        <img
                          src={getTutorImage(tutor.photo)}
                          alt={tutor.name}
                          loading="lazy"
                          className="h-full w-full object-cover"
                          style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
                        />
                      ) : (
                        <div className="h-full w-full bg-[#091f42] flex items-center justify-center text-lg font-black text-white">
                          {getInitials(tutor.name)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="min-w-0 leading-tight">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <h3 className="text-lg sm:text-xl font-black text-white tracking-tight truncate max-w-[130px] sm:max-w-[200px]">
                      {tutor.name || "Expert Tutor"}
                    </h3>
                  </div>

                  <p className="mt-1 text-sm font-semibold text-blue-300 truncate">
                    {tutor.subject || tutor.category || "Subject expert"}
                  </p>

                  <div className="h-[2px] w-8 bg-gradient-to-r from-[#E2B755] to-transparent mt-2" />

                  {/* Clean Tagline line */}
                  <p className="mt-2 text-xs font-semibold text-slate-300 truncate max-w-[170px] sm:max-w-[220px]">
                    {tutor.tagline || tutor.about || "Experienced faculty tutor"}
                  </p>
                </div>
              </div>

              {/* Price starts fee container */}
              <div className="flex items-center gap-2.5 bg-[#081a36]/65 border border-white/10 rounded-2xl p-2.5 shadow-inner shrink-0">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#F4D068] to-[#CAA036] flex items-center justify-center text-slate-950 font-extrabold text-sm shadow-md shrink-0 select-none">
                  ₹
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-white leading-none">
                    ₹{tutor.price || 500}/hr
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Starting fee</div>
                </div>
              </div>
            </div>
          </div>

          {/* Body Section */}
          <div className="p-6 flex flex-col justify-between flex-1 bg-white dark:bg-slate-900">
            <div>
              {/* 2x2 Details Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Rating */}
                <div className="flex items-center gap-3 bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 rounded-2xl p-3 shadow-sm">
                  <div className="h-9 w-9 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100 leading-tight">
                      {tutor.rating || "4.8"}
                    </div>
                    <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">Rating</div>
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-center gap-3 bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 rounded-2xl p-3 shadow-sm">
                  <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate leading-tight">
                      {tutor.location || tutor.locations?.[0] || "Bangalore"}
                    </div>
                    <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">Location</div>
                  </div>
                </div>

                {/* Experience */}
                <div className="flex items-center gap-3 bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 rounded-2xl p-3 shadow-sm">
                  <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100 leading-tight">
                      {tutor.experience || "10+ years"}
                    </div>
                    <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">Experience</div>
                  </div>
                </div>

                {/* Teaching Mode */}
                <div className="flex items-center gap-3 bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 rounded-2xl p-3 shadow-sm">
                  <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <GraduationCap className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100 leading-tight">
                      {tutor.mode || "Online/Home"}
                    </div>
                    <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">Teaching Mode</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons Row */}
            <div className="mt-6 flex flex-col sm:flex-row gap-2">
              <Button
                className="flex-1 rounded-xl bg-[#0B1B33] dark:bg-blue-600 dark:hover:bg-blue-500 px-3.5 py-2.5 font-bold text-white shadow-md hover:bg-slate-900 transition duration-200 flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                onClick={() => onBook(tutor)}
              >
                <span>Request Demo</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              </Button>
              
              <Link
                to="/payment"
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#008A3B] px-3.5 py-2.5 font-bold text-white shadow-md hover:bg-green-700 transition duration-200 text-xs cursor-pointer"
              >
                <span>Pay for Demo</span>
                <ChevronRight className="h-3.5 w-3.5 text-green-200" />
              </Link>

              <Button
                className="flex-1 rounded-xl border border-blue-200 dark:border-blue-800/80 bg-white dark:bg-slate-800 px-3.5 py-2.5 font-bold text-blue-600 dark:text-blue-400 shadow-sm hover:bg-blue-50/50 dark:hover:bg-slate-700 transition duration-200 flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                onClick={() => onViewProfile(tutor)}
              >
                <span>View Profile</span>
                <ChevronRight className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SectionTitle({ eyebrow, title, subtitle, center = false }) {
  return (
    <div className={cn("max-w-3xl", center && "mx-auto text-center")}>
      {eyebrow ? (
        <p className="mb-3 inline-flex rounded-full bg-blue-50 dark:bg-blue-500/15 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-blue-700 dark:text-blue-300 ring-1 ring-blue-100 dark:ring-blue-500/30">
          {eyebrow}
        </p>
      ) : null}

      <h2 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-5xl">
        {title}
      </h2>

      {subtitle ? (
        <p className="mt-4 text-base leading-8 text-slate-600 dark:text-slate-400 md:text-lg">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}


function Modal({ open, onClose, title, children }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ y: 28, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, scale: 0.97, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-6 py-5 backdrop-blur">
              <h3 className="text-xl font-black text-slate-950 dark:text-slate-100">{title}</h3>

              <button
                onClick={onClose}
                className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 text-slate-800 dark:text-slate-200">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function ProfileStat({ title, label }) {
  return (
    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/60 p-4">
      <div className="font-black text-slate-950 dark:text-slate-100">{title}</div>
      <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}

function FilterToggle({ checked, onChange, label }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-2xl px-4 py-3 text-xs font-black transition",
        checked
          ? "bg-slate-950 dark:bg-blue-600 text-white"
          : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-blue-600"
      />
      {label}
    </label>
  );
}

function LoadingTutors() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="h-80 animate-pulse rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ring-1 ring-slate-200 dark:ring-slate-800"
        />
      ))}
    </div>
  );
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileResourcesOpen, setMobileResourcesOpen] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [tutors, setTutors] = useState([]);
  const [selectedTutor, setSelectedTutor] = useState(null);
  const [bookingTutor, setBookingTutor] = useState(null);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeFaq, setActiveFaq] = useState(null);
  const [activeSection, setActiveSection] = useState("home");
  const [visibleTutorsCount, setVisibleTutorsCount] = useState(4);
  const [showDemoPreview, setShowDemoPreview] = useState(false);

  useEffect(() => {
    setVisibleTutorsCount(4);
  }, [query, selectedCategory, verifiedOnly, onlineOnly]);

  useEffect(() => {
    const handleScroll = () => {
      const sections = ["home", "tutors", "why-choose", "plans", "subjects", "boards", "areas", "faqs"];
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

  const sliderRef = useRef(null);

  const [bookingForm, setBookingForm] = useState({
    learnerName: "",
    phone: "",
    preferredDate: "",
    preferredSlot: "",
    message: "",
  });

  const toggleFaq = (index) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  useEffect(() => {
    fetch(`${API_BASE}/tutors`)
      .then((res) => res.json())
      .then((data) => {
        const approvedTutors = Array.isArray(data)
          ? data.filter((tutor) => tutor.status === "approved")
          : [];

        setTutors(approvedTutors);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setToast("Could not load tutors.");
      });
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const filteredTutors = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();

    return [...tutors]
      .filter((tutor) => {
        const matchesQuery =
          !normalizedQuery ||
          tutor.name?.toLowerCase().includes(normalizedQuery) ||
          tutor.subject?.toLowerCase().includes(normalizedQuery) ||
          tutor.location?.toLowerCase().includes(normalizedQuery) ||
          tutor.locations?.join(" ").toLowerCase().includes(normalizedQuery) ||
          tutor.category?.toLowerCase().includes(normalizedQuery);

        const matchesCategory =
          selectedCategory === "All" || tutor.category === selectedCategory;

        const matchesVerified = !verifiedOnly || tutor.verified;

        const matchesOnline =
          !onlineOnly || (tutor.mode || "").toLowerCase().includes("online");

        return (
          matchesQuery && matchesCategory && matchesVerified && matchesOnline
        );
      })
      .sort(
        (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
      );
  }, [tutors, query, selectedCategory, verifiedOnly, onlineOnly]);

  async function submitBooking() {
    if (!bookingTutor) return;

    if (!bookingForm.learnerName.trim() || !bookingForm.phone.trim()) {
      setToast("Please enter learner name and phone number.");
      return;
    }

    const payload = {
      tutorId: bookingTutor._id,
      tutorName: bookingTutor.name,
      ...bookingForm,
    };

    try {
      const res = await fetch(`${API_BASE}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setToast(`Demo requested with ${bookingTutor.name}`);
        setBookingTutor(null);
        setBookingForm({
          learnerName: "",
          phone: "",
          preferredDate: "",
          preferredSlot: "",
          message: "",
        });
      } else {
        setToast("Booking failed");
      }
    } catch {
      setToast("Booking failed");
    }
  }

  function scrollTutors(direction) {
    if (!sliderRef.current) return;

    const amount = direction === "left" ? -360 : 360;
    sliderRef.current.scrollBy({ left: amount, behavior: "smooth" });
  }

  // 5 exact Bangalore FAQs
  const faqs = [
    {
      q: "Do you provide home tuition across all areas of Bangalore?",
      a: "Yes, Saraswati Tutorials provides home tuition services across major areas of Bangalore including Whitefield, HSR Layout, Indiranagar, Jayanagar, Koramangala, JP Nagar, Electronic City, and nearby locations."
    },
    {
      q: "Which boards do your tutors cover?",
      a: "Our tutors teach students from CBSE, ICSE, IGCSE, IB and Karnataka State Board for Classes 6 to 12."
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
      q: "Which subjects are available for tuition in Bangalore?",
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

  // Local Business Schema
  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "name": "Saraswati Tutorials",
    "url": "https://saraswatitutorial.com/",
    "logo": "https://saraswatitutorial.com/logo.png",
    "description": "Looking for home tuition in Bangalore? Saraswati Tutorials provides expert home tutors for CBSE, ICSE, IGCSE, IB & Karnataka State Board students from Class 6 to 12 across Bangalore.",
    "telephone": "+91 8904457689",
    "email": "support@saraswatitutorial.com",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Bangalore",
      "addressRegion": "Karnataka",
      "addressCountry": "IN"
    },
    "areaServed": {
      "@type": "AdministrativeArea",
      "name": "Bangalore"
    },
    "serviceType": "Home Tuition",
    "provider": {
      "@type": "LocalBusiness",
      "name": "Saraswati Tutorials",
      "url": "https://saraswatitutorial.com/"
    }
  };

  const whyChooseUs = [
    { title: "Verified & Experienced Tutors", desc: "All our tutors undergo strict background checks and academic evaluations.", icon: ShieldCheck },
    { title: "One-to-One Personalized Classes", desc: "Customized attention mapping to your child's learning pace.", icon: Users },
    { title: "Home & Online Tuition Available", desc: "Flexible modes—learn offline at home or online via live interactive classes.", icon: Home },
    { title: "Bi-Weekly Tests & Tracking", desc: "Bi-weekly academic tests, progress reviews, and parent updates for close performance monitoring.", icon: ClipboardCheck },
    { title: "Flexible Timings", desc: "Sessions scheduled around your child's school and daily routine.", icon: Clock },
    { title: "Tutors for All Major Boards", desc: "Expert syllabus mapping for CBSE, ICSE, IGCSE, IB, and State Board.", icon: BookOpen },
    { title: "Affordable Fee Structure", desc: "High-quality academic support customized to fit family budgets.", icon: IndianRupee },
    { title: "Free Demo Class Available", desc: "Book a trial class with no commitment to test compatibility.", icon: Tv },
    { title: "Fast Learning Progress", desc: "Concept clarity, regular practice, and doubt-solving for steady improvement.", icon: TrendingUp },
    { title: "Expert Subject Teachers", desc: "Qualified and experienced teachers specialized in their subjects.", icon: GraduationCap },
    { title: "Regular Attendance & Updates", desc: "Daily attendance tracking and regular updates shared with parents.", icon: CalendarCheck },
    { title: "Parent Support & Guidance", desc: "Dedicated support to help parents stay informed and involved.", icon: Users }
  ];

  const schoolSubjects = [
    {
      title: "Mathematics Tuition",
      desc: "Master algebra, calculus, and geometry with step-by-step guidance from expert maths home tutors in Bangalore.",
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
    { name: "Karnataka State Board", desc: "Aligned syllabus support for SSLC and 2nd PUC exams, highlighting textbook exercises, board-pattern tests, and high-yield scoring topics." }
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
    "Whitefield", "HSR Layout", "Indiranagar", "Jayanagar", "Koramangala",
    "JP Nagar", "Electronic City", "Marathahalli", "Bellandur", "BTM Layout",
    "Hebbal", "Yelahanka", "Malleshwaram", "Bannerghatta Road", "Kanakapura Road"
  ];

  const testimonials = [
    {
      name: "Mrs. Ritu Sharma",
      location: "Whitefield",
      role: "Parent of Class 10 CBSE Student",
      text: "Saraswati Tutorials helped my son improve his Class 10 CBSE Math score from 65% to 92%. The tutor from Whitefield was extremely patient and focused on solving past papers."
    },
    {
      name: "Mr. Anil Mehta",
      location: "HSR Layout",
      role: "Parent of IB Physics Student",
      text: "Finding a quality IB Physics tutor in HSR Layout was a major challenge. The tutor recommended by Saraswati Tutorials has been outstanding. Conceptual clarity has improved drastically."
    },
    {
      name: "Mrs. Deepa Kulkarni",
      location: "Indiranagar",
      role: "Parent of Class 12 PUC Student",
      text: "My daughter was struggling with Karnataka State Board Chemistry for Class 12. The home tutor from Indiranagar cleared her basics and regularly conducted test series. Highly recommended!"
    }
  ];

  const steps = [
    { title: "Submit Requirement", desc: "Share your child's class, board, subjects, location, and budget with us." },
    { title: "Tutor Shortlisting", desc: "Our team selects the most suitable and experienced tutors for your requirements." },
    { title: "Demo Class", desc: "Evaluate the teacher's style and chemistry with a free, no-obligation demo class." },
    { title: "Start Learning", desc: "Begin classes at home or online with scheduled progress reviews." }
  ];

  const updatedFaqSchema = {
    ...faqSchema,
    mainEntity: faqSchema.mainEntity.map((item, idx) => {
      if (idx === 0) {
        return {
          ...item,
          acceptedAnswer: {
            "@type": "Answer",
            "text": "Yes, Saraswati Tutorials provides home tuition services across major areas of Bangalore."
          }
        };
      }
      return item;
    })
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#eff6ff,transparent_50%),radial-gradient(ellipse_at_bottom,#f5f3ff,transparent_50%),linear-gradient(to_bottom,#f8fafc,#f1f5f9)] dark:bg-none dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 selection:bg-blue-600 selection:text-white">
      <Helmet>
        <title>Private Home Tutors near me in Bangalore | Saraswati Tutorials</title>
        <meta
          name="description"
          content="Hire patient, experienced, background-verified home tutors in Bangalore for Classes 6–12, graduation, competitive exams, and skills."
        />
        <link rel="canonical" href="https://saraswatitutorial.com/" />

        {/* Schemas */}
        <script type="application/ld+json">{JSON.stringify(updatedFaqSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(localBusinessSchema)}</script>
      </Helmet>

      <header className="sticky top-0 z-50 w-full py-3 px-4 sm:px-6 lg:px-8 bg-transparent">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 xl:px-6 py-2.5 xl:py-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/80 rounded-[1.75rem] shadow-[0_8px_30px_rgba(0,0,0,0.05)] dark:shadow-none">
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
                  className="h-full w-full sm:h-[48px] sm:w-[48px] rounded-xl object-contain"
                  onError={(e) => {
                    e.target.src = "https://placehold.co/100x100?text=ST";
                  }}
                />
              </motion.div>
              <div className="hidden sm:block shrink-0 leading-tight">
                <motion.div 
                  whileHover={{ x: 2 }}
                  className="text-lg xl:text-xl font-black tracking-tight text-slate-900 dark:text-white transition-all duration-300 group-hover:text-blue-600"
                >
                  Saraswati Tutorials
                </motion.div>
                <div className="text-[10px] xl:text-[11px] font-black uppercase tracking-widest text-blue-600">
                  “Beyond Tuition”
                </div>
              </div>
            </Link>

            <div className="hidden sm:block h-8 w-px bg-slate-200 mx-2 xl:mx-3 shrink-0" />

            <div className="shrink-0">
              <LocationSelector activeCity="Bangalore" />
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-2 xl:gap-3.5 2xl:gap-5 text-xs xl:text-[13px] 2xl:text-[14px] font-bold text-slate-600 xl:flex shrink-0">
            {[
              { href: "#home", label: "Home", id: "home" },
              { href: "#tutors", label: "Tutors", id: "tutors" },
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
                    isActive ? "text-blue-600 font-extrabold" : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
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
              className="whitespace-nowrap flex items-center gap-1.5 xl:gap-2 rounded-xl xl:rounded-[14px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 xl:px-5 py-2 xl:py-2.5 text-[11px] xl:text-xs font-black text-slate-800 dark:text-slate-100 shadow-sm transition-all duration-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 shrink-0"
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
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-800 dark:text-slate-100 cursor-pointer"
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
              className="border-t border-white/20 dark:border-slate-800 bg-white/80 dark:bg-slate-900/90 backdrop-blur-lg px-6 py-4 xl:hidden shadow-xl"
            >
              <div className="flex flex-col gap-4 text-base font-bold text-slate-800 dark:text-slate-100">
                <div className="flex items-center justify-between py-2 border-b border-white/20">
                  <span className="text-xs font-black uppercase text-slate-400">Select City:</span>
                  <LocationSelector activeCity="Bangalore" />
                </div>
                <a href="#home" onClick={() => setMenuOpen(false)} className="py-2">Home</a>
                <a href="#tutors" onClick={() => setMenuOpen(false)} className="py-2">Tutors</a>
                <a href="#why-choose" onClick={() => setMenuOpen(false)} className="py-2">Why Us</a>
                <a href="#plans" onClick={() => setMenuOpen(false)} className="py-2">Plans</a>
                <a href="#subjects" onClick={() => setMenuOpen(false)} className="py-2">Subjects</a>
                <a href="#boards" onClick={() => setMenuOpen(false)} className="py-2">Boards</a>
                <a href="#areas" onClick={() => setMenuOpen(false)} className="py-2">Areas We Serve</a>
                
                <div className="flex flex-col">
                  <button 
                    type="button"
                    onClick={() => setMobileResourcesOpen(!mobileResourcesOpen)}
                    className="flex items-center justify-between py-2 text-left font-bold text-slate-800 dark:text-slate-100"
                  >
                    <span>Resources</span>
                    <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${mobileResourcesOpen ? "rotate-180" : ""}`} />
                  </button>
                  {mobileResourcesOpen && (
                    <div className="pl-4 flex flex-col gap-2 border-l border-slate-100 dark:border-slate-700 my-1 animate-slideFade">
                      <a href="#faqs" onClick={() => { setMenuOpen(false); setMobileResourcesOpen(false); }} className="py-1.5 text-slate-600 font-bold text-sm">FAQ</a>
                      <Link to="/blogs" onClick={() => { setMenuOpen(false); setMobileResourcesOpen(false); }} className="py-1.5 text-slate-600 font-bold text-sm">Blog</Link>
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
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-3 text-center text-slate-800 dark:text-slate-100 font-black transition-all duration-300 shadow-sm"
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
                Home Tuition in <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Bangalore</span> for Class 6 to 12 → Graduation
              </h1>

              {/* Tagline Description with connector line */}
              <div className="relative pl-6 border-l-2 border-blue-500/20 mt-6">
                <div className="absolute left-[-5px] top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                <p className="text-lg leading-relaxed text-slate-300">
                  Expert home tutors and online classes for CBSE, ICSE, IGCSE, IB & State Board students across Bangalore. Personalized one-to-one tuition for Maths, Science, English, Commerce, and skills.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-4 items-center">
                <MotionLink
                  to="/parent-enquiry"
                  onClick={() => trackEvent("book_demo")}
                  whileHover={{ scale: 1.03, translateY: -2, boxShadow: "0 10px 25px rgba(59,130,246,0.3)" }}
                  whileTap={{ scale: 0.97 }}
                  className="group inline-flex items-center gap-2 rounded-2xl border border-transparent bg-blue-600 px-7 py-4 font-black text-white shadow-xl shadow-blue-900/40 transition-all duration-300 hover:bg-blue-500"
                >
                  Book Demo
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </MotionLink>

                {/* Parents Dashboard Preview button */}
                <motion.button
                  id="parents-dashboard-btn"
                  type="button"
                  onClick={() => setShowDemoPreview(true)}
                  whileHover={{ scale: 1.03, translateY: -2, boxShadow: "0 10px 25px rgba(15,23,42,0.6)" }}
                  whileTap={{ scale: 0.97 }}
                  className="group inline-flex items-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-900/90 px-7 py-4 font-black text-slate-100 backdrop-blur-xl transition-all duration-300 hover:bg-slate-800 hover:border-slate-500 hover:text-white shadow-xl shadow-slate-950/50 cursor-pointer"
                  aria-label="Parents dashboard preview"
                >
                  Parents Dashboard
                </motion.button>
              </div>

              {/* Quick Stats Grid */}
              <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1 */}
                <div className="relative rounded-2xl border border-blue-500/10 bg-[#060c18] pl-3.5 pr-2.5 py-4 flex items-center gap-2.5 transition-all duration-300 hover:border-blue-500/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.08)] group">
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
                    <div className="text-lg xl:text-xl font-extrabold text-blue-400">3200+</div>
                    <div className="text-[11px] font-semibold text-slate-300 leading-tight">Verified Tutors</div>
                  </div>
                </div>

                {/* Card 2 */}
                <div className="relative rounded-2xl border border-blue-500/10 bg-[#060c18] pl-3.5 pr-2.5 py-4 flex items-center gap-2.5 transition-all duration-300 hover:border-blue-500/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.08)] group">
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
                    <div className="text-lg xl:text-xl font-extrabold text-blue-400">35+</div>
                    <div className="text-[11px] font-semibold text-slate-300 leading-tight">Subjects Covered</div>
                  </div>
                </div>

                {/* Card 3 */}
                <div className="relative rounded-2xl border border-blue-500/10 bg-[#060c18] pl-3.5 pr-2.5 py-4 flex items-center gap-2.5 transition-all duration-300 hover:border-blue-500/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.08)] group">
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

                {/* Card 4 – Free Trial */}
                <div className="relative rounded-2xl border border-blue-500/10 bg-[#060c18] pl-3.5 pr-2.5 py-4 flex items-center gap-2.5 transition-all duration-300 hover:border-blue-500/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.08)] group">
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

            {/* Parent Consultation Feature Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="lg:col-span-5 w-full mt-10 lg:mt-0"
            >
              <div className="relative overflow-hidden rounded-[1.5rem] sm:rounded-[2.5rem] border border-slate-800 bg-[#081229]/80 p-4 sm:p-5 shadow-2xl backdrop-blur-xl">
                <div className="relative h-60 w-full overflow-hidden rounded-[1.2rem] sm:rounded-[2rem] shadow-inner">
                  <img
                    src="/bangalore_tutor_hero.png"
                    alt="Saraswati Home Tuition in Bangalore"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                  <div className="absolute bottom-4 left-4 rounded-xl bg-blue-600/90 px-3.5 py-1.5 text-[10px] font-black tracking-wide text-white backdrop-blur flex items-center gap-1.5 border border-blue-400/20">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verified Home Tutors
                  </div>
                </div>

                <div className="mt-6 p-2">
                  <h3 className="text-xl font-black text-white">Bangalore Parent Consultation</h3>
                  <p className="mt-2 text-xs text-slate-400">
                    Get in touch with our curriculum coordinator to discuss syllabus tracking, tutor preferences, and timings.
                  </p>

                  <div className="mt-6 space-y-3">
                    <a
                      href="tel:+918904457689"
                      onClick={() => trackEvent("call_click")}
                      className="flex items-center gap-3 rounded-2xl bg-[#0b1b36] border border-slate-800 p-3.5 transition hover:bg-[#102447] cursor-pointer"
                    >
                      <Phone className="h-5 w-5 text-blue-400" />
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Call / WhatsApp</div>
                        <div className="text-xs font-black text-white">+91 8904457689 / +91 9041157689</div>
                      </div>
                    </a>

                    <div className="flex items-center gap-3 rounded-2xl bg-[#0b1b36] border border-slate-800 p-3.5">
                      <Mail className="h-5 w-5 text-blue-400" />
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</div>
                        <div className="text-xs font-black text-white">support@saraswatitutorial.com</div>
                      </div>
                    </div>
                  </div>

                  <MotionLink
                    to="/parent-enquiry"
                    onClick={() => trackEvent("book_demo")}
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

      {/* Dynamic Tutors Directory Section */}
      <section
        id="tutors"
        className="mx-auto max-w-7xl px-6 py-16 md:py-24"
      >
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <SectionTitle
            eyebrow="Our Tutors"
            title="Best home tutors in Bangalore"
            subtitle="Find experienced and verified tutors by subject, location, learning mode, and expertise."
          />
        </div>

        {/* Dynamic Filters Control Panel */}
        <div className="mb-8 rounded-[1.5rem] sm:rounded-[2.5rem] border border-white/50 dark:border-slate-700/60 bg-white/30 dark:bg-slate-900/30 backdrop-blur-xl p-4 sm:p-6 shadow-xl shadow-slate-100/10 dark:shadow-none">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-center">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 dark:border-slate-700 pl-12 text-sm focus-visible:ring-slate-900 dark:focus-visible:ring-slate-400 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                placeholder="Search subject, tutor, or location..."
              />
            </div>

            {/* Category Select Dropdown */}
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none"
              >
                <option>All Categories</option>
                {categories.map((category) => (
                  <option key={category.name} value={category.name}>{category.name}</option>
                ))}
              </select>
            </div>

            {/* Filter Toggle Checkboxes */}
            <div className="flex gap-2 sm:col-span-2 justify-start sm:justify-end">
              <FilterToggle
                checked={verifiedOnly}
                onChange={setVerifiedOnly}
                label="Verified only"
              />

              <FilterToggle
                checked={onlineOnly}
                onChange={setOnlineOnly}
                label="Online only"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <LoadingTutors />
        ) : filteredTutors.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-slate-300 dark:border-slate-700 bg-white/40 dark:bg-slate-900/30 backdrop-blur-sm p-10 text-center">
            <p className="text-lg font-black text-slate-950 dark:text-white">
              No tutors found
            </p>
            <p className="mt-2 text-slate-500 dark:text-slate-400">
              Try removing filters or searching another subject/location.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex justify-between gap-3 lg:hidden">
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                Swipe to explore tutors
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => scrollTutors("left")}
                  className="rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm"
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <button
                  onClick={() => scrollTutors("right")}
                  className="rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm"
                  aria-label="Scroll right"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              ref={sliderRef}
              className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 scroll-smooth lg:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {filteredTutors.slice(0, visibleTutorsCount).map((tutor) => (
                <TutorCard
                  key={tutor._id}
                  tutor={tutor}
                  onViewProfile={setSelectedTutor}
                  onBook={setBookingTutor}
                  swipeMode
                />
              ))}
            </div>

            <div className="hidden gap-6 lg:grid lg:grid-cols-2">
              {filteredTutors.slice(0, visibleTutorsCount).map((tutor) => (
                <TutorCard
                  key={tutor._id}
                  tutor={tutor}
                  onViewProfile={setSelectedTutor}
                  onBook={setBookingTutor}
                />
              ))}
            </div>

            {visibleTutorsCount < filteredTutors.length && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => setVisibleTutorsCount((prev) => prev + 4)}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-blue-600 bg-white px-6 py-2.5 text-xs font-black uppercase tracking-wider text-blue-600 hover:bg-blue-50 active:scale-95 transition-all duration-200 cursor-pointer shadow-md shadow-blue-500/5"
                >
                  See More Tutors
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* SEO Intro Section */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="rounded-[1.5rem] sm:rounded-[2.5rem] border border-white/50 dark:border-slate-700/60 bg-white/30 dark:bg-slate-900/30 backdrop-blur-xl p-5 sm:p-8 shadow-xl shadow-slate-100/10 dark:shadow-none md:p-12">
          <div className="max-w-4xl">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">Overview</h2>
            <h3 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-4xl">
              Home Tuition in Bangalore for Class 6 to 12
            </h3>

            <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">
              <p>
                Saraswati Tutorials provides trusted and result-oriented home tuition in Bangalore for students from Class 6 to 12. We offer experienced private tutors for CBSE, ICSE, IGCSE, IB and Karnataka State Board students across major areas of Bangalore including Whitefield, HSR Layout, Indiranagar, Jayanagar, Koramangala, Electronic City, and more. Our personalized one-to-one teaching approach helps students improve conceptual understanding, confidence, and academic performance.
              </p>
              <p>
                Whether your child needs help in Maths, Science, Physics, Chemistry, Biology, English, or Commerce subjects, our expert tutors provide customized learning plans, regular assessments, and dedicated doubt-solving support at home or online.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Section */}
      <section id="why-choose" className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-600">Core Benefits</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-5xl">
              Why Parents Prefer Saraswati Tutorials in Bangalore
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-300">
              We stand apart through our student-first philosophy, matching children with vetted subject-matter experts who act as academic mentors.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {whyChooseUs.map((item, idx) => {
              const IconComp = item.icon;
              const glassThemes = [
                // 1. Verified Tutors (Blue Glass)
                { bg: "bg-blue-500/12", border: "border-blue-300/70", icon: "text-blue-600", glow: "group-hover:shadow-[0_12px_28px_rgba(37,99,235,0.18)]" },
                // 2. One-to-One (Purple Glass)
                { bg: "bg-purple-500/12", border: "border-purple-300/70", icon: "text-purple-600", glow: "group-hover:shadow-[0_12px_28px_rgba(147,51,234,0.18)]" },
                // 3. Home & Online (Orange Glass)
                { bg: "bg-orange-500/12", border: "border-orange-300/70", icon: "text-orange-500", glow: "group-hover:shadow-[0_12px_28px_rgba(249,115,22,0.18)]" },
                // 4. Bi-Weekly Tests (Green Glass)
                { bg: "bg-emerald-500/12", border: "border-emerald-300/70", icon: "text-emerald-600", glow: "group-hover:shadow-[0_12px_28px_rgba(16,185,129,0.18)]" },
                // 5. Flexible Timings (Pink Glass)
                { bg: "bg-rose-500/12", border: "border-rose-300/70", icon: "text-rose-500", glow: "group-hover:shadow-[0_12px_28px_rgba(244,63,94,0.18)]" },
                // 6. All Boards (Blue Glass)
                { bg: "bg-blue-500/12", border: "border-blue-300/70", icon: "text-blue-600", glow: "group-hover:shadow-[0_12px_28px_rgba(37,99,235,0.18)]" },
                // 7. Affordable Fee (Amber Glass)
                { bg: "bg-amber-500/12", border: "border-amber-300/70", icon: "text-amber-500", glow: "group-hover:shadow-[0_12px_28px_rgba(245,158,11,0.18)]" },
                // 8. Free Demo (Pink Glass)
                { bg: "bg-pink-500/12", border: "border-pink-300/70", icon: "text-pink-500", glow: "group-hover:shadow-[0_12px_28px_rgba(236,72,153,0.18)]" },
                // 9. Fast Progress (Teal Glass)
                { bg: "bg-teal-500/12", border: "border-teal-300/70", icon: "text-teal-600", glow: "group-hover:shadow-[0_12px_28px_rgba(20,184,166,0.18)]" },
                // 10. Expert Teachers (Purple Glass)
                { bg: "bg-purple-500/12", border: "border-purple-300/70", icon: "text-purple-600", glow: "group-hover:shadow-[0_12px_28px_rgba(147,51,234,0.18)]" },
                // 11. Regular Attendance (Blue Glass)
                { bg: "bg-blue-500/12", border: "border-blue-300/70", icon: "text-blue-600", glow: "group-hover:shadow-[0_12px_28px_rgba(37,99,235,0.18)]" },
                // 12. Parent Support (Cyan Glass)
                { bg: "bg-cyan-500/12", border: "border-cyan-300/70", icon: "text-cyan-600", glow: "group-hover:shadow-[0_12px_28px_rgba(6,182,212,0.18)]" },
              ];
              const theme = glassThemes[idx % glassThemes.length];

              return (
                <motion.div
                  whileHover={{ y: -6, scale: 1.02 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  key={idx}
                  className="group relative overflow-hidden rounded-3xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition-all duration-300 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-[0_20px_35px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_20px_35px_rgba(0,0,0,0.35)]"
                >
                  {/* 3D Transparent Water Glass Badge Container */}
                  <div className={`relative flex h-16 w-16 items-center justify-center rounded-[1.35rem] ${theme.bg} backdrop-blur-xl border ${theme.border} shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.9),0_6px_16px_rgba(0,0,0,0.04)] transition-all duration-300 group-hover:scale-105 group-hover:-rotate-2 ${theme.glow}`}>
                    {/* Water gloss highlight reflection */}
                    <div className="absolute top-1 left-2.5 right-2.5 h-[3px] rounded-full bg-gradient-to-r from-transparent via-white/90 to-transparent pointer-events-none" />
                    {/* Inner glass bevel rim */}
                    <div className="absolute inset-0 rounded-[1.35rem] ring-1 ring-inset ring-white/60 pointer-events-none" />
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
          <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-600">Tuition Programs</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-5xl">
            Subjects Available for Home Tuition in Bangalore
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-300">
            Comprehensive curriculum guidance covering science, mathematics, literature, and accounting.
          </p>
        </div>

        <div className="mt-12 space-y-12">
          {/* School Subjects */}
          <div>
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 border-l-4 border-blue-600 pl-3 mb-6">
              School Subjects
            </h3>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {schoolSubjects.map((subj, idx) => (
                <div
                  key={idx}
                  className="overflow-hidden group rounded-3xl border border-white/60 dark:border-slate-700/60 bg-white/30 dark:bg-slate-900/30 backdrop-blur-md shadow-sm shadow-slate-100/20 dark:shadow-none transition hover:bg-white/50 dark:hover:bg-slate-800/50 hover:shadow-xl hover:scale-[1.03] duration-300"
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
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 font-black text-blue-600 transition group-hover:bg-blue-100">
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
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 border-l-4 border-indigo-600 pl-3 mb-6">
              Commerce Subjects
            </h3>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {commerceSubjects.map((subj, idx) => (
                <div
                  key={idx}
                  className="overflow-hidden group rounded-3xl border border-white/60 dark:border-slate-700/60 bg-white/30 dark:bg-slate-900/30 backdrop-blur-md shadow-sm shadow-slate-100/20 dark:shadow-none transition hover:bg-white/50 dark:hover:bg-slate-800/50 hover:shadow-xl hover:scale-[1.03] duration-300"
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
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 font-black text-indigo-600 transition group-hover:bg-indigo-100">
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
          <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-600">Structured Modules</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-5xl">
            Tuition Classes Available
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-300">
            Tailored grade-wise guidance designed to secure high scores and bolster conceptual foundations.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {classesList.map((cls, idx) => (
            <div
              key={idx}
              className="overflow-hidden group rounded-3xl border border-white/60 dark:border-slate-700/60 bg-white/30 dark:bg-slate-900/30 backdrop-blur-md shadow-sm shadow-slate-100/20 dark:shadow-none transition hover:bg-white/50 dark:hover:bg-slate-800/50 hover:shadow-xl hover:scale-[1.03] duration-300"
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
            <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-600">Locations</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-5xl">
              Home Tuition Available Across Bangalore
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-300">
              Our network of verified home tutors reaches all major commercial and residential pockets in Bangalore.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
            {areas.map((area, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-2xl border border-white/50 dark:border-slate-700/60 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm p-4 transition hover:bg-white/60 dark:hover:bg-slate-800/60 hover:scale-[1.02]"
              >
                <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{area}</span>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-8 max-w-3xl text-center text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            <p>
              Saraswati Tutorials has a widespread network of home tutors spanning across the entire Bangalore metropolitan region. Whether you live in East Bangalore, South Bangalore, North Bangalore, or neighboring areas, we can match you with an experienced private tutor who can conduct offline classes at your residence. In addition to offline sessions, our tutors are equipped to offer highly engaging and interactive online live classes, providing flexibility for busy student schedules.
            </p>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-600">Process Flow</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-5xl">
            How Our Tutor Matching Process Works
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-300">
            Four simple steps to match your child with their perfect private home tutor.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, idx) => (
            <div key={idx} className="relative rounded-3xl border border-white/60 dark:border-slate-700/60 bg-white/30 dark:bg-slate-900/30 backdrop-blur-md p-6 shadow-sm dark:shadow-none transition hover:bg-white/50 dark:hover:bg-slate-800/50 hover:scale-[1.02]">
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
              Trusted by Parents Across Bangalore
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
          <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-600">Questions</p>
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
                className="overflow-hidden rounded-2xl border border-white/60 dark:border-slate-700/60 bg-white/30 dark:bg-slate-900/30 backdrop-blur-md shadow-sm dark:shadow-none transition hover:bg-white/40 dark:hover:bg-slate-800/40"
              >
                <motion.button
                  onClick={() => toggleFaq(idx)}
                  whileTap={{ scale: 0.99, backgroundColor: "rgba(255, 255, 255, 0.4)" }}
                  className="flex w-full items-center justify-between px-6 py-5 text-left font-black text-slate-950 dark:text-white hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                >
                  <span>{faq.q}</span>
                  {isOpen ? <ChevronUp className="h-5 w-5 text-blue-600" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                </motion.button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="border-t border-white/20 dark:border-slate-700/60 bg-white/20 dark:bg-slate-900/20 px-6 py-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
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
            Get matched with experienced home tutors in Bangalore for your child’s academic needs.
          </p>
          <div className="mt-8">
            <Link
              to="/parent-enquiry"
              onClick={() => trackEvent("book_demo")}
              className="inline-flex items-center gap-2 rounded-2xl border border-transparent bg-white px-8 py-4 font-black text-slate-950 shadow-xl transition hover:-translate-y-0.5 hover:bg-slate-100"
            >
              Enquire Now
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/20 dark:border-slate-800 bg-white/30 dark:bg-slate-900/30 backdrop-blur-md py-12 text-slate-600 dark:text-slate-400">
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
              <h5 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">Direct Services</h5>
              <ul className="mt-4 space-y-2 text-sm">
                <li><Link to="/parent-enquiry" className="hover:text-blue-600">Parent Enquiry</Link></li>
                <li><Link to="/tutor-register" className="hover:text-blue-600">Become a Tutor</Link></li>
                <li><a href="https://saraswatitutorial.com/" className="hover:text-blue-600">Home Tuition Services</a></li>
                <li><a href="https://saraswatitutorial.com/#tutors" className="hover:text-blue-600">Online Tuition</a></li>
              </ul>
            </div>

            <div>
              <h5 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">Legal Details</h5>
              <ul className="mt-4 space-y-2 text-sm">
                <li><Link to="/terms-conditions" className="hover:text-blue-600">Terms & Conditions</Link></li>
                <li><Link to="/privacy-policy" className="hover:text-blue-600">Privacy Policy</Link></li>
                <li><Link to="/disclaimer" className="hover:text-blue-600">Disclaimer</Link></li>
              </ul>
            </div>

            <div>
              <h5 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">Support Contact</h5>
              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-blue-600" />
                  <span>+91 8904457689 / +91 9041157689</span>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-600" />
                  <span>support@saraswatitutorial.com</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t border-slate-100 dark:border-slate-800 pt-6 text-center text-xs text-slate-400 dark:text-slate-500">
            &copy; {new Date().getFullYear()} Saraswati Tutorials. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Chat */}
      <motion.a
        href="https://wa.me/918904457689"
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackEvent("whatsapp_click")}
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
          <path
            fill="white"
            d="M12.004 2C6.48 2 2 6.48 2 12c0 2.17.69 4.19 1.86 5.86L2 22l4.27-1.13C7.9 21.58 9.9 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"
          />
          <path
            className="fill-[#25D366] transition-colors duration-200 group-hover:fill-[#128C7E]"
            d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"
          />
        </svg>
      </motion.a>

      {/* Tutor Profile Details Modal */}
      <Modal
        open={!!selectedTutor}
        onClose={() => setSelectedTutor(null)}
        title="Tutor Profile"
      >
        {selectedTutor ? (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              {selectedTutor.photo ? (
                <img
                  src={getTutorImage(selectedTutor.photo)}
                  alt={selectedTutor.name}
                  loading="lazy"
                  className="h-20 w-20 rounded-3xl object-cover"
                />
              ) : (
                <Avatar className="h-20 w-20 rounded-3xl">
                  <AvatarFallback className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 dark:bg-slate-800 text-lg font-black text-slate-800 dark:text-slate-100">
                    {getInitials(selectedTutor.name)}
                  </AvatarFallback>
                </Avatar>
              )}

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-2xl font-black text-slate-950 dark:text-white">
                    {selectedTutor.name}
                  </h4>

                  {selectedTutor.verified ? (
                    <Badge className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                      Verified
                    </Badge>
                  ) : null}
                </div>

                <p className="mt-1 text-sm font-semibold text-slate-600">
                  {selectedTutor.subject} •{" "}
                  {selectedTutor.location ||
                    selectedTutor.locations?.[0] ||
                    "Bangalore"}
                </p>
              </div>
            </div>

            <p className="text-sm leading-7 text-slate-600">
              {selectedTutor.about ||
                "Experienced tutor available for personalized learning support."}
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
              <ProfileStat
                title={selectedTutor.qualification || "Qualified tutor"}
                label="Qualification"
              />
              <ProfileStat
                title={selectedTutor.experience || "Experienced"}
                label="Experience"
              />
              <ProfileStat
                title={`₹${selectedTutor.price || 0}/hr`}
                label="Starting fee"
              />
            </div>

            <Button
              className="rounded-2xl bg-slate-950 px-5 py-3 font-black text-white"
              onClick={() => {
                setBookingTutor(selectedTutor);
                setSelectedTutor(null);
              }}
              aria-label={`Book demo with ${selectedTutor?.name || "tutor"}`}
            >
              Book demo
            </Button>
          </div>
        ) : null}
      </Modal>

      {/* Booking Form Modal */}
      <Modal
        open={!!bookingTutor}
        onClose={() => setBookingTutor(null)}
        title="Book Demo Class"
      >
        {bookingTutor ? (
          <div className="space-y-5">
            <div className="rounded-3xl bg-slate-50 dark:bg-slate-800/60 p-4">
              <p className="font-black text-slate-950 dark:text-white">{bookingTutor.name}</p>
              <p className="mt-1 text-sm text-slate-600">
                {bookingTutor.subject} • ₹{bookingTutor.price || 0}/hr
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                className="h-12 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                placeholder="Learner name"
                value={bookingForm.learnerName}
                onChange={(e) =>
                  setBookingForm({
                    ...bookingForm,
                    learnerName: e.target.value,
                  })
                }
              />

              <Input
                className="h-12 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                placeholder="Phone number"
                value={bookingForm.phone}
                onChange={(e) =>
                  setBookingForm({
                    ...bookingForm,
                    phone: e.target.value,
                  })
                }
              />

              <Input
                type="date"
                className="h-12 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                value={bookingForm.preferredDate}
                onChange={(e) =>
                  setBookingForm({
                    ...bookingForm,
                    preferredDate: e.target.value,
                  })
                }
              />

              <Input
                className="h-12 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                placeholder="Preferred slot"
                value={bookingForm.preferredSlot}
                onChange={(e) =>
                  setBookingForm({
                    ...bookingForm,
                    preferredSlot: e.target.value,
                  })
                }
              />
            </div>

            <textarea
              className="min-h-[110px] w-full rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm outline-none focus:border-slate-950 dark:focus:border-slate-400 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              placeholder="Message or learning requirement"
              value={bookingForm.message}
              onChange={(e) =>
                setBookingForm({
                  ...bookingForm,
                  message: e.target.value,
                })
              }
            />

            <div className="flex items-center justify-between rounded-3xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Demo request will be shared instantly.
              </div>
              <span>Secure flow</span>
            </div>

            <div className="flex gap-3">
              <Button
                className="rounded-2xl bg-slate-950 px-5 py-3 font-black text-white"
                onClick={submitBooking}
                aria-label="Confirm tutor booking"
              >
                Confirm booking
              </Button>

              <Button
                className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 font-black text-slate-800 dark:text-slate-100"
                onClick={() => setBookingTutor(null)}
                aria-label="Cancel booking"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-5 right-5 z-50 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-bold text-white shadow-2xl"
          >
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Demo Parent Dashboard Preview Modal */}
      {showDemoPreview && (
        <DemoParentDashboard
          onClose={() => setShowDemoPreview(false)}
          selectedPlan="advance"
        />
      )}
    </div>
  );
}
