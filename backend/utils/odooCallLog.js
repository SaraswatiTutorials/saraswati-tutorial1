/**
 * Every call this server makes to Odoo, for the Panel 2 Odoo health check.
 *
 * The two functions that talk to Odoo (callOdoo in odooService.js and
 * executeOdooJsonRpc in whatsappService.js) pass each call through
 * watchOdooCall. It times the call, notes whether it worked, and gives the
 * result or error back untouched, so the send itself behaves exactly as before.
 *
 * Only the kind of call is kept (service, model, method), never its
 * arguments: those carry the Odoo password and people's details. Error
 * messages are kept with long digit runs (phone numbers) shortened.
 *
 * Kept in memory, so a restart starts the record again.
 */

const HOUR = 60 * 60 * 1000;
const KEEP_HOURS = 720; // the longest period the page offers
const MAX_ERRORS = 200;

const startedAt = new Date();
const hours = new Map(); // hour start (ms) -> Map(area key -> { ok, failed, totalMs })
const lastSeen = new Map(); // area key -> { lastOkAt, lastFailAt, lastError }
const errors = []; // newest last

/** Phone numbers (8 or more digits in a row), cut to their last four digits. */
export function maskText(text) {
  return String(text ?? "")
    .replace(/\d{8,}/g, (d) => `…${d.slice(-4)}`) // leaves Meta's 6-digit error codes readable
    .slice(0, 500);
}

/** Which part of the app a call belongs to, by the Odoo model it touches. */
export const AREAS = {
  login: "Login",
  leads: "Leads",
  notes: "Notes on leads",
  tutors: "Tutors",
  contacts: "Contacts",
  whatsapp: "WhatsApp",
  queue: "WhatsApp send queue",
  sign: "Agreements (Sign)",
  other: "Other",
};

export function areaOf({ service, model = "", op = "" }) {
  if (service === "common") return "login";
  const m = String(model);
  if (op === "message_post" && m !== "discuss.channel") return "notes";
  if (m === "crm.lead") return "leads";
  if (m.startsWith("x_master_tutor") || m.startsWith("master_tutor") || m.startsWith("x_tutor")) return "tutors";
  if (m === "res.partner") return "contacts";
  if (m.startsWith("whatsapp.") || m === "discuss.channel" || m === "ir.attachment") return "whatsapp";
  if (m === "ir.cron") return "queue";
  if (m.startsWith("sign.")) return "sign";
  return "other";
}

/** The parts of a JSON-RPC call that are safe to keep: never the arguments. */
function describe(service, method, args) {
  if (service === "object" && method === "execute_kw" && Array.isArray(args)) {
    return { service, model: String(args[3] ?? ""), op: String(args[4] ?? "") };
  }
  return { service, model: "", op: String(method ?? "") };
}

function prune(now) {
  const oldest = now - KEEP_HOURS * HOUR;
  for (const key of hours.keys()) if (key < oldest) hours.delete(key);
  while (errors.length && errors[0].at.getTime() < oldest) errors.shift();
}

export function recordOdooCall({ via = "server", service, model = "", op = "", ok, ms = null, error = "", at = new Date() }) {
  const t = at.getTime();
  const area = areaOf({ service, model, op });
  const hourKey = t - (t % HOUR);
  if (!hours.has(hourKey)) hours.set(hourKey, new Map());
  const bucket = hours.get(hourKey);
  const s = bucket.get(area) || { ok: 0, failed: 0, totalMs: 0, timed: 0 };
  if (ok) s.ok += 1; else s.failed += 1;
  if (Number.isFinite(ms)) { s.totalMs += ms; s.timed += 1; }
  bucket.set(area, s);

  const seen = lastSeen.get(area) || { lastOkAt: null, lastFailAt: null, lastError: "" };
  if (ok) seen.lastOkAt = at;
  else { seen.lastFailAt = at; seen.lastError = maskText(error); }
  lastSeen.set(area, seen);

  if (!ok) {
    errors.push({
      at, via, area, service,
      model, op,
      message: maskText(error) || "Odoo call failed",
      ms: Number.isFinite(ms) ? ms : null,
    });
    if (errors.length > MAX_ERRORS) errors.shift();
  }
  prune(t);
}

function safeRecord(entry) {
  try { recordOdooCall(entry); } catch { /* the record must never break a send */ }
}

/**
 * Runs one Odoo call and records how it went. A login that Odoo answers
 * with "no" (false instead of a user id) is a failure too, though it is not
 * thrown: callers see the same answer they always did.
 */
export async function watchOdooCall(via, service, method, args, run) {
  const started = Date.now();
  const what = describe(service, method, args);
  try {
    const result = await run();
    const refused = service === "common" && method === "authenticate" && !(typeof result === "number" && result > 0);
    safeRecord({
      via, ...what, ok: !refused, ms: Date.now() - started,
      error: refused ? "Odoo refused the login: wrong username, password or database" : "",
    });
    return result;
  } catch (err) {
    safeRecord({ via, ...what, ok: false, ms: Date.now() - started, error: err?.message || String(err) });
    throw err;
  }
}

/**
 * What the server's calls to Odoo looked like since `since`: per area, the
 * calls that worked and failed, and the errors, newest first.
 */
export function getOdooCalls({ since, now = new Date() } = {}) {
  const from = since ? since.getTime() : 0;
  const lastHourFrom = now.getTime() - HOUR;
  const totals = new Map();
  let ok = 0, failed = 0;
  for (const [hourKey, bucket] of hours) {
    // An hour that started before `since` still counts if it ends after it.
    if (hourKey + HOUR <= from) continue;
    for (const [area, s] of bucket) {
      const tot = totals.get(area) || { ok: 0, failed: 0, totalMs: 0, timed: 0 };
      tot.ok += s.ok; tot.failed += s.failed; tot.totalMs += s.totalMs; tot.timed += s.timed;
      totals.set(area, tot);
      ok += s.ok; failed += s.failed;
    }
  }

  const areas = [...new Set([...totals.keys(), ...lastSeen.keys()])].map((key) => {
    const tot = totals.get(key) || { ok: 0, failed: 0, totalMs: 0, timed: 0 };
    const seen = lastSeen.get(key) || {};
    const failingNow = !!seen.lastFailAt && (!seen.lastOkAt || seen.lastFailAt > seen.lastOkAt);
    return {
      key, label: AREAS[key] || key,
      ok: tot.ok, failed: tot.failed,
      avgMs: tot.timed ? Math.round(tot.totalMs / tot.timed) : null,
      lastOkAt: seen.lastOkAt || null,
      lastFailAt: seen.lastFailAt || null,
      lastError: failingNow ? seen.lastError || "" : "",
      failingNow,
    };
  }).sort((a, b) => (b.failingNow - a.failingNow) || (b.failed - a.failed) || ((b.ok + b.failed) - (a.ok + a.failed)));

  const inPeriod = errors.filter((e) => e.at.getTime() >= from);
  return {
    since: startedAt,
    ok, failed,
    failedLastHour: errors.filter((e) => e.at.getTime() >= lastHourFrom).length,
    areas,
    errors: inPeriod.slice(-50).reverse().map((e) => ({ ...e, areaLabel: AREAS[e.area] || e.area })),
  };
}

/** For tests only: forget everything recorded so far. */
export function resetOdooCalls() {
  hours.clear();
  lastSeen.clear();
  errors.length = 0;
}
