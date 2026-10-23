import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { API_BASE } from "../config";

export default function TeacherLogin() {
  const location = useLocation();
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState(location.state?.message || "");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
    <div className="min-h-screen bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
        <h2 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
          Saraswati Tutorials
        </h2>
        <p className="mt-2 text-sm text-indigo-200">
          Teacher Portal — Attendance Management
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white/10 backdrop-blur-md py-8 px-6 shadow-xl rounded-3xl border border-white/10 sm:px-10">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-white">Sign In</h3>
            <p className="text-xs text-indigo-300 mt-1">
              Enter your registered Tutor Code, Email address, or Phone number.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="identifier" className="block text-sm font-semibold text-white">
                Tutor Credentials
              </label>
              <div className="mt-1">
                <input
                  id="identifier"
                  type="text"
                  required
                  placeholder="e.g. TUT0001, name@email.com, 9876543210"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="appearance-none block w-full px-4 h-12 bg-white/5 border border-white/10 rounded-2xl placeholder-slate-400 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/25 p-3">
                <p className="text-xs font-medium text-rose-300">{error}</p>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-2xl shadow-sm text-sm font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Verifying..." : "Verify & Access"}
              </button>
            </div>
          </form>
          
          <div className="mt-6 border-t border-white/5 pt-4 text-center">
            <p className="text-xs text-slate-400">
              Need assistance? Contact the administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
