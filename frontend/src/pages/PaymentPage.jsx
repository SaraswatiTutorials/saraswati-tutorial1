import { Link } from "react-router-dom";
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Home,
  MessageCircle,
} from "lucide-react";

const RAZORPAY_PAYMENT_LINK = "https://razorpay.me/@SaraswatiTutorials";

export default function PaymentPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_32%),radial-gradient(circle_at_top_right,#dcfce7,transparent_28%),linear-gradient(135deg,#f8fafc,#eef2ff)] dark:bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_35%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_30%),linear-gradient(135deg,#020617,#0b1229)] px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </Link>

          <a
            href="https://wa.me/918904457689"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-500 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-green-600"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
        </div>

        <div className="overflow-hidden rounded-[1.5rem] sm:rounded-[2.5rem] bg-slate-950 shadow-2xl dark:ring-1 dark:ring-slate-800">
          <div className="relative grid gap-8 p-4 sm:p-6 text-white md:grid-cols-[1.1fr_0.9fr] md:p-10">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/30 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />

            <div className="relative z-10">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-blue-200 ring-1 ring-white/15">
                <CreditCard className="h-4 w-4" />
                Demo Class Payment
              </div>

              <h1 className="text-3xl sm:text-4xl font-black tracking-tight md:text-6xl">
                Complete your demo class payment securely
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
                Pay securely through Razorpay to confirm your demo class request
                with Saraswati Tutorials.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <a
                  href={RAZORPAY_PAYMENT_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center rounded-2xl bg-white dark:bg-white px-7 py-4 text-sm font-black text-slate-950 dark:text-slate-950 shadow-xl transition hover:-translate-y-0.5"
                >
                  Pay Now
                  <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" />
                </a>

                <a
                  href="https://wa.me/918904457689"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-2xl border border-white/25 px-7 py-4 text-sm font-black text-white transition hover:bg-white/10"
                >
                  Need Help?
                </a>
              </div>
            </div>

            <div className="relative z-10 rounded-[1.2rem] sm:rounded-[2rem] bg-white p-6 text-slate-950 shadow-2xl dark:bg-slate-900 dark:text-white dark:ring-1 dark:ring-slate-700/70">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                <ShieldCheck className="h-8 w-8" />
              </div>

              <h2 className="text-2xl font-black dark:text-white">
                Secure Razorpay Checkout
              </h2>

              <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">
                You will be redirected to Saraswati Tutorials’ Razorpay payment
                page. After payment, please share the payment confirmation on
                WhatsApp if required.
              </p>

              <div className="mt-6 space-y-3">
                <InfoPoint text="Secure payment through Razorpay" />
                <InfoPoint text="Demo class payment confirmation" />
                <InfoPoint text="WhatsApp support available" />
                <InfoPoint text="Works with UPI, cards, and other Razorpay-supported methods" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <SmallCard
            title="Step 1"
            text="Click Pay Now and complete payment on Razorpay."
          />
          <SmallCard
            title="Step 2"
            text="Take a screenshot or keep the payment confirmation."
          />
          <SmallCard
            title="Step 3"
            text="Our team will coordinate your demo class details."
          />
        </div>
      </div>
    </div>
  );
}

function InfoPoint({ text }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/70">
      <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{text}</p>
    </div>
  );
}

function SmallCard({ title, text }) {
  return (
    <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900/80 dark:ring-slate-800">
      <h3 className="text-lg font-black text-slate-950 dark:text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{text}</p>
    </div>
  );
}