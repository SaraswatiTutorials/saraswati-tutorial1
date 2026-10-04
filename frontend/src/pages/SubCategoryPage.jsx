import React from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import courseStructure from "../data/courseData";

export default function SubCategoryPage() {
  const { main, sub } = useParams();

  const mainCategory = courseStructure[main];
  const subData = mainCategory?.subcategories[sub];

  if (!mainCategory || !subData) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-16 text-center text-slate-700 dark:bg-slate-950 dark:text-slate-300">
        Not Found
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-5xl px-6 py-16">
        {/* SEO */}
        <Helmet>
          <title>
            {subData.name} Tuition in Bangalore | Saraswati Tutorial
          </title>

          <meta
            name="description"
            content={`Find best ${subData.name} tuition in Bangalore with expert tutors. Book demo today.`}
          />
        </Helmet>

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

          <span>{subData.name}</span>
        </div>

        {/* Main Content */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-8 shadow-xl shadow-slate-200/20 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/20 sm:p-10">
          {/* H1 */}
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-4xl">
            {subData.name} Tuition in Bangalore
          </h1>

          {/* Intro */}
          <p className="mt-4 max-w-3xl leading-7 text-slate-600 dark:text-slate-400">
            Explore the best {subData.name} courses in Bangalore with
            experienced tutors and flexible learning options.
          </p>

          {/* Courses Grid */}
          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
            {subData.courses.map((c) => (
              <Link
                key={c.slug}
                to={`/courses/${main}/${sub}/${c.slug}`}
                className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/70 dark:hover:border-blue-800 dark:hover:bg-slate-800"
              >
                <h3 className="text-lg font-semibold text-slate-900 transition group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400">
                  {c.name}
                </h3>

                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Learn {c.name} with expert tutors
                </p>
              </Link>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-10">
            <Link
              to="/parent-enquiry"
              className="inline-flex items-center rounded-2xl bg-slate-900 px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-slate-800 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white dark:focus:ring-slate-500 dark:focus:ring-offset-slate-900"
            >
              Book Demo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
