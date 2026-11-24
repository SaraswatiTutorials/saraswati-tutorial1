import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  AlertCircle, CalendarCheck2, CalendarClock, Check, Clock, HelpCircle, Loader2, Lock,
  MessageSquareText, RefreshCw, Sparkles, Star, ThumbsUp, UserCheck, Wrench,
} from "lucide-react";
import { API_BASE } from "../config";
import BrandLogo from "../components/BrandLogo";
import "@fontsource-variable/plus-jakarta-sans";

// A parent's feedback about the tutor sent for their child's demo. Opened from
// the WhatsApp link Panel 2 sends (/tutor-feedback/<token>); answered once.
//
// Look: a gradient welcome card with the tutor's details, then one card per
// question. Brand indigo marks what the parent has chosen; green and amber are
// used only where the answer itself is good or a concern. The page sets every
// colour itself in both themes (data-own-colors keeps the site-wide dark
// fallbacks in index.css off it).

const STAR_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];
const ALL_GOOD = "Nothing, all good";
const EMPTY = { demoHappened: "", overall: 0, ratings: {}, liked: [], improve: [], decision: "", comment: "" };

const ink = "text-[#141a33] dark:text-[#eef0fb]";
const muted = "text-[#5d6583] dark:text-[#9aa3c3]";
const card = "rounded-[22px] border border-[#e6e8f2] bg-white shadow-[0_1px_2px_rgba(20,26,51,0.04),0_8px_24px_-12px_rgba(20,26,51,0.08)] dark:border-[#232a47] dark:bg-[#121730] dark:shadow-none";
const line = "border-[#eceef5] dark:border-[#232a47]";

// Colours for a chosen answer. Written out in full so Tailwind finds every class.
const TONES = {
  indigo: {
    picked: "border-[#5b50e6] bg-[#f4f3ff] text-[#3d33b8] ring-4 ring-[#5b50e6]/10 dark:border-[#8f88ff] dark:bg-[#8f88ff]/12 dark:text-[#dedbff] dark:ring-[#8f88ff]/10",
    icon: "bg-[#ecebff] text-[#5b50e6] dark:bg-[#8f88ff]/15 dark:text-[#b3aeff]",
    dot: "border-[#5b50e6] bg-[#5b50e6] dark:border-[#8f88ff] dark:bg-[#8f88ff]",
  },
  emerald: {
    picked: "border-[#12a06a] bg-[#ecfaf3] text-[#0d6b48] ring-4 ring-[#12a06a]/10 dark:border-[#34d399] dark:bg-[#34d399]/10 dark:text-[#a7f3d0] dark:ring-[#34d399]/10",
    icon: "bg-[#e3f7ee] text-[#12a06a] dark:bg-[#34d399]/15 dark:text-[#6ee7b7]",
    dot: "border-[#12a06a] bg-[#12a06a] dark:border-[#34d399] dark:bg-[#34d399]",
  },
  amber: {
    picked: "border-[#d68a00] bg-[#fff7e6] text-[#8a5300] ring-4 ring-[#d68a00]/10 dark:border-[#fbbf24] dark:bg-[#fbbf24]/10 dark:text-[#fde68a] dark:ring-[#fbbf24]/10",
    icon: "bg-[#fff1d6] text-[#c27c00] dark:bg-[#fbbf24]/15 dark:text-[#fcd34d]",
    dot: "border-[#d68a00] bg-[#d68a00] dark:border-[#fbbf24] dark:bg-[#fbbf24]",
  },
  rose: {
    picked: "border-[#e0445f] bg-[#fff1f3] text-[#a3203a] ring-4 ring-[#e0445f]/10 dark:border-[#fb7185] dark:bg-[#fb7185]/10 dark:text-[#fecdd3] dark:ring-[#fb7185]/10",
    icon: "bg-[#ffe4e8] text-[#e0445f] dark:bg-[#fb7185]/15 dark:text-[#fda4af]",
    dot: "border-[#e0445f] bg-[#e0445f] dark:border-[#fb7185] dark:bg-[#fb7185]",
  },
};
const idle = "border-[#e3e6f0] bg-white text-[#2a3150] hover:border-[#c9cde0] hover:bg-[#fafbfe] dark:border-[#2a3252] dark:bg-[#161c38] dark:text-[#dfe3f5] dark:hover:border-[#3a4470] dark:hover:bg-[#1a2142]";

const DEMO_LOOK = { yes: { icon: CalendarCheck2, tone: "emerald" }, not_yet: { icon: CalendarClock, tone: "amber" } };
const DECISION_LOOK = {
  continue: { icon: UserCheck, tone: "emerald", note: "We'll confirm the regular classes" },
  another: { icon: RefreshCw, tone: "indigo", note: "We'll find a better match for your child" },
  unsure: { icon: HelpCircle, tone: "amber", note: "Our team can call you to talk it over" },
};
const starTone = (n) => (n <= 2 ? "rose" : n === 3 ? "amber" : "emerald");

function Question({ n, title, hint, required, answered, icon: Icon, children }) {
  return (
    <section className={`${card} animate-fadeIn p-5 sm:p-6`}>
      <div className="flex items-start gap-3.5">
        <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold tabular-nums transition-colors duration-300 ${
          answered
            ? "bg-[#12a06a] text-white dark:bg-[#34d399] dark:text-[#06281b]"
            : "bg-[#f0f0fb] text-[#5b50e6] dark:bg-[#8f88ff]/15 dark:text-[#b3aeff]"
        }`}>
          {answered ? <Check className="h-4 w-4" strokeWidth={3} /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className={`text-[16.5px] font-bold leading-snug tracking-[-0.01em] ${ink}`}>{title}</h2>
            {required && (
              <span className="rounded-full bg-[#fff1f3] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[#c22d4a] dark:bg-[#fb7185]/12 dark:text-[#fda4af]">Required</span>
            )}
          </div>
          {hint && (
            <p className={`mt-1 flex items-center gap-1.5 text-[13.5px] ${muted}`}>
              {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}{hint}
            </p>
          )}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

// Big tiles for single-choice questions (did it happen, continue or not)
function Tile({ selected, onClick, icon: Icon, tone = "indigo", note, children }) {
  const t = TONES[tone];
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onClick}
      className={`group flex w-full items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5b50e6]/25 ${selected ? t.picked : idle}`}>
      {Icon && (
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors ${selected ? t.icon : "bg-[#f3f4f9] text-[#6b7393] group-hover:text-[#5b50e6] dark:bg-[#1f2747] dark:text-[#8c95b8] dark:group-hover:text-[#b3aeff]"}`}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-snug">{children}</span>
        {note && <span className={`mt-0.5 block text-[12.5px] ${selected ? "opacity-80" : muted}`}>{note}</span>}
      </span>
      <span className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 transition-colors ${selected ? t.dot : "border-[#cdd1e1] dark:border-[#3a4366]"}`}>
        {selected && <Check className="h-3 w-3 text-white dark:text-[#0b1020]" strokeWidth={3.5} />}
      </span>
    </button>
  );
}

// Big stars, for the one overall rating only
function Stars({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  const tone = TONES[starTone(shown)];
  return (
    <div className="flex flex-col items-center rounded-2xl bg-[#f8f8fd] px-3 py-5 dark:bg-[#0e1328]">
      <div className="flex gap-1 sm:gap-2" role="radiogroup" aria-label="Overall rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} of 5, ${STAR_WORDS[n]}`}
            onClick={() => onChange(n)} onMouseEnter={() => setHover(n)}
            className="grid h-12 w-12 place-items-center rounded-xl transition-transform duration-150 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5b50e6]/25 sm:h-14 sm:w-14">
            <Star strokeWidth={1.5}
              className={`h-9 w-9 transition-colors duration-150 sm:h-10 sm:w-10 ${n <= shown ? "fill-[#ffb400] text-[#ffb400] drop-shadow-[0_2px_6px_rgba(255,180,0,0.35)]" : "text-[#d3d6e4] dark:text-[#363f63]"}`} />
          </button>
        ))}
      </div>
      <div className="mt-3 h-7">
        {shown ? (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold ${tone.icon}`}>
            {shown >= 4 && <Sparkles className="h-3.5 w-3.5" />}{STAR_WORDS[shown]} · {shown}/5
          </span>
        ) : (
          <span className={`text-[13.5px] ${muted}`}>Tap a star to rate</span>
        )}
      </div>
    </div>
  );
}

// A compact 1-5 scale, for the detailed ratings
function Scale({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-2.5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className={`text-[14.5px] font-medium ${ink}`}>{label}</span>
      <div className="grid w-full grid-cols-5 gap-1.5 sm:w-[236px]" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${label}: ${n} of 5`}
            onClick={() => onChange(n)}
            className={`h-10 rounded-xl text-[14px] font-semibold tabular-nums transition-all duration-150 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5b50e6]/25 ${
              value === n
                ? "bg-gradient-to-b from-[#6c63ff] to-[#5b50e6] text-white shadow-[0_4px_12px_-4px_rgba(91,80,230,0.6)]"
                : value && n < value
                  ? "bg-[#ecebff] text-[#4a3fd1] dark:bg-[#8f88ff]/15 dark:text-[#c9c5ff]"
                  : "bg-[#f3f4f9] text-[#6b7393] hover:bg-[#e9eaf4] hover:text-[#2a3150] dark:bg-[#1a2142] dark:text-[#8c95b8] dark:hover:bg-[#222a4f] dark:hover:text-[#dfe3f5]"
            }`}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function Chip({ selected, onClick, tone = "indigo", children }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13.5px] font-medium transition-all duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5b50e6]/25 ${selected ? TONES[tone].picked : idle}`}>
      {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      {children}
    </button>
  );
}

function Page({ children, footer }) {
  return (
    <div data-own-colors className="plan-font relative min-h-screen overflow-hidden bg-[#f5f6fb] dark:bg-[#0a0e1f]">
      <Helmet>
        <title>Demo feedback · Saraswati Tutorials</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      {/* Soft glow behind the top of the page */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(108,99,255,0.16),transparent_70%)] dark:bg-[radial-gradient(60%_60%_at_50%_0%,rgba(108,99,255,0.22),transparent_70%)]" />
      <div className="relative mx-auto w-full max-w-[600px] px-4 pb-36 pt-5 sm:px-5 sm:pt-8">
        {children}
      </div>
      {footer}
    </div>
  );
}

function Masthead({ progress }) {
  return (
    <header className="mb-5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <BrandLogo className="h-9 w-9 rounded-xl object-cover" />
        <div className="leading-tight">
          <div className={`text-[14.5px] font-bold ${ink}`}>Saraswati Tutorials</div>
          <div className={`text-[11.5px] ${muted}`}>Demo class feedback</div>
        </div>
      </div>
      {progress && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e3e6f0] bg-white/80 px-3 py-1.5 text-[12px] font-semibold text-[#4a5272] backdrop-blur dark:border-[#2a3252] dark:bg-[#121730]/80 dark:text-[#aab2d0]">
          <Clock className="h-3.5 w-3.5" /> {progress}
        </span>
      )}
    </header>
  );
}

// Shown on /tutor-feedback/preview only, so nobody mistakes it for a real request
function PreviewNote() {
  return (
    <div className="mb-4 rounded-2xl border border-dashed border-[#e2c46f] bg-[#fff9e8] px-4 py-3 text-[13px] leading-snug text-[#7a5a00] dark:border-[#6b5a2a] dark:bg-[#2a2310] dark:text-[#f0d88f]">
      <b>Preview.</b> This is the form parents receive after a demo, with sample details. Nothing you enter here is saved.
    </div>
  );
}

function Notice({ tone, icon: Icon, title, children }) {
  return (
    <div className={`${card} px-6 py-10 text-center sm:px-10`}>
      <span className={`mx-auto grid h-14 w-14 place-items-center rounded-2xl ${TONES[tone].icon}`}>
        <Icon className="h-7 w-7" />
      </span>
      <h1 className={`mt-5 text-[22px] font-bold tracking-[-0.02em] ${ink}`}>{title}</h1>
      <div className={`mx-auto mt-2.5 max-w-[420px] text-[15px] leading-relaxed ${muted}`}>{children}</div>
    </div>
  );
}

export default function TutorFeedback() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [answers, setAnswers] = useState(EMPTY);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/tutor-feedback/${encodeURIComponent(token || "")}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.message || "This feedback link is not valid.");
        return body;
      })
      .then((body) => { if (!cancelled) setInfo(body); })
      .catch((e) => { if (!cancelled) setLoadError(e.message || "Could not open this link."); });
    return () => { cancelled = true; };
  }, [token]);

  // Always from the latest answers, so quick taps never overwrite each other
  const set = (patch) => { setError(""); setAnswers((a) => ({ ...a, ...(typeof patch === "function" ? patch(a) : patch) })); };
  const toggle = (key, value) => set((a) => {
    if (a[key].includes(value)) return { [key]: a[key].filter((v) => v !== value) };
    // "Nothing, all good" and a complaint cannot both be true
    if (key === "improve" && value === ALL_GOOD) return { improve: [ALL_GOOD] };
    return { [key]: [...a[key].filter((v) => !(key === "improve" && v === ALL_GOOD)), value] };
  });

  const happened = answers.demoHappened === "yes";
  const o = info?.options;
  const tutorFirst = (info?.tutorName || "the tutor").split(/\s+/)[0];
  const initials = useMemo(() => (info?.tutorName || "T").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase(), [info]);

  // The three answers that are required when the demo happened
  const required = happened ? [answers.demoHappened, answers.overall, answers.decision] : [answers.demoHappened];
  const answered = required.filter(Boolean).length;
  const ready = answered === required.length;

  async function submit(e) {
    e.preventDefault();
    if (!answers.demoHappened) return setError("Please tell us whether the demo class happened.");
    if (happened && !answers.overall) return setError("Please give an overall rating.");
    if (happened && !answers.decision) return setError(`Please tell us whether you'd like to continue with ${tutorFirst}.`);
    setSending(true);
    try {
      const r = await fetch(`${API_BASE}/tutor-feedback/${encodeURIComponent(token)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(answers),
      });
      const body = await r.json().catch(() => ({}));
      if (r.ok || r.status === 409) { setDone(true); window.scrollTo(0, 0); }
      else setError(body.message || "We couldn't send your feedback. Please try again.");
    } catch {
      setError("We couldn't send your feedback. Please check your internet connection and try again.");
    } finally {
      setSending(false);
    }
  }

  if (loadError) {
    return (
      <Page>
        <Masthead />
        <Notice tone="rose" icon={AlertCircle} title="This link isn't working">
          {loadError} Please open the most recent feedback message we sent you on WhatsApp, or reply to that message and we'll help.
        </Notice>
      </Page>
    );
  }

  if (!info) {
    return (
      <Page>
        <Masthead />
        <div className="space-y-4" aria-busy="true" aria-label="Loading">
          <div className="h-[210px] animate-pulse rounded-[26px] bg-gradient-to-br from-[#6c63ff]/40 to-[#8b5cf6]/30" />
          {[0, 1].map((i) => (
            <div key={i} className={`${card} p-6`}>
              <div className="h-4 w-1/2 animate-pulse rounded-full bg-[#eceef5] dark:bg-[#1f2747]" />
              <div className="mt-5 h-12 animate-pulse rounded-2xl bg-[#f3f4f9] dark:bg-[#1a2142]" />
              <div className="mt-2.5 h-12 animate-pulse rounded-2xl bg-[#f3f4f9] dark:bg-[#1a2142]" />
            </div>
          ))}
          <p className={`flex items-center justify-center gap-2 pt-1 text-[13.5px] ${muted}`}><Loader2 className="h-4 w-4 animate-spin" /> Loading your feedback form…</p>
        </div>
      </Page>
    );
  }

  if (done || info.submitted) {
    const decision = o?.decisions?.find((d) => d.key === answers.decision);
    const showSummary = done && happened && answers.overall;
    return (
      <Page>
        <Masthead />
        <div className={`${card} animate-fadeIn overflow-hidden`}>
          <div className="relative overflow-hidden bg-gradient-to-br from-[#12a06a] to-[#0e8a8a] px-6 pb-8 pt-10 text-center text-white sm:px-10">
            <div aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
            <div aria-hidden className="absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-white/10" />
            <span className="relative mx-auto grid h-16 w-16 place-items-center rounded-full bg-white text-[#12a06a] shadow-lg shadow-black/10">
              <span className="absolute inset-0 animate-ping rounded-full bg-white/40 [animation-iteration-count:2]" />
              <Check className="relative h-8 w-8" strokeWidth={3} />
            </span>
            <h1 className="relative mt-5 text-[26px] font-bold leading-tight tracking-[-0.02em]">
              Thank you{info.parentFirstName ? `, ${info.parentFirstName}` : ""}!
            </h1>
            <p className="relative mt-1.5 text-[14.5px] text-white/85">Your feedback has reached our team.</p>
          </div>

          <div className="px-6 py-7 sm:px-8">
            {showSummary ? (
              <div className={`mb-6 rounded-2xl border ${line} bg-[#f8f8fd] p-4 dark:bg-[#0e1328]`}>
                <div className={`text-[12px] font-semibold uppercase tracking-wide ${muted}`}>Your rating for {info.tutorName}</div>
                <div className="mt-2 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} strokeWidth={1.5} className={`h-6 w-6 ${n <= answers.overall ? "fill-[#ffb400] text-[#ffb400]" : "text-[#d3d6e4] dark:text-[#363f63]"}`} />
                  ))}
                  <span className={`ml-2 text-[14px] font-semibold ${ink}`}>{STAR_WORDS[answers.overall]}</span>
                </div>
                {decision && (
                  <div className={`mt-3 flex items-center gap-2 border-t ${line} pt-3 text-[14px] ${ink}`}>
                    {(() => { const L = DECISION_LOOK[decision.key]; const Icon = L?.icon || Check; return <span className={`grid h-7 w-7 place-items-center rounded-lg ${TONES[L?.tone || "indigo"].icon}`}><Icon className="h-4 w-4" /></span>; })()}
                    <span className="font-medium">{decision.label}</span>
                  </div>
                )}
              </div>
            ) : null}
            <p className={`text-[15px] leading-relaxed ${muted}`}>
              If you have any questions about {info.studentName ? `${info.studentName}'s` : "your child's"} classes, just reply to our WhatsApp message and we'll be happy to help.
            </p>
            {info.preview ? (
              <button type="button"
                onClick={() => { setDone(false); setAnswers(EMPTY); window.scrollTo(0, 0); }}
                className={`mt-6 inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[14px] font-semibold transition-colors ${idle}`}>
                <RefreshCw className="h-4 w-4" /> Try the preview again
              </button>
            ) : (
              <p className={`mt-6 text-[13px] ${muted}`}>You can close this page now.</p>
            )}
          </div>
        </div>
      </Page>
    );
  }

  const meta = [info.subjects, info.grade && `Class ${info.grade}`].filter(Boolean);

  return (
    <Page
      footer={
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e6e8f2] bg-white/85 backdrop-blur-xl dark:border-[#232a47] dark:bg-[#0d1226]/85">
          <div className="mx-auto flex w-full max-w-[600px] items-center gap-4 px-4 py-3 sm:px-5" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className={`text-[12.5px] font-semibold ${ready ? "text-[#12a06a] dark:text-[#34d399]" : muted}`}>
                  {ready ? "Ready to send" : `${required.length - answered} required ${required.length - answered === 1 ? "answer" : "answers"} left`}
                </p>
                <span className={`text-[12px] tabular-nums ${muted}`}>{answered}/{required.length}</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#eceef5] dark:bg-[#1f2747]">
                <div className={`h-full rounded-full transition-all duration-500 ${ready ? "bg-gradient-to-r from-[#12a06a] to-[#34d399]" : "bg-gradient-to-r from-[#6c63ff] to-[#8b5cf6]"}`}
                  style={{ width: `${Math.max(4, (answered / required.length) * 100)}%` }} />
              </div>
            </div>
            <button form="tutor-feedback" type="submit" disabled={sending}
              className={`inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-bold transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5b50e6]/30 disabled:opacity-70 ${
                ready
                  ? "bg-gradient-to-b from-[#6c63ff] to-[#5b50e6] text-white shadow-[0_8px_20px_-8px_rgba(91,80,230,0.7)] hover:brightness-110 active:scale-[0.98]"
                  : "bg-[#eceef5] text-[#8a91ab] dark:bg-[#1f2747] dark:text-[#6f789c]"
              }`}>
              {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending</> : "Send feedback"}
            </button>
          </div>
        </div>
      }
    >
      <Masthead progress="About 1 minute" />
      {info.preview && <PreviewNote />}

      <form id="tutor-feedback" onSubmit={submit} noValidate className="space-y-4">
        {/* Welcome card */}
        <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#5b50e6] via-[#6a5af0] to-[#8b5cf6] p-6 text-white shadow-[0_18px_40px_-18px_rgba(91,80,230,0.65)] sm:p-7">
          <div aria-hidden className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-white/10" />
          <div aria-hidden className="absolute -bottom-20 right-16 h-40 w-40 rounded-full bg-white/[0.07]" />
          <div className="relative">
            <p className="text-[14px] font-medium text-white/80">{info.parentFirstName ? `Dear ${info.parentFirstName},` : "Dear parent,"}</p>
            <h1 className="mt-1.5 text-[26px] font-extrabold leading-[1.15] tracking-[-0.025em] sm:text-[29px]">
              How was {info.studentName ? `${info.studentName}'s` : "the"} demo class with {tutorFirst}?
            </h1>
            <p className="mt-2 text-[14.5px] leading-relaxed text-white/80">
              Your honest answers help us make sure {info.studentName || "your child"} has the right tutor.
            </p>

            <div className="mt-5 flex items-center gap-3.5 rounded-2xl bg-white/12 p-3.5 ring-1 ring-white/20 backdrop-blur-sm">
              {info.tutorPhoto
                ? <img src={info.tutorPhoto} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-white/70" />
                : <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-[15px] font-bold text-[#5b50e6] ring-2 ring-white/40">{initials}</div>}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[15.5px] font-bold">{info.tutorName}</span>
                  {info.tutorCode && <span className="rounded-md bg-white/20 px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide">{info.tutorCode}</span>}
                </div>
                {meta.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {meta.map((m) => <span key={m} className="rounded-full bg-white/15 px-2.5 py-0.5 text-[12px] font-medium text-white/90">{m}</span>)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <Question n={1} title="Did the demo class take place?" required answered={!!answers.demoHappened}>
          <div role="radiogroup" aria-label="Did the demo class take place?" className="grid gap-2.5 sm:grid-cols-2">
            {o.demoStates.map((d) => (
              <Tile key={d.key} selected={answers.demoHappened === d.key} onClick={() => set({ demoHappened: d.key })}
                icon={DEMO_LOOK[d.key]?.icon} tone={DEMO_LOOK[d.key]?.tone || "indigo"}>{d.label}</Tile>
            ))}
          </div>
        </Question>

        {happened && (
          <>
            <Question n={2} title={`Overall, how would you rate ${tutorFirst}?`} required answered={!!answers.overall}>
              <Stars value={answers.overall} onChange={(n) => set({ overall: n })} />
            </Question>

            <Question n={3} title="A little more detail" hint="Optional · 1 is poor, 5 is excellent" answered={Object.keys(answers.ratings).length > 0}>
              <div className="-my-1 divide-y divide-[#eceef5] dark:divide-[#232a47]">
                {o.aspects.map((a) => (
                  <Scale key={a.key} label={a.label} value={answers.ratings[a.key] || 0}
                    onChange={(n) => set((cur) => ({ ratings: { ...cur.ratings, [a.key]: n } }))} />
                ))}
              </div>
            </Question>

            <Question n={4} title="What went well?" hint="Choose any that apply" icon={ThumbsUp} answered={answers.liked.length > 0}>
              <div className="flex flex-wrap gap-2">
                {o.liked.map((x) => <Chip key={x} tone="emerald" selected={answers.liked.includes(x)} onClick={() => toggle("liked", x)}>{x}</Chip>)}
              </div>
            </Question>

            <Question n={5} title="Anything that could be better?" hint="Choose any that apply" icon={Wrench} answered={answers.improve.length > 0}>
              <div className="flex flex-wrap gap-2">
                {o.improve.map((x) => (
                  <Chip key={x} tone={x === ALL_GOOD ? "emerald" : "amber"} selected={answers.improve.includes(x)} onClick={() => toggle("improve", x)}>{x}</Chip>
                ))}
              </div>
            </Question>

            <Question n={6} title={`Would you like to continue with ${tutorFirst}?`} required answered={!!answers.decision}>
              <div role="radiogroup" aria-label={`Continue with ${tutorFirst}?`} className="grid gap-2.5">
                {o.decisions.map((d) => {
                  const look = DECISION_LOOK[d.key] || {};
                  return (
                    <Tile key={d.key} selected={answers.decision === d.key} onClick={() => set({ decision: d.key })}
                      icon={look.icon} tone={look.tone} note={look.note}>{d.label}</Tile>
                  );
                })}
              </div>
            </Question>
          </>
        )}

        {answers.demoHappened && (
          <Question n={happened ? 7 : 2} title={happened ? "Anything else you'd like us to know?" : "When is the demo planned?"}
            hint="Optional" icon={MessageSquareText} answered={!!answers.comment.trim()}>
            <textarea rows={4} maxLength={o.commentMax} value={answers.comment}
              onChange={(e) => set({ comment: e.target.value })}
              placeholder={happened ? "In your own words…" : "Or anything else we should know…"}
              className="block w-full resize-none rounded-2xl border border-[#e3e6f0] bg-[#fafbfe] px-4 py-3.5 text-[15px] leading-relaxed text-[#141a33] outline-none transition-all placeholder:text-[#a2a8c0] focus:border-[#5b50e6] focus:bg-white focus:ring-4 focus:ring-[#5b50e6]/10 dark:border-[#2a3252] dark:bg-[#0e1328] dark:text-[#eef0fb] dark:placeholder:text-[#5c6588] dark:focus:border-[#8f88ff] dark:focus:bg-[#0e1328] dark:focus:ring-[#8f88ff]/15" />
            <div className={`mt-1.5 text-right text-[12px] tabular-nums ${muted}`}>{answers.comment.length} / {o.commentMax}</div>
          </Question>
        )}

        {error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-[#f6c4cd] bg-[#fff1f3] px-4 py-3.5 text-[14px] font-medium text-[#a3203a] dark:border-[#5a2532] dark:bg-[#2a121a] dark:text-[#fda4af]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <p className={`flex items-center justify-center gap-1.5 pt-2 text-center text-[12.5px] ${muted}`}>
          <Lock className="h-3.5 w-3.5" /> Your answers go only to the Saraswati Tutorials team.
        </p>
      </form>
    </Page>
  );
}
