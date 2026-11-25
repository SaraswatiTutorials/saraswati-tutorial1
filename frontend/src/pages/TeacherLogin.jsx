import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowRight, BadgeCheck, Loader2 } from "lucide-react";
import { API_BASE } from "../config";
import "@fontsource-variable/inter";
import PortalLogin from "../components/portal/PortalLogin";

const LOGIN_FEATURES = [
  "Mark each class as done or missed in a few taps",
  "Track every student's monthly classes and hours",
  "Parents see your updates straight away",
];

export default function TeacherLogin() {
  const location = useLocation();
  // Pre-filled when a registration form sends an already-registered tutor here,
  // or from ?id=TUT0218 in the WhatsApp login link sent to partial tutors
  const linkId = new URLSearchParams(location.search).get("id") || "";
  const [identifier, setIdentifier] = useState(location.state?.identifier || linkId);
  const [error, setError] = useState(location.state?.message || "");
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const navigate = useNavigate();

  // The sign-up form gets the mobile number pre-filled when one was typed here
  const typedPhone = identifier.replace(/\D/g, "").slice(-10);
  const signUpHref = /^\d{10}$/.test(typedPhone) && !/^tut/i.test(identifier.trim())
    ? `/partial-verification?phone=${typedPhone}`
    : "/partial-verification";

  // Already signed in: go straight to the dashboard (not after a sign-out or expired session)
  useEffect(() => {
    // A login link names who should sign in, so it does not jump into someone else's session
    const signedInAs = localStorage.getItem("tutorCode") || "";
    const otherTutor = linkId && linkId.toUpperCase() !== signedInAs.toUpperCase();
    if (!location.state?.message && !otherTutor && localStorage.getItem("tutorToken") && localStorage.getItem("tutorId")) {
      navigate("/teacher/dashboard", { replace: true });
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!identifier.trim()) {
      setError("Please enter your Tutor Code or mobile number.");
      return;
    }
    setError("");
    setNotFound(false);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/attendance/tutor-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier })
      });

      const data = await res.json();

      if (!res.ok) {
        // No tutor with this code or number: offer the short sign-up form
        setNotFound(res.status === 401);
        setError(data.message || "Authentication failed");
        setLoading(false);
        return;
      }

      localStorage.setItem("tutorToken", data.token);
      localStorage.setItem("tutorId", data.tutor.id);
      localStorage.setItem("tutorName", data.tutor.name);
      localStorage.setItem("tutorCode", data.tutor.tutorCode || "");
      localStorage.setItem("tutorPhoto", data.tutor.photo || "");

      navigate("/teacher/dashboard");
    } catch (err) {
      setError("Server connection failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PortalLogin
      portal="Tutor Portal"
      headline="Your classes and students, all in one place."
      features={LOGIN_FEATURES}
      title="Tutor sign in"
      subtitle="Use your Tutor Code (e.g. TUT0218) or your full mobile number."
      footer={
        <div className="space-y-2">
          <p>
            New tutor?{" "}
            <a href={signUpHref} className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Sign up</a>
          </p>
          <p>
            Are you a parent?{" "}
            <a href="/parent/login" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Parent sign in</a>
          </p>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor="identifier" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Tutor Code or mobile number
          </label>
          <div className="flex h-12 items-center rounded-xl border border-slate-300 bg-white transition focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-900">
            <BadgeCheck className="ml-3.5 h-4 w-4 shrink-0 text-slate-400" />
            <input
              id="identifier"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="TUT0001 / 98765 43210"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                if (error) setError("");
                if (notFound) setNotFound(false);
              }}
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-base font-medium text-slate-900 placeholder:text-sm placeholder:text-slate-400 focus:outline-none dark:text-white"
            />
          </div>
        </div>

        {error && notFound && (
          <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            <p className="font-semibold">We couldn't find a tutor with this code or number.</p>
            <p className="mt-1">Check it and try again, or sign up as a new tutor. It takes about a minute.</p>
            <a
              href={signUpHref}
              className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white transition hover:bg-amber-700"
            >
              Sign up as a tutor <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        )}

        {error && !notFound && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {loading ? "Signing in..." : "Sign in"}
        </button>
        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          Need help signing in? Contact the Saraswati team.
        </p>
      </form>
    </PortalLogin>
  );
}
