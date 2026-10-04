import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackLeadConversion } from "../utils/analytics";

const PARENT_WHATSAPP_LINK = "https://wa.me/message/VX2T7QEATZPRL1";
const TUTOR_WHATSAPP_LINK = "https://wa.me/message/TI4DOHTXZTLGD1";

export default function ThankYou() {
  const location = useLocation();

  const params = new URLSearchParams(location.search);
  const type = params.get("type");

  const isTutor = type === "tutor";

  const whatsappLink = isTutor
    ? TUTOR_WHATSAPP_LINK
    : PARENT_WHATSAPP_LINK;

  useEffect(() => {
    const wasSubmitted =
      sessionStorage.getItem("enquiry_form_submitted") === "true";

    if (wasSubmitted && !isTutor) {
      sessionStorage.removeItem("enquiry_form_submitted");
      trackLeadConversion();
    }
  }, [isTutor]);

  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = whatsappLink;
    }, 2500);

    return () => clearTimeout(timer);
  }, [whatsappLink]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-6 py-12 dark:bg-slate-950">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-100/60 blur-3xl dark:bg-emerald-950/20" />
        <div className="absolute bottom-0 left-10 h-56 w-56 rounded-full bg-slate-100/80 blur-3xl dark:bg-slate-900/40" />
        <div className="absolute right-10 top-1/3 h-56 w-56 rounded-full bg-slate-100/80 blur-3xl dark:bg-slate-900/40" />
      </div>

      <div className="relative w-full max-w-lg">
        <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-8 text-center shadow-xl shadow-slate-200/30 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/90 dark:shadow-black/20 sm:p-10">
          {/* Success icon */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
            ?
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Thank you!
          </h1>

          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Your details have been submitted successfully.
          </p>

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-500">
            Redirecting you to WhatsApp...
          </p>

          <div className="mt-6">
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-2xl bg-green-600 px-6 py-3 font-semibold text-white shadow-lg transition hover:bg-green-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              Open WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
