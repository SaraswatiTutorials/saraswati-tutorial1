import React, { useEffect, useRef, useState } from "react";
import { MessageSquare, X, Loader2, CheckCircle2, Send } from "lucide-react";
import { API_BASE } from "../config";
import { FEEDBACK_CATEGORY_LABELS, FEEDBACK_CATEGORIES_BY_SOURCE } from "../data/feedbackConfig";

const MAX_MESSAGE_LENGTH = 2000;

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

  // Focus the message box when the form opens; the page behind doesn't scroll while it is open
  useEffect(() => {
    if (!open) return undefined;
    messageRef.current?.focus();
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
      <button
        type="button"
        onClick={openForm}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-slate-900 dark:bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800 dark:hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 cursor-pointer md:bottom-6 md:right-6"
        aria-haspopup="dialog"
      >
        <MessageSquare className="h-4 w-4" aria-hidden="true" />
        Feedback
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 sm:items-center sm:p-4"
          onClick={closeForm}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-[1.75rem] sm:rounded-[1.75rem] bg-white dark:bg-slate-900 border border-transparent dark:border-slate-700 p-5 sm:p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="feedback-title" className="text-lg font-black text-slate-900 dark:text-white">
                  Facing an issue?
                </h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  Tell us what went wrong and our team will help you.
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
                aria-label="Close feedback form"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {sent ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
                <p className="text-base font-bold text-slate-900 dark:text-white">Thank you, we got your message!</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {phone.trim() ? "Our team will look into it and contact you soon." : "Our team will look into it."}
                </p>
                <button
                  type="button"
                  onClick={closeForm}
                  className="mt-5 rounded-2xl bg-slate-900 dark:bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-slate-800 dark:hover:bg-blue-500 cursor-pointer"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <fieldset>
                  <legend className="mb-1.5 text-sm font-bold text-slate-700 dark:text-slate-300">
                    What is the issue about? <span className="text-rose-500">*</span>
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {(FEEDBACK_CATEGORIES_BY_SOURCE[source] || []).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setCategory(key);
                          setError("");
                        }}
                        aria-pressed={category === key}
                        className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer ${
                          category === key
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-700"
                        }`}
                      >
                        {FEEDBACK_CATEGORY_LABELS[key]}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <label htmlFor="feedback-message" className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">
                    Describe the issue <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    id="feedback-message"
                    ref={messageRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                    rows={4}
                    placeholder="E.g. The Next button is not working after I enter my address..."
                    className="w-full resize-none rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <p className="mt-1 text-right text-xs text-slate-400">
                    {message.length}/{MAX_MESSAGE_LENGTH}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="feedback-name" className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">
                      Name <span className="font-medium text-slate-400">(optional)</span>
                    </label>
                    <input
                      id="feedback-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={100}
                      className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label htmlFor="feedback-phone" className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">
                      Phone <span className="font-medium text-slate-400">(to call you back)</span>
                    </label>
                    <input
                      id="feedback-phone"
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      maxLength={20}
                      className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                </div>

                {error && (
                  <p role="alert" className="rounded-xl bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-sm font-semibold text-rose-700 dark:text-rose-300">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-black text-white shadow-lg transition hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {sending ? "Sending..." : "Send Feedback"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
