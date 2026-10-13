import React from "react";
import { PLANS } from "../data/plansConfig";

const inr = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

const planTitle = (planType) => PLANS.find((p) => p.id === planType)?.title || planType;

const hoursLabel = (hours) => `${hours} hour${hours === 1 ? "" : "s"}`;

// Parent-facing fee breakdown for a quote from the shared fee engine.
// Everything shown here is calculated on the fly; only the monthly totals are
// submitted with the enquiry. showSummary adds the selected plan and schedule.
export default function FeeBreakdown({ quote, showSummary = false }) {
  if (!quote) return null;

  if (!quote.ok) {
    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/30 p-4 text-xs font-bold text-red-700 dark:text-red-300">
        {quote.errors.map((e, i) => (
          <p key={i}>{e.message}</p>
        ))}
        <p className="mt-1 font-semibold">Please choose another plan or schedule.</p>
      </div>
    );
  }

  const { rules } = quote;
  const multipleStudents = quote.students.length > 1;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 p-4 md:p-5 text-xs">
      <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
        Fee Breakdown
      </h5>

      {showSummary && (
        <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 sm:grid-cols-4">
          <SummaryItem label="Plan" value={planTitle(quote.planType)} />
          <SummaryItem label="Schedule" value={`${quote.daysPerWeek} days/week × ${hoursLabel(quote.hoursPerDay)}`} />
          <SummaryItem label="Mode" value={quote.preferredMode || "—"} />
          <SummaryItem label="Classes / month" value={`${quote.totalClasses} (≈ ${inr(quote.costPerClass)} each)`} />
        </dl>
      )}

      <div className="space-y-4">
        {quote.students.map((student) => (
          <div key={student.index} className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-black text-slate-800 dark:text-slate-100">
                {student.studentName || `Student ${student.index + 1}`}
              </span>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                {student.gradeGroup} • {student.curriculum || "—"}
              </span>
            </div>

            {rules.subjectPricingEnabled ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px] text-left">
                  <thead>
                    <tr className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      <th className="py-1 pr-2">Subject</th>
                      <th className="py-1 px-2 text-right">Base</th>
                      <th className="py-1 px-2 text-right">Discount</th>
                      <th className="py-1 pl-2 text-right">Final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {student.subjects.map((line) => (
                      <tr key={line.name} className="border-t border-slate-200/70 dark:border-slate-700/70 font-semibold text-slate-600 dark:text-slate-300">
                        <td className="py-1.5 pr-2">{line.name}</td>
                        <td className="py-1.5 px-2 text-right">{inr(line.basePrice)}</td>
                        <td className="py-1.5 px-2 text-right text-emerald-700 dark:text-emerald-400">
                          {line.discountPercent > 0 ? `-${inr(line.discountAmount)} (${line.discountPercent}%)` : "—"}
                        </td>
                        <td className="py-1.5 pl-2 text-right font-extrabold text-slate-900 dark:text-white">{inr(line.finalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="font-semibold text-slate-500 dark:text-slate-400">
                Subjects{student.subjects.length > 0 ? ` (${student.subjects.length})` : ""}:{" "}
                {student.subjects.map((s) => s.name).join(", ") || "—"}
                <span className="block text-[10px] text-slate-400 dark:text-slate-500">
                  {student.subjects.length > 1
                    ? `All ${student.subjects.length} subjects are covered by one monthly fee`
                    : "Included in one monthly fee"}
                </span>
              </p>
            )}

            <div className="flex justify-between font-bold text-slate-700 dark:text-slate-200">
              <span>Monthly fee{multipleStudents ? ` (${student.studentName || `Student ${student.index + 1}`})` : ""}:</span>
              <span>{inr(student.monthlyFee)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-1.5 font-semibold text-slate-600 dark:text-slate-300">
        {rules.subjectPricingEnabled && (
          <>
            <div className="flex justify-between">
              <span>Total before discounts:</span>
              <span>{inr(quote.totalBeforeSubjectDiscount)}</span>
            </div>
            <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
              <span>Additional-subject discount ({rules.additionalSubjectDiscountPercent}% each after the first):</span>
              <span>-{inr(quote.subjectDiscountTotal)}</span>
            </div>
          </>
        )}
        {quote.siblingDiscount > 0 && (
          <>
            <div className="flex justify-between">
              <span>Total for all students:</span>
              <span>{inr(quote.totalBaseFee)}</span>
            </div>
            <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
              <span>Sibling concession ({quote.siblingConcessionPercent}%):</span>
              <span>-{inr(quote.siblingDiscount)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between pt-1.5 border-t border-slate-200 dark:border-slate-700 text-sm font-black text-slate-900 dark:text-white">
          <span>Monthly payable:</span>
          <span>{inr(quote.monthlyPayable)}</span>
        </div>
      </div>

      {rules.prepaymentEnabled && quote.prepaymentOptions.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
          <h6 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
            Pay in Advance and Save
          </h6>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left">
              <thead>
                <tr className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <th className="py-1 pr-2">Term</th>
                  <th className="py-1 px-2 text-right">Without discount</th>
                  <th className="py-1 px-2 text-right">Discount</th>
                  <th className="py-1 pl-2 text-right">You pay</th>
                </tr>
              </thead>
              <tbody>
                {quote.prepaymentOptions.map((opt) => (
                  <tr key={opt.months} className="border-t border-slate-200/70 dark:border-slate-700/70 font-semibold text-slate-600 dark:text-slate-300">
                    <td className="py-1.5 pr-2">{opt.months === 12 ? "12 months (annual)" : `${opt.months} months`}</td>
                    <td className="py-1.5 px-2 text-right">{inr(opt.grossTotal)}</td>
                    <td className="py-1.5 px-2 text-right text-emerald-700 dark:text-emerald-400">
                      -{inr(opt.discountAmount)} ({opt.discountPercent}%)
                    </td>
                    <td className="py-1.5 pl-2 text-right font-extrabold text-slate-900 dark:text-white">{inr(opt.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10px] font-medium text-slate-400 dark:text-slate-500 leading-relaxed">
            For information only. Your enquiry records the monthly fee; our team will confirm any advance payment with you.
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-bold text-slate-800 dark:text-slate-100 break-words">{value}</dd>
    </div>
  );
}
