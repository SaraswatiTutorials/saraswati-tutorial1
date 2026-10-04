import { Star, Quote, UserRound } from "lucide-react";

const testimonials = [
  {
    name: "Priya Sharma",
    role: "Parent of Class 10 Student",
    text: "Saraswati Tutorial helped us find a reliable home tutor quickly. The demo class was smooth and the tutor understood my child's learning needs very well.",
    rating: 5,
  },
  {
    name: "Ramesh Kumar",
    role: "Parent",
    text: "Very professional process. We received quick support and the tutor was experienced, punctual, and patient.",
    rating: 5,
  },
  {
    name: "Ananya Rao",
    role: "Student",
    text: "My science concepts became much clearer after joining. The tutor explained everything step by step.",
    rating: 5,
  },
  {
    name: "Sonal Gupta",
    role: "Parent",
    text: "Good platform for finding verified tutors in Bangalore. The team followed up properly and helped us choose the right tutor.",
    rating: 5,
  },
  {
    name: "Amit Verma",
    role: "Parent of Class 8 Student",
    text: "The tutor was friendly and made learning comfortable. My child is more confident now.",
    rating: 5,
  },
  {
    name: "Neha Singh",
    role: "Parent",
    text: "Easy enquiry process, fast response, and good tutor options. Highly recommended for parents looking for home tuition.",
    rating: 5,
  },
];

export default function Testimonials() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 px-6 py-20 text-white">
        <div className="mx-auto max-w-6xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-300">
            Testimonials
          </p>

          <h1 className="mt-4 text-4xl font-bold md:text-6xl">
            What Parents &amp; Students Say
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-200">
            Real feedback from families who trusted Saraswati Tutorial for
            personalized learning support.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((item, index) => (
            <div
              key={index}
              className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-lg shadow-slate-200/20 transition hover:-translate-y-1 hover:shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/20"
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                  <UserRound className="h-6 w-6" />
                </div>

                <Quote className="h-8 w-8 text-slate-200 dark:text-slate-700" />
              </div>

              <div className="mb-4 flex gap-1">
                {Array.from({ length: item.rating }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>

              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                “{item.text}”
              </p>

              <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-700">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  {item.name}
                </h3>

                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {item.role}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
