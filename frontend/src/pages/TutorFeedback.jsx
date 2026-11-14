import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { AlertCircle, Check, Loader2, Star } from "lucide-react";
import { API_BASE } from "../config";
import "@fontsource-variable/plus-jakarta-sans";

// A parent's feedback about the tutor sent for their child's demo. Opened from
// the WhatsApp link Panel 2 sends (/tutor-feedback/<token>); answered once.
//
// Look: a quiet, printed-form feel. Warm paper background, one column, thin
// rules between numbered questions, ink-coloured type. The brand indigo is
// kept for what the parent has chosen and for the button, so colour always
// means "this is your answer".

const STAR_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];
const ALL_GOOD = "Nothing, all good";

const ink = "text-[#1c1b19] dark:text-[#f2f0eb]";
const muted = "text-[#6f6b63] dark:text-[#a29e95]";
const rule = "border-[#e7e3da] dark:border-[#2e2c28]";

function Question({ n, title, hint, children }) {
  return (
    <section className={`border-t ${rule} py-7`}>
      <div className="flex items-baseline gap-3">
        <span className={`w-6 shrink-0 font-mono text-[12px] tabular-nums ${muted}`}>{String(n).padStart(2, "0")}</span>
        <div className="min-w-0 flex-1">
          <h2 className={`text-[17px] font-semibold leading-snug tracking-[-0.01em] ${ink}`}>{title}</h2>
          {hint && <p className={`mt-1 text-[13.5px] ${muted}`}>{hint}</p>}
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

// Big stars, for the one overall rating only
function Stars({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div>
      <div className="-ml-1.5 flex" role="radiogroup" aria-label="Overall rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} of 5, ${STAR_WORDS[n]}`}
            onClick={() => onChange(n)} onMouseEnter={() => setHover(n)}
            className="grid h-12 w-12 place-items-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5b50e6]">
            <Star strokeWidth={1.5}
              className={`h-[34px] w-[34px] transition-colors ${n <= shown ? "fill-[#f2a900] text-[#f2a900]" : "text-[#cfc9bd] dark:text-[#4a4741]"}`} />
          </button>
        ))}
      </div>
      <p className={`mt-1 h-5 text-[14px] ${shown ? "font-medium text-[#9a6b00] dark:text-[#f2c14e]" : muted}`}>
        {shown ? STAR_WORDS[shown] : "Tap to rate"}
      </p>
    </div>
  );
}

// A compact 1-5 scale, for the detailed ratings
function Scale({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className={`text-[15px] ${ink}`}>{label}</span>
      <div className={`grid w-full grid-cols-5 overflow-hidden rounded-lg border sm:w-[230px] ${rule}`} role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${label}: ${n} of 5`}
            onClick={() => onChange(n)}
            className={`h-10 border-l text-[14px] tabular-nums transition-colors first:border-l-0 ${rule} ${
              value === n
                ? "bg-[#5b50e6] font-semibold text-white"
                : value && n < value
                  ? "bg-[#eeecff] text-[#4a3fd1] dark:bg-[#2a2747] dark:text-[#b3aeff]"
                  : `bg-white hover:bg-[#f6f4ef] dark:bg-[#1f1e1b] dark:hover:bg-[#2a2824] ${muted}`
            }`}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function Option({ selected, onClick, children }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[14px] transition-colors ${
        selected
          ? "border-[#5b50e6] bg-[#f3f2ff] text-[#3d33b8] dark:border-[#8f88ff] dark:bg-[#24213f] dark:text-[#d6d3ff]"
          : `${rule} bg-white text-[#3b3934] hover:border-[#c9c3b6] dark:bg-[#1f1e1b] dark:text-[#d9d6cf]`
      }`}>
      {selected && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
      {children}
    </button>
  );
}

function Pick({ selected, onClick, children }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 border-b px-0.5 py-3.5 text-left text-[15.5px] last:border-b-0 ${rule} ${
        selected ? "font-semibold text-[#3d33b8] dark:text-[#c9c5ff]" : ink
      }`}>
      <span>{children}</span>
      <span className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-[1.5px] transition-colors ${
        selected ? "border-[#5b50e6] bg-[#5b50e6]" : "border-[#c9c3b6] dark:border-[#55524b]"
      }`}>
        {selected && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
      </span>
    </button>
  );
}

function Page({ children, footer }) {
  return (
    <div className="plan-font min-h-screen bg-[#faf8f4] dark:bg-[#151412]">
      <Helmet>
        <title>Demo feedback · Saraswati Tutorials</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="mx-auto w-full max-w-[560px] px-5 pb-32 pt-5 sm:pt-10">
        {children}
      </div>
      {footer}
    </div>
  );
}

function Masthead({ progress }) {
  return (
    <header className="mb-8 flex items-center justify-between">
      <img src="/logo.png" alt="Saraswati Tutorials" className="h-8 w-auto" />
      {progress && <span className={`text-[12.5px] tabular-nums ${muted}`}>{progress}</span>}
    </header>
  );
}

export default function TutorFeedback() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [answers, setAnswers] = useState({ demoHappened: "", overall: 0, ratings: {}, liked: [], improve: [], decision: "", comment: "" });
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
      if (r.ok || r.status === 409) setDone(true);
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
        <div className={`border-t ${rule} pt-8`}>
          <h1 className={`text-[24px] font-bold tracking-[-0.02em] ${ink}`}>This link isn't working</h1>
          <p className={`mt-3 text-[15.5px] leading-relaxed ${muted}`}>
            {loadError} Please open the most recent feedback message we sent you on WhatsApp, or reply to that message and we'll help.
          </p>
        </div>
      </Page>
    );
  }

  if (!info) {
    return (
      <Page>
        <Masthead />
        <div className={`flex items-center gap-2 border-t ${rule} pt-8 ${muted}`}><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      </Page>
    );
  }

  if (done || info.submitted) {
    const decision = o?.decisions?.find((d) => d.key === answers.decision);
    return (
      <Page>
        <Masthead />
        <div className={`border-t ${rule} pt-10`}>
          <div className="grid h-12 w-12 place-items-center rounded-full bg-[#e7f4ec] dark:bg-[#1c3326]">
            <Check className="h-6 w-6 text-[#1f7a4a]" strokeWidth={2.5} />
          </div>
          <h1 className={`mt-6 text-[26px] font-bold leading-tight tracking-[-0.02em] ${ink}`}>
            Thank you{info.parentFirstName ? `, ${info.parentFirstName}` : ""}.
          </h1>
          <p className={`mt-3 text-[15.5px] leading-relaxed ${muted}`}>
            {done && happened && answers.overall
              ? <>You rated {info.tutorName} <b className={ink}>{answers.overall} out of 5</b>{decision ? <> and told us: <b className={ink}>{decision.label.toLowerCase()}</b></> : null}. </>
              : null}
            Your feedback has reached our team. If you have any questions about {info.studentName ? `${info.studentName}'s` : "your child's"} classes, just reply to our WhatsApp message.
          </p>
          <p className={`mt-8 text-[13.5px] ${muted}`}>You can close this page.</p>
        </div>
      </Page>
    );
  }

  return (
    <Page
      footer={
        <div className={`fixed inset-x-0 bottom-0 border-t ${rule} bg-[#faf8f4]/95 backdrop-blur dark:bg-[#151412]/95`}>
          <div className="mx-auto flex w-full max-w-[560px] items-center gap-4 px-5 py-3.5" style={{ paddingBottom: "max(14px, env(safe-area-inset-bottom))" }}>
            <div className="min-w-0 flex-1">
              <div className={`h-[3px] w-full overflow-hidden rounded-full bg-[#ebe7de] dark:bg-[#2e2c28]`}>
                <div className="h-full rounded-full bg-[#5b50e6] transition-all duration-300" style={{ width: `${(answered / required.length) * 100}%` }} />
              </div>
              <p className={`mt-1.5 text-[12.5px] ${muted}`}>{ready ? "Ready to send" : `${required.length - answered} required ${required.length - answered === 1 ? "answer" : "answers"} left`}</p>
            </div>
            <button form="tutor-feedback" type="submit" disabled={sending}
              className={`inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg px-6 text-[15px] font-semibold transition-colors ${
                ready ? "bg-[#5b50e6] text-white hover:bg-[#4a3fd1]" : "bg-[#e9e5dc] text-[#8a857b] dark:bg-[#2a2824] dark:text-[#7d796f]"
              } disabled:opacity-70`}>
              {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending</> : "Send feedback"}
            </button>
          </div>
        </div>
      }
    >
      <Masthead progress="Takes about a minute" />

      <form id="tutor-feedback" onSubmit={submit} noValidate>
        <div className="pb-7">
          <p className={`text-[14px] ${muted}`}>{info.parentFirstName ? `Dear ${info.parentFirstName},` : "Dear parent,"}</p>
          <h1 className={`mt-2 text-[27px] font-bold leading-[1.15] tracking-[-0.025em] ${ink}`}>How was the demo class with {tutorFirst}?</h1>
          <div className="mt-5 flex items-center gap-3">
            {info.tutorPhoto
              ? <img src={info.tutorPhoto} alt="" className="h-11 w-11 rounded-full object-cover" />
              : <div className="grid h-11 w-11 place-items-center rounded-full bg-[#ebe7de] text-[14px] font-semibold text-[#5a564e] dark:bg-[#2e2c28] dark:text-[#cfcac0]">{initials}</div>}
            <div className="min-w-0 text-[14px] leading-snug">
              <div className={`font-semibold ${ink}`}>{info.tutorName}{info.tutorCode && <span className={`ml-1.5 font-normal ${muted}`}>{info.tutorCode}</span>}</div>
              <div className={`truncate ${muted}`}>
                {[info.subjects, info.grade && `Class ${info.grade}`, info.studentName && `Demo for ${info.studentName}`].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
        </div>

        <Question n={1} title="Did the demo class take place?">
          <div role="radiogroup" aria-label="Did the demo class take place?">
            {o.demoStates.map((d) => (
              <Pick key={d.key} selected={answers.demoHappened === d.key} onClick={() => set({ demoHappened: d.key })}>{d.label}</Pick>
            ))}
          </div>
        </Question>

        {happened && (
          <>
            <Question n={2} title={`Overall, how would you rate ${tutorFirst}?`}>
              <Stars value={answers.overall} onChange={(n) => set({ overall: n })} />
            </Question>

            <Question n={3} title="A little more detail" hint="Optional. 1 is poor, 5 is excellent.">
              <div className="divide-y divide-[#ece8df] dark:divide-[#2e2c28]">
                {o.aspects.map((a) => (
                  <Scale key={a.key} label={a.label} value={answers.ratings[a.key] || 0}
                    onChange={(n) => set((cur) => ({ ratings: { ...cur.ratings, [a.key]: n } }))} />
                ))}
              </div>
            </Question>

            <Question n={4} title="What went well?" hint="Choose any that apply.">
              <div className="flex flex-wrap gap-2">
                {o.liked.map((x) => <Option key={x} selected={answers.liked.includes(x)} onClick={() => toggle("liked", x)}>{x}</Option>)}
              </div>
            </Question>

            <Question n={5} title="Anything that could be better?" hint="Choose any that apply.">
              <div className="flex flex-wrap gap-2">
                {o.improve.map((x) => <Option key={x} selected={answers.improve.includes(x)} onClick={() => toggle("improve", x)}>{x}</Option>)}
              </div>
            </Question>

            <Question n={6} title={`Would you like to continue with ${tutorFirst}?`}>
              <div role="radiogroup" aria-label={`Continue with ${tutorFirst}?`}>
                {o.decisions.map((d) => (
                  <Pick key={d.key} selected={answers.decision === d.key} onClick={() => set({ decision: d.key })}>{d.label}</Pick>
                ))}
              </div>
            </Question>
          </>
        )}

        {answers.demoHappened && (
          <Question n={happened ? 7 : 2} title={happened ? "Anything else you'd like us to know?" : "When is the demo planned?"} hint="Optional">
            <textarea rows={4} maxLength={o.commentMax} value={answers.comment}
              onChange={(e) => set({ comment: e.target.value })}
              placeholder={happened ? "In your own words…" : "Or anything else we should know…"}
              className={`block w-full resize-none rounded-lg border ${rule} bg-white px-3.5 py-3 text-[15px] leading-relaxed ${ink} outline-none transition-colors placeholder:text-[#a8a397] focus:border-[#5b50e6] focus:ring-2 focus:ring-[#5b50e6]/15 dark:bg-[#1f1e1b]`} />
            <div className={`mt-1.5 text-right text-[12px] tabular-nums ${muted}`}>{answers.comment.length} / {o.commentMax}</div>
          </Question>
        )}

        {error && (
          <div role="alert" className="mt-2 flex items-start gap-2 rounded-lg border border-[#f1c7c0] bg-[#fdf2f0] px-3.5 py-3 text-[14px] text-[#9b2c1f] dark:border-[#5a2a24] dark:bg-[#2a1715] dark:text-[#f0a99f]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <p className={`border-t ${rule} pt-6 text-[12.5px] leading-relaxed ${muted}`}>
          Your answers go only to the Saraswati Tutorials team.
        </p>
      </form>
    </Page>
  );
}
