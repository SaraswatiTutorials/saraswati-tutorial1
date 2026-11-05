import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Calendar,
  CalendarCheck,
  Check,
  CheckCircle2,
  Circle,
  CircleDot,
  Clock,
  FileText,
  Info,
  LayoutDashboard,
  MessageSquareQuote,
  PenLine,
  Phone,
  Star,
  Target,
  TrendingUp,
  X,
  XCircle,
} from "lucide-react";
import "@fontsource-variable/plus-jakarta-sans";
import BrandLogo from "../components/BrandLogo";
import ThemeToggle from "../components/ThemeToggle";
import PortalLogin from "../components/portal/PortalLogin";
import { headerIconButton } from "../components/portal/PortalShell";
import { SAMPLE_PLAN, SAMPLE_SUBJECTS, SAMPLE_TUTOR, buildSample, formatShortDate } from "../data/parentDashboardSample";

// Public preview of the parent dashboard: the visitor's names on sample data. A name proves
// nothing about who is asking, so real records stay behind the phone sign-in at /parent/login.
// The names stay in this browser tab and are never sent to the server.
const NAMES_KEY = "parentDashboardPreviewNames";
const MAX_NAME_LENGTH = 60;

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "progress", label: "Progress", icon: BarChart3 },
  { id: "homework", label: "Homework", icon: FileText },
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const card = "rounded-3xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none";

function readSavedNames() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(NAMES_KEY) || "null");
    return typeof saved?.parentName === "string" && typeof saved?.studentName === "string" ? saved : null;
  } catch {
    return null;
  }
}

function saveNames(names) {
  try {
    sessionStorage.setItem(NAMES_KEY, JSON.stringify(names));
  } catch {
    // Private browsing can block storage; the preview still works until a refresh
  }
}

const firstNameOf = (name) => name.trim().split(/\s+/)[0];

function initialsOf(name) {
  const words = name.trim().split(/\s+/);
  const letters = [words[0], words.length > 1 ? words.at(-1) : ""].map((word) => Array.from(word)[0] || "");
  return letters.join("").toUpperCase() || "?";
}

function nameProblem(value, label) {
  const name = value.trim();
  if (!name) return `Enter the ${label} name.`;
  if (name.length < 2 || !/\p{L}/u.test(name)) return `Enter a valid ${label} name.`;
  return "";
}

function greetingFor(hour) {
  if (hour < 12) return "Good morning";
  return hour < 17 ? "Good afternoon" : "Good evening";
}

// ── Name form ────────────────────────────────────────────────────────────────

function NameField({ id, label, value, onChange, error, placeholder, autoComplete }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</label>
      <input
        id={id}
        type="text"
        value={value}
        maxLength={MAX_NAME_LENGTH}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`h-12 w-full rounded-xl border bg-white px-3.5 text-base font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 dark:bg-slate-900 dark:text-white ${
          error
            ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/15"
            : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/15 dark:border-slate-700"
        }`}
      />
      {error && <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}

function NameForm({ initial, onOpen }) {
  const [parentName, setParentName] = useState(initial?.parentName || "");
  const [studentName, setStudentName] = useState(initial?.studentName || "");
  const [errors, setErrors] = useState({});

  const submit = (e) => {
    e.preventDefault();
    const found = { parent: nameProblem(parentName, "parent"), student: nameProblem(studentName, "student") };
    setErrors(found);
    if (!found.parent && !found.student) onOpen({ parentName: parentName.trim(), studentName: studentName.trim() });
  };

  return (
    <div className="plan-font">
      <PortalLogin
        portal="Parent Dashboard"
        headline="See your child's learning, all in one place."
        features={[
          "Attendance for every class, with the topics covered",
          "Subject progress and test scores, month by month",
          "Homework and remarks straight from the tutor",
        ]}
        title="Open the parent dashboard"
        subtitle="Add your names to see how it will look for your family. This preview uses sample data."
        footer={
          <div className="space-y-2">
            <p>
              Already enrolled?{" "}
              <Link to="/parent/login" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Sign in for your child's real records</Link>
            </p>
            <p>
              New to Saraswati Tutorials?{" "}
              <Link to="/parent-enquiry" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Book a free demo</Link>
            </p>
          </div>
        }
      >
        <form onSubmit={submit} noValidate className="space-y-4">
          <NameField
            id="preview-parent-name"
            label="Parent name"
            placeholder="e.g. Meera Sharma"
            autoComplete="name"
            value={parentName}
            error={errors.parent}
            onChange={(value) => { setParentName(value); setErrors((prev) => ({ ...prev, parent: "" })); }}
          />
          <NameField
            id="preview-student-name"
            label="Student name"
            placeholder="e.g. Aarav Sharma"
            autoComplete="off"
            value={studentName}
            error={errors.student}
            onChange={(value) => { setStudentName(value); setErrors((prev) => ({ ...prev, student: "" })); }}
          />
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 cursor-pointer"
          >
            Open dashboard
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="text-center text-xs text-slate-500 dark:text-slate-400">Your names stay on this device and aren't saved by us.</p>
        </form>
      </PortalLogin>
    </div>
  );
}

// ── Shared pieces ────────────────────────────────────────────────────────────

function InitialsAvatar({ text, size = "h-11 w-11 text-sm", tone = "from-indigo-500 to-violet-600" }) {
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br font-bold text-white shadow-sm ${tone} ${size}`}>
      {text}
    </span>
  );
}

function SectionCard({ title, icon: Icon, aside, className = "", children }) {
  return (
    <section className={`${card} p-5 sm:p-6 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />}
          {title}
        </h2>
        {aside && <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

const STAT_TINTS = {
  good: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400",
  accent: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300",
  warning: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400",
  serious: "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400",
};

function StatTile({ label, value, detail, icon: Icon, tint = "accent" }) {
  return (
    <div className={`${card} p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${STAT_TINTS[tint]}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-1 text-[1.75rem] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

function Meter({ percent, label }) {
  return (
    <div role="img" aria-label={label} className="h-2 w-full overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-950/70">
      <div className="h-full rounded-full bg-indigo-600 transition-[width] duration-700 dark:bg-indigo-400" style={{ width: `${percent}%` }} />
    </div>
  );
}

function SampleNotice({ studentFirstName }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
      <p className="flex items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span><strong className="font-semibold">Sample data.</strong> {studentFirstName}'s real attendance, scores and remarks appear here once classes begin.</span>
      </p>
      <Link to="/parent-enquiry" className="shrink-0 pl-6 font-semibold underline underline-offset-2 hover:no-underline sm:pl-0">Book a free demo</Link>
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────

function HeroRing({ percent, done, total }) {
  const size = 128;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div role="img" aria-label={`${done} of ${total} classes completed`} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" stroke="rgba(255,255,255,0.14)" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          stroke="#FCD34D"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <span className="text-3xl font-bold leading-none">{percent}%</span>
        <span className="mt-1 text-xs font-medium text-indigo-100">{done} of {total}</span>
      </div>
    </div>
  );
}

function Hero({ names, sample, hour, studentFirstName }) {
  const { stats, nextClass } = sample;
  return (
    <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#1B2A6B] via-[#0F1A47] to-[#0B1229] p-5 text-white shadow-lg shadow-indigo-950/20 sm:p-7">
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-indigo-400/25 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-amber-300/10 blur-3xl" />

      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="break-words text-sm font-medium text-indigo-100">{greetingFor(hour)}, {names.parentName}</p>
          <h1 className="mt-1.5 break-words text-[1.75rem] font-bold leading-tight tracking-tight text-white sm:text-4xl">
            {names.studentName} is on track this month
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-indigo-100">
            {stats.completed} of {stats.total} classes done, {stats.attendancePercent}% attendance, and a new remark from {SAMPLE_TUTOR.name}.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[SAMPLE_PLAN.classLabel, SAMPLE_PLAN.board, SAMPLE_PLAN.title].map((chip) => (
              <span key={chip} className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white">{chip}</span>
            ))}
          </div>
        </div>
        <HeroRing percent={stats.progressPercent} done={stats.completed} total={stats.total} />
      </div>

      <div className="relative mt-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-300 text-slate-950">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-indigo-100">Next class</p>
            <p className="break-words text-sm font-semibold text-white sm:text-base">{nextClass.subject} with {SAMPLE_TUTOR.name}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="flex items-center gap-1.5 font-medium text-white">
            <Clock className="h-4 w-4 text-indigo-200" aria-hidden="true" />
            {nextClass.when}, {nextClass.time}
          </span>
          {nextClass.countdown && (
            <span className="rounded-full bg-amber-300 px-2.5 py-0.5 text-xs font-bold text-slate-950">{nextClass.countdown}</span>
          )}
        </div>
      </div>
    </section>
  );
}

function ThisWeek({ days }) {
  const statusStyle = {
    done: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    missed: "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
    upcoming: "bg-indigo-50 text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-100",
    none: "bg-slate-50 text-slate-400 dark:bg-slate-800/40 dark:text-slate-500",
  };
  const statusWord = { done: "Attended", missed: "Missed", upcoming: "Coming up", none: "No class" };
  const statusIcon = { done: Check, missed: X, upcoming: Clock };

  return (
    <SectionCard title="This week" icon={Calendar} aside="Mon to Fri, 5:00 PM">
      <ol className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {days.map((day) => {
          const Icon = statusIcon[day.status];
          return (
            <li
              key={day.key}
              aria-label={`${formatShortDate(day.date)}: ${statusWord[day.status]}${day.subject ? `, ${day.subject}` : ""}`}
              className={`flex min-w-0 flex-col items-center rounded-xl px-0.5 py-2.5 text-center sm:rounded-2xl sm:py-3 ${statusStyle[day.status]} ${day.isToday ? "ring-2 ring-indigo-600 dark:ring-indigo-400" : ""}`}
            >
              <span className="text-[11px] font-semibold sm:text-xs">{WEEKDAYS[(day.date.getDay() + 6) % 7]}</span>
              <span className="mt-0.5 text-base font-bold leading-tight sm:text-lg">{day.date.getDate()}</span>
              <span className="mt-1 flex h-4 items-center justify-center" aria-hidden="true">
                {Icon ? <Icon className="h-3.5 w-3.5" strokeWidth={2.5} /> : <span className="h-px w-3 bg-current opacity-40" />}
              </span>
              <span className="mt-1 hidden w-full truncate px-1 text-[11px] font-medium sm:block">{day.subject ? day.subject.slice(0, 7).replace("Mathema", "Maths") : "Free"}</span>
            </li>
          );
        })}
      </ol>
    </SectionCard>
  );
}

function TutorCard() {
  return (
    <SectionCard title="Assigned tutor">
      <div className="flex items-center gap-3.5">
        <InitialsAvatar text={SAMPLE_TUTOR.initials} size="h-14 w-14 text-lg" tone="from-fuchsia-500 to-pink-600" />
        <div className="min-w-0">
          <p className="break-words text-base font-bold text-slate-900 dark:text-white">{SAMPLE_TUTOR.name}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{SAMPLE_TUTOR.qualification}</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
          <dt className="text-xs text-slate-500 dark:text-slate-400">Rating</dt>
          <dd className="mt-0.5 flex items-center gap-1 font-bold text-slate-900 dark:text-white">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
            {SAMPLE_TUTOR.rating}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
          <dt className="text-xs text-slate-500 dark:text-slate-400">Experience</dt>
          <dd className="mt-0.5 font-bold text-slate-900 dark:text-white">8 years</dd>
        </div>
      </dl>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Contact shared after enrollment
      </p>
    </SectionCard>
  );
}

function RemarkCard({ remark }) {
  return (
    <figure className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/50">
      <blockquote className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{remark.text}</blockquote>
      <figcaption className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{SAMPLE_TUTOR.name}, {remark.date}</figcaption>
    </figure>
  );
}

function Overview({ sample, remarks, goTo }) {
  const { stats, homework, thisWeek } = sample;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Attendance" value={`${stats.attendancePercent}%`} detail={`${stats.missed} class missed`} icon={CalendarCheck} tint="good" />
        <StatTile label="Classes left" value={stats.remaining} detail={`of ${stats.total} this month`} icon={Target} />
        <StatTile label="Homework" value={`${stats.homeworkDone}/${stats.homeworkTotal}`} detail={`${stats.homeworkTotal - stats.homeworkDone} still to do`} icon={PenLine} tint="warning" />
        <StatTile label="Average score" value={`${stats.averageScore}%`} detail={`+${stats.scoreChange} since the last test`} icon={TrendingUp} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <ThisWeek days={thisWeek} />

          <SectionCard title="Subject performance" icon={BarChart3} aside="Latest test score">
            <ul className="space-y-4">
              {SAMPLE_SUBJECTS.map((subject) => {
                const score = subject.tests.at(-1);
                return (
                  <li key={subject.name}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="min-w-0 text-sm font-semibold text-slate-800 dark:text-slate-100">{subject.name}</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{score}%</span>
                    </div>
                    <Meter percent={score} label={`${subject.name}: ${score}%`} />
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Now studying {subject.now}</p>
                  </li>
                );
              })}
            </ul>
            <button type="button" onClick={() => goTo("progress")} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400 cursor-pointer">
              See full progress
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </SectionCard>
        </div>

        <div className="space-y-5">
          <TutorCard />
          <SectionCard title="Latest remark" icon={MessageSquareQuote}>
            <RemarkCard remark={remarks[0]} />
          </SectionCard>
          <SectionCard title="Homework due" icon={PenLine}>
            <ul className="space-y-3">
              {homework.toDo.map((item) => (
                <li key={item.task} className="flex items-start gap-2.5">
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.task}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.subject} · Due {item.due}</p>
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

// ── Attendance ───────────────────────────────────────────────────────────────

const CALENDAR_STATES = {
  done: { label: "Attended", icon: Check, cell: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100" },
  missed: { label: "Missed", icon: X, cell: "bg-rose-100 text-rose-900 dark:bg-rose-900/50 dark:text-rose-100" },
  upcoming: { label: "Coming up", icon: Clock, cell: "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/50 dark:text-indigo-100" },
};

function AttendanceCalendar({ weeks }) {
  return (
    <SectionCard title="Class calendar" icon={Calendar}>
      <div className="grid grid-cols-7 gap-1 text-center sm:gap-1.5" role="presentation">
        {WEEKDAYS.map((day) => (
          <span key={day} className="pb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{day}</span>
        ))}
        {weeks.flat().map((day) => {
          const state = CALENDAR_STATES[day.status];
          const Icon = state?.icon;
          const description = `${formatShortDate(day.date)}: ${state ? `${state.label}, ${day.subject}` : "No class"}`;
          return (
            <div
              key={day.key}
              role="img"
              aria-label={description}
              title={description}
              className={`relative flex h-11 flex-col items-center justify-center rounded-lg text-sm font-semibold sm:h-14 sm:rounded-xl ${state ? state.cell : "text-slate-400 dark:text-slate-600"} ${day.isToday ? "ring-2 ring-indigo-600 ring-offset-1 ring-offset-white dark:ring-indigo-400 dark:ring-offset-slate-900" : ""}`}
            >
              <span className="leading-none">{day.date.getDate()}</span>
              {Icon && <Icon className="mt-0.5 h-3 w-3" strokeWidth={3} aria-hidden="true" />}
            </div>
          );
        })}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-slate-600 dark:text-slate-300">
        {Object.values(CALENDAR_STATES).map((state) => (
          <li key={state.label} className="flex items-center gap-1.5">
            <span className={`flex h-5 w-5 items-center justify-center rounded-md ${state.cell}`}>
              <state.icon className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
            </span>
            {state.label}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function ClassLog({ log }) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? log : log.slice(0, 6);
  return (
    <SectionCard title="Class history" icon={BookOpen} aside="Newest first">
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((entry) => {
          const missed = entry.status === "missed";
          return (
            <li key={entry.date.getTime()} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex min-w-0 items-start gap-2.5">
                {missed
                  ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                  : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{missed ? entry.reason : entry.topic}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{entry.subject} · {formatShortDate(entry.date)}</p>
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${missed ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"}`}>
                {missed ? "Missed" : "Attended"}
              </span>
            </li>
          );
        })}
      </ul>
      {log.length > 6 && (
        <button type="button" onClick={() => setShowAll((value) => !value)} className="mt-4 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400 cursor-pointer">
          {showAll ? "Show fewer" : `Show all ${log.length} classes`}
        </button>
      )}
    </SectionCard>
  );
}

function Attendance({ sample }) {
  const { stats, weeks, log } = sample;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Attendance" value={`${stats.attendancePercent}%`} detail="of classes held" icon={CalendarCheck} tint="good" />
        <StatTile label="Attended" value={stats.completed} detail="this month" icon={CheckCircle2} tint="good" />
        <StatTile label="Missed" value={stats.missed} detail="this month" icon={XCircle} tint="serious" />
        <StatTile label="Coming up" value={stats.remaining} detail="classes left" icon={Clock} />
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <AttendanceCalendar weeks={weeks} />
        <ClassLog log={log} />
      </div>
    </div>
  );
}

// ── Progress ─────────────────────────────────────────────────────────────────

// One subject's test scores on a shared 50 to 100 scale, so the three charts compare directly
function ScoreTrend({ subject }) {
  const [active, setActive] = useState(null);
  const width = 260;
  const height = 92;
  const padding = { top: 10, right: 12, bottom: 8, left: 12 };
  const scaleMin = 50;
  const scaleMax = 100;

  const xFor = (index) => padding.left + (index * (width - padding.left - padding.right)) / (subject.tests.length - 1);
  const yFor = (score) => padding.top + ((scaleMax - score) * (height - padding.top - padding.bottom)) / (scaleMax - scaleMin);
  const points = subject.tests.map((score, index) => ({ score, x: xFor(index), y: yFor(score) }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padding.left},${height - padding.bottom} ${line} ${width - padding.right},${height - padding.bottom}`;
  const shown = active === null ? points.length - 1 : active;
  const latest = subject.tests.at(-1);
  const change = latest - subject.tests.at(-2);

  return (
    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{subject.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">+{change} since the last test</p>
        </div>
        <p className="text-2xl font-bold leading-none text-slate-900 dark:text-white">{latest}%</p>
      </div>

      <div className="relative mt-3" onMouseLeave={() => setActive(null)}>
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible" aria-hidden="true">
          <line x1={padding.left} x2={width - padding.right} y1={yFor(scaleMax)} y2={yFor(scaleMax)} strokeWidth="1" className="stroke-slate-200 dark:stroke-slate-700" />
          <line x1={padding.left} x2={width - padding.right} y1={height - padding.bottom} y2={height - padding.bottom} strokeWidth="1" className="stroke-slate-200 dark:stroke-slate-700" />
          <polygon points={area} className="fill-indigo-600/10 dark:fill-indigo-400/10" />
          <polyline points={line} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="stroke-indigo-600 dark:stroke-indigo-400" />
          {active !== null && (
            <line x1={points[active].x} x2={points[active].x} y1={padding.top} y2={height - padding.bottom} strokeWidth="1" className="stroke-slate-300 dark:stroke-slate-600" />
          )}
          <circle cx={points[shown].x} cy={points[shown].y} r="4" strokeWidth="2" className="fill-indigo-600 stroke-slate-50 dark:fill-indigo-400 dark:stroke-slate-800" />
        </svg>

        {/* Hover and keyboard targets, one per test */}
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
          {points.map((point, index) => (
            <button
              key={index}
              type="button"
              aria-label={`${subject.name}, test ${index + 1}: ${point.score}%`}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              className="h-full cursor-default rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            />
          ))}
        </div>

        {active !== null && (
          <span
            role="status"
            className="pointer-events-none absolute -top-2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs font-semibold text-white shadow-md dark:bg-white dark:text-slate-900"
            style={{ left: `${Math.min(84, Math.max(16, (points[active].x / width) * 100))}%` }}
          >
            Test {active + 1}: {points[active].score}%
          </span>
        )}
      </div>
      <p className="mt-1 flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span>Test 1</span>
        <span>Scale 50 to 100%</span>
        <span>Test {points.length}</span>
      </p>
    </div>
  );
}

function ScoresTable() {
  const testCount = SAMPLE_SUBJECTS[0].tests.length;
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[20rem] text-left text-sm">
        <caption className="sr-only">Test scores by subject</caption>
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <th scope="col" className="py-2 pr-3 font-semibold">Subject</th>
            {Array.from({ length: testCount }, (_, index) => (
              <th key={index} scope="col" className="px-2 py-2 text-right font-semibold">Test {index + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {SAMPLE_SUBJECTS.map((subject) => (
            <tr key={subject.name}>
              <th scope="row" className="py-2.5 pr-3 font-semibold text-slate-800 dark:text-slate-100">{subject.name}</th>
              {subject.tests.map((score, index) => (
                <td key={index} className={`px-2 py-2.5 text-right tabular-nums ${index === testCount - 1 ? "font-bold text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"}`}>{score}%</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TOPIC_STATES = {
  Completed: { icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400" },
  "In progress": { icon: CircleDot, className: "text-indigo-600 dark:text-indigo-400" },
  Started: { icon: Circle, className: "text-slate-400 dark:text-slate-500" },
};

function Progress({ sample, remarks }) {
  return (
    <div className="space-y-5">
      <SectionCard title="Test scores" icon={TrendingUp} aside={`Average ${sample.stats.averageScore}%`}>
        <div className="grid gap-3 md:grid-cols-3">
          {SAMPLE_SUBJECTS.map((subject) => <ScoreTrend key={subject.name} subject={subject} />)}
        </div>
        <ScoresTable />
      </SectionCard>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <SectionCard title="Syllabus covered" icon={BookOpen}>
          <div className="space-y-5">
            {SAMPLE_SUBJECTS.map((subject) => (
              <div key={subject.name}>
                <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{subject.name}</h3>
                <ul className="space-y-2">
                  {subject.topics.map((topic) => {
                    const state = TOPIC_STATES[topic.status];
                    return (
                      <li key={topic.name} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2 text-slate-700 dark:text-slate-200">
                          <state.icon className={`h-4 w-4 shrink-0 ${state.className}`} aria-hidden="true" />
                          <span className="min-w-0">{topic.name}</span>
                        </span>
                        <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">{topic.status}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Tutor remarks" icon={MessageSquareQuote}>
          <div className="space-y-3">
            {remarks.map((remark) => <RemarkCard key={remark.date} remark={remark} />)}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ── Homework ─────────────────────────────────────────────────────────────────

function Homework({ sample }) {
  const { stats, homework } = sample;
  const percent = Math.round((stats.homeworkDone / stats.homeworkTotal) * 100);
  return (
    <div className="space-y-5">
      <section className={`${card} p-5 sm:p-6`}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Homework this month</h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{stats.homeworkTotal - stats.homeworkDone} still to do</p>
          </div>
          <p className="text-3xl font-bold leading-none text-slate-900 dark:text-white">{stats.homeworkDone}/{stats.homeworkTotal}</p>
        </div>
        <div className="mt-4"><Meter percent={percent} label={`${stats.homeworkDone} of ${stats.homeworkTotal} submitted`} /></div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <SectionCard title="To do" icon={PenLine} aside={`${homework.toDo.length} pending`}>
          <ul className="space-y-3">
            {homework.toDo.map((item) => (
              <li key={item.task} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.task}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-600 dark:text-slate-300">
                  <span>{item.subject}</span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 font-semibold"><Clock className="h-3 w-3" aria-hidden="true" />Due {item.due}</span>
                </p>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Checked by the tutor" icon={CheckCircle2} aside={`Latest ${homework.done.length} of ${stats.homeworkDone}`}>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {homework.done.map((item) => (
              <li key={item.task} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm font-semibold text-slate-800 dark:text-slate-100">{item.task}</p>
                  <span className="shrink-0 text-sm font-bold text-slate-900 dark:text-white">{item.marks}</span>
                </div>
                <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">{item.subject}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.remark}</p>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}

// ── Page frame ───────────────────────────────────────────────────────────────

function NextSteps({ studentFirstName }) {
  return (
    <section className={`${card} flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6`}>
      <div className="min-w-0">
        <h2 className="break-words text-base font-bold text-slate-900 dark:text-white">Get this dashboard for {studentFirstName}</h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Book a free demo and we'll match a verified tutor. Your dashboard goes live when classes start.</p>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        <Link to="/parent/login" className="flex h-11 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
          Already enrolled? Sign in
        </Link>
        <Link to="/parent-enquiry" className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700">
          Book a free demo
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function Dashboard({ names, onChangeNames }) {
  const [tab, setTab] = useState("overview");
  const [now, setNow] = useState(() => new Date());

  // Keeps the "next class" countdown current
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const sample = useMemo(() => buildSample(now), [now]);
  const studentFirstName = firstNameOf(names.studentName);
  const remarks = useMemo(() => sample.remarks(studentFirstName), [sample, studentFirstName]);

  const goTo = (next) => {
    setTab(next);
    window.scrollTo({ top: 0 });
  };

  const activeLabel = NAV_ITEMS.find((item) => item.id === tab).label;

  return (
    <div data-dashboard className="plan-font min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      {/* Sidebar, large screens */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <Link to="/" className="flex items-center gap-2.5 px-2 py-1">
          <BrandLogo alt="" className="h-10 w-10 shrink-0 rounded-xl object-contain" />
          <span className="min-w-0 leading-tight">
            <span className="block text-sm font-bold text-slate-900 dark:text-white">Saraswati Tutorials</span>
            <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">Parent Dashboard</span>
          </span>
        </Link>

        <nav aria-label="Dashboard sections" className="mt-6 flex-1 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = item.id === tab;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => goTo(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer ${
                  active
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <InitialsAvatar text={initialsOf(names.parentName)} size="h-10 w-10 text-sm" />
            <div className="min-w-0">
              <p className="break-words text-sm font-bold text-slate-900 dark:text-white">{names.parentName}</p>
              <p className="break-words text-xs text-slate-500 dark:text-slate-400">Parent of {names.studentName}</p>
            </div>
          </div>
          <button type="button" onClick={onChangeNames} className="mt-2.5 w-full rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer">
            Change names
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/85">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2.5">
              <Link to="/" aria-label="Saraswati Tutorials home" className="shrink-0 lg:hidden">
                <BrandLogo alt="" className="h-9 w-9 rounded-xl object-contain" />
              </Link>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-bold text-slate-900 dark:text-white lg:text-lg">{activeLabel}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400 lg:hidden">{names.parentName} · {names.studentName}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <button type="button" onClick={onChangeNames} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 lg:hidden cursor-pointer">
                Change
              </button>
              <ThemeToggle buttonClassName={headerIconButton} />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl space-y-5 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-6">
          <SampleNotice studentFirstName={studentFirstName} />
          {tab === "overview" && <Hero names={names} sample={sample} hour={now.getHours()} studentFirstName={studentFirstName} />}
          <div key={tab} className="animate-fadeIn">
            {tab === "overview" && <Overview sample={sample} remarks={remarks} goTo={goTo} />}
            {tab === "attendance" && <Attendance sample={sample} />}
            {tab === "progress" && <Progress sample={sample} remarks={remarks} />}
            {tab === "homework" && <Homework sample={sample} />}
          </div>
          <NextSteps studentFirstName={studentFirstName} />
        </main>
      </div>

      {/* Bottom navigation, phones and tablets */}
      <nav aria-label="Dashboard sections" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {NAV_ITEMS.map((item) => {
            const active = item.id === tab;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => goTo(item.id)}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 cursor-pointer ${
                  active ? "text-indigo-600 dark:text-indigo-300" : "text-slate-500 dark:text-slate-400"
                }`}
              >
                <item.icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default function ParentDashboardPreview() {
  const [names, setNames] = useState(readSavedNames);
  const [editing, setEditing] = useState(false);

  const open = (next) => {
    saveNames(next);
    setNames(next);
    setEditing(false);
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <Helmet>
        <title>Parent Dashboard | Saraswati Tutorials</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      {names && !editing
        ? <Dashboard names={names} onChangeNames={() => setEditing(true)} />
        : <NameForm initial={names} onOpen={open} />}
    </>
  );
}
