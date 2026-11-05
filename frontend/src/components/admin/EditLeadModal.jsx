import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Edit, Plus, Trash2, X } from "lucide-react";
import { API_BASE } from "../../config";
import TimeInput12 from "../TimeInput12";
import { PLANS } from "../../data/plansConfig";
import {
  classOptions,
  dayOptions,
  getCurriculumOptions,
  preferredGenderOptions,
  preferredModeOptions,
  subjectOptions,
} from "../../data/enquiryOptions";
import { FEE_CONFIG } from "../../pricing/feeConfig";
import { calculateQuote, toEnquiryFields } from "../../pricing/feeEngine";

const INPUT_CLASS =
  "h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm font-medium text-slate-800 dark:text-slate-100 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";

const TEXT_FIELDS = ["parentName", "phone", "email", "address", "area", "city", "pincode", "planType", "preferredMode", "preferredGender"];
const NUMBER_FIELDS = ["daysPerWeek", "hoursPerDay", "monthlyFees", "totalClasses"];
const TIMING_FIELDS = ["classTimingType", "startTime", "endTime"];

const EMPTY_WARD = { studentName: "", schoolName: "", classGrade: "", curriculum: "", subjectsNeeded: [], specialNeeds: "" };

const numberText = (value) => (value === null || value === undefined ? "" : String(value));

function toForm(lead) {
  const form = {
    wards: (lead.wards?.length ? lead.wards : [EMPTY_WARD]).map((ward) => ({
      ...EMPTY_WARD,
      ...ward,
      subjectsNeeded: [...(ward.subjectsNeeded || [])],
    })),
    preferredDays: [...(lead.preferredDays || [])],
    classTimingType: lead.classTimingType || (lead.startTime ? "Fixed Timing" : ""),
    startTime: lead.startTime || "",
    endTime: lead.endTime || "",
  };
  for (const key of TEXT_FIELDS) form[key] = lead[key] || "";
  for (const key of NUMBER_FIELDS) form[key] = numberText(lead[key]);
  return form;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Only what the admin changed is sent, so an older record's untouched fields stay as they are
function buildChanges(form, initial, quote) {
  const changes = {};
  for (const key of [...TEXT_FIELDS, ...NUMBER_FIELDS]) {
    if (form[key].trim() !== initial[key].trim()) changes[key] = form[key].trim();
  }
  if (!same(form.preferredDays, initial.preferredDays)) changes.preferredDays = form.preferredDays;
  if (!same(form.wards, initial.wards)) changes.wards = form.wards;
  if (TIMING_FIELDS.some((key) => form[key] !== initial[key])) {
    for (const key of TIMING_FIELDS) changes[key] = form[key];
  }

  // A fee set to the standard price keeps that price's per-student and sibling breakdown
  if (changes.monthlyFees !== undefined && quote?.ok && Number(form.monthlyFees) === quote.monthlyPayable) {
    const { totalBaseFee, studentFees, siblingDiscount, siblingConcessionPercent } = toEnquiryFields(quote);
    Object.assign(changes, { totalBaseFee, studentFees, siblingDiscount, siblingConcessionPercent });
  }
  return changes;
}

const formatRupees = (amount) => `₹${Number(amount).toLocaleString("en-IN")}`;

// Keeps a value saved by an older form selectable even though it is no longer offered
function withSaved(options, saved) {
  const list = options.map((option) => (typeof option === "string" ? { value: option, label: option } : option));
  return saved && !list.some((option) => option.value === saved) ? [...list, { value: saved, label: saved }] : list;
}

function Field({ label, required = false, hint, className = "", children }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
    </label>
  );
}

function TextField({ label, required, hint, className, value, onChange, ...inputProps }) {
  return (
    <Field label={label} required={required} hint={hint} className={className}>
      <input {...inputProps} className={INPUT_CLASS} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function SelectField({ label, hint, className, value, onChange, options, emptyLabel = "Not set" }) {
  return (
    <Field label={label} hint={hint} className={className}>
      <select className={`${INPUT_CLASS} cursor-pointer`} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{emptyLabel}</option>
        {withSaved(options, value).map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </Field>
  );
}

function ChipGroup({ label, options, selected, onChange }) {
  const toggle = (option) =>
    onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]);

  return (
    <fieldset className="min-w-0 sm:col-span-2">
      <legend className="mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {withSaved(options, null)
          .concat(selected.filter((item) => !options.includes(item)).map((item) => ({ value: item, label: item })))
          .map(({ value, label: optionLabel }) => {
            const checked = selected.includes(value);
            return (
              <label
                key={value}
                className={`cursor-pointer select-none rounded-lg border px-2.5 py-1.5 text-xs font-medium transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500 ${
                  checked
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(value)} />
                {optionLabel}
              </label>
            );
          })}
      </div>
    </fieldset>
  );
}

function Section({ title, children }) {
  return (
    <section className="border-b border-slate-100 dark:border-slate-800 py-5 first:pt-0 last:border-0 last:pb-0">
      <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
      {children}
    </section>
  );
}

function StandardFee({ quote, monthlyFees, onUse }) {
  if (!quote) return null;

  if (!quote.ok) {
    return (
      <p className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
        No standard fee for this selection: {quote.errors[0]?.message} You can still save a custom fee.
      </p>
    );
  }

  if (Number(monthlyFees) === quote.monthlyPayable) {
    return <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">This is the standard fee for this selection.</p>;
  }

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 px-3 py-2 text-xs text-indigo-900 dark:text-indigo-200">
      <span>Standard fee for this selection: <strong>{formatRupees(quote.monthlyPayable)}</strong> per month</span>
      <button
        type="button"
        onClick={() => onUse(quote.monthlyPayable)}
        className="rounded-lg bg-indigo-600 px-2.5 py-1 font-semibold text-white transition hover:bg-indigo-700 cursor-pointer"
      >
        Use this fee
      </button>
    </div>
  );
}

// Lets the admin correct a parent enquiry: parent, students, plan and fee, and schedule
export default function EditLeadModal({ lead, onClose, onSaved }) {
  const [initial] = useState(() => toForm(lead));
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // A save error stops applying once the admin changes something
  useEffect(() => setError(""), [form]);

  const setField = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));

  const setWard = (index, key) => (value) =>
    setForm((prev) => ({
      ...prev,
      wards: prev.wards.map((ward, i) => (i === index ? { ...ward, [key]: value } : ward)),
    }));

  const addWard = () => setForm((prev) => ({ ...prev, wards: [...prev.wards, { ...EMPTY_WARD, subjectsNeeded: [] }] }));

  const removeWard = (index) => setForm((prev) => ({ ...prev, wards: prev.wards.filter((_, i) => i !== index) }));

  // Classes per package follow days per week (days × 4) unless the admin set a different number
  const setDaysPerWeek = (value) =>
    setForm((prev) => {
      const followsDays = !prev.totalClasses || Number(prev.totalClasses) === Number(prev.daysPerWeek) * 4;
      return {
        ...prev,
        daysPerWeek: value,
        totalClasses: followsDays && value ? String(Number(value) * 4) : prev.totalClasses,
      };
    });

  const quote = useMemo(
    () =>
      form.planType
        ? calculateQuote({
            planType: form.planType,
            daysPerWeek: form.daysPerWeek,
            hoursPerDay: form.hoursPerDay,
            preferredMode: form.preferredMode,
            wards: form.wards,
          })
        : null,
    [form.planType, form.daysPerWeek, form.hoursPerDay, form.preferredMode, form.wards]
  );

  const requestClose = () => {
    if (same(form, initial) || window.confirm("Discard your changes to this enquiry?")) onClose();
  };

  const save = async (e) => {
    e.preventDefault();
    const changes = buildChanges(form, initial, quote);
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/parent-enquiries/${lead._id}/details`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
        },
        body: JSON.stringify(changes),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Couldn't save the changes. Please try again.");
        return;
      }
      onSaved(data);
    } catch {
      setError("Couldn't reach the server, so nothing was saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const fixedTiming = form.classTimingType === "Fixed Timing";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-4">
      <form
        onSubmit={save}
        noValidate
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-lead-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="edit-lead-title" className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <Edit className="h-5 w-5 shrink-0 text-indigo-500" />
              Edit enquiry
            </h2>
            <p className="mt-0.5 break-words text-xs text-slate-500 dark:text-slate-400">
              {initial.parentName || "Unnamed parent"}
              {lead.requirementId ? ` · ${lead.requirementId}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <Section title="Parent">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Parent name" required value={form.parentName} onChange={setField("parentName")} autoComplete="off" />
              <TextField
                label="Phone"
                required
                type="tel"
                value={form.phone}
                onChange={setField("phone")}
                autoComplete="off"
                hint="The parent signs in to the portal with this number."
              />
              <TextField label="Email" type="email" value={form.email} onChange={setField("email")} autoComplete="off" />
              <TextField label="City" value={form.city} onChange={setField("city")} autoComplete="off" />
              <TextField label="Address" className="sm:col-span-2" value={form.address} onChange={setField("address")} autoComplete="off" />
              <TextField label="Area" value={form.area} onChange={setField("area")} autoComplete="off" />
              <TextField label="PIN code" inputMode="numeric" value={form.pincode} onChange={setField("pincode")} autoComplete="off" />
            </div>
          </Section>

          <Section title="Students">
            <div className="space-y-3">
              {form.wards.map((ward, index) => (
                <div key={index} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 sm:p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Student {index + 1}</p>
                    {form.wards.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeWard(index)}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField label="Student name" required value={ward.studentName} onChange={setWard(index, "studentName")} autoComplete="off" />
                    <TextField label="School" value={ward.schoolName} onChange={setWard(index, "schoolName")} autoComplete="off" />
                    <SelectField label="Class" value={ward.classGrade} onChange={setWard(index, "classGrade")} options={classOptions} />
                    <SelectField
                      label="Board / course"
                      value={ward.curriculum}
                      onChange={setWard(index, "curriculum")}
                      options={getCurriculumOptions(ward.classGrade)}
                    />
                    <ChipGroup label="Subjects" options={subjectOptions} selected={ward.subjectsNeeded} onChange={setWard(index, "subjectsNeeded")} />
                    <TextField label="Special notes" className="sm:col-span-2" value={ward.specialNeeds} onChange={setWard(index, "specialNeeds")} autoComplete="off" />
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addWard}
              className="mt-3 flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add student
            </button>
          </Section>

          <Section title="Plan and fee">
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Plan"
                value={form.planType}
                onChange={setField("planType")}
                options={PLANS.map((plan) => ({ value: plan.id, label: plan.title }))}
                emptyLabel="No plan"
              />
              <TextField label="Monthly fee (₹)" inputMode="numeric" value={form.monthlyFees} onChange={setField("monthlyFees")} autoComplete="off" />
              <SelectField
                label="Days per week"
                value={form.daysPerWeek}
                onChange={setDaysPerWeek}
                options={FEE_CONFIG.supportedSchedule.daysPerWeek.map(String)}
              />
              <SelectField
                label="Hours per class"
                value={form.hoursPerDay}
                onChange={setField("hoursPerDay")}
                options={FEE_CONFIG.supportedSchedule.sessionHours.map(String)}
              />
              <TextField
                label="Classes per package"
                inputMode="numeric"
                value={form.totalClasses}
                onChange={setField("totalClasses")}
                autoComplete="off"
                hint="Package progress and renewal reminders count against this."
              />
            </div>
            <StandardFee quote={quote} monthlyFees={form.monthlyFees} onUse={(fee) => setField("monthlyFees")(String(fee))} />
          </Section>

          <Section title="Tuition preferences">
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField label="Tuition mode" value={form.preferredMode} onChange={setField("preferredMode")} options={preferredModeOptions} />
              <SelectField label="Tutor gender" value={form.preferredGender} onChange={setField("preferredGender")} options={preferredGenderOptions} />
              <ChipGroup label="Preferred days" options={dayOptions} selected={form.preferredDays} onChange={setField("preferredDays")} />
              <SelectField
                label="Class timing"
                value={form.classTimingType}
                onChange={setField("classTimingType")}
                options={["Fixed Timing", "Flexible"]}
              />
              {fixedTiming && (
                <>
                  <div className="hidden sm:block" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Start time</p>
                    <TimeInput12 ariaLabel="Start time" className={INPUT_CLASS} value={form.startTime} onChange={setField("startTime")} />
                  </div>
                  <div className="min-w-0">
                    <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">End time</p>
                    <TimeInput12 ariaLabel="End time" className={INPUT_CLASS} value={form.endTime} onChange={setField("endTime")} />
                  </div>
                </>
              )}
            </div>
          </Section>
        </div>

        <footer className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 sm:px-6">
          {error && (
            <p role="alert" className="mb-3 flex items-start gap-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-sm font-medium text-rose-700 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 break-words">{error}</span>
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lead.odooLeadId ? "Saving updates Odoo. " : ""}Parents and tutors aren't messaged.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={requestClose}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </footer>
      </form>
    </div>
  );
}
