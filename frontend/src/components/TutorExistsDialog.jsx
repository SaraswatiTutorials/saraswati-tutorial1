import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, Mail, MessageCircle, Phone, UserCheck, X } from "lucide-react";
import { TUTOR_SUPPORT } from "../data/contactDetails";

// Shown by the tutor registration forms when the number or email is already
// registered: log in instead, and contact us to change any details.
// `info` is the server's answer: { matchedOn: "phone" | "email", source: "tutor" | "partial" }.
export default function TutorExistsDialog({ info, phone, onClose }) {
  const navigate = useNavigate();
  const loginRef = useRef(null);

  useEffect(() => {
    if (!info) return undefined;
    loginRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = before;
      document.removeEventListener("keydown", onKey);
    };
  }, [info]);

  if (!info) return null;

  const onWhat = info.matchedOn === "email" ? "email address" : "phone number";
  const next = info.source === "partial"
    ? "Log in with your number to see your tutor ID and complete your full verification from your panel."
    : "Log in with your number to open your tutor panel.";
  const number = String(phone || "").replace(/\D/g, "").slice(-10);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutor-exists-title"
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-md sm:rounded-3xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="px-6 pb-6 pt-7 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <UserCheck className="h-7 w-7" />
          </span>
          <h2 id="tutor-exists-title" className="mt-4 text-xl font-bold text-slate-900">This tutor already exists</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            A tutor with this {onWhat} is already registered with Saraswati Tutorials. {next}
          </p>

          <button
            ref={loginRef}
            type="button"
            onClick={() => navigate("/teacher/login", { state: number ? { identifier: number } : undefined })}
            className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white shadow-sm shadow-indigo-600/30 transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 cursor-pointer"
          >
            <LogIn className="h-4 w-4" />
            Log in with your number
          </button>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 h-10 w-full rounded-xl text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 cursor-pointer"
          >
            I typed it wrong, go back
          </button>
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-6 py-5">
          <p className="text-sm font-bold text-slate-900">Need to change your details?</p>
          <p className="mt-0.5 text-sm text-slate-600">For any changes to your details, please contact us:</p>
          <ul className="mt-3 space-y-2">
            {TUTOR_SUPPORT.phones.map((p) => (
              <li key={p.tel}>
                <a href={`tel:${p.tel}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-indigo-300 hover:text-indigo-700">
                  <Phone className="h-4 w-4 shrink-0 text-indigo-500" />
                  Call {p.label}
                </a>
              </li>
            ))}
            <li>
              <a href={TUTOR_SUPPORT.whatsappLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-emerald-300 hover:text-emerald-700">
                <MessageCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                Chat with us on WhatsApp
              </a>
            </li>
            <li>
              <a href={`mailto:${TUTOR_SUPPORT.email}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-indigo-300 hover:text-indigo-700">
                <Mail className="h-4 w-4 shrink-0 text-indigo-500" />
                <span className="min-w-0 break-all">{TUTOR_SUPPORT.email}</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
