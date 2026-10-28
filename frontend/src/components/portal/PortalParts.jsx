import { CheckCircle2, XCircle, Clock, User } from "lucide-react";
import { formatClassTimeRange, formatHours, logMinutes } from "../../utils/classTime";

// Building blocks shared by the parent portal and the tutor dashboard

export const cardClass =
  "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none";

// "2026-10-27" -> "Tue, 27 Oct 2026"
export function formatDay(date) {
  const parts = String(date || "").split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return date || "";
  return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// The server labels months "Month 2 (Cycle 2)"; people only need "Month 2"
export function monthName(label, cycleNumber) {
  return String(label || `Month ${cycleNumber || 1}`).replace(/\s*\(Cycle \d+\)\s*$/, "");
}

export function missedReasonText(log) {
  return log.missedReason === "Other" ? log.customReason || "Other" : log.missedReason || "Not given";
}

export function progressPercent(done, total) {
  return total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
}

const TONES = {
  slate: "text-slate-900 dark:text-white",
  emerald: "text-emerald-600 dark:text-emerald-400",
  rose: "text-rose-600 dark:text-rose-400",
  indigo: "text-indigo-600 dark:text-indigo-400",
  amber: "text-amber-600 dark:text-amber-400",
};

export function StatTile({ label, value, tone = "slate", icon: Icon, hint }) {
  return (
    <div className={`${cardClass} p-4`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
        {Icon && <Icon className={`h-4 w-4 ${TONES[tone]}`} />}
      </div>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${TONES[tone]}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

export function ProgressRing({ done, total, size = 112 }) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = progressPercent(done, total);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" className="stroke-slate-100 dark:stroke-slate-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
          className="stroke-indigo-600 transition-[stroke-dashoffset] duration-700 dark:stroke-indigo-400"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-900 dark:text-white">{done}<span className="text-base font-semibold text-slate-400">/{total}</span></span>
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">classes</span>
      </div>
    </div>
  );
}

export function ProgressBar({ done, total }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      <div className="h-full rounded-full bg-indigo-600 transition-all duration-500 dark:bg-indigo-400" style={{ width: `${progressPercent(done, total)}%` }} />
    </div>
  );
}

export function StatusPill({ status }) {
  const done = status === "Done";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        done
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
          : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
      }`}
    >
      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {done ? "Completed" : "Missed"}
    </span>
  );
}

// Month picker for a tuition's class history; "all" shows every month
export function MonthTabs({ cycles, currentCycle, selected, onSelect, totalLogs }) {
  const tab = (active) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
      active
        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
        : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
    }`;
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
      {cycles.map((cycleNumber) => (
        <button key={cycleNumber} type="button" onClick={() => onSelect(cycleNumber)} className={tab(selected === cycleNumber)}>
          Month {cycleNumber}
          {cycleNumber === currentCycle && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" title="Current month" />}
        </button>
      ))}
      <button type="button" onClick={() => onSelect("all")} className={tab(selected === "all")}>
        All months ({totalLogs})
      </button>
    </div>
  );
}

// Newest-first list of logged classes, numbered oldest = Class 1
export function ClassTimeline({ logs, showTutor = false }) {
  return (
    <ol className="relative space-y-3 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-slate-200 dark:before:bg-slate-800">
      {logs.map((log, index) => {
        const done = log.status === "Done";
        const time = formatClassTimeRange(log.classStartTime, log.classEndTime);
        const hours = done ? formatHours(logMinutes(log)) : "";
        return (
          <li key={log._id || index} className="relative flex gap-3">
            <span
              className={`relative z-10 mt-3 flex h-[31px] w-[31px] shrink-0 items-center justify-center rounded-full border-4 border-slate-50 dark:border-slate-950 ${
                done ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
              }`}
            >
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
            </span>
            <div className={`${cardClass} min-w-0 flex-1 p-4`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{formatDay(log.date)}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>Class {logs.length - index} · Month {log.packageCycle || 1}</span>
                    {time && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {time}
                        {hours && ` (${hours})`}
                      </span>
                    )}
                  </p>
                </div>
                <StatusPill status={log.status} />
              </div>
              <div className="mt-3 rounded-xl bg-slate-50 px-3.5 py-2.5 dark:bg-slate-800/60">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {done ? "Topics covered" : "Reason"}
                </p>
                <p className="mt-0.5 whitespace-pre-line break-words text-sm text-slate-700 dark:text-slate-200">
                  {done ? log.topicsCovered || "Not given" : missedReasonText(log)}
                </p>
              </div>
              {showTutor && log.tutorName && (
                <p className="mt-2.5 flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                  <User className="h-3 w-3" /> Marked by {log.tutorName}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function EmptyState({ icon: Icon, title, text, children }) {
  return (
    <div className={`${cardClass} flex flex-col items-center px-6 py-12 text-center`}>
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <p className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{text}</p>}
      {children}
    </div>
  );
}

// Class history for one tuition: month tabs, that month's summary, then the class list
export function ClassHistory({ logs, cycles = [], currentCycle = 1, selected, onSelect, showTutor }) {
  const cycleNumbers = [];
  const maxCycle = Math.max(currentCycle, 1, ...logs.map((l) => l.packageCycle || 1), ...cycles.map((c) => c.cycleNumber || 1));
  for (let n = 1; n <= maxCycle; n++) cycleNumbers.push(n);

  const shown = selected === "all" ? logs : logs.filter((l) => (l.packageCycle || 1) === selected);
  const cycle = cycles.find((c) => c.cycleNumber === selected);

  return (
    <div className="space-y-4">
      <MonthTabs cycles={cycleNumbers} currentCycle={currentCycle} selected={selected} onSelect={onSelect} totalLogs={logs.length} />

      {cycle && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            Month {cycle.cycleNumber}
            {cycle.dateRangeDisplay && <span className="font-normal text-slate-500 dark:text-slate-400"> · {cycle.dateRangeDisplay}</span>}
          </span>
          <span className="flex flex-wrap gap-x-3 font-semibold">
            <span className="text-emerald-600 dark:text-emerald-400">{cycle.completedCount}/{cycle.totalScheduled} done</span>
            {cycle.missedCount > 0 && <span className="text-rose-600 dark:text-rose-400">{cycle.missedCount} missed</span>}
            {cycle.doneMinutes > 0 && <span className="text-slate-500 dark:text-slate-400">{formatHours(cycle.doneMinutes)} taught</span>}
          </span>
        </div>
      )}

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {selected === "all" ? "No classes have been marked yet." : `No classes marked in Month ${selected} yet.`}
        </p>
      ) : (
        <ClassTimeline logs={shown} showTutor={showTutor} />
      )}
    </div>
  );
}
