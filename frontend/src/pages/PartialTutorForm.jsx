import { useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  User,
  Phone,
  School,
  GraduationCap,
  BookOpen,
  Laptop,
  Briefcase,
  Ellipsis,
  CheckCircle2,
  Check,
  Loader2,
  MapPinned,
  ShieldCheck,
  Clock3,
  Lock,
  ArrowRight,
} from "lucide-react";

import { API_BASE } from "../config";
import { LocationField } from "../components/LocationPicker";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";

// Same choices the admin sees on the full tutor registration
const experienceOptions = [
  "0 year", "1 year", "2 year", "3 year", "4 year", "5 year",
  "5+ years", "10+ years", "15+ years", "20+ years", "25+ years", "30+ years",
];

const occupationOptions = [
  { value: "School Teacher", icon: School },
  { value: "College Lecturer", icon: GraduationCap },
  { value: "Student", icon: BookOpen },
  { value: "Freelancer", icon: Laptop },
  { value: "Working Professional", icon: Briefcase },
  { value: "Other", icon: Ellipsis },
];

const benefits = [
  { icon: Clock3, title: "Takes about a minute", text: "Just the basics today. We help you finish the rest." },
  { icon: MapPinned, title: "Matched by your area", text: "We send you families who live close to you." },
  { icon: ShieldCheck, title: "Your details stay private", text: "Seen only by the Saraswati Tutorials team." },
];

// Photo from Unsplash (free to use)
const HERO_PHOTO = "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1100&q=80";

// This page has its own type: Plus Jakarta Sans for text, Fraunces for the large headings
const BODY_FONT = { fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif" };
const DISPLAY_FONT = { fontFamily: "'Fraunces', Georgia, serif" };

const initialForm = {
  name: "",
  whatsapp: "",
  experience: "",
  occupation: "",
  location: null,
};

const validate = (form) => {
  const errors = {};
  if (form.name.trim().length < 3) errors.name = "Name must be at least 3 characters";
  if (!/^\d{10}$/.test(form.whatsapp)) errors.whatsapp = "Enter a valid 10-digit WhatsApp number";
  if (!form.experience) errors.experience = "Select your experience";
  if (!form.occupation) errors.occupation = "Select your occupation";
  if (form.location?.latitude == null || form.location?.longitude == null) {
    errors.location = "Add your location on the map";
  } else if (form.location.houseDetails.trim().length < 3) {
    errors.location = "Enter house, flat, or building details";
  }
  return errors;
};

function FieldLabel({ htmlFor, step, children, hint }) {
  return (
    <div className="mb-2.5 flex items-end justify-between gap-3">
      <label htmlFor={htmlFor} className="flex items-center gap-2.5 text-sm font-bold text-slate-800 dark:text-slate-100">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-[11px] font-extrabold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
          {step}
        </span>
        {children}
        <span className="text-rose-500">*</span>
      </label>
      {hint && <span className="hidden text-xs font-medium text-slate-400 sm:inline">{hint}</span>}
    </div>
  );
}

function FieldError({ children }) {
  if (!children) return null;
  return <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">{children}</p>;
}

function BenefitList() {
  return (
    <ul className="space-y-4">
      {benefits.map(({ icon: Icon, title, text }) => (
        <li key={title} className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-200/70 dark:bg-white/5 dark:text-blue-400 dark:ring-white/10">
            <Icon className="h-5 w-5" />
          </span>
          <span className="pt-0.5">
            <span className="block text-sm font-bold text-slate-900 dark:text-white">{title}</span>
            <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">{text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function PartialTutorForm() {
  const selectedCity = localStorage.getItem("userLocation") === "Mumbai" ? "Mumbai" : "Bangalore";

  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [done, setDone] = useState(false);

  const completed = [
    form.name.trim().length >= 3,
    /^\d{10}$/.test(form.whatsapp),
    Boolean(form.experience),
    Boolean(form.occupation),
    form.location?.latitude != null && form.location?.houseDetails?.trim().length >= 3,
  ].filter(Boolean).length;

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setServerError("");
  };

  const handleLocation = (location) => {
    setForm((prev) => ({ ...prev, location: { ...location, houseDetails: location.houseDetails || "" } }));
    setErrors((prev) => ({ ...prev, location: "" }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setServerError("");
    try {
      await axios.post(`${API_BASE}/partial-tutors`, {
        name: form.name.trim(),
        whatsapp: form.whatsapp,
        experience: form.experience,
        occupation: form.occupation,
        location: form.location,
      });
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setServerError(err.response?.data?.message || "Could not send your details. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputShell = (error) =>
    `flex h-14 items-center gap-3 rounded-2xl border bg-slate-50/70 px-4 transition focus-within:bg-white focus-within:ring-4 dark:bg-slate-950/50 dark:focus-within:bg-slate-950/80 ${
      error
        ? "border-rose-300 focus-within:border-rose-400 focus-within:ring-rose-100 dark:border-rose-500/50 dark:focus-within:ring-rose-500/20"
        : "border-slate-200 hover:border-slate-300 focus-within:border-blue-500 focus-within:ring-blue-100 dark:border-white/10 dark:hover:border-white/20 dark:focus-within:border-blue-400 dark:focus-within:ring-blue-500/20"
    }`;

  const inputText =
    "h-full w-full bg-transparent text-[15px] font-semibold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400 dark:text-white";

  const chip = (selected) =>
    `relative whitespace-nowrap rounded-xl border px-1.5 py-2.5 text-[13px] font-semibold transition sm:px-3 sm:text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 dark:focus-visible:ring-blue-500/30 ${
      selected
        ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/20"
        : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/50 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-blue-400/50 dark:hover:bg-blue-500/10 dark:hover:text-white"
    }`;

  return (
    <div style={BODY_FONT} className="flex min-h-screen flex-col bg-[#f5f7fb] text-slate-800 antialiased dark:bg-[#0b1120] dark:text-slate-100">
      <Helmet>
        <title>Partial Verification | Saraswati Tutorials</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,700;1,9..144,600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        />
      </Helmet>

      {/* Soft brand glow behind the top of the page */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_60%_at_15%_0%,rgba(37,99,235,0.12),transparent),radial-gradient(50%_50%_at_90%_10%,rgba(16,185,129,0.10),transparent)] dark:opacity-70" />

      <div className="relative">
        <SiteHeader city={selectedCity} sticky={false} audience="tutor" />
      </div>

      <main data-own-colors className="relative mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-6 sm:px-6 md:pt-10">
        {done ? (
          <div className="mx-auto max-w-lg overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-200/60 ring-1 ring-slate-200/70 dark:bg-slate-900/60 dark:shadow-2xl dark:shadow-black/40 dark:ring-white/10 dark:backdrop-blur-xl">
            <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500" />
            <div className="p-8 text-center sm:p-12">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/50 dark:bg-emerald-500/15 dark:ring-emerald-500/10">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h1 style={DISPLAY_FONT} className="text-3xl font-semibold text-slate-900 dark:text-white">
                Thank you, {form.name.trim().split(" ")[0]}
              </h1>
              <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">
                We have your details. Our team will message you on WhatsApp at{" "}
                <span className="font-bold text-slate-800 dark:text-slate-200">+91 {form.whatsapp}</span> to complete
                your tutor profile.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link
                  to="/"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:from-blue-700 hover:to-indigo-700"
                >
                  Back to home
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setForm(initialForm);
                    setDone(false);
                  }}
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  Submit another
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-12">
            {/* Intro. On phones only the heading shows above the form; the rest moves below it. */}
            <section className="lg:sticky lg:top-8 lg:self-start">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-blue-700 shadow-sm ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30">
                <ShieldCheck className="h-3.5 w-3.5" />
                Tutor partial verification
              </span>
              <h1
                style={DISPLAY_FONT}
                className="mt-5 text-[2.5rem] font-semibold leading-[1.08] tracking-tight text-slate-900 dark:text-white sm:text-5xl"
              >
                Teach students <span className="italic text-blue-600 dark:text-blue-400">near you</span>
              </h1>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base">
                Share five quick details. We match you with families in your area, then call you to finish your profile.
              </p>

              <div className="mt-8 hidden lg:block">
                <div className="relative overflow-hidden rounded-3xl shadow-xl shadow-slate-300/40 dark:shadow-black/40 dark:ring-1 dark:ring-white/10">
                  <img
                    src={HERO_PHOTO}
                    alt="A teacher with students in a classroom"
                    className="h-64 w-full object-cover"
                    loading="eager"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" />
                  <p className="absolute bottom-5 left-5 right-5 text-sm font-semibold text-white/90">
                    School teachers, lecturers, students and working professionals all teach with us.
                  </p>
                </div>
                <div className="mt-8">
                  <BenefitList />
                </div>
              </div>
            </section>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              noValidate
              className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-200/60 ring-1 ring-slate-200/70 dark:bg-slate-900/60 dark:shadow-2xl dark:shadow-black/40 dark:ring-white/10 dark:backdrop-blur-xl"
            >
              <div className="border-b border-slate-100 px-5 py-5 dark:border-white/10 sm:px-8 sm:py-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 style={DISPLAY_FONT} className="text-2xl font-semibold text-slate-900 dark:text-white">
                      Your details
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">All fields are required.</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-white/5 dark:text-slate-300 dark:ring-1 dark:ring-white/10">
                    {completed} of 5
                  </span>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-500"
                    style={{ width: `${(completed / 5) * 100}%` }}
                  />
                </div>
              </div>

              <div className="space-y-7 px-5 py-6 sm:px-8 sm:py-8">
                <div>
                  <FieldLabel htmlFor="pt-name" step={1}>Full name</FieldLabel>
                  <div className={inputShell(errors.name)}>
                    <User className="h-5 w-5 shrink-0 text-slate-400" />
                    <input
                      id="pt-name"
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      placeholder="e.g. Priya Sharma"
                      autoComplete="name"
                      className={inputText}
                    />
                  </div>
                  <FieldError>{errors.name}</FieldError>
                </div>

                <div>
                  <FieldLabel htmlFor="pt-whatsapp" step={2} hint="We'll message you here">
                    WhatsApp number
                  </FieldLabel>
                  <div className={inputShell(errors.whatsapp)}>
                    <Phone className="h-5 w-5 shrink-0 text-slate-400" />
                    <span className="border-r border-slate-200 pr-3 text-[15px] font-bold text-slate-500 dark:border-white/10 dark:text-slate-400">
                      +91
                    </span>
                    <input
                      id="pt-whatsapp"
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={form.whatsapp}
                      onChange={(e) => setField("whatsapp", e.target.value.replace(/\D/g, ""))}
                      placeholder="10-digit number"
                      autoComplete="tel-national"
                      className={`${inputText} tracking-wide`}
                    />
                  </div>
                  <FieldError>{errors.whatsapp}</FieldError>
                </div>

                <div role="group" aria-labelledby="pt-experience-label">
                  <FieldLabel step={3}>
                    <span id="pt-experience-label">Teaching experience</span>
                  </FieldLabel>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {experienceOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={form.experience === option}
                        onClick={() => setField("experience", option)}
                        className={chip(form.experience === option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  <FieldError>{errors.experience}</FieldError>
                </div>

                <div role="group" aria-labelledby="pt-occupation-label">
                  <FieldLabel step={4}>
                    <span id="pt-occupation-label">Current occupation</span>
                  </FieldLabel>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {occupationOptions.map(({ value, icon: Icon }) => {
                      const selected = form.occupation === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setField("occupation", value)}
                          className={`relative flex flex-col items-start gap-2.5 rounded-2xl border p-3.5 text-left transition focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 dark:focus-visible:ring-blue-500/30 ${
                            selected
                              ? "border-blue-600 bg-blue-50/70 ring-1 ring-blue-600 dark:border-blue-500 dark:bg-blue-500/10 dark:ring-blue-500"
                              : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-blue-400/50 dark:hover:bg-blue-500/10"
                          }`}
                        >
                          <span
                            className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                              selected
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300"
                            }`}
                          >
                            <Icon className="h-[18px] w-[18px]" />
                          </span>
                          <span className="text-sm font-bold leading-snug text-slate-800 dark:text-slate-100">{value}</span>
                          {selected && (
                            <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                              <Check className="h-3 w-3" strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <FieldError>{errors.occupation}</FieldError>
                </div>

                <div>
                  <FieldLabel step={5}>Where you can teach</FieldLabel>
                  {/* LocationField's own label is hidden: the numbered label above replaces it */}
                  <div className="[&>div>label:first-child]:hidden dark:[&>div>button]:border-white/10 dark:[&>div>button]:bg-slate-950/50 dark:[&>div>button:hover]:bg-slate-950/80 dark:[&>div>p]:text-rose-400">
                    <LocationField
                      label=""
                      biasCity={form.location?.city || selectedCity}
                      error={errors.location}
                      emptyText="Pin your area on the map"
                      value={form.location}
                      onChange={handleLocation}
                    />
                  </div>
                </div>

                {serverError && (
                  <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                    {serverError}
                  </p>
                )}

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="group flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-base font-bold text-white shadow-lg shadow-blue-600/25 transition hover:from-blue-700 hover:to-indigo-700 hover:shadow-blue-600/35 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 dark:shadow-blue-950/60 dark:focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        Submit my details
                        <ArrowRight className="h-5 w-5 transition group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>
                  <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">
                    <Lock className="h-3.5 w-3.5" />
                    Your details are only shared with our team
                  </p>
                </div>
              </div>
            </form>

            {/* Phones: the reasons to join come after the form */}
            <section className="lg:hidden">
              <BenefitList />
            </section>
          </div>
        )}
      </main>

      <SiteFooter city={selectedCity} audience="tutor" />
    </div>
  );
}
