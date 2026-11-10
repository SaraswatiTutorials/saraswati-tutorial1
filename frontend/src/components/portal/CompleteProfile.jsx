import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, FileUp, Loader2, ShieldCheck, Clock } from "lucide-react";
import { API_BASE } from "../../config";
import { cardClass } from "./PortalParts";
import {
  genderOptions,
  gradeOptions,
  boardOptions,
  subjectOptions,
  occupationOptions,
  travelDistanceOptions,
  timingGroups,
} from "../../data/tutorFormOptions";

// A partial tutor (short sign-up form) completes the full registration here:
// only what the short form did not ask. Sending it makes them a registered
// tutor, waiting for the team's approval like any other registration.

const MAX_FILE = 8 * 1024 * 1024;
const DOCS = [
  { key: "photo", label: "Profile photo", accept: "image/*", required: true },
  { key: "idProof", label: "ID proof (Aadhaar, PAN, passport...)", accept: "image/*,application/pdf", required: true },
  { key: "expCert", label: "Education certificate", accept: "image/*,application/pdf", required: true },
  { key: "otherDoc", label: "Any other document (optional)", accept: "image/*,application/pdf", required: false },
];

const empty = {
  email: "", gender: "", qualification: "", grades: [], boards: [], subjects: [],
  hasOccupation: "", occupation: "", organization: "", maxTravelDistance: "",
  hasVehicle: "", vehicleNumber: "", timings: [],
  photo: "", idProof: "", expCert: "", otherDoc: "",
  agreement: false, attendanceAgreement: false,
};

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white";
const labelClass = "mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200";

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
        active
          ? "border-indigo-600 bg-indigo-600 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, children, hint }) {
  return (
    <div>
      <span className={labelClass}>{label} <span className="text-rose-500">*</span></span>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

// initialStatus: the /full-profile answer when the page already has it (no second fetch).
// defaultOpen: show the form straight away instead of behind the button.
export default function CompleteProfile({ token, onConverted, onRelogin, initialStatus = null, defaultOpen = false }) {
  const [status, setStatus] = useState(initialStatus);
  const [open, setOpen] = useState(defaultOpen);
  const [form, setForm] = useState(() =>
    initialStatus?.stage === "partial" && initialStatus.known?.occupation
      ? { ...empty, occupation: initialStatus.known.occupation }
      : empty);
  const [uploading, setUploading] = useState({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialStatus) return undefined;
    let live = true;
    fetch(`${API_BASE}/portal/tutor/full-profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!live || !data) return;
        setStatus(data);
        if (data.stage === "partial" && data.known?.occupation) {
          setForm((prev) => ({ ...prev, occupation: data.known.occupation }));
        }
      })
      .catch(() => {});
    return () => { live = false; };
  }, [token]);

  if (!status || status.stage === "full") return null;

  if (status.stage === "submitted") {
    return (
      <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">Your full verification is with our team</p>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            We have your details and documents. We will let you know on WhatsApp once your profile is verified.
          </p>
        </div>
      </section>
    );
  }

  if (status.stage === "relogin") {
    return (
      <section className={`${cardClass} flex flex-wrap items-center justify-between gap-3 p-4`}>
        <p className="text-sm text-slate-700 dark:text-slate-200">You have completed your full verification. Please log in again to continue.</p>
        <button type="button" onClick={onRelogin} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 cursor-pointer">
          Log in again
        </button>
      </section>
    );
  }

  const set = (key, value) => { setForm((prev) => ({ ...prev, [key]: value })); setError(""); };
  const toggle = (key, value) =>
    set(key, form[key].includes(value) ? form[key].filter((v) => v !== value) : [...form[key], value]);

  const done = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()),
    gender: !!form.gender,
    qualification: form.qualification.trim().length >= 2,
    grades: form.grades.length > 0,
    boards: form.boards.length > 0,
    subjects: form.subjects.length > 0,
    hasOccupation: form.hasOccupation === "no" || (form.hasOccupation === "yes" && !!form.occupation),
    maxTravelDistance: !!form.maxTravelDistance,
    hasVehicle: form.hasVehicle === "no" || (form.hasVehicle === "yes" && !!form.vehicleNumber.trim()),
    timings: form.timings.length > 0,
    documents: !!(form.photo && form.idProof && form.expCert),
    agreements: form.agreement && form.attendanceAgreement,
  };
  const needed = status.needed || [];
  const doneCount = needed.filter((n) => done[n.key]).length;
  const busy = Object.values(uploading).some(Boolean);

  async function upload(key, file) {
    if (!file) return;
    if (file.size > MAX_FILE) { setError("Each file should be under 8MB"); return; }
    setUploading((prev) => ({ ...prev, [key]: true }));
    setError("");
    try {
      const fd = new FormData();
      fd.append(key, file);
      const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data[key]) throw new Error(data.message || "Upload failed. Please try again.");
      set(key, data[key]);
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading((prev) => ({ ...prev, [key]: false }));
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (sending || busy) return;
    const firstMissing = needed.find((n) => !done[n.key]);
    if (firstMissing) { setError(`Please complete: ${firstMissing.label}`); return; }
    setSending(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/portal/tutor/complete-profile`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || "Couldn't send your details. Please try again.");
      onConverted(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  const known = status.known || {};
  const knownRows = [
    ["Name", known.name], ["WhatsApp", known.whatsapp], ["Experience", known.experience],
    ["Area", [known.area, known.city].filter(Boolean).join(", ")],
  ].filter(([, v]) => v);

  return (
    <section className={`${cardClass} overflow-hidden`} aria-labelledby="complete-profile-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-indigo-50/60 p-4 dark:border-slate-800 dark:bg-indigo-500/10 sm:p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h2 id="complete-profile-title" className="text-base font-bold text-slate-900 dark:text-white">Complete your full verification</h2>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
              You signed up with the short form. Add the details below to become a fully verified tutor and get more tuition matches.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 cursor-pointer"
        >
          {open ? "Hide form" : "Complete profile"}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Still needed · {doneCount} of {needed.length} done
          </p>
          <ul className="mt-2 space-y-1.5">
            {needed.map((n) => (
              <li key={n.key} className="flex items-start gap-2 text-sm">
                {done[n.key]
                  ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  : <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />}
                <span className={done[n.key] ? "text-slate-500 line-through dark:text-slate-400" : "text-slate-800 dark:text-slate-100"}>{n.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Already on your profile</p>
          <dl className="mt-2 space-y-1.5 text-sm">
            {knownRows.map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="w-24 shrink-0 text-slate-500 dark:text-slate-400">{k}</dt>
                <dd className="min-w-0 break-words font-medium text-slate-800 dark:text-slate-100">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {open && (
        <form onSubmit={submit} className="space-y-5 border-t border-slate-100 p-4 dark:border-slate-800 sm:p-5" noValidate>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Email address">
              <input type="email" className={inputClass} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="name@email.com" autoComplete="email" />
            </Field>
            <Field label="Qualification">
              <input className={inputClass} value={form.qualification} onChange={(e) => set("qualification", e.target.value)} placeholder="e.g. B.Ed, M.Sc in Physics, B.Tech" />
            </Field>
          </div>

          <Field label="Gender">
            <div className="flex flex-wrap gap-2">
              {genderOptions.map((g) => <Chip key={g} active={form.gender === g} onClick={() => set("gender", g)}>{g}</Chip>)}
            </div>
          </Field>

          <Field label="Grades you can teach">
            <div className="flex flex-wrap gap-2">
              {gradeOptions.map((g) => <Chip key={g} active={form.grades.includes(g)} onClick={() => toggle("grades", g)}>{g}</Chip>)}
            </div>
          </Field>
          <Field label="Boards you can teach">
            <div className="flex flex-wrap gap-2">
              {boardOptions.map((b) => <Chip key={b} active={form.boards.includes(b)} onClick={() => toggle("boards", b)}>{b}</Chip>)}
            </div>
          </Field>
          <Field label="Subjects you can teach">
            <div className="flex flex-wrap gap-2">
              {subjectOptions.map((s) => <Chip key={s} active={form.subjects.includes(s)} onClick={() => toggle("subjects", s)}>{s}</Chip>)}
            </div>
          </Field>

          <Field label="Have you worked or are you working in any school, college, or institute?">
            <div className="flex flex-wrap gap-2">
              {["yes", "no"].map((v) => (
                <Chip key={v} active={form.hasOccupation === v} onClick={() => set("hasOccupation", v)}>{v === "yes" ? "Yes" : "No"}</Chip>
              ))}
            </div>
            {form.hasOccupation === "yes" && (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <select className={inputClass} value={form.occupation} onChange={(e) => set("occupation", e.target.value)} aria-label="Occupation">
                  <option value="">Select occupation</option>
                  {occupationOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <input className={inputClass} value={form.organization} onChange={(e) => set("organization", e.target.value)} placeholder="School, college, institute, or company (optional)" aria-label="Organization" />
              </div>
            )}
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="How far can you travel?">
              <select className={inputClass} value={form.maxTravelDistance} onChange={(e) => set("maxTravelDistance", e.target.value)}>
                <option value="">Select distance</option>
                {travelDistanceOptions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Do you have a vehicle?">
              <div className="flex flex-wrap items-center gap-2">
                {["yes", "no"].map((v) => (
                  <Chip key={v} active={form.hasVehicle === v} onClick={() => set("hasVehicle", v)}>{v === "yes" ? "Yes" : "No"}</Chip>
                ))}
              </div>
              {form.hasVehicle === "yes" && (
                <input className={`${inputClass} mt-3`} value={form.vehicleNumber} onChange={(e) => set("vehicleNumber", e.target.value)} placeholder="Vehicle number, e.g. KA01AB1234" aria-label="Vehicle number" />
              )}
            </Field>
          </div>

          <Field label="Available timings">
            <div className="space-y-2">
              {Object.entries(timingGroups).map(([group, slots]) => (
                <div key={group}>
                  <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{group}</p>
                  <div className="flex flex-wrap gap-2">
                    {slots.map((t) => <Chip key={t} active={form.timings.includes(t)} onClick={() => toggle("timings", t)}>{t}</Chip>)}
                  </div>
                </div>
              ))}
            </div>
          </Field>

          <div>
            <span className={labelClass}>Documents</span>
            <div className="grid gap-3 md:grid-cols-2">
              {DOCS.map((d) => (
                <label key={d.key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 p-3 hover:border-indigo-400 dark:border-slate-700">
                  {uploading[d.key]
                    ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-indigo-600" />
                    : form[d.key]
                      ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      : <FileUp className="h-5 w-5 shrink-0 text-slate-400" />}
                  <span className="min-w-0 text-sm">
                    <span className="block font-semibold text-slate-800 dark:text-slate-100">
                      {d.label} {d.required && <span className="text-rose-500">*</span>}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {uploading[d.key] ? "Uploading..." : form[d.key] ? "Uploaded. Tap to replace." : "Tap to upload (max 8MB)"}
                    </span>
                  </span>
                  <input type="file" accept={d.accept} className="sr-only" onChange={(e) => { upload(d.key, e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={form.agreement} onChange={(e) => set("agreement", e.target.checked)} />
              <span>
                I agree to pay a <strong>32% Placement, Facilitation &amp; Verification Fee</strong> for the <em>first two months</em> for each opportunity facilitated by <strong>Saraswati Tutorials</strong>.
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={form.attendanceAgreement} onChange={(e) => set("attendanceAgreement", e.target.checked)} />
              <span>
                I agree to update my attendance after every class using the credentials provided by Saraswati Tutorials. Classes not marked in the portal will not be considered completed and may not be included for payment processing.
              </span>
            </label>
          </div>

          {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}

          <button
            type="submit"
            disabled={sending || busy}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60 sm:w-auto cursor-pointer"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {sending ? "Sending..." : busy ? "Uploading..." : "Submit for full verification"}
          </button>
        </form>
      )}
    </section>
  );
}
