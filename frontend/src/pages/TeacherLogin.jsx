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
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState(location.state?.message || "");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Already signed in: go straight to the dashboard (not after a sign-out or expired session)
  useEffect(() => {
    if (!location.state?.message && localStorage.getItem("tutorToken") && localStorage.getItem("tutorId")) {
      navigate("/teacher/dashboard", { replace: true });
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!identifier.trim()) {
      setError("Please enter your Tutor Code, Email, or Phone.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/attendance/tutor-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Authentication failed");
        setLoading(false);
        return;
      }

      localStorage.setItem("tutorToken", data.token);
      localStorage.setItem("tutorId", data.tutor.id);
      localStorage.setItem("tutorName", data.tutor.name);
      localStorage.setItem("tutorCode", data.tutor.tutorCode || "");

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
      subtitle="Use your Tutor Code (e.g. TUT0218), registered email, or full mobile number."
      footer={
        <div className="space-y-2">
          <p>
            Not registered yet?{" "}
            <a href="/tutor-verification" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Become a tutor</a>
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
            Tutor Code, email or mobile
          </label>
          <div className="flex h-12 items-center rounded-xl border border-slate-300 bg-white transition focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-900">
            <BadgeCheck className="ml-3.5 h-4 w-4 shrink-0 text-slate-400" />
            <input
              id="identifier"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="TUT0001 / name@email.com / 98765 43210"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                if (error) setError("");
              }}
              className="h-full min-w-0 flex-1 bg-transparent px-3 text-base font-medium text-slate-900 placeholder:text-sm placeholder:text-slate-400 focus:outline-none dark:text-white"
            />
          </div>
        </div>

        {error && (
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
          Only approved tutors can sign in. Need help? Contact the Saraswati team.
        </p>
      </form>
    </PortalLogin>
  );
}
