import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, FileSignature, KeyRound, RefreshCw, Search, Send, UserX, XCircle } from "lucide-react";
import { API_BASE } from "../../config";

// Tutors' Odoo Sign agreements, as stored in MongoDB by the backend's agreement
// sync (every 30 min). GET /api/agreements/summary and /api/agreements/tutors.
const FILTERS = [
  { key: "signed", label: "Signed", icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10" },
  { key: "sent", label: "Sent, not signed", icon: Clock, tone: "text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10" },
  { key: "none", label: "Never sent", icon: UserX, tone: "text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-800" },
  { key: "refused", label: "Refused", icon: XCircle, tone: "text-rose-600 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/10" },
];

const fmt = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}/agreements${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}`, ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

export default function SignedAgreements() {
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState("signed");
  const [tutors, setTutors] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sendingId, setSendingId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, list] = await Promise.all([api("/summary"), api(`/tutors?status=${status}`)]);
      setSummary(s);
      setTutors(list.tutors || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const syncNow = async () => {
    setSyncing(true);
    setNotice("");
    setError("");
    try {
      const r = await api("/sync", { method: "POST" });
      setNotice(`Odoo checked: ${r.signed} signed, ${r.sent} waiting, ${r.changed} tutor(s) updated.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Send one tutor the agreement (or a partial tutor the login link) again
  const sendAgain = async (t, kind) => {
    const what = kind === "profile" ? "the login link to complete full verification" : "the agreement to sign";
    if (!window.confirm(`Send ${what} to ${t.name || "this tutor"} on WhatsApp?`)) return;
    setSendingId(`${t._id}|${kind}`);
    setNotice("");
    setError("");
    try {
      const r = await api(`/send/${t._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const row = (r.tutors || [])[0];
      const k = row?.[kind];
      if (k?.sent) setNotice(`Sent ${kind === "profile" ? "login link" : "agreement"} to ${row.name}.`);
      else setError(`Not sent to ${row?.name || t.name}: ${k?.failureReason || k?.reason || r.reason || "nothing to send"}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingId("");
    }
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tutors;
    return tutors.filter((t) => [t.name, t.tutorCode, t.phone, t.email, t.odooAgreement?.document]
      .some((v) => String(v || "").toLowerCase().includes(q)));
  }, [tutors, query]);

  const count = (key) => summary?.byStatus?.[key] ?? 0;

  return (
    <div className="animate-slideFade">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            <FileSignature className="h-6 w-6 text-indigo-600" /> Signed Agreements
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Tutors who signed the Tutor Engagement agreement in Odoo Sign, matched by email or mobile number.
            {summary?.lastSyncAt ? ` Last checked ${fmt(summary.lastSyncAt)}.` : " Not checked yet."}
          </p>
        </div>
        <button
          type="button"
          onClick={syncNow}
          disabled={syncing}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Checking Odoo…" : "Check Odoo now"}
        </button>
      </div>

      {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>}
      {notice && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">{notice}</div>}
      {summary?.lastError && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">Last Odoo check failed: {summary.lastError}</div>}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {FILTERS.map(({ key, label, icon: Icon, tone }) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatus(key)}
            className={`rounded-2xl border bg-white p-4 text-left transition dark:bg-slate-900 cursor-pointer ${
              status === key ? "border-indigo-500 ring-2 ring-indigo-500/20" : "border-slate-200 hover:border-slate-300 dark:border-slate-800"
            }`}
          >
            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></span>
            <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{summary ? count(key) : "…"}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
          </button>
        ))}
      </div>
      {summary && (
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
          <b>{summary.signed}</b> of <b>{summary.totalTutors}</b> registered tutors have signed their agreement
          {summary.totalPartials ? <>, and <b>{summary.partialSigned}</b> of <b>{summary.totalPartials}</b> partial tutors (not fully verified yet)</> : null}.
          The cards count both.
        </p>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, tutor ID, phone, email"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
          />
          <span className="text-xs text-slate-400">{shown.length} shown</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
        ) : !shown.length ? (
          <div className="p-8 text-center text-sm text-slate-500">No tutors here.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Tutor</th>
                  <th className="px-4 py-3">Phone / Email</th>
                  <th className="px-4 py-3">{status === "signed" ? "Signed on" : "Sent on"}</th>
                  <th className="px-4 py-3">Full verification</th>
                  <th className="px-4 py-3">Document</th>
                  <th className="px-4 py-3">Onboarding tick</th>
                  <th className="px-4 py-3">Send again</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {shown.map((t) => (
                  <tr key={t._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white">{t.name || "(no name)"}</div>
                      <div className="text-xs text-slate-500">{t.tutorCode || "No tutor ID"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{t.phone || "—"}</div>
                      <div className="text-xs text-slate-500">{t.email || ""}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {fmt(status === "signed" ? t.odooAgreement?.signedAt : t.odooAgreement?.sentAt)}
                    </td>
                    <td className="px-4 py-3">
                      {t.fullyVerified
                        ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Done</span>
                        : <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Not done (partial)</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{t.odooAgreement?.document || "—"}</td>
                    <td className="px-4 py-3">
                      {t.onboardingCompleted
                        ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Ticked</span>
                        : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Not ticked</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {t.odooAgreement?.status !== "signed" && (
                          <button
                            type="button"
                            onClick={() => sendAgain(t, "agreement")}
                            disabled={!!sendingId}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-indigo-200 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-900 dark:text-indigo-300 dark:hover:bg-indigo-950 cursor-pointer"
                          >
                            <Send className="h-3.5 w-3.5" />
                            {sendingId === `${t._id}|agreement` ? "Sending…" : t.odooAgreement?.status === "sent" ? "Send agreement again" : "Send agreement"}
                          </button>
                        )}
                        {!t.fullyVerified && (
                          <button
                            type="button"
                            onClick={() => sendAgain(t, "profile")}
                            disabled={!!sendingId}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950 cursor-pointer"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            {sendingId === `${t._id}|profile` ? "Sending…" : "Send login link"}
                          </button>
                        )}
                        {t.odooAgreement?.status === "signed" && t.fullyVerified && <span className="text-xs text-slate-400">All done</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
