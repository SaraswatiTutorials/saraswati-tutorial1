import React from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import courseStructure from "../data/courseData";

export default function CoursePage() {
  const { main, sub, course } = useParams();

  const mainCategory = courseStructure[main];
  const subCategory = mainCategory?.subcategories[sub];
  const courseData = subCategory?.courses.find(
    (c) => c.slug === course
  );

  if (!courseData) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-16 text-center text-slate-700 dark:bg-slate-950 dark:text-slate-300">
        Page Not Found
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-5xl px-6 py-16">
        {/* Breadcrumb */}
        <div className="mb-6 flex flex-wrap gap-1 text-sm text-slate-500 dark:text-slate-400">
          <Link
            to="/"
            className="transition hover:text-slate-900 hover:underline dark:hover:text-slate-100"
          >
            Home
          </Link>
          <span>/</span>
          <Link
            to={`/courses/${main}`}
            className="transition hover:text-slate-900 hover:underline dark:hover:text-slate-100"
          >
            {mainCategory.name}
          </Link>
          <span>/</span>
          <Link
            to={`/courses/${main}/${sub}`}
            className="transition hover:text-slate-900 hover:underline dark:hover:text-slate-100"
          >
            {subCategory.name}
          </Link>
          <span>/</span>
          <span>{courseData.name}</span>
        </div>

        {/* SEO */}
        <Helmet>
          <title>
            {courseData.seoTitle || `${courseData.name} in Bangalore`}
          </title>
          <meta
            name="description"
            content={
              courseData.seoDesc ||
              `Best ${courseData.name} in Bangalore with expert tutors. Book demo today.`
            }
          />
        </Helmet>

        {/* Main Content */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-8 shadow-xl shadow-slate-200/20 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/20 sm:p-10">
          {/* H1 */}
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-4xl">
            {courseData.name}
          </h1>

          {/* Intro */}
          <p className="mt-4 max-w-3xl leading-7 text-slate-600 dark:text-slate-400">
            Join the best {courseData.name} in Bangalore with experienced
            tutors and personalized learning.
          </p>

          {/* Why Choose Us */}
          <section className="mt-10">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Why Choose Us for {courseData.name}?
            </h2>

            <ul className="mt-4 list-disc space-y-2 pl-6 leading-7 text-slate-600 dark:text-slate-400">
              <li>Experienced tutors</li>
              <li>1-on-1 attention</li>
              <li>Flexible timings</li>
              <li>Affordable pricing</li>
            </ul>
          </section>

          {/* Fees & Syllabus */}
          <section className="mt-10">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {courseData.name} Fees &amp; Syllabus
            </h2>

            <p className="mt-4 leading-7 text-slate-600 dark:text-slate-400">
              Complete syllabus coverage with affordable fees starting from
              ?300/hr.
            </p>
          </section>

          {/* CTA */}
          <div className="mt-10">
            <Link
              to="/parent-enquiry"
              className="inline-flex items-center rounded-2xl bg-slate-900 px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-slate-800 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white dark:focus:ring-slate-500 dark:focus:ring-offset-slate-900"
            >
              Enroll Now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
