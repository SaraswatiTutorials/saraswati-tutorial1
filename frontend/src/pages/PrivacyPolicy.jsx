import React from "react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200/80 bg-white p-8 shadow-xl shadow-slate-200/30 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/20 sm:p-10">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Privacy Policy
          </h1>

          <p className="text-sm text-slate-500 dark:text-slate-400">
            Last Updated: April 2026
          </p>
        </div>

        <p className="mb-8 leading-7 text-slate-700 dark:text-slate-300">
          At{" "}
          <strong className="font-semibold text-slate-900 dark:text-slate-100">
            Saraswati Tutorials
          </strong>
          , we are committed to protecting the privacy of our students,
          parents, and tutors.
        </p>

        <section className="mb-7">
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            1. Information We Collect
          </h2>

          <ul className="list-disc space-y-1 pl-5 leading-7 text-slate-700 dark:text-slate-300">
            <li>Name of student/parent</li>
            <li>Contact details (phone number, email)</li>
            <li>Location/address for tutor assignment</li>
            <li>Academic details (class, subjects, curriculum)</li>
            <li>
              Payment-related information (processed securely via third-party
              providers)
            </li>
          </ul>
        </section>

        <section className="mb-7">
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            2. How We Use Information
          </h2>

          <ul className="list-disc space-y-1 pl-5 leading-7 text-slate-700 dark:text-slate-300">
            <li>Assigning suitable tutors based on requirements</li>
            <li>Scheduling demo sessions and classes</li>
            <li>Providing customer support</li>
            <li>Improving our services</li>
          </ul>
        </section>

        <section className="mb-7">
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            3. Data Protection
          </h2>

          <p className="leading-7 text-slate-700 dark:text-slate-300">
            We take reasonable measures to protect personal data from
            unauthorized access, misuse, or disclosure.
          </p>
        </section>

        <section className="mb-7">
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            4. Sharing of Information
          </h2>

          <ul className="list-disc space-y-1 pl-5 leading-7 text-slate-700 dark:text-slate-300">
            <li>We do not sell or rent personal data.</li>
            <li>
              Limited information may be shared with assigned tutors strictly
              for service purposes.
            </li>
          </ul>
        </section>

        <section className="mb-7">
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            5. Confidentiality
          </h2>

          <p className="leading-7 text-slate-700 dark:text-slate-300">
            All tutor and student details are treated as confidential and used
            only for operational purposes.
          </p>
        </section>

        <section className="mb-7">
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            6. Third-Party Services
          </h2>

          <p className="leading-7 text-slate-700 dark:text-slate-300">
            Payments and communications may involve trusted third-party
            platforms. Saraswati Tutorials is not responsible for third-party
            policies.
          </p>
        </section>

        <section className="mb-7">
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            7. Consent
          </h2>

          <p className="leading-7 text-slate-700 dark:text-slate-300">
            By using our services, you consent to this Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            8. Updates
          </h2>

          <p className="leading-7 text-slate-700 dark:text-slate-300">
            We may update this policy from time to time. Continued use of
            services implies acceptance of changes.
          </p>
        </section>
      </div>
    </div>
  );
}
