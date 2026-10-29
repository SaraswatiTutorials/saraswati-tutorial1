import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, ChevronDown, Check, Calendar, User, Menu, X } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import BrandLogo from "./BrandLogo";
import { trackEvent } from "../utils/analytics";

const MotionLink = motion(Link);

// The home page's navbar for the other pages (parent enquiry form). Section links
// go back to that section of the city's home page.
// city: "Bangalore" | "Mumbai"
// sticky: false where the page has popups inside its own layers (they would sit under the navbar)

const handleLocationRedirect = (city) => {
  localStorage.setItem("userLocation", city);
  const onLocalhost = window.location.hostname.includes("localhost");
  if (city === "Mumbai") {
    window.location.href = onLocalhost ? "/mumbai" : "https://mumbai.saraswatitutorial.com/";
  } else {
    window.location.href = onLocalhost ? "/" : "https://saraswatitutorial.com/";
  }
};

// Locally the Mumbai home page is at /mumbai; live it is the root of its own subdomain
function getHomePath(city) {
  return city === "Mumbai" && window.location.hostname.includes("localhost") ? "/mumbai" : "/";
}

function getSectionLinks(city) {
  const links = [
    { id: "home", label: "Home" },
    { id: "tutors", label: "Tutors" },
    { id: "why-choose", label: "Why Us" },
    { id: "plans", label: "Plans" },
    { id: "subjects", label: "Subjects" },
    { id: "boards", label: "Boards" },
    { id: "areas", label: "Areas", mobileLabel: "Areas We Serve" },
  ];
  // The Mumbai page has no tutors list
  return city === "Mumbai" ? links.filter((link) => link.id !== "tutors") : links;
}

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
        <span className="inline-flex animate-pulse"><MapPin className="h-3.5 w-3.5 text-blue-600" /></span>
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

function ResourcesDropdown({ homePath }) {
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

  return (
    <div ref={dropdownRef} className="relative inline-block z-30 select-none">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 py-1.5 transition duration-300 whitespace-nowrap shrink-0 font-bold cursor-pointer relative text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
      >
        <span>Resources</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${isOpen ? "rotate-180" : ""} text-slate-500 dark:text-slate-400`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-32 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 shadow-xl py-1.5 text-slate-700 dark:text-slate-200 animate-slideFade">
          <a
            href={`${homePath}#faqs`}
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

export default function SiteHeader({ city = "Bangalore", sticky = true }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileResourcesOpen, setMobileResourcesOpen] = useState(false);
  const homePath = getHomePath(city);
  const sectionLinks = getSectionLinks(city);

  return (
    <header className={`${sticky ? "sticky top-0 z-50" : "relative"} w-full py-3 px-4 sm:px-6 lg:px-8 bg-transparent`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 xl:px-6 py-2.5 xl:py-3.5 bg-white/95 dark:bg-slate-900/95 border border-slate-200/50 dark:border-slate-800/80 rounded-[1.75rem] shadow-[0_8px_30px_rgba(0,0,0,0.05)] dark:shadow-none">
        <div className="flex items-center gap-2 xl:gap-3 shrink-0">
          <Link to={homePath} className="flex items-center gap-2 xl:gap-3 group shrink-0">
            <motion.div
              whileHover={{ scale: 1.08, rotate: [0, -3, 3, 0] }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="h-[72px] w-[72px] sm:h-[60px] sm:w-[60px] shrink-0 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700 shadow-sm flex items-center justify-center cursor-pointer"
            >
              <BrandLogo alt="ST" className="h-full w-full sm:h-[48px] sm:w-[48px] rounded-xl object-contain" />
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

          <div className="hidden sm:block h-8 w-px bg-slate-200 dark:bg-slate-700 mx-2 xl:mx-3 shrink-0" />

          <div className="shrink-0">
            <LocationSelector activeCity={city} />
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-2 xl:gap-3.5 2xl:gap-5 text-xs xl:text-[13px] 2xl:text-[14px] font-bold text-slate-600 xl:flex shrink-0">
          {sectionLinks.map((link) => (
            <a
              key={link.id}
              href={`${homePath}#${link.id}`}
              className="relative py-1.5 transition duration-300 whitespace-nowrap shrink-0 text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
            >
              {link.label}
            </a>
          ))}
          <ResourcesDropdown homePath={homePath} />
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
            to="/tutor-verification"
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
            type="button"
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
                <LocationSelector activeCity={city} />
              </div>
              {sectionLinks.map((link) => (
                <a key={link.id} href={`${homePath}#${link.id}`} onClick={() => setMenuOpen(false)} className="py-2">
                  {link.mobileLabel || link.label}
                </a>
              ))}

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
                    <a href={`${homePath}#faqs`} onClick={() => { setMenuOpen(false); setMobileResourcesOpen(false); }} className="py-1.5 text-slate-600 dark:text-slate-400 font-bold text-sm">FAQ</a>
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
                to="/tutor-verification"
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
  );
}
