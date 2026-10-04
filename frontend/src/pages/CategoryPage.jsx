import React from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import courseStructure from "../data/courseData";

export default function CategoryPage() {
  const { category } = useParams();

  const mainCategory = courseStructure[category];

  if (!mainCategory) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-16 text-center text-slate-700 dark:bg-slate-950 dark:text-slate-300">
        Category Not Found
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-5xl px-6 py-16">
        {/* SEO */}
        <Helmet>
          <title>{mainCategory.name} in Bangalore | Saraswati Tutorial</title>
          <meta
            name="description"
            content={
              mainCategory.description ||
              `Best ${mainCategory.name} in Bangalore with expert tutors. Book demo today.`
            }
          />
        </Helmet>

        {/* Breadcrumb */}
        <div className="mb-5 text-sm text-slate-500 dark:text-slate-400">
          <Link
            to="/"
            className="transition hover:text-slate-900 hover:underline dark:hover:text-slate-100"
          >
            Home
          </Link>{" "}
          / <span>{mainCategory.name}</span>
        </div>

        {/* Header */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-8 shadow-lg shadow-slate-200/20 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/20 sm:p-10">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-4xl">
            {mainCategory.name}
          </h1>

          {mainCategory.description ? (
            <p className="mt-4 max-w-3xl leading-7 text-slate-600 dark:text-slate-400">
              {mainCategory.description}
            </p>
          ) : null}

          {/* Subcategories */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {Object.entries(mainCategory.subcategories).map(([key, sub]) => (
              <Link
                key={key}
                to={`/courses/${category}/${key}`}
                className="group rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 font-medium text-blue-600 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/70 dark:text-blue-400 dark:hover:border-blue-800 dark:hover:bg-slate-800"
              >
                <span className="transition group-hover:underline">
                  {sub.name}
                </span>
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
