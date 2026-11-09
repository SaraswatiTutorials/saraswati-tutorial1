/**
 * Panel 2 health check: Odoo.
 *
 * Answers "is Odoo working, and is everything we send to it getting there?"
 * from four places:
 *
 *   1. Odoo itself, asked live: can it be reached, does the login work, is a
 *      WhatsApp account set up, are the message templates the app uses
 *      approved, what happened to the WhatsApp messages sent in the period,
 *      and is Odoo's send queue job running.
 *   2. MongoDB: what each send to Odoo recorded (leads, tutors, attendance,
 *      invitations, top 3, reconfirmations) and the Odoo-to-here tutor sync.
 *   3. The record of every call this server made to Odoo (odooCallLog.js).
 *   4. The settings the app uses to reach Odoo (never the password itself).
 *
 * The live checks ONLY read. readOnlyRpc refuses anything but version,
 * login, search_read, search_count and read, so this check can never send a
 * message, create a record or trigger a job in Odoo. The live answer is kept
 * for a minute because the page asks on every refresh.
 */

import { getOdooCalls, maskText } from "./odooCallLog.js";
import { REQUIREMENT_TEMPLATES, templateLookupDomain, toOdooDatetime } from "./whatsappService.js";
import { TUTOR_OPTIONS_TEMPLATES, TUTOR_CARD_TEMPLATE } from "./tutorOptionsMessage.js";
import { RECONFIRM_TEMPLATE, SELECTION_TEMPLATE } from "./pipelineStages.js";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
export const MAX_HOURS = 720;
const RPC_TIMEOUT_MS = 8000;
const QUERY_MS = 5000;
const LIVE_TTL_MS = 60 * 1000;
const LIVE_MIN_GAP_MS = 10 * 1000; // "Check again" cannot ask Odoo more often than this
const STUCK_AFTER_MIN = 15; // a WhatsApp message still queued in Odoo after this long
const SEND_STUCK_MIN = 10; // a record here still waiting for Odoo after this long

/** The cron job triggerWhatsAppQueue (whatsappService.js) runs to push the queue out. */
export const WHATSAPP_QUEUE_CRON_ID = 19;

/* ---------------- Settings ---------------- */

const sanitize = (v) => String(v ?? "").trim().replace(/^['"]|['"]$/g, "");

function hostOf(url) {
  try {
    const u = new URL(url);
    return u.port ? `${u.hostname}:${u.port}` : u.hostname; // never the user:password@ part
  } catch {
    return "";
  }
}

/**
 * The Odoo connections the app uses, worked out the same way the code that
 * sends does: odooService.js (leads, tutors, notes, attendance) prefers
 * ODOO_COMMUNITY_URL; whatsappService.js (WhatsApp) uses ODOO_URL only.
 * When both point at the same Odoo with the same login, it is one connection.
 */
export function odooTargets(env = process.env) {
  const mainUrl = sanitize(env.ODOO_COMMUNITY_URL || env.ODOO_URL || "https://odoo.saraswatitutorial.com").replace(/\/+$/, "");
  const main = {
    jsonrpc: env.ODOO_JSONRPC_URL || `${mainUrl}/jsonrpc`,
    db: sanitize(env.ODOO_DB || "saraswati-tutorial"),
    user: sanitize(env.ODOO_USERNAME || "admin"),
    password: sanitize(env.ODOO_PASSWORD || ""),
  };
  const waUrl = sanitize(env.ODOO_URL).replace(/\/+$/, "");
  const wa = {
    jsonrpc: waUrl ? `${waUrl}/jsonrpc` : "",
    db: sanitize(env.ODOO_DB),
    user: sanitize(env.ODOO_USERNAME),
    password: sanitize(env.ODOO_PASSWORD),
  };

  const setupError = (t, urlName) => {
    if (!t.jsonrpc) return `${urlName} is not set, so the server does not know where Odoo is.`;
    if (!hostOf(t.jsonrpc)) return `${urlName} is not a valid web address.`;
    if (!t.db) return "ODOO_DB is not set.";
    if (!t.user) return "ODOO_USERNAME is not set.";
    if (!t.password) return "ODOO_PASSWORD is not set, so Odoo will refuse the login.";
    return "";
  };

  const same = main.jsonrpc === wa.jsonrpc && main.db === wa.db && main.user === wa.user && main.password === wa.password;
  const targets = same
    ? [{ key: "main", usedFor: "Leads, tutors, notes and WhatsApp", whatsapp: true, ...main, setupError: setupError(main, "ODOO_URL") }]
    : [
      { key: "main", usedFor: "Leads, tutors, notes and attendance", whatsapp: false, ...main,
        setupError: setupError(main, env.ODOO_COMMUNITY_URL ? "ODOO_COMMUNITY_URL" : "ODOO_URL") },
      { key: "whatsapp", usedFor: "WhatsApp messages", whatsapp: true, ...wa, setupError: setupError(wa, "ODOO_URL") },
    ];
  return targets.map((t) => ({ ...t, host: hostOf(t.jsonrpc) }));
}

export function attendanceApi(env = process.env) {
  const mainUrl = sanitize(env.ODOO_COMMUNITY_URL || env.ODOO_URL || "https://odoo.saraswatitutorial.com").replace(/\/+$/, "");
  const url = env.ODOO_ATTENDANCE_API_URL || `${mainUrl}/tuition/api/v1/attendance`;
  return { host: hostOf(url), tokenSet: !!sanitize(env.ODOO_COMMUNITY_API_TOKEN || env.ODOO_ATTENDANCE_API_TOKEN) };
}

/* ---------------- Talking to Odoo, read only ---------------- */

const READ_METHODS = new Set(["search_read", "search_count", "read"]);
const COMMON_METHODS = new Set(["version", "authenticate"]);

/** Throws unless the call only reads. Every live check goes through this. */
export function assertReadOnly(service, method, args) {
  if (service === "common" && COMMON_METHODS.has(method)) return;
  if (service === "object" && method === "execute_kw" && READ_METHODS.has(args?.[4])) return;
  const what = service === "object" ? `${args?.[3]}.${args?.[4]}` : `${service}.${method}`;
  throw new Error(`The health check only reads from Odoo; it refused to call ${what}.`);
}

/** One JSON-RPC call, with a time limit and plain-English errors. */
async function jsonRpc(target, service, method, args) {
  let res;
  try {
    res = await fetch(target.jsonrpc, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: { service, method, args }, id: Date.now() }),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
  } catch (err) {
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      throw new Error(`Odoo did not answer within ${RPC_TIMEOUT_MS / 1000} seconds.`);
    }
    const code = err?.cause?.code || err?.code || "";
    const why = {
      ECONNREFUSED: "the connection was refused",
      ENOTFOUND: "that address does not exist",
      EAI_AGAIN: "the address could not be looked up",
      ECONNRESET: "the connection was cut off",
      ETIMEDOUT: "the connection timed out",
      CERT_HAS_EXPIRED: "its security certificate has expired",
    }[code] || err?.cause?.message || err?.message || "unknown network error";
    throw new Error(`Could not reach Odoo at ${target.host}: ${why}.`);
  }
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Odoo answered with a web page instead of data (HTTP ${res.status}). The address may be wrong, or Odoo may be down or restarting.`);
  }
  if (data?.error) throw new Error(data.error?.data?.message || data.error?.message || "Odoo returned an error.");
  return data?.result;
}

export function readOnlyRpc(rpc = jsonRpc) {
  return async (target, service, method, args) => {
    assertReadOnly(service, method, args);
    return rpc(target, service, method, args);
  };
}

const fromOdooTime = (v) => {
  if (!v) return null;
  const d = new Date(String(v).replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? null : d;
};
const lastDigits = (phone) => {
  const d = String(phone || "").replace(/\D/g, "");
  return d ? `…${d.slice(-4)}` : "";
};
const errText = (err) => maskText(err?.message || String(err));

async function checkConnection(target, rpc) {
  const out = {
    key: target.key, usedFor: target.usedFor, whatsapp: target.whatsapp,
    host: target.host, database: target.db, username: target.user,
    reachable: false, version: "", versionMs: null, loginOk: false, loginMs: null,
    error: target.setupError || "", setupError: !!target.setupError, uid: null,
  };
  if (target.setupError) return out;

  let t0 = Date.now();
  try {
    const v = await rpc(target, "common", "version", []);
    out.reachable = true;
    out.version = String(v?.server_version || "");
    out.versionMs = Date.now() - t0;
  } catch (err) {
    out.error = errText(err);
    return out;
  }

  t0 = Date.now();
  try {
    const uid = await rpc(target, "common", "authenticate", [target.db, target.user, target.password, {}]);
    out.loginMs = Date.now() - t0;
    if (typeof uid === "number" && uid > 0) {
      out.loginOk = true;
      out.uid = uid;
    } else {
      out.error = "Odoo refused the login: wrong username, password or database name.";
    }
  } catch (err) {
    out.error = errText(err);
  }
  return out;
}

/* ---------------- WhatsApp, inside Odoo ---------------- */

/**
 * Every WhatsApp template the app sends, and what it is for. Where the code
 * tries several names in turn (newest first), any one approved is enough.
 * `core` ones are the Panel 2 pipeline's: without them a step cannot send.
 */
export function templateChecklist(env = process.env) {
  const pinnedInvite = env.WHATSAPP_REQUIREMENT_TEMPLATE_NAME || "";
  return [
    { key: "reconfirm", use: "Step 1: reconfirm with the parent", names: [RECONFIRM_TEMPLATE], core: true },
    { key: "invite", use: "Step 3: invite tutors", names: [...new Set([pinnedInvite, ...REQUIREMENT_TEMPLATES].filter(Boolean))], anyOf: true, core: true },
    { key: "cards", use: "Step 4: tutor cards to the parent", names: [env.WHATSAPP_TUTOR_CARD_TEMPLATE_NAME || TUTOR_CARD_TEMPLATE], core: true },
    { key: "options", use: "Step 4: top 3 list to the parent",
      names: env.WHATSAPP_TUTOR_OPTIONS_TEMPLATE_NAME ? [env.WHATSAPP_TUTOR_OPTIONS_TEMPLATE_NAME] : TUTOR_OPTIONS_TEMPLATES, anyOf: true, core: true },
    { key: "selected", use: "Step 5: tell the selected tutor", names: [SELECTION_TEMPLATE], core: true },
    { key: "assigned", use: "Demo assigned to tutor (admin panel)", names: [env.WHATSAPP_ASSIGNMENT_TEMPLATE_NAME || "Demo Assigned To Tutor"] },
    { key: "agreement", use: "Tutor agreement after registration", names: [env.WHATSAPP_ONBOARDING_TEMPLATE_NAME || "tutor_agreement"] },
    { key: "missed", use: "Attendance not marked reminder", names: [env.WHATSAPP_MISSED_CLASS_TEMPLATE_NAME || "tutor_attendance_not_marked"] },
    { key: "admin", use: "New enquiry alert to the admin", names: [env.WHATSAPP_ADMIN_ENQUIRY_TEMPLATE_NAME || "admin_new_enquiry_alert"] },
  ];
}

export const TEMPLATE_STATUS = {
  approved: "Approved", pending: "Waiting for Meta", draft: "Draft", rejected: "Rejected",
  paused: "Paused by Meta", disabled: "Disabled by Meta", in_appeal: "In appeal",
};

/** Matches Odoo's templates (by display name or Meta name) to the checklist. */
export function judgeTemplates(checklist, found) {
  const byName = (name) => found.filter((t) => t.name === name || t.template_name === name);
  return checklist.map((item) => {
    const tried = item.names.map((name) => {
      const hits = byName(name);
      const best = hits.find((t) => t.status === "approved") || hits[0] || null;
      return { name, status: best ? String(best.status || "") : "missing" };
    });
    const usable = tried.find((t) => t.status === "approved") || null;
    const first = tried[0];
    let state = usable ? "ok" : "bad";
    let note = "";
    if (usable && usable.name !== first.name) {
      note = `Sending with ${usable.name}; ${first.name} is ${first.status === "missing" ? "not in Odoo" : (TEMPLATE_STATUS[first.status] || first.status).toLowerCase()}.`;
    } else if (!usable) {
      note = first.status === "missing"
        ? (item.anyOf ? "None of these templates is in Odoo." : "This template is not in Odoo.")
        : (item.anyOf ? "None of these templates is approved." : `It is ${(TEMPLATE_STATUS[first.status] || first.status).toLowerCase()}, not approved.`);
      if (!item.core) state = "warn";
    }
    return { key: item.key, use: item.use, core: !!item.core, using: usable?.name || "", tried, state, note };
  });
}

/** What Odoo did with outgoing WhatsApp messages, by Odoo's own state names. */
export const MESSAGE_STATES = [
  { key: "outgoing", label: "Waiting to send" },
  { key: "sent", label: "Sent" },
  { key: "delivered", label: "Delivered" },
  { key: "read", label: "Read" },
  { key: "replied", label: "Replied" },
  { key: "error", label: "Failed", failed: true },
  { key: "bounced", label: "Bounced", failed: true },
  { key: "cancel", label: "Cancelled" },
];

async function checkWhatsApp(read, { env, now, since }) {
  const out = {
    accounts: null, accountsError: "",
    templates: [], templatesError: "",
    messages: null, messagesError: "",
    queue: null, queueError: "",
  };
  const sinceO = toOdooDatetime(since);
  const outgoing = [["message_type", "!=", "inbound"], ["create_date", ">=", sinceO]];

  const accounts = (async () => {
    try {
      const rows = await read("whatsapp.account", "search_read", [[]], { fields: ["name"], limit: 20 });
      out.accounts = rows.map((r) => String(r.name || `Account ${r.id}`));
    } catch (err) { out.accountsError = errText(err); }
  })();

  const templates = (async () => {
    try {
      const checklist = templateChecklist(env);
      const names = [...new Set(checklist.flatMap((c) => c.names))];
      const domain = ["|", ["name", "in", names], ["template_name", "in", names]];
      const found = await read("whatsapp.template", "search_read", [domain], { fields: ["name", "template_name", "status"], limit: 200 });
      out.templates = judgeTemplates(checklist, found || []);
    } catch (err) { out.templatesError = errText(err); }
  })();

  const messages = (async () => {
    try {
      const counts = await Promise.all(MESSAGE_STATES.map((s) =>
        read("whatsapp.message", "search_count", [[...outgoing, ["state", "=", s.key]]])));
      const [replies, stuck, failures, lastOut, lastIn] = await Promise.all([
        read("whatsapp.message", "search_count", [[["message_type", "=", "inbound"], ["create_date", ">=", sinceO]]]),
        read("whatsapp.message", "search_count", [[...outgoing, ["state", "=", "outgoing"],
          ["create_date", "<", toOdooDatetime(new Date(now.getTime() - STUCK_AFTER_MIN * MIN))]]]),
        read("whatsapp.message", "search_read", [[...outgoing, ["state", "in", ["error", "bounced"]]]],
          { fields: ["mobile_number", "state", "failure_type", "failure_reason", "create_date", "wa_template_id"], limit: 20, order: "id desc" }),
        read("whatsapp.message", "search_read", [[["message_type", "!=", "inbound"]]], { fields: ["create_date"], limit: 1, order: "id desc" }),
        read("whatsapp.message", "search_read", [[["message_type", "=", "inbound"]]], { fields: ["create_date"], limit: 1, order: "id desc" }),
      ]);
      const byState = Object.fromEntries(MESSAGE_STATES.map((s, i) => [s.key, Number(counts[i]) || 0]));
      const total = Object.values(byState).reduce((a, b) => a + b, 0);
      const failed = MESSAGE_STATES.filter((s) => s.failed).reduce((a, s) => a + byState[s.key], 0);
      out.messages = {
        total, failed, byState,
        replies: Number(replies) || 0,
        stuck: Number(stuck) || 0,
        lastSentAt: fromOdooTime(lastOut?.[0]?.create_date),
        lastReplyAt: fromOdooTime(lastIn?.[0]?.create_date),
        failures: (failures || []).map((m) => ({
          at: fromOdooTime(m.create_date),
          to: lastDigits(m.mobile_number),
          template: Array.isArray(m.wa_template_id) ? String(m.wa_template_id[1] || "") : "",
          state: m.state,
          reason: maskText(m.failure_reason || m.failure_type || "No reason given by Odoo"),
        })),
      };
    } catch (err) { out.messagesError = errText(err); }
  })();

  const queue = (async () => {
    try {
      const rows = await read("ir.cron", "search_read", [[["id", "=", WHATSAPP_QUEUE_CRON_ID]]],
        { fields: ["name", "active", "nextcall", "interval_number", "interval_type"], limit: 1 });
      const job = rows?.[0];
      out.queue = job
        ? {
          found: true, id: WHATSAPP_QUEUE_CRON_ID, name: String(job.name || ""), active: !!job.active,
          nextCall: fromOdooTime(job.nextcall),
          every: job.interval_number ? `${job.interval_number} ${job.interval_type || ""}`.trim() : "",
        }
        : { found: false, id: WHATSAPP_QUEUE_CRON_ID };
    } catch (err) { out.queueError = errText(err); }
  })();

  await Promise.all([accounts, templates, messages, queue]);
  return out;
}

/** Everything asked of Odoo itself. Never throws: each part reports its own error. */
export async function checkOdooLive({ env = process.env, now = new Date(), since, rpc } = {}) {
  const call = readOnlyRpc(rpc);
  const targets = odooTargets(env);
  const connections = await Promise.all(targets.map((t) => checkConnection(t, call)));

  let whatsapp = null;
  const waIndex = targets.findIndex((t) => t.whatsapp);
  const waConn = connections[waIndex];
  if (waConn?.loginOk) {
    const t = targets[waIndex];
    const read = (model, method, args, kwargs = {}) =>
      call(t, "object", "execute_kw", [t.db, waConn.uid, t.password, model, method, args, kwargs]);
    whatsapp = await checkWhatsApp(read, { env, now, since });
  }
  return {
    at: now,
    connections: connections.map(({ uid, ...c }) => c), // the user id is not needed on the page
    whatsapp,
    whatsappSkipped: waConn?.loginOk ? "" : "Not checked: the server cannot log in to the Odoo that sends WhatsApp.",
  };
}

const liveCache = new Map(); // hours -> { at, promise }

/** The live check, kept for a minute so a page that refreshes often does not keep asking Odoo. */
function cachedLive({ hours, env, now, since, force }) {
  const held = liveCache.get(hours);
  const age = held ? Date.now() - held.at : Infinity;
  if (held && (age < LIVE_MIN_GAP_MS || (!force && age < LIVE_TTL_MS))) return held.promise;
  const promise = checkOdooLive({ env, now, since });
  if (liveCache.size > 10) liveCache.clear();
  liveCache.set(hours, { at: Date.now(), promise });
  return promise;
}

/* ---------------- What this database recorded about each send ---------------- */

/**
 * Each kind of record the server sends to Odoo (or through Odoo, for
 * WhatsApp), and how its outcome is saved here.
 */
export const SEND_FLOWS = [
  {
    key: "leads", label: "Parent enquiries", to: "Odoo leads", coll: "parentenquiries", time: "createdAt",
    match: { archived: { $ne: true } }, field: "odooSyncStatus",
    ok: ["synced"], failed: ["failed"], waiting: ["pending", "retrying"], reason: "odooSyncError",
    ref: (r) => r.requirementId, name: (r) => r.parentName, project: { requirementId: 1, parentName: 1 },
  },
  {
    key: "tutors", label: "Registered tutors", to: "Odoo master tutors", coll: "tutors", time: "createdAt",
    field: "odooSyncStatus", ok: ["synced"], failed: ["failed"], waiting: ["pending"], reason: "odooSyncError",
    ref: (r) => r.tutorCode, name: (r) => r.name, project: { tutorCode: 1, name: 1 },
  },
  {
    key: "attendance", label: "Attendance", to: "Odoo attendance", coll: "attendances", time: "createdAt",
    field: "odooSyncStatus", ok: ["synced"], failed: ["failed"], waiting: ["pending", "retrying"], reason: "odooSyncError",
    ref: (r) => r.requirementId, name: (r) => r.tutorName || r.studentName, project: { requirementId: 1, tutorName: 1, studentName: 1 },
  },
  {
    key: "invites", label: "Invitations to tutors", to: "WhatsApp, through Odoo", coll: "broadcastlogs", time: "createdAt",
    field: "status", ok: ["Sent", "Delivered", "Read", "Replied"], failed: ["Failed"], waiting: ["Pending", "Sending"], reason: "failureReason",
    ref: (r) => r.requirementId, name: (r) => r.tutorName, project: { requirementId: 1, tutorName: 1 },
  },
  {
    key: "top3", label: "Top 3 to parents", to: "WhatsApp, through Odoo", coll: "tutor_top3", time: "preparedAt",
    bool: "sent", reason: "failureReason",
    ref: (r) => r.requirementId, name: (r) => r.parentName, project: { requirementId: 1, parentName: 1 },
  },
  {
    key: "reconfirm", label: "Reconfirmations to parents", to: "WhatsApp, through Odoo", coll: "parent_reconfirmations", time: "sentAt",
    bool: "sent", reason: "failureReason",
    ref: (r) => r.requirementId, name: (r) => r.parentName, project: { requirementId: 1, parentName: 1 },
  },
];

const SYNC_JOBS = [
  { key: "odoo_tutor_sync", label: "Tutor list (master tutors)" },
  { key: "odoo_x_tutor_sync", label: "Tutor list (tutor form)" },
];

/** ok / warn / bad / quiet for one kind of send, from its counts. */
export function flowStatus({ total, failed, stuck }) {
  if (!total) return "quiet";
  if (failed >= 3 && failed / total >= 0.5) return "bad";
  if (failed > 0 || stuck > 0) return "warn";
  return "ok";
}

async function readFlow(db, f, { since, now }) {
  const coll = db.collection(f.coll);
  const inPeriod = { [f.time]: { $gte: since }, ...(f.match || {}) };
  const stuckBefore = new Date(now.getTime() - SEND_STUCK_MIN * MIN);
  const opts = { maxTimeMS: QUERY_MS };
  const project = { ...f.project, [f.time]: 1, [f.reason]: 1 };

  let ok = 0, failed = 0, waiting = 0, stuck = 0, other = 0, failedQuery, okQuery;
  if (f.bool) {
    const groups = await coll.aggregate([{ $match: inPeriod }, { $group: { _id: { $eq: [`$${f.bool}`, true] }, n: { $sum: 1 } } }], opts).toArray();
    for (const g of groups) { if (g._id) ok += g.n; else failed += g.n; }
    failedQuery = { ...inPeriod, [f.bool]: { $ne: true } };
    okQuery = { [f.bool]: true };
  } else {
    const groups = await coll.aggregate([{ $match: inPeriod }, { $group: { _id: `$${f.field}`, n: { $sum: 1 } } }], opts).toArray();
    for (const g of groups) {
      if (f.ok.includes(g._id)) ok += g.n;
      else if (f.failed.includes(g._id)) failed += g.n;
      else if (f.waiting.includes(g._id)) waiting += g.n;
      else other += g.n;
    }
    if (waiting) {
      stuck = await coll.countDocuments({ ...inPeriod, [f.field]: { $in: f.waiting }, [f.time]: { $gte: since, $lt: stuckBefore } }, opts);
    }
    failedQuery = { ...inPeriod, [f.field]: { $in: f.failed } };
    okQuery = { [f.field]: { $in: f.ok } };
  }

  const [failures, lastOk] = await Promise.all([
    failed ? coll.find(failedQuery, { projection: project, ...opts }).sort({ [f.time]: -1 }).limit(10).toArray() : [],
    coll.find(okQuery, { projection: { [f.time]: 1 }, ...opts }).sort({ [f.time]: -1 }).limit(1).next().catch(() => null),
  ]);

  const total = ok + failed + waiting + other;
  return {
    key: f.key, label: f.label, to: f.to, direction: "to",
    total, ok, failed, waiting, stuck, other,
    lastOkAt: lastOk?.[f.time] || null,
    status: flowStatus({ total, failed, stuck }),
    failures: failures.map((r) => ({
      ref: String(f.ref(r) || ""), name: String(f.name(r) || ""), at: r[f.time] || null,
      reason: maskText(r[f.reason] || "No reason recorded"),
    })),
    error: "",
  };
}

async function readSyncJobs(db, { now, env }) {
  const states = await db.collection("syncstates")
    .find({ key: { $in: SYNC_JOBS.map((j) => j.key) } }, { maxTimeMS: QUERY_MS }).toArray();
  const byKey = new Map(states.map((s) => [s.key, s]));
  const everyMin = Number(env.TUTOR_SYNC_INTERVAL_MIN || 15);
  const lateAfterMin = Math.max(60, everyMin * 3);
  return SYNC_JOBS.map((job) => {
    const s = byKey.get(job.key);
    const lastAt = s?.lastSyncAt ? new Date(s.lastSyncAt) : null;
    let status = "ok", note = "";
    if (!s) { status = "warn"; note = "Has never run against this database."; }
    else if (s.status === "error") { status = "bad"; note = maskText(s.lastError || "The last run stopped with an error."); }
    else if (!lastAt || now - lastAt > lateAfterMin * MIN) {
      status = "warn";
      note = lastAt ? `No successful run for over ${Math.round((now - lastAt) / HOUR) || 1} hour(s). It should run every ${everyMin} minutes.` : "Never finished a run.";
    } else if (s.status === "running" && s.updatedAt && now - new Date(s.updatedAt) > 30 * MIN) {
      status = "warn"; note = "Has been running for over 30 minutes; a restart may have cut it off.";
    } else if (s.lastError) {
      status = "warn"; note = `Some records failed in the last run: ${maskText(s.lastError)}`;
    } else {
      note = `${s.lastSyncCount ?? 0} updated in the last run.`;
    }
    return {
      key: job.key, label: job.label, to: "This database, from Odoo", direction: "from",
      total: null, ok: null, failed: null, waiting: null, stuck: 0,
      lastOkAt: lastAt, status, note, failures: [], error: "",
    };
  });
}

/** Every kind of send, side by side. One that cannot be read never stops the others. */
export async function readSendFlows(db, { since, now = new Date(), env = process.env } = {}) {
  const sends = await Promise.all(SEND_FLOWS.map((f) => readFlow(db, f, { since, now }).catch((err) => ({
    key: f.key, label: f.label, to: f.to, direction: "to",
    total: null, ok: null, failed: null, waiting: null, stuck: 0, lastOkAt: null,
    status: "unknown", failures: [], error: errText(err),
  }))));
  const syncs = await readSyncJobs(db, { now, env }).catch((err) => SYNC_JOBS.map((job) => ({
    key: job.key, label: job.label, to: "This database, from Odoo", direction: "from",
    total: null, ok: null, failed: null, waiting: null, stuck: 0, lastOkAt: null,
    status: "unknown", note: "", failures: [], error: errText(err),
  })));
  return [...sends, ...syncs];
}

/* ---------------- The whole answer ---------------- */

const periodText = (h) => (h % 24 === 0 ? (h === 24 ? "last 24 hours" : `last ${h / 24} days`) : `last ${h} hour${h === 1 ? "" : "s"}`);
const agoText = (d, now) => {
  const m = Math.max(0, Math.round((now - new Date(d)) / MIN));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

/** Turns everything found into the lists of problems (red) and warnings (amber). */
export function judgeOdoo({ live, flows, calls, attendance, hours, now }) {
  const problems = [];
  const warnings = [];
  const period = periodText(hours);

  for (const c of live.connections) {
    const name = live.connections.length > 1 ? `Odoo for ${c.usedFor.toLowerCase()}` : "Odoo";
    if (c.setupError) problems.push(`${name}: ${c.error}`);
    else if (!c.reachable) problems.push(`${name} cannot be reached. ${c.error}`);
    else if (!c.loginOk) problems.push(`${name}: ${c.error}`);
    else if (c.versionMs != null && c.versionMs > 3000) warnings.push(`${name} is slow: it took ${(c.versionMs / 1000).toFixed(1)} seconds to answer.`);
  }

  const wa = live.whatsapp;
  if (wa) {
    if (wa.accountsError) warnings.push(`Could not read the WhatsApp accounts in Odoo: ${wa.accountsError}`);
    else if (wa.accounts && !wa.accounts.length) problems.push("No WhatsApp account is set up in Odoo, so no WhatsApp message can be sent.");

    if (wa.templatesError) warnings.push(`Could not read the WhatsApp templates in Odoo: ${wa.templatesError}`);
    for (const t of wa.templates) {
      if (t.state === "bad") problems.push(`WhatsApp template for "${t.use}": ${t.note} Those messages will fail.`);
      else if (t.state === "warn") warnings.push(`WhatsApp template for "${t.use}": ${t.note}`);
    }

    if (wa.messagesError) warnings.push(`Could not read the WhatsApp messages in Odoo: ${wa.messagesError}`);
    const m = wa.messages;
    if (m) {
      if (m.stuck) problems.push(`${m.stuck} WhatsApp message${m.stuck === 1 ? " has" : "s have"} been waiting in Odoo's queue for over ${STUCK_AFTER_MIN} minutes. Odoo is not sending them.`);
      if (m.failed) {
        const share = m.total ? Math.round((m.failed / m.total) * 100) : 0;
        const text = `${m.failed} of ${m.total} WhatsApp messages failed in the ${period} (${share}%).`;
        if (m.failed >= 3 && share >= 25) problems.push(text); else warnings.push(text);
      }
    }

    if (wa.queueError) warnings.push(`Could not read Odoo's WhatsApp send job: ${wa.queueError}`);
    const q = wa.queue;
    if (q && !q.found) warnings.push(`Odoo's WhatsApp send job (number ${q.id}), which the server starts after each send, was not found. Messages wait for Odoo's own schedule.`);
    else if (q && !q.active) problems.push(`Odoo's WhatsApp send job "${q.name}" is switched off, so queued messages are not sent.`);
    else if (q?.nextCall && now - q.nextCall > 30 * MIN) warnings.push(`Odoo's WhatsApp send job was due ${agoText(q.nextCall, now)} and has not run. Odoo's scheduled jobs may be stopped.`);
  }

  if (!attendance.tokenSet) warnings.push("No attendance API token is set (ODOO_COMMUNITY_API_TOKEN), so attendance cannot be sent to Odoo.");

  for (const f of flows) {
    const what = f.direction === "from" ? `Odoo to this database, ${f.label.toLowerCase()}` : `${f.label} to ${f.to}`;
    if (f.status === "unknown") warnings.push(`${what}: could not be checked. ${f.error}`);
    else if (f.direction === "from") {
      if (f.status === "bad") problems.push(`${what}: ${f.note}`);
      else if (f.status === "warn") warnings.push(`${what}: ${f.note}`);
    } else {
      const parts = [];
      if (f.failed) parts.push(`${f.failed} of ${f.total} failed`);
      if (f.stuck) parts.push(`${f.stuck} still waiting after ${SEND_STUCK_MIN} minutes`);
      if (!parts.length) continue;
      const text = `${what}: ${parts.join(", ")} in the ${period}.`;
      if (f.status === "bad") problems.push(text); else warnings.push(text);
    }
  }

  const hourAgo = now.getTime() - HOUR;
  for (const a of calls.areas) {
    if (!a.failingNow) continue;
    const text = `${a.label}: the server's last call to Odoo failed ${agoText(a.lastFailAt, now)}. ${a.lastError}`;
    if (new Date(a.lastFailAt).getTime() >= hourAgo) problems.push(text); else warnings.push(text);
  }
  const recovered = calls.areas.filter((a) => !a.failingNow && a.failed).reduce((n, a) => n + a.failed, 0);
  if (recovered) warnings.push(`${recovered} call${recovered === 1 ? "" : "s"} from the server to Odoo failed in the ${period}; each kind has worked since.`);

  return { problems, warnings, status: problems.length ? "bad" : warnings.length ? "warn" : "ok" };
}

/**
 * The Odoo health check. `rpc` replaces the call to Odoo in tests; given
 * one, nothing is cached.
 */
export async function buildOdooHealth(db, { hours = 24, now = new Date(), env = process.env, rpc = null, force = false } = {}) {
  const h = Math.min(Math.max(Math.round(Number(hours) || 24), 1), MAX_HOURS);
  const since = new Date(now.getTime() - h * HOUR);

  const [live, flows] = await Promise.all([
    rpc ? checkOdooLive({ env, now, since, rpc }) : cachedLive({ hours: h, env, now, since, force }),
    db ? readSendFlows(db, { since, now, env }) : Promise.resolve([]),
  ]);
  const calls = getOdooCalls({ since, now });
  const attendance = attendanceApi(env);
  const verdict = judgeOdoo({ live, flows, calls, attendance, hours: h, now });
  if (!db) verdict.warnings.push("The database is not connected, so what was sent to Odoo could not be checked.");
  if (!db && verdict.status === "ok") verdict.status = "warn";

  return {
    generatedAt: now, hours: h, since,
    ...verdict,
    liveCheckedAt: live.at,
    connections: live.connections,
    attendance,
    whatsapp: live.whatsapp,
    whatsappSkipped: live.whatsappSkipped,
    flows,
    calls,
  };
}
