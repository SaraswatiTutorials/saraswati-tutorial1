import { useEffect, useState } from "react";
import {
  ClipboardList,
  FileCheck2,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  MessageSquareQuote,
  CalendarDays,
  Award,
  Hourglass,
  CheckCircle2,
  BookOpen,
} from "lucide-react";
import { API_BASE } from "../../config";
import { cardClass, formatDay, StatTile, EmptyState, Avatar } from "./PortalParts";

// Assignments and tests: the tutor sets them and adds marks and a remark; parents follow the results

const STATUS_STYLE = {
  Pending: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  Checked: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  "Not submitted": "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
};

const hasScore = (a) => a.marks !== null && a.marks !== undefined && a.maxMarks > 0;
export const scorePercent = (a) => (hasScore(a) ? Math.round((a.marks / a.maxMarks) * 100) : null);
const formatMarks = (n) => (Number.isInteger(n) ? String(n) : String(Number(n).toFixed(1)));

function todayString() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split("T")[0];
}

function AssignmentStatus({ status }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status] || STATUS_STYLE.Pending}`}>
      {status === "Pending" ? "Not checked yet" : status}
    </span>
  );
}

export function AssignmentCard({ item, actions }) {
  const isTest = item.kind === "Test";
  const percent = scorePercent(item);
  const KindIcon = isTest ? FileCheck2 : ClipboardList;
  return (
    <article className={`${cardClass} p-4 sm:p-5`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isTest ? "bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300" : "bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300"}`}>
          <KindIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {item.kind}{item.subject ? ` · ${item.subject}` : ""}
            </span>
            <AssignmentStatus status={item.status} />
          </div>
          <h4 className="mt-1 break-words text-base font-semibold text-slate-900 dark:text-white">{item.title}</h4>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {isTest ? "Test on" : "Given"} {formatDay(item.givenDate)}
            </span>
            {!isTest && item.dueDate && <span>Due {formatDay(item.dueDate)}</span>}
          </p>
        </div>
        {percent !== null && (
          <div className="shrink-0 text-right">
            <p className="text-xl font-bold leading-none text-slate-900 dark:text-white">
              {formatMarks(item.marks)}
              <span className="text-sm font-semibold text-slate-400">/{formatMarks(item.maxMarks)}</span>
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{percent}%</p>
          </div>
        )}
      </div>

      {item.details && (
        <p className="mt-3 whitespace-pre-line break-words text-sm text-slate-600 dark:text-slate-300">{item.details}</p>
      )}

      {item.remark && (
        <div className="mt-3 rounded-xl bg-slate-50 px-3.5 py-2.5 dark:bg-slate-800/60">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <MessageSquareQuote className="h-3.5 w-3.5" /> Tutor's remark
          </p>
          <p className="mt-0.5 whitespace-pre-line break-words text-sm text-slate-700 dark:text-slate-200">{item.remark}</p>
        </div>
      )}

      {actions && <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">{actions}</div>}
    </article>
  );
}

// Scores of checked work, oldest to newest, as one bar each (0-100%)
function ScoreTrend({ items }) {
  const scored = items.filter(hasScore).sort((a, b) => (a.givenDate < b.givenDate ? -1 : 1)).slice(-12);
  if (scored.length < 2) return null;
  return (
    <figure className={`${cardClass} p-4 sm:p-5`}>
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-slate-900 dark:text-white">Score trend</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">Last {scored.length} marked</span>
      </figcaption>
      <div className="relative mt-4 h-36 pl-9">
        {[100, 50, 0].map((line) => (
          <div key={line} className="absolute left-0 right-0 flex items-center gap-2" style={{ bottom: `${line}%`, transform: "translateY(50%)" }}>
            <span className="w-7 text-right text-[10px] font-medium text-slate-400 dark:text-slate-500">{line}%</span>
            <span className={`h-px flex-1 ${line === 0 ? "bg-slate-300 dark:bg-slate-700" : "bg-slate-100 dark:bg-slate-800"}`} />
          </div>
        ))}
        <ol className="relative flex h-full items-end gap-1.5">
          {scored.map((a) => {
            const percent = scorePercent(a);
            return (
              <li key={a._id} className="group relative flex h-full flex-1 items-end justify-center" tabIndex={0} aria-label={`${a.title}: ${formatMarks(a.marks)} of ${formatMarks(a.maxMarks)}, ${percent}%`}>
                <span
                  className="w-full max-w-8 rounded-t-[4px] bg-indigo-500 transition group-hover:bg-indigo-600 dark:bg-indigo-400 dark:group-hover:bg-indigo-300"
                  style={{ height: `${Math.max(percent, 1)}%` }}
                />
                <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden w-max max-w-44 rounded-lg bg-slate-900 px-2.5 py-1.5 text-left text-xs text-white shadow-lg group-hover:block group-focus:block dark:bg-white dark:text-slate-900">
                  <span className="block font-semibold">{a.title}</span>
                  <span className="block opacity-80">{formatDay(a.givenDate)}</span>
                  <span className="block">{formatMarks(a.marks)}/{formatMarks(a.maxMarks)} · {percent}%</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="mt-2 flex justify-between pl-9 text-[10px] font-medium text-slate-400 dark:text-slate-500">
        <span>{formatDay(scored[0].givenDate)}</span>
        <span>{formatDay(scored[scored.length - 1].givenDate)}</span>
      </div>
    </figure>
  );
}

export function AssignmentSummary({ items }) {
  const scored = items.filter(hasScore);
  const average = scored.length ? Math.round(scored.reduce((sum, a) => sum + scorePercent(a), 0) / scored.length) : null;
  const pending = items.filter((a) => a.status === "Pending").length;
  const checked = items.filter((a) => a.status === "Checked").length;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Given" value={items.length} icon={BookOpen} hint="assignments & tests" />
        <StatTile label="Checked" value={checked} icon={CheckCircle2} tone="emerald" />
        <StatTile label="Waiting for check" value={pending} icon={Hourglass} tone="amber" />
        <StatTile label="Average score" value={average === null ? "—" : `${average}%`} icon={Award} tone="indigo" hint={scored.length ? `from ${scored.length} marked` : "no marks yet"} />
      </div>
      <ScoreTrend items={items} />
    </div>
  );
}

// Parent portal: everything the tutor has set for this student
export function ParentAssignments({ assignments = [] }) {
  const [filter, setFilter] = useState("all");
  const shown = filter === "all" ? assignments : assignments.filter((a) => a.kind === filter);
  return (
    <section>
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Assignments &amp; tests</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">Homework and tests from the tutor, with marks and remarks.</p>
      </div>
      {assignments.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No assignments yet"
          text="When the tutor gives homework or a test, it will show here with the marks and the tutor's remark."
        />
      ) : (
        <div className="space-y-4">
          <AssignmentSummary items={assignments} />
          <KindFilter value={filter} onChange={setFilter} items={assignments} />
          <div className="space-y-3">
            {shown.map((a) => <AssignmentCard key={a._id} item={a} />)}
          </div>
        </div>
      )}
    </section>
  );
}

function KindFilter({ value, onChange, items }) {
  const options = [
    { id: "all", label: `All (${items.length})` },
    { id: "Assignment", label: `Assignments (${items.filter((a) => a.kind === "Assignment").length})` },
    { id: "Test", label: `Tests (${items.filter((a) => a.kind === "Test").length})` },
  ];
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
            value === o.id
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
              : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Tutor dashboard: pick a student, then set work and record marks and remarks
export function TutorAssignments({ students, token, onSessionExpired }) {
  const [studentId, setStudentId] = useState(students[0]?._id || null);
  const [records, setRecords] = useState({}); // studentId -> assignments
  const [loadingId, setLoadingId] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState(null); // { item?, kind } while the form is open
  const [filter, setFilter] = useState("all");

  const student = students.find((s) => s._id === studentId) || students[0];
  const items = student ? records[student._id] : undefined;

  async function load(id) {
    setLoadingId(id);
    setLoadError("");
    try {
      const res = await fetch(`${API_BASE}/portal/students/${id}/assignments`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setRecords((prev) => ({ ...prev, [id]: data.assignments || [] }));
    } catch (err) {
      setLoadError(err.message || "Couldn't load assignments.");
    } finally {
      setLoadingId(null);
    }
  }

  useEffect(() => {
    if (student && !records[student._id]) load(student._id);
  }, [student?._id]);

  async function remove(item) {
    if (!window.confirm(`Delete "${item.title}"? The parent will no longer see it.`)) return;
    const res = await fetch(`${API_BASE}/portal/assignments/${item._id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) return onSessionExpired();
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return window.alert(data.message || "Couldn't delete it. Please try again.");
    }
    setRecords((prev) => ({ ...prev, [student._id]: prev[student._id].filter((a) => a._id !== item._id) }));
  }

  function saved(item) {
    setRecords((prev) => {
      const list = prev[student._id] || [];
      const next = list.some((a) => a._id === item._id) ? list.map((a) => (a._id === item._id ? item : a)) : [item, ...list];
      return { ...prev, [student._id]: next.sort((a, b) => (a.givenDate < b.givenDate ? 1 : a.givenDate > b.givenDate ? -1 : 0)) };
    });
    setEditing(null);
  }

  if (!student) return null;
  const shown = !items ? [] : filter === "all" ? items : items.filter((a) => a.kind === filter);

  return (
    <div className="space-y-5">
      {students.length > 1 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none" role="tablist" aria-label="Choose a student">
          {students.map((s) => {
            const active = s._id === student._id;
            return (
              <button
                key={s._id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => { setStudentId(s._id); setFilter("all"); }}
                className={`flex shrink-0 items-center gap-2.5 rounded-2xl border py-2 pl-2 pr-4 text-left transition cursor-pointer ${
                  active
                    ? "border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                }`}
              >
                <Avatar src={s.studentPhoto} name={s.studentName} size="h-8 w-8" textClass="text-xs" className={active ? "ring-2 ring-white/60" : ""} />
                <span>
                  <span className="block text-sm font-semibold">{s.studentName}</span>
                  <span className={`block text-xs ${active ? "text-indigo-100" : "text-slate-500 dark:text-slate-400"}`}>{s.requirementId}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className={`${cardClass} flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5`}>
        <div className="flex min-w-0 items-center gap-3">
          <Avatar src={student.studentPhoto} name={student.studentName} size="h-12 w-12" textClass="text-base" />
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-slate-900 dark:text-white">{student.studentName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">The parent sees everything you add here.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing({ kind: "Assignment" })}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 sm:flex-none cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Assignment
          </button>
          <button
            type="button"
            onClick={() => setEditing({ kind: "Test" })}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:flex-none cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Test
          </button>
        </div>
      </div>

      {loadingId === student._id && !items ? (
        <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading assignments...
        </p>
      ) : !items ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center dark:border-rose-900 dark:bg-rose-950/20">
          <p className="text-sm font-medium text-rose-700 dark:text-rose-400">{loadError || "Couldn't load assignments."}</p>
          <button type="button" onClick={() => load(student._id)} className="mt-2 text-sm font-semibold text-indigo-600 underline dark:text-indigo-400 cursor-pointer">
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No assignments or tests yet"
          text="Give homework or a weekly test, then add the marks and a remark once it's checked. The parent sees them straight away."
        />
      ) : (
        <div className="space-y-4">
          <AssignmentSummary items={items} />
          <KindFilter value={filter} onChange={setFilter} items={items} />
          <div className="space-y-3">
            {shown.map((item) => (
              <AssignmentCard
                key={item._id}
                item={item}
                actions={
                  <>
                    <button
                      type="button"
                      onClick={() => setEditing({ item, kind: item.kind, focusResult: true })}
                      className="flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 cursor-pointer"
                    >
                      <Award className="h-3.5 w-3.5" /> {item.status === "Pending" ? "Add marks & remark" : "Update result"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing({ item, kind: item.kind })}
                      className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(item)}
                      className="ml-auto flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </>
                }
              />
            ))}
          </div>
        </div>
      )}

      {editing && (
        <AssignmentForm
          key={editing.item?._id || editing.kind}
          student={student}
          item={editing.item}
          initialKind={editing.kind}
          focusResult={editing.focusResult}
          token={token}
          onSessionExpired={onSessionExpired}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      )}
    </div>
  );
}

const STATUSES = [
  { id: "Pending", label: "Not checked" },
  { id: "Checked", label: "Checked" },
  { id: "Not submitted", label: "Not submitted" },
];

function AssignmentForm({ student, item, initialKind, focusResult, token, onSessionExpired, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    kind: item?.kind || initialKind || "Assignment",
    title: item?.title || "",
    subject: item?.subject || "",
    details: item?.details || "",
    givenDate: item?.givenDate || todayString(),
    dueDate: item?.dueDate || "",
    maxMarks: item?.maxMarks ?? "",
    marks: item?.marks ?? "",
    remark: item?.remark || "",
    status: item?.status || "Pending",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isTest = form.kind === "Test";

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Entering marks means the work has been checked
      if (key === "marks" && value !== "" && prev.status === "Pending") next.status = "Checked";
      return next;
    });
    if (error) setError("");
  };

  async function submit(e) {
    e.preventDefault();
    if (!form.title.trim()) return setError("Give it a title, e.g. \"Chapter 4 worksheet\".");
    if (form.marks !== "" && form.maxMarks === "") return setError("Enter the total marks too.");
    if (form.marks !== "" && Number(form.marks) > Number(form.maxMarks)) return setError(`Marks can't be more than the total (${form.maxMarks}).`);

    setSaving(true);
    setError("");
    try {
      const body = { ...form, dueDate: isTest ? "" : form.dueDate, marks: form.status === "Not submitted" ? "" : form.marks };
      const res = await fetch(
        item ? `${API_BASE}/portal/assignments/${item._id}` : `${API_BASE}/portal/students/${student._id}/assignments`,
        {
          method: item ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        }
      );
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      onSaved(data.assignment);
    } catch (err) {
      setError(err.message || "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const field =
    "w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-white";
  const narrowField = field.replace("w-full", "w-28");
  const label = "mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200";
  const segment = (active) =>
    `flex h-10 flex-1 items-center justify-center rounded-lg text-sm font-semibold transition cursor-pointer ${
      active ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="assignment-form-title">
      <div className="flex max-h-[92vh] w-full animate-fadeIn flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <h3 id="assignment-form-title" className="text-base font-bold text-slate-900 dark:text-white">
              {item ? (focusResult ? "Marks & remark" : `Edit ${form.kind.toLowerCase()}`) : `New ${form.kind.toLowerCase()}`}
            </h3>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{student.studentName} · {student.requirementId}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {focusResult && item ? (
              <div className="rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{item.kind}</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">{item.title}</p>
              </div>
            ) : (
              <>
                <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                  {["Assignment", "Test"].map((kind) => (
                    <button key={kind} type="button" onClick={() => setForm((prev) => ({ ...prev, kind }))} className={segment(form.kind === kind)}>
                      {kind}
                    </button>
                  ))}
                </div>

                <div>
                  <label htmlFor="as-title" className={label}>Title</label>
                  <input id="as-title" value={form.title} onChange={set("title")} maxLength={120} placeholder={isTest ? "e.g. Weekly test – Fractions" : "e.g. Chapter 4 worksheet"} className={`${field} h-11`} />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="as-subject" className={label}>Subject <span className="font-normal text-slate-400">(optional)</span></label>
                    <input id="as-subject" value={form.subject} onChange={set("subject")} maxLength={60} placeholder="e.g. Maths" className={`${field} h-11`} />
                  </div>
                  <div>
                    <label htmlFor="as-max" className={label}>Total marks <span className="font-normal text-slate-400">(optional)</span></label>
                    <input id="as-max" type="number" inputMode="decimal" min="1" value={form.maxMarks} onChange={set("maxMarks")} placeholder="e.g. 25" className={`${field} h-11`} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="as-given" className={label}>{isTest ? "Test date" : "Given on"}</label>
                    <input id="as-given" type="date" value={form.givenDate} onChange={set("givenDate")} className={`${field} h-11`} />
                  </div>
                  {!isTest && (
                    <div>
                      <label htmlFor="as-due" className={label}>Due date <span className="font-normal text-slate-400">(optional)</span></label>
                      <input id="as-due" type="date" value={form.dueDate} min={form.givenDate || undefined} onChange={set("dueDate")} className={`${field} h-11`} />
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="as-details" className={label}>{isTest ? "Syllabus / chapters" : "Instructions"} <span className="font-normal text-slate-400">(optional)</span></label>
                  <textarea id="as-details" rows={3} value={form.details} onChange={set("details")} maxLength={2000} placeholder={isTest ? "Chapters or topics in the test" : "What the student needs to do"} className={`${field} resize-none py-3`} />
                </div>
              </>
            )}

            <fieldset className={focusResult ? "space-y-4" : "space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800"}>
              {!focusResult && <legend className="px-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Result <span className="font-normal text-slate-400">(add later if not checked yet)</span></legend>}
              <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                {STATUSES.map((s) => (
                  <button key={s.id} type="button" onClick={() => setForm((prev) => ({ ...prev, status: s.id }))} className={`${segment(form.status === s.id)} px-2 text-xs sm:text-sm`}>
                    {s.label}
                  </button>
                ))}
              </div>
              {form.status !== "Not submitted" && (
                <div>
                  <label htmlFor="as-marks" className={label}>Marks scored</label>
                  <div className="flex items-center gap-2">
                    <input id="as-marks" type="number" inputMode="decimal" min="0" value={form.marks} onChange={set("marks")} placeholder="—" className={`${narrowField} h-11`} />
                    <span className="whitespace-nowrap text-sm font-semibold text-slate-500 dark:text-slate-400">out of</span>
                    {focusResult ? (
                      <input aria-label="Total marks" type="number" inputMode="decimal" min="1" value={form.maxMarks} onChange={set("maxMarks")} placeholder="total" className={`${narrowField} h-11`} />
                    ) : (
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{form.maxMarks || "—"}</span>
                    )}
                  </div>
                </div>
              )}
              <div>
                <label htmlFor="as-remark" className={label}>Remark for the parent</label>
                <textarea id="as-remark" rows={3} value={form.remark} onChange={set("remark")} maxLength={1000} placeholder="e.g. Good grip on addition; needs practice with word problems." className={`${field} resize-none py-3`} />
              </div>
            </fieldset>

            {error && (
              <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                {error}
              </p>
            )}
          </div>

          <div className="flex gap-3 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
            <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex h-11 flex-[2] items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60 cursor-pointer">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving..." : item ? "Save changes" : `Add ${form.kind.toLowerCase()}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
