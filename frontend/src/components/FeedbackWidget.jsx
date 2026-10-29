import React, { useEffect, useRef, useState } from "react";
import { MessageSquare, X, Loader2, CheckCircle2 } from "lucide-react";
import { API_BASE } from "../config";
import { FEEDBACK_CATEGORY_LABELS, FEEDBACK_CATEGORIES_BY_SOURCE } from "../data/feedbackConfig";

const MAX_MESSAGE_LENGTH = 2000;

// The device's own UI font (San Francisco, Roboto, Segoe UI) so the form reads like the phone's own screens
const SYSTEM_FONT = { fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' };

// Inputs are 16px on phones: smaller text makes iPhones zoom the page when a field is tapped
const FIELD_CLASS =
  "w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-base sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

// Floating "Feedback" button + form where parents and tutors report an issue they are
// facing on the parent enquiry / tutor registration pages. It shows up in the admin dashboard.
// source: "parent-enquiry" | "tutor-registration" (where the admin sees it came from)
// contact: { name, phone } already typed on the page, used to pre-fill the form
// step: the form step the visitor is on
export default function FeedbackWidget({ source, contact = {}, step = 0 }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const messageRef = useRef(null);

  const openForm = () => {
    // Fill in what the visitor already typed on the page, without overwriting their edits
    setName((prev) => prev || contact.name || "");
    setPhone((prev) => prev || contact.phone || "");
    setSent(false);
    setError("");
    setOpen(true);
  };

  const closeForm = () => {
    if (sending) return;
    setOpen(false);
  };

  // The page behind doesn't scroll while the form is open. The message box is focused
  // only on larger screens: on phones the keyboard would cover the issue options.
  useEffect(() => {
    if (!open) return undefined;
    if (window.matchMedia("(min-width: 640px)").matches) messageRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Escape closes the form (not while it is sending)
  useEffect(() => {
    if (!open || sending) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, sending]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!category) {
      setError("Please choose what the issue is about.");
      return;
    }
    if (!message.trim()) {
      setError("Please describe the issue you are facing.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, category, message, name, phone, step }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not send feedback. Please try again.");
      setSent(true);
      setCategory("");
      setMessage("");
    } catch (err) {
      setError(err.message || "Could not send feedback. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Room at the end of the page on phones, so the last button (e.g. Continue) can
          scroll clear of the floating Feedback button instead of sitting under it */}
      <div className="h-20 sm:hidden" aria-hidden="true" />

      {/* Round icon on phones so it covers less of the form; labelled pill from tablets up */}
      <button
        type="button"
        onClick={openForm}
        style={SYSTEM_FONT}
        className="fixed bottom-4 right-4 z-40 inline-flex h-12 w-12 items-center justify-center gap-2 rounded-full bg-slate-900 dark:bg-blue-600 text-sm font-semibold text-white shadow-lg shadow-slate-900/25 transition hover:bg-slate-800 dark:hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 cursor-pointer sm:h-auto sm:w-auto sm:px-4 sm:py-2.5 md:bottom-6 md:right-6"
        aria-haspopup="dialog"
        aria-label="Feedback"
      >
        <MessageSquare className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Feedback</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-6"
          onClick={closeForm}
        >
          {/* Phones: bottom sheet. Tablets and up: centred card. Header and Send button stay
              in place and only the middle scrolls, so Send is never pushed off screen. */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
            onClick={(e) => e.stopPropagation()}
            style={SYSTEM_FONT}
            className="flex w-full max-h-[88dvh] flex-col rounded-t-2xl bg-white dark:bg-slate-900 shadow-2xl sm:max-w-lg sm:max-h-[85vh] sm:rounded-2xl sm:border sm:border-slate-200 dark:sm:border-slate-700"
          >
            <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600 sm:hidden" aria-hidden="true" />

            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 px-5 pb-3.5 pt-3 sm:px-6 sm:pt-5">
              <div>
                <h2 id="feedback-title" className="text-lg font-semibold text-slate-900 dark:text-white">
                  Facing an issue?
                </h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  Tell us what went wrong and our team will help you.
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="-mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
                aria-label="Close feedback form"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {sent ? (
              <div className="px-5 py-8 text-center sm:px-6">
                <CheckCircle2 className="mx-auto mb-3 h-11 w-11 text-emerald-500" />
                <p className="text-base font-semibold text-slate-900 dark:text-white">Thank you, we got your message!</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {phone.trim() ? "Our team will look into it and contact you soon." : "Our team will look into it."}
                </p>
                <button
                  type="button"
                  onClick={closeForm}
                  className="mt-6 rounded-xl bg-slate-900 dark:bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:hover:bg-blue-500 cursor-pointer"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
                <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
                  <fieldset>
                    <legend className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                      What is the issue about? <span className="text-rose-500">*</span>
                    </legend>
                    <div className="grid grid-cols-2 gap-2">
                      {(FEEDBACK_CATEGORIES_BY_SOURCE[source] || []).map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setCategory(key);
                            setError("");
                          }}
                          aria-pressed={category === key}
                          className={`min-h-[44px] rounded-xl border px-3 py-2 text-left text-[13px] leading-snug transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer ${
                            category === key
                              ? "border-blue-600 bg-blue-50 font-medium text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-200"
                              : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                          }`}
                        >
                          {FEEDBACK_CATEGORY_LABELS[key]}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <div>
                    <label htmlFor="feedback-message" className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200">
                      Describe the issue <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      id="feedback-message"
                      ref={messageRef}
                      value={message}
                      onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                      rows={3}
                      placeholder="E.g. The Next button is not working after I enter my address"
                      className={`${FIELD_CLASS} resize-none leading-relaxed`}
                    />
                    <p className="mt-1 text-right text-xs text-slate-400">
                      {message.length}/{MAX_MESSAGE_LENGTH}
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
                    <div>
                      <label htmlFor="feedback-name" className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200">
                        Name <span className="font-normal text-slate-400">(optional)</span>
                      </label>
                      <input
                        id="feedback-name"
                        type="text"
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={100}
                        className={FIELD_CLASS}
                      />
                    </div>
                    <div>
                      <label htmlFor="feedback-phone" className="mb-1.5 block text-sm font-medium text-slate-800 dark:text-slate-200">
                        Phone <span className="font-normal text-slate-400">(to call you back)</span>
                      </label>
                      <input
                        id="feedback-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        maxLength={20}
                        className={FIELD_CLASS}
                      />
                    </div>
                  </div>
                </div>

                <div className="shrink-0 border-t border-slate-100 dark:border-slate-800 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-5">
                  {error && (
                    <p role="alert" className="mb-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={sending}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer sm:text-sm"
                  >
                    {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {sending ? "Sending..." : "Send feedback"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
