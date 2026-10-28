import { useEffect, useState } from "react";
import { API_BASE } from "../config";
import "@fontsource-variable/inter";
import {
  Phone,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Target,
  Hourglass,
  FileDown,
  FileText,
  LogOut,
  Loader2,
  GraduationCap,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import PortalShell, { headerIconButton } from "../components/portal/PortalShell";
import PortalLogin from "../components/portal/PortalLogin";
import {
  cardClass,
  formatDay,
  monthName,
  StatTile,
  ProgressRing,
  StatusPill,
  ClassHistory,
  EmptyState,
} from "../components/portal/PortalParts";
import { formatHours } from "../utils/classTime";
import { downloadAttendanceReport } from "../utils/attendanceReport";

// Keeps the parent signed in across a refresh of this tab
const SESSION_KEY = "parentPortalPhone";

const LOGIN_FEATURES = [
  "See every class your child attended, with the topics covered",
  "Know about missed classes and the reason straight away",
  "Download the monthly attendance report as a PDF",
];

const hasTutor = (item) => Boolean(item.card.assignedTutorId) || (item.card.tutorName && item.card.tutorName !== "Not Assigned");

function readSavedPhone() {
  try {
    return sessionStorage.getItem(SESSION_KEY) || "";
  } catch {
    return "";
  }
}

export default function ParentPortal() {
  const [phone, setPhone] = useState(readSavedPhone);
  const [loading, setLoading] = useState(() => Boolean(readSavedPhone()));
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  async function signIn(number) {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/attendance/parent-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: number }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "We couldn't find any records for this number.");
        try { sessionStorage.removeItem(SESSION_KEY); } catch {}
        return;
      }
      setResults(data.results);
      const first = data.results.find(hasTutor) || data.results[0];
      setSelectedId(first?.card._id || null);
      try { sessionStorage.setItem(SESSION_KEY, number); } catch {}
    } catch {
      setError("We couldn't reach the server. Check your internet connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // Signed in earlier in this tab: load their records again
  useEffect(() => {
    const saved = readSavedPhone();
    if (saved) signIn(saved);
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    if (phone.replace(/\D/g, "").length < 10) {
      setError("Enter the full 10-digit number you registered with.");
      return;
    }
    signIn(phone.trim());
  }

  function signOut() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
    setResults(null);
    setSelectedId(null);
    setPhone("");
    setError("");
  }

  if (!results) {
    return (
      <PortalLogin
        portal="Parent Portal"
        headline="Follow your child's learning, class by class."
        features={LOGIN_FEATURES}
        title="Parent sign in"
        subtitle="Enter the mobile number you used when you booked tuition with us."
        footer={
          <div className="space-y-2">
            <p>
              New to Saraswati Tutorials?{" "}
              <a href="/parent-enquiry" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Book a free demo</a>
            </p>
            <p>
              Are you a tutor?{" "}
              <a href="/teacher/login" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Tutor sign in</a>
            </p>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="parent-phone" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
              Mobile number
            </label>
            <div className="flex h-12 items-center rounded-xl border border-slate-300 bg-white transition focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-900">
              <span className="flex h-full items-center gap-1.5 border-r border-slate-200 px-3 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <Phone className="h-4 w-4" /> +91
              </span>
              <input
                id="parent-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (error) setError("");
                }}
                className="h-full min-w-0 flex-1 bg-transparent px-3 text-base font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {loading ? "Finding your records..." : "View my child's progress"}
          </button>
        </form>
      </PortalLogin>
    );
  }

  const tuitions = results.filter(hasTutor);
  const pending = results.filter((item) => !hasTutor(item));
  const selected = tuitions.find((item) => item.card._id === selectedId) || tuitions[0];
  const parentName = results.find((item) => item.parentName)?.parentName || "";
  const digits = phone.replace(/\D/g, "").slice(-10);

  return (
    <PortalShell
      portal="Parent Portal"
      actions={
        <button type="button" onClick={signOut} className={`${headerIconButton} sm:w-auto sm:gap-2 sm:px-4`} aria-label="Sign out" title="Sign out">
          <LogOut className="h-4 w-4" />
          <span className="hidden text-sm font-semibold sm:inline">Sign out</span>
        </button>
      }
    >
      <div className="animate-fadeIn space-y-6">
        <section>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Welcome back</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {parentName ? `Hello, ${parentName}` : "Hello"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Signed in with +91 {digits.slice(0, 5)} {digits.slice(5)}
          </p>
        </section>

        {tuitions.length > 1 && (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none" role="tablist" aria-label="Choose a student">
            {tuitions.map(({ card }) => {
              const active = card._id === selected?.card._id;
              return (
                <button
                  key={card._id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedId(card._id)}
                  className={`shrink-0 rounded-2xl border px-4 py-2.5 text-left transition cursor-pointer ${
                    active
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                  }`}
                >
                  <span className="block text-sm font-semibold">{card.studentName}</span>
                  <span className={`block text-xs ${active ? "text-indigo-100" : "text-slate-500 dark:text-slate-400"}`}>
                    with {card.tutorName}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {selected ? (
          <TuitionView key={selected.card._id} item={selected} />
        ) : (
          <EmptyState
            icon={GraduationCap}
            title="Classes haven't started yet"
            text="We're arranging the right tutor for your child. Attendance will show here once classes begin."
          />
        )}

        {pending.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Enquiries in progress</h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Our team is finding a tutor for these.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {pending.map(({ card }) => (
                <div key={card._id} className={`${cardClass} flex items-center gap-3 p-4`}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{card.studentName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {card.requirementId} · {card.leadStatus || "Tutor being assigned"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </PortalShell>
  );
}

function TuitionView({ item }) {
  const { card, logs } = item;
  const currentCycle = card.currentPackageCycle || 1;
  const [month, setMonth] = useState(currentCycle);
  const [downloading, setDownloading] = useState(false);
  const hoursThisMonth = card.cycles?.find((c) => c.cycleNumber === currentCycle)?.doneMinutes;

  async function downloadPdf() {
    setDownloading(true);
    try {
      await downloadAttendanceReport(card, logs);
    } catch (err) {
      console.error(err);
      alert("Couldn't create the PDF report. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className={`${cardClass} overflow-hidden`}>
        <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                {card.requirementId}
              </span>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                {monthName(card.currentMonthLabel, currentCycle)} in progress
              </span>
            </div>
            <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">{card.studentName}</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                  {card.tutorName.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Tutor</dt>
                  <dd className="truncate font-semibold text-slate-800 dark:text-slate-100">{card.tutorName}</dd>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <Calendar className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Schedule</dt>
                  <dd className="font-semibold text-slate-800 dark:text-slate-100">{card.classSchedule}</dd>
                </div>
              </div>
            </dl>
          </div>

          <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/50 sm:flex-col sm:gap-2 sm:bg-transparent sm:p-0 sm:text-center dark:sm:bg-transparent">
            <ProgressRing done={card.completedClasses} total={card.totalClasses} />
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">This month</p>
              {card.cycleDateRange && <p className="text-xs text-slate-500 dark:text-slate-400">{card.cycleDateRange}</p>}
            </div>
          </div>
        </div>

        {card.latestLogDate && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/40 sm:px-6">
            <span className="text-slate-500 dark:text-slate-400">Last class</span>
            <span className="font-semibold text-slate-800 dark:text-slate-100">{formatDay(card.latestLogDate)}</span>
            <StatusPill status={card.currentAttendanceStatus} />
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Completed" value={card.completedClasses} tone="emerald" icon={CheckCircle2} hint="this month" />
        <StatTile label="Missed" value={card.missedClasses} tone="rose" icon={XCircle} hint="this month" />
        <StatTile label="Remaining" value={card.remainingClasses} tone="indigo" icon={Target} hint={`of ${card.totalClasses} classes`} />
        <StatTile label="Hours taught" value={formatHours(hoursThisMonth) || "0 hrs"} icon={Hourglass} hint="this month" />
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Class history</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Every class marked by the tutor, newest first.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={downloadPdf}
              disabled={downloading}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 sm:flex-none cursor-pointer"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {downloading ? "Preparing..." : "PDF report"}
            </button>
            <a
              href={`${API_BASE}/attendance/download-history/${card._id}?cycle=all`}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:flex-none"
            >
              <FileDown className="h-4 w-4" /> Excel (CSV)
            </a>
          </div>
        </div>

        <ClassHistory
          logs={logs}
          cycles={card.cycles || []}
          currentCycle={currentCycle}
          selected={month}
          onSelect={setMonth}
          showTutor
        />
      </section>

      {card.classDuration && card.classDuration !== "Not provided" && (
        <p className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
          <Clock className="h-3.5 w-3.5" /> Planned class length: {card.classDuration}
        </p>
      )}
    </div>
  );
}
