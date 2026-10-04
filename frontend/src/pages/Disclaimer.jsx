import React from "react";

export default function Disclaimer() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200/80 bg-white p-8 shadow-xl shadow-slate-200/30 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/20 sm:p-10">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Disclaimer
          </h1>

          <p className="text-sm text-slate-500 dark:text-slate-400">
            Last Updated: April 2026
          </p>
        </div>

        <p className="mb-8 leading-7 text-slate-700 dark:text-slate-300">
          Saraswati Tutorials acts as a facilitator connecting
          students/parents with qualified tutors.
        </p>

        <section className="mb-7">
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            1. No Guarantee of Results
          </h2>

          <p className="leading-7 text-slate-700 dark:text-slate-300">
            We do not guarantee specific academic results, ranks, or exam
            outcomes.
          </p>
        </section>

        <section className="mb-7">
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            2. Tutor Performance
          </h2>

          <p className="leading-7 text-slate-700 dark:text-slate-300">
            While we conduct background verification, teaching effectiveness
            may vary based on student compatibility and effort.
          </p>
        </section>

        <section className="mb-7">
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            3. Role of Platform
          </h2>

          <p className="leading-7 text-slate-700 dark:text-slate-300">
            We provide tutor matching, support, and monitoring services.
            However, the actual teaching is conducted independently by
            tutors.
          </p>
        </section>

        <section className="mb-7">
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            4. Parental Responsibility
          </h2>

          <p className="leading-7 text-slate-700 dark:text-slate-300">
            Parents/guardians are advised to monitor sessions and provide
            feedback for better outcomes.
          </p>
        </section>

        <section className="mb-7">
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            5. External Factors
          </h2>

          <ul className="list-disc space-y-1 pl-5 leading-7 text-slate-700 dark:text-slate-300">
            <li>Student absence</li>
            <li>Technical issues (for online classes)</li>
            <li>External circumstances beyond our control</li>
          </ul>
        </section>

        <section className="mb-7">
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            6. Limitation of Liability
          </h2>

          <p className="leading-7 text-slate-700 dark:text-slate-300">
            Saraswati Tutorials shall not be held liable for indirect,
            incidental, or consequential damages arising from use of
            services.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            7. Policy Acceptance
          </h2>

          <p className="leading-7 text-slate-700 dark:text-slate-300">
            By using our services, you acknowledge and agree to this
            disclaimer.
          </p>
        </section>
      </div>
    </div>
  );
}
