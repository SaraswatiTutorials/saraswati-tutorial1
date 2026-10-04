import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { API_BASE } from "../config";

export default function BlogLogin() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/blog-auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Login failed");
        return;
      }

      localStorage.setItem("blogEditorToken", data.token);
      localStorage.setItem("blogEditorEmail", data.user.email);

      navigate("/admin/blogs");
    } catch (error) {
      console.error(error);
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-6 py-12 dark:bg-slate-950">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-slate-200/50 blur-3xl dark:bg-slate-800/30" />
        <div className="absolute bottom-0 left-10 h-56 w-56 rounded-full bg-slate-100/80 blur-3xl dark:bg-slate-900/40" />
        <div className="absolute right-10 top-1/3 h-56 w-56 rounded-full bg-slate-100/80 blur-3xl dark:bg-slate-900/40" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-8 shadow-xl shadow-slate-200/30 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/90 dark:shadow-black/20">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-xl font-bold text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
              ST
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Blog Editor Login
            </h1>

            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Sign in to manage blogs.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="blog-email"
                className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Email
              </label>

              <input
                id="blog-email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) =>
                  setForm({ ...form, email: e.target.value })
                }
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:ring-slate-700"
                placeholder="Enter your email"
                required
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="blog-password"
                className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Password
              </label>

              <input
                id="blog-password"
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:ring-slate-700"
                placeholder="Enter your password"
                required
                disabled={loading}
              />
            </div>

            {/* Error */}
            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
                <p className="text-sm font-medium text-red-600 dark:text-red-400">
                  {error}
                </p>
              </div>
            ) : null}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-2xl bg-slate-900 font-semibold text-white shadow-lg transition hover:bg-slate-800 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white dark:focus:ring-slate-500 dark:focus:ring-offset-slate-900"
            >
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
