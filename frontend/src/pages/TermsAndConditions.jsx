import React, { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import {
  ShieldCheck, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp,
  Users, MapPin, Home, Clock, RefreshCw, LayoutDashboard,
  BadgeCheck, AlertTriangle, Info, IndianRupee, CalendarX2,
  ArrowRight, X as XIcon, HelpCircle, CheckSquare, MessageCircle,
  FileText, Sparkles, Lock, ArrowUpRight, Check, Calendar,
  CreditCard, TrendingUp, AlertCircle
} from "lucide-react";
import { API_BASE } from "../config";
import { TNC_CONFIG, computeFees, formatINR } from "../data/tncConfig";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Read monthly tuition from URL param ?fee= or session storage */
function getMonthlyTuition() {
  try {
    const params = new URLSearchParams(window.location.search);
    const urlFee = parseInt(params.get("fee"), 10);
    if (!isNaN(urlFee) && urlFee > 0) return urlFee;
    const storedFee = parseInt(sessionStorage.getItem("parentMonthlyFee") || "", 10);
    if (!isNaN(storedFee) && storedFee > 0) return storedFee;
  } catch { /* ignore */ }
  return TNC_CONFIG.exampleMonthlyTuition;
}

async function recordAction(action, snapshot = {}) {
  try {
    await fetch(`${API_BASE}/tnc/record`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        source: "terms-conditions",
        pageVersion: TNC_CONFIG.termsVersion,
        ...snapshot,
      }),
    });
  } catch (err) {
    console.error("[TNC] record error:", err);
  }
}

function openClarificationWhatsApp() {
  const text = encodeURIComponent("I need some clarification regarding your Terms & Conditions. Please contact me.");
  window.open(`${TNC_CONFIG.whatsappBusinessUrl}?text=${text}`, "_blank", "noopener,noreferrer");
}

function openAcceptanceWhatsApp() {
  const text = encodeURIComponent("I agree with your Terms & Conditions, please schedule a demo.");
  // Extract phone number from the business URL (wa.me/XXXXXXXXXX) and build with pre-filled text
  const phoneMatch = TNC_CONFIG.whatsappBusinessUrl.match(/wa\.me\/(\d+)/);
  const phone = phoneMatch ? phoneMatch[1] : "918904457689";
  window.open(`https://wa.me/${phone}?text=${text}`, "_blank", "noopener,noreferrer");
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICES DATA
// ─────────────────────────────────────────────────────────────────────────────
const SERVICES = [
  {
    icon: ShieldCheck,
    color: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40",
    title: "Verified Tutors",
    body: "Every tutor is verified with ID, education, and background checks.",
  },
  {
    icon: Users,
    color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40",
    title: "Tutor Matching",
    body: "We find a tutor based on your location, class, syllabus, subject, and preferred timing.",
  },
  {
    icon: Home,
    color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40",
    title: "Home Tuition",
    body: "Your tutor comes directly to your home for the classes.",
  },
  {
    icon: RefreshCw,
    color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40",
    title: "72-Hour Replacement",
    body: "If there is a genuine issue with the tutor, we arrange a replacement within 72 hours.",
  },
  {
    icon: BadgeCheck,
    color: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40",
    title: "Missed Class Support",
    body: "If a class is missed with 24 hours\u2019 notice, we help arrange a replacement class.",
  },
  {
    icon: LayoutDashboard,
    color: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40",
    title: "Parents Portal",
    body: "Complete digital tracking of class dates, topics covered, and attendance logs.",
  },
];

const FEE_BREAKDOWN = [
  { label: "Tutor Sourcing", pct: 20, desc: "Matching from 3200+ verified tutor database." },
  { label: "Tutor Verification", pct: 20, desc: "Govt ID & academic credentials validation." },
  { label: "Tutor Allocation", pct: 20, desc: "Arranging direct physical doorstep setup." },
  { label: "Parents Dashboard", pct: 20, desc: "Digital attendance tracking portal." },
  { label: "Backup & Replacement", pct: 20, desc: "Guaranteed replacement support within 72h max." },
];

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT TIMELINE COMPONENT — the most important UX element
// ─────────────────────────────────────────────────────────────────────────────
function PaymentTimeline({ fees }) {
  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 opacity-40" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-2">
          Your Payment Schedule at a Glance
        </span>
        <div className="h-1 flex-1 rounded-full bg-gradient-to-l from-blue-500 to-emerald-500 opacity-40" />
      </div>

      {/* Two-card layout */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch">

        {/* ── MONTH 1 CARD ── */}
        <div className="flex-1 rounded-2xl overflow-hidden border-2 border-blue-300 dark:border-blue-700 shadow-md shadow-blue-100 dark:shadow-blue-950/30">
          {/* Card header */}
          <div className="bg-blue-600 dark:bg-blue-700 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-200 shrink-0" />
              <span className="text-xs font-black text-white uppercase tracking-widest">First Month</span>
            </div>

          </div>

          {/* Card body */}
          <div className="bg-blue-50 dark:bg-blue-950/30 px-4 py-4 space-y-3 h-full">
            {/* Fee name */}
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <strong className="text-sm font-black text-blue-900 dark:text-blue-200">
                Parents Onboarding Fee
              </strong>
            </div>
            <strong className="block text-2xl font-black text-blue-700 dark:text-blue-300">
              {formatINR(fees.admissionFee)}
            </strong>

            {/* Bullets */}
            <ul className="space-y-1.5">
              {[
                "Payable after tutor confirmation",
                "Payable before the first class",
                "One-time payment only",
              ].map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                  <span className="text-[11px] font-semibold text-blue-800 dark:text-blue-300 leading-relaxed">
                    {point}
                  </span>
                </li>
              ))}
            </ul>

            {/* "No monthly tuition" callout — the key message */}
            <div className="mt-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 px-3 py-2.5 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[11px] font-black text-amber-800 dark:text-amber-300 leading-snug uppercase tracking-wide">
                Onboarding Fee Only
              </p>
            </div>
          </div>
        </div>

        {/* ── CONNECTOR ARROW ── */}
        <div className="flex items-center justify-center sm:flex-col gap-2 sm:gap-0 py-0 sm:py-4 px-2 sm:px-0">
          <div className="hidden sm:block h-full w-px bg-gradient-to-b from-blue-300 via-slate-300 to-emerald-300 dark:from-blue-700 dark:via-slate-600 dark:to-emerald-700" />
          <div className="sm:my-3 flex flex-col sm:flex-row items-center gap-1">
            <div className="h-px sm:h-0 w-8 sm:w-px bg-slate-300 dark:bg-slate-600 block sm:hidden" />
            <div className="rounded-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 p-1.5 shadow-sm">
              <ArrowRight className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 sm:rotate-0 rotate-0" />
            </div>
            <div className="h-px sm:h-0 w-8 sm:w-px bg-slate-300 dark:bg-slate-600 block sm:hidden" />
          </div>
          <div className="hidden sm:block h-full w-px bg-gradient-to-b from-blue-300 via-slate-300 to-emerald-300 dark:from-blue-700 dark:via-slate-600 dark:to-emerald-700" />
        </div>

        {/* ── MONTH 2 CARD ── */}
        <div className="flex-1 rounded-2xl overflow-hidden border-2 border-emerald-300 dark:border-emerald-700 shadow-md shadow-emerald-100 dark:shadow-emerald-950/30">
          {/* Card header */}
          <div className="bg-emerald-600 dark:bg-emerald-700 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-200 shrink-0" />
              <span className="text-xs font-black text-white uppercase tracking-widest">Second Month Onwards</span>
            </div>

          </div>

          {/* Card body */}
          <div className="bg-emerald-50 dark:bg-emerald-950/30 px-4 py-4 space-y-3 h-full">
            {/* Fee name */}
            <div className="flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <strong className="text-sm font-black text-emerald-900 dark:text-emerald-200">
                Monthly Tuition Fee
              </strong>
            </div>
            <strong className="block text-2xl font-black text-emerald-700 dark:text-emerald-300">
              {formatINR(fees.tuition)}
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">/month</span>
            </strong>

            {/* Bullets */}
            <ul className="space-y-1.5">
              {[
                "Tuition begins from the second month",
                "First monthly payment is due in the second month",
                "Billed monthly thereafter",
              ].map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                  <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 leading-relaxed">
                    {point}
                  </span>
                </li>
              ))}
            </ul>

            {/* Timing callout */}
            <div className="mt-1 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-700 px-3 py-2.5 flex items-start gap-2">
              <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
              <p className="text-[11px] font-black text-orange-800 dark:text-orange-300 leading-snug uppercase tracking-wide">
                Your First Tuition Payment is Due from Month 2
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary sentence */}
      <div className="bg-slate-100 dark:bg-slate-800/60 rounded-2xl px-4 py-3 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 leading-relaxed text-center">
        <strong className="text-slate-900 dark:text-white">In summary:</strong>{" "}
        Parents Onboarding Fee ({formatINR(fees.admissionFee)}) is payable after tutor confirmation and before the first class.{" "}
        Monthly tuition starts from the beginning of the second month.{" "}
        Your first monthly tuition payment ({formatINR(fees.tuition)}) is due from the second month.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE (FULLY READABLE SINGLE-PAGE LAYOUT)
// ─────────────────────────────────────────────────────────────────────────────
export default function TermsConditions() {
  const [monthlyTuition] = useState(() => getMonthlyTuition());
  const fees = computeFees(monthlyTuition);
  const [fullName, setFullName] = useState("");

  const [flow, setFlow] = useState("idle"); // "idle" | "preview" | "submitting" | "accepted" | "declined"
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const acceptRef = useRef(null);

  const handleAcceptClick = () => setFlow("preview");

  const handleDeclineClick = () => {
    recordAction("dismissed", { name: fullName });
    setFlow("declined");
  };

  const handleConfirm = async () => {
    setFlow("submitting");
    await recordAction("accepted", {
      name: fullName,
      feeSnapshot: {
        tuition: fees.tuition,
        onboardingFee: fees.admissionFee,
        backupComponent: fees.backupComponent,
      },
    });
    setFlow("accepted");
    setTimeout(() => {
      openAcceptanceWhatsApp();
    }, 1500);
  };

  const handleBack = () => setFlow("idle");

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <Helmet>
        <title>Parent Onboarding & Terms | Saraswati Tutorials</title>
        <meta name="description" content="Read and accept official Saraswati Tutorials Parent Onboarding Guide — fees, service guarantees, and policy." />
      </Helmet>

      {/* Preview modal */}
      {(flow === "preview" || flow === "submitting") && (
        <PreviewModal
          fees={fees}
          fullName={fullName}
          onConfirm={handleConfirm}
          onBack={handleBack}
          submitting={flow === "submitting"}
        />
      )}

      {/* Accepted state overlay */}
      {flow === "accepted" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="text-center space-y-4 px-6">
            <div className="h-16 w-16 rounded-full bg-emerald-500 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/30">
              <Check className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-xl font-black text-white">Terms Accepted!</h2>
            <p className="text-sm text-slate-300 font-medium">Opening WhatsApp to schedule your demo…</p>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200 pb-24">
        {/* Sticky Header */}
        <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 py-3 shadow-xs">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="Saraswati Tutorials"
                className="h-9 sm:h-10 w-auto object-contain shrink-0"
              />
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
              <div className="hidden sm:block">
                <p className="text-xs font-black text-slate-900 dark:text-white leading-tight">Saraswati Tutorials</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Bangalore & Mumbai</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-full">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified Document
              </span>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 pt-6 space-y-6">

          {/* Hero Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl">
            <div className="relative z-10 space-y-2">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Parent Onboarding & Terms
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-medium leading-relaxed">
                Please read the official policies below. All terms are clearly laid out for your complete transparency before signing.
              </p>
            </div>
          </div>

          {/* Quick Jump Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-2 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-2 text-xs overflow-x-auto scrollbar-none">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 pl-2 shrink-0">
              Quick Jump:
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {[
                { id: "sec-services", label: "1. Services" },
                { id: "sec-fees", label: "2. Fee & Payment" },
                { id: "sec-policies", label: "3. Replacement" },
                { id: "sec-terms", label: "4. Hiring Policy" },
                { id: "sec-sign", label: "5. Sign & Accept" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-600 hover:text-white font-bold transition-all cursor-pointer whitespace-nowrap text-[11px]"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* SECTION 1: SERVICES & DEMO POLICY */}
          {/* ─────────────────────────────────────────────────────────────── */}
          <section id="sec-services" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400 border-b border-slate-100 dark:border-slate-800 pb-3">
              <ShieldCheck className="h-5 w-5 shrink-0" />
              <h2 className="text-base font-black uppercase tracking-wider text-slate-900 dark:text-white">
                1. What You Get &amp; Free Demo
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SERVICES.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.title} className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${s.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <strong className="text-xs font-black text-slate-800 dark:text-white">{s.title}</strong>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                      {s.body}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Demo Policy Callout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-base shadow-sm shrink-0">
                  ₹0
                </div>
                <div>
                  <strong className="text-xs font-black text-emerald-900 dark:text-emerald-300 uppercase tracking-wider block">1st Demo Session</strong>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">100% FREE (1 Hour duration) with zero upfront risk.</p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800/80 rounded-2xl p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
                  <span className="text-xs font-black leading-tight text-center">₹{TNC_CONFIG.additionalDemoFeeRs}</span>
                </div>
                <div>
                  <strong className="text-xs font-black text-blue-900 dark:text-blue-300 uppercase tracking-wider block">2nd Demo Session Onwards</strong>
                  <p className="text-[11px] text-blue-700 dark:text-blue-400 font-semibold mt-0.5">₹{TNC_CONFIG.additionalDemoFeeRs} per class, where applicable.</p>
                </div>
              </div>
            </div>
          </section>

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* SECTION 2: FEE STRUCTURE & PAYMENT TIMELINE */}
          {/* ─────────────────────────────────────────────────────────────── */}
          <section id="sec-fees" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400 border-b border-slate-100 dark:border-slate-800 pb-3">
              <IndianRupee className="h-5 w-5 shrink-0" />
              <h2 className="text-base font-black uppercase tracking-wider text-slate-900 dark:text-white">
                2. Fee Structure
              </h2>
            </div>

            {/* Formula Calculation Box */}
            <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:text-left items-center">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Monthly Tuition Quote</span>
                <strong className="text-2xl font-black text-slate-900 dark:text-white">{formatINR(fees.tuition)}</strong>
              </div>
              <div className="text-indigo-600 dark:text-indigo-400 font-bold text-sm text-center">
                × {TNC_CONFIG.admissionFeePercent}% Onboarding Rate =
              </div>
              <div className="sm:text-right">
                <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 block">Parents Onboarding Fee</span>
                <strong className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatINR(fees.admissionFee)}</strong>
              </div>
            </div>

            {/* ── PAYMENT TIMELINE — THE KEY UX ELEMENT ── */}
            <PaymentTimeline fees={fees} />

            {/* Itemized breakdown */}
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">
                What The {formatINR(fees.admissionFee)} Parents Onboarding Fee Covers:
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FEE_BREAKDOWN.map((item) => {
                  const amount = Math.round((fees.admissionFee * item.pct) / 100);
                  return (
                    <div key={item.label} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black text-[10px] px-2 py-0.5 rounded-md">
                          {item.pct}%
                        </span>
                        <div>
                          <strong className="text-slate-800 dark:text-white font-bold block">{item.label}</strong>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{item.desc}</span>
                        </div>
                      </div>
                      <strong className="text-slate-900 dark:text-white font-black shrink-0">{formatINR(amount)}</strong>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* SECTION 3: TUTOR REPLACEMENT & CLASS COMPENSATION */}
          {/* ─────────────────────────────────────────────────────────────── */}
          <section id="sec-policies" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2.5 text-teal-600 dark:text-teal-400 border-b border-teal-100 dark:border-teal-900/40 pb-3">
              <RefreshCw className="h-5 w-5 shrink-0" />
              <h2 className="text-base font-black uppercase tracking-wider text-slate-900 dark:text-white">
                3. Tutor Replacement &amp; Class Compensation
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <RefreshCw className="h-4 w-4" />
                  <strong className="text-xs font-black uppercase text-slate-900 dark:text-white">72-Hour Max Replacement</strong>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-semibold">
                  If any genuine academic concern arises, Saraswati Tutorials commits to assigning a qualified replacement tutor within <strong>{TNC_CONFIG.replacementTimelineHours} hours</strong>.
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  If we fail to provide a replacement, the {TNC_CONFIG.backupReplacementPercent}% backup component ({formatINR(fees.backupComponent)}) is fully refundable.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <BadgeCheck className="h-4 w-4" />
                  <strong className="text-xs font-black uppercase text-slate-900 dark:text-white">Class Compensation</strong>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-semibold">
                  Missed classes are eligible for full makeup/compensation sessions provided parents inform the institute at least <strong>{TNC_CONFIG.classCompensationNoticeHours} hours</strong> in advance.
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tutor reservation after demo requires confirmation within {TNC_CONFIG.tutorReservationHours} hours.
                </p>
              </div>
            </div>
          </section>

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* SECTION 4: HIRING POLICY & NOTICE PERIOD */}
          {/* ─────────────────────────────────────────────────────────────── */}
          <section id="sec-terms" className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400 border-b border-slate-100 dark:border-slate-800 pb-3">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h2 className="text-base font-black uppercase tracking-wider text-slate-900 dark:text-white">
                4. Bypass Policy and Notice Period
              </h2>
            </div>

            {/* Bypass Penalty Box */}
            <div className="bg-rose-50/70 dark:bg-rose-955/30 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-5 space-y-3">
              <strong className="text-xs font-black uppercase text-rose-900 dark:text-rose-300 block">
                No Direct Off-Platform Hiring
              </strong>
              <p className="text-xs text-rose-800 dark:text-rose-300 font-medium leading-relaxed">
                Parents are strictly prohibited from hiring or paying assigned home tutors directly outside Saraswati Tutorials without written confirmation.
              </p>

              <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-rose-200 dark:border-rose-900/40 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-rose-500 block">Bypass Penalty Rate</span>
                  <strong className="text-xs font-black text-rose-700 dark:text-rose-300">Equivalent to {TNC_CONFIG.bypassPenaltyMonths} Months' Tuition Fee</strong>
                </div>
                <strong className="text-lg font-black text-rose-600 dark:text-rose-400">{formatINR(fees.bypassPenalty)}</strong>
              </div>
            </div>

            {/* Notice Period & Validity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] font-extrabold uppercase text-blue-500 dark:text-blue-400 block">Notice Period</span>
                <strong className="text-blue-900 dark:text-blue-200 font-black">{TNC_CONFIG.noticePeriodDays} Days' Advance Notice Required</strong>
                <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">15 days advance notice required for replacement and termination of service.</p>
              </div>
              <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] font-extrabold uppercase text-emerald-500 dark:text-emerald-400 block">Service Validity</span>
                <strong className="text-emerald-900 dark:text-emerald-200 font-black">{TNC_CONFIG.academicYearValidity}</strong>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">Onboarding agreement remains active throughout the ongoing academic session, until the student promotes to next grade.</p>
              </div>
            </div>
          </section>

          {/* ─────────────────────────────────────────────────────────────── */}
          {/* SECTION 5: SIGN & ACCEPT */}
          {/* ─────────────────────────────────────────────────────────────── */}
          <section id="sec-sign" ref={acceptRef} className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-indigo-200 dark:border-indigo-800 shadow-xl p-6 space-y-5">
            <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-black uppercase tracking-widest text-slate-900 dark:text-white">
                  5. Sign & Accept
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Enter your name to digitally sign and confirm your acceptance.</p>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
                Official Consent
              </span>
            </div>

            {/* Name Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Full Name —{" "}
                <span className="text-indigo-600 dark:text-indigo-400 font-black">NAME AS PER DOCUMENTATION</span>{" "}
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Enter your name exactly as on your ID (e.g. Ramesh Sharma)"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:font-medium"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium pl-1">
                Please enter your name exactly as it appears on your official ID or student documents.
              </p>
            </div>

            {/* Checkbox Clause */}
            <div className="flex items-start gap-3 select-none">
              <div
                onClick={() => setAgreedToTerms((v) => !v)}
                role="checkbox"
                aria-checked={agreedToTerms}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); setAgreedToTerms((v) => !v); } }}
                className={`mt-0.5 h-5 w-5 shrink-0 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer ${
                  agreedToTerms
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                }`}
              >
                {agreedToTerms && <Check className="h-3.5 w-3.5 text-white" />}
              </div>
              <span
                onClick={() => setAgreedToTerms((v) => !v)}
                className="text-xs text-slate-700 dark:text-slate-300 font-semibold leading-relaxed cursor-pointer"
              >
                I, <strong className="text-slate-900 dark:text-white underline">{fullName.trim() || "___________"}</strong>, have read and agree to all the Terms &amp; Conditions outlined above for <strong>Saraswati Tutorials</strong> home tutoring services.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                id="tnc-accept-btn"
                onClick={handleAcceptClick}
                disabled={!fullName.trim() || !agreedToTerms || flow === "submitting"}
                className={`flex-1 flex items-center justify-center gap-2 rounded-2xl font-black text-xs uppercase tracking-wider py-3.5 transition-all shadow-md ${
                  !fullName.trim() || !agreedToTerms || flow === "submitting"
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 cursor-pointer active:scale-[0.99]"
                }`}
              >
                {flow === "submitting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Accept Terms & Conditions
              </button>
              <button
                id="tnc-decline-btn"
                onClick={handleDeclineClick}
                disabled={flow === "submitting"}
                className="px-6 py-3.5 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-955/30 text-rose-600 dark:text-rose-400 font-black text-xs uppercase tracking-wider hover:bg-rose-100 dark:hover:bg-rose-950/50 transition cursor-pointer"
              >
                Decline
              </button>
            </div>

            {/* WhatsApp Clarification Option */}
            <div className="text-center pt-1 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={openClarificationWhatsApp}
                className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition cursor-pointer"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                Need clarification before signing? Contact us on WhatsApp
              </button>
            </div>
          </section>

          {/* Footer */}
          <footer className="text-center text-[10px] text-slate-400 dark:text-slate-500 pt-4 font-semibold">
            © {new Date().getFullYear()} Saraswati Tutorials. Effective Date: April 2026 | Terms Version: {TNC_CONFIG.termsVersion}
          </footer>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PREVIEW MODAL — shown after clicking Accept
// ─────────────────────────────────────────────────────────────────────────────
function PreviewModal({ fees, fullName, onConfirm, onBack, submitting }) {
  const cfg = TNC_CONFIG;
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Final Onboarding Review</span>
            <h3 className="text-sm font-black text-slate-900 dark:text-white mt-0.5">Confirm Your Acceptance</h3>
          </div>
          <button onClick={onBack} className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer">
            <XIcon className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3 text-xs font-medium">
          <Row label="NAME AS PER DOCUMENTATION" value={fullName} accent />
          <Row label="Monthly Tuition Fee" value={formatINR(fees.tuition)} />
          <Row label="Parents Onboarding Fee" value={`${cfg.admissionFeePercent}% — ${formatINR(fees.admissionFee)}`} accent />
          <Row label="Demo Sessions" value={`1st Demo FREE (₹0), 2nd Demo onwards ₹${cfg.additionalDemoFeeRs} per class, where applicable`} />
          <Row label="Tutor Replacement" value={`Within ${cfg.replacementTimelineHours} hours`} />
          <Row label="Class Compensation" value={`With ${cfg.classCompensationNoticeHours}h advance notice`} />
          <Row label="Payment Schedule" value="Month 1: Onboarding Fee Only · Month 2: Tuition Fee" />
          <Row label="Bypass Penalty" value={`${cfg.bypassPenaltyMonths} Months' Tuition`} warn />
          <Row label="Notice Period" value={`${cfg.noticePeriodDays} Days`} />

          {/* Acceptance message preview */}
          <div className="mt-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-4 py-3">
            <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 mb-1">WhatsApp Message on Confirm:</p>
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 italic">
              "I agree with your Terms & Conditions, please schedule a demo."
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex gap-3 shrink-0 bg-slate-50 dark:bg-slate-950">
          <button
            onClick={onBack}
            disabled={submitting}
            className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Go Back
          </button>
          <button
            id="tnc-confirm-btn"
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-600/20 transition active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            Confirm & Accept
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, accent, warn }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
      <span className="text-slate-500 dark:text-slate-400 font-semibold shrink-0">{label}</span>
      <span className={`font-bold text-right ${warn ? "text-rose-600 dark:text-rose-400 font-black" : accent ? "text-emerald-600 dark:text-emerald-400 font-black" : "text-slate-900 dark:text-white"}`}>
        {value}
      </span>
    </div>
  );
}
