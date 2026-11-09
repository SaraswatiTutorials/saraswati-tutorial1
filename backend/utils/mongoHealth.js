/**
 * Panel 2 — MongoDB health check.
 *
 * Answers, for the database as a whole:
 *   - Is the server connected, and how fast does the database answer?
 *   - Does a write actually go in? A test record is written, read back and
 *     removed — the most direct proof that data can be saved.
 *   - Which collections are receiving data, how much, and when last?
 *   - Has anything gone wrong since the server started? (utils/mongoErrorLog.js)
 *   - How much space is used?
 *
 * Only the write test writes, and only to its own collection, which it leaves
 * empty. It is skipped in local safe mode, where the live database must not
 * change. Every query has a time limit and every part fails on its own.
 */

import os from "os";
import mongoose from "mongoose";
import { getMongoEvents, recordMongoProblem } from "./mongoErrorLog.js";

const QUERY_MS = 8000;
const MAX_HOURS = 720;
const MIN = 60 * 1000;

/** Where the write test writes. It is always left empty. */
export const WRITE_TEST_COLLECTION = "panel2_health_checks";

/** A write test at most this often unless asked for, so a page refreshing every few seconds does not keep writing. */
const WRITE_TEST_EVERY_MS = 60 * 1000;

/**
 * Every collection this code (or the workflows around it) uses, in plain
 * words. `core` ones should always exist: a missing one means data is not
 * going where the app thinks it is.
 */
export const KNOWN_COLLECTIONS = {
  parentenquiries:         { label: "Parent enquiries",            owner: "Website and admin", core: true },
  tutors:                  { label: "Registered tutors",           owner: "Website and Odoo sync", core: true },
  partialtutors:           { label: "Partial tutor form",          owner: "Website" },
  broadcastlogs:           { label: "Messages to tutors",          owner: "This server", core: true },
  tutor_shortlists:        { label: "Shortlists",                  owner: "Panel 2 and n8n" },
  tutor_top3:              { label: "Top 3 sent to parents",       owner: "Panel 2" },
  tutor_assignments:       { label: "Parent's choice",             owner: "n8n" },
  parent_reconfirmations:  { label: "Parent reconfirmations",      owner: "Panel 2" },
  inbound_messages:        { label: "WhatsApp messages received",  owner: "n8n" },
  counters:                { label: "Requirement ID counter",      owner: "This server", core: true },
  attendances:             { label: "Attendance",                  owner: "Tutor and parent portal" },
  assignments:             { label: "Tests",                       owner: "Tutor portal" },
  analyticslogs:           { label: "Website visits and form logs", owner: "Website" },
  parentenquirydrafts:     { label: "Unfinished parent forms",     owner: "Website" },
  tutorregistrationdrafts: { label: "Unfinished tutor forms",      owner: "Website" },
  bookings:                { label: "Bookings",                    owner: "Website" },
  enquiries:               { label: "Contact form enquiries",      owner: "Website" },
  feedbacks:               { label: "Feedback",                    owner: "Parent portal" },
  tncacceptances:          { label: "Terms accepted",              owner: "Website" },
  blogs:                   { label: "Blog posts",                  owner: "Admin" },
  admins:                  { label: "Admin accounts",              owner: "Admin" },
  syncstates:              { label: "Odoo sync progress",          owner: "Odoo sync" },
  [WRITE_TEST_COLLECTION]: { label: "Panel 2 write test",          owner: "Panel 2 health check" },
};

/** The host name without the username, password or options a connection string carries. */
export function safeHost(client) {
  try {
    const hosts = client?.options?.hosts || [];
    const names = hosts.map((h) => String(h?.host || h || "").split(":")[0]).filter(Boolean);
    if (!names.length) return "";
    // An Atlas cluster lists every member; one name says which cluster it is.
    return names.length > 1 ? `${names[0]} (+${names.length - 1} more)` : names[0];
  } catch {
    return "";
  }
}

const STATES = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };

const timed = async (fn) => {
  const t = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - t };
};

const failText = (err) => {
  const m = err?.message || String(err || "");
  if (/time limit|MaxTimeMSExpired|operation exceeded/i.test(m)) return "The database took too long to answer.";
  if (/not authorized|unauthorized/i.test(m)) return "This database user is not allowed to read that.";
  return m || "Could not check";
};

// ---------------------------------------------------------------
// The write test
// ---------------------------------------------------------------

let lastWriteTest = null;

export async function runWriteTest(db, { safeMode = false, now = new Date() } = {}) {
  if (safeMode) {
    lastWriteTest = { ok: null, skipped: true, at: now, reason: "Skipped: local safe mode does not allow writes to the live database." };
    return lastWriteTest;
  }
  const coll = db.collection(WRITE_TEST_COLLECTION);
  const _id = new mongoose.Types.ObjectId();
  const result = { ok: false, skipped: false, at: now, writeMs: null, readMs: null, removeMs: null, totalMs: null, error: "" };
  const started = Date.now();
  let step = "write";
  try {
    const w = await timed(() => coll.insertOne({ _id, kind: "write test", at: now, server: os.hostname() }, { writeConcern: { w: "majority" } }));
    result.writeMs = w.ms;
    if (!w.value?.acknowledged) throw new Error("The database did not confirm the write.");

    step = "read back";
    const r = await timed(() => coll.findOne({ _id }, { maxTimeMS: QUERY_MS }));
    result.readMs = r.ms;
    if (!r.value) throw new Error("The record was written but could not be read back.");

    step = "remove";
    const d = await timed(() => coll.deleteOne({ _id }));
    result.removeMs = d.ms;
    if (d.value?.deletedCount !== 1) throw new Error("The test record could not be removed.");

    result.ok = true;
  } catch (err) {
    result.error = `${step[0].toUpperCase()}${step.slice(1)} failed: ${failText(err)}`;
    recordMongoProblem({ operation: `write test (${step})`, collection: WRITE_TEST_COLLECTION, message: result.error });
    // Never leave a test record behind, even when a later step failed.
    await coll.deleteOne({ _id }).catch(() => {});
  }
  result.totalMs = Date.now() - started;
  lastWriteTest = result;
  return result;
}

// ---------------------------------------------------------------
// Collections
// ---------------------------------------------------------------

async function inspectCollection(db, name, { fromId }) {
  const coll = db.collection(name);
  const known = KNOWN_COLLECTIONS[name];
  const out = {
    name, label: known?.label || "", owner: known?.owner || "Not used by this code",
    known: !!known, exists: true, count: null, newInPeriod: null, lastAt: null,
    size: null, storage: null, indexes: null, idKind: "objectid", error: "",
  };
  try {
    const [count, newest] = await Promise.all([
      coll.estimatedDocumentCount({ maxTimeMS: QUERY_MS }),
      coll.find({}, { projection: { _id: 1 }, maxTimeMS: QUERY_MS }).sort({ _id: -1 }).limit(1).next(),
    ]);
    out.count = count;
    if (newest && newest._id instanceof mongoose.mongo.ObjectId) {
      // New records are told by the time inside their ObjectId: always there,
      // always indexed, whoever wrote the row and whatever they called their
      // date field.
      out.lastAt = newest._id.getTimestamp();
      out.newInPeriod = await coll.countDocuments({ _id: { $gte: fromId } }, { maxTimeMS: QUERY_MS });
    } else if (newest) {
      out.idKind = "custom"; // IDs chosen by the code, such as "requirementId": no time inside them
    }
  } catch (err) {
    out.error = failText(err);
    return out;
  }

  // Size and indexes are extras: a database user without the right to see
  // them still gets everything above.
  try {
    const [stats] = await coll.aggregate([{ $collStats: { storageStats: {} } }], { maxTimeMS: QUERY_MS }).toArray();
    const s = stats?.storageStats || {};
    out.size = s.size ?? null;
    out.storage = (s.storageSize ?? 0) + (s.totalIndexSize ?? 0) || null;
    out.indexes = s.nindexes ?? null;
  } catch {
    try { out.indexes = (await coll.indexes()).length; } catch { /* leave blank */ }
  }
  return out;
}

/** One word for a collection, from what it holds and how recently. */
export function collectionStatus(c) {
  if (c.error) return "error";
  if (!c.exists) return "missing";
  if (!c.count) return "empty";
  if (c.idKind === "custom") return "fixed";
  return c.newInPeriod > 0 ? "active" : "quiet";
}

// ---------------------------------------------------------------
// Everything together
// ---------------------------------------------------------------

export async function buildMongoHealth(db, {
  hours = 24, now = new Date(), safeMode = false, forceWriteTest = false, client = null, readyState = 1,
} = {}) {
  const h = Math.min(Math.max(Math.round(Number(hours) || 24), 1), MAX_HOURS);
  const since = new Date(now.getTime() - h * 3600 * 1000);
  const fromId = mongoose.Types.ObjectId.createFromTime(Math.floor(since.getTime() / 1000));
  const problems = [];
  const warnings = [];

  // Connection
  const connection = {
    state: STATES[readyState] || "unknown", connected: false, pingMs: null,
    database: db?.databaseName || "", host: safeHost(client), serverVersion: "", error: "",
  };
  try {
    const p = await timed(() => db.command({ ping: 1 }, { maxTimeMS: QUERY_MS }));
    connection.pingMs = p.ms;
    connection.connected = readyState === 1;
    const info = await db.command({ buildInfo: 1 }, { maxTimeMS: QUERY_MS }).catch(() => null);
    connection.serverVersion = info?.version || "";
  } catch (err) {
    connection.error = failText(err);
  }
  if (!connection.connected) problems.push(connection.error ? `Not connected: ${connection.error}` : "Not connected to the database.");
  else if (connection.pingMs > 1500) warnings.push(`The database is slow to answer (${connection.pingMs} ms).`);

  // Write test, at most once a minute unless asked for
  let writeTest = lastWriteTest;
  const stale = !writeTest || now - new Date(writeTest.at) > WRITE_TEST_EVERY_MS;
  if (connection.connected && (forceWriteTest || stale)) writeTest = await runWriteTest(db, { safeMode, now });
  if (writeTest && writeTest.ok === false) problems.push(`Write test failed. ${writeTest.error}`);

  // Collections
  let collections = [];
  let listError = "";
  if (connection.connected) {
    try {
      const listed = (await db.listCollections({}, { nameOnly: false }).toArray())
        .filter((c) => c.type !== "view" && !c.name.startsWith("system."));
      collections = await Promise.all(listed.map((c) => inspectCollection(db, c.name, { fromId })));
    } catch (err) {
      listError = failText(err);
      problems.push(`Could not list the collections: ${listError}`);
    }
    const present = new Set(collections.map((c) => c.name));
    for (const [name, info] of Object.entries(KNOWN_COLLECTIONS)) {
      if (info.core && !present.has(name) && !listError) {
        collections.push({ name, label: info.label, owner: info.owner, known: true, exists: false, count: 0,
          newInPeriod: null, lastAt: null, size: null, storage: null, indexes: null, idKind: "objectid", error: "" });
        warnings.push(`"${info.label}" (${name}) is not in this database.`);
      }
    }
  }
  for (const c of collections) {
    c.status = collectionStatus(c);
    if (c.status === "error") problems.push(`${c.label || c.name}: ${c.error}`);
  }
  const order = { error: 0, missing: 1, active: 2, quiet: 3, fixed: 4, empty: 5 };
  collections.sort((a, b) => (order[a.status] - order[b.status])
    || (new Date(b.lastAt || 0) - new Date(a.lastAt || 0))
    || a.name.localeCompare(b.name));

  // Space
  let storage = { error: "" };
  if (connection.connected) {
    try {
      const s = await db.command({ dbStats: 1, scale: 1 }, { maxTimeMS: QUERY_MS });
      storage = {
        error: "",
        collections: s.collections ?? null,
        records: s.objects ?? null,
        dataSize: s.dataSize ?? null,
        storageSize: s.storageSize ?? null,
        indexSize: s.indexSize ?? null,
        // Only some servers report the disk; a shared Atlas cluster does not.
        diskUsed: s.fsUsedSize ?? null,
        diskTotal: s.fsTotalSize ?? null,
      };
      if (storage.diskUsed && storage.diskTotal) {
        const pct = Math.round((storage.diskUsed / storage.diskTotal) * 100);
        storage.diskPercent = pct;
        if (pct >= 90) problems.push(`The database disk is ${pct}% full.`);
        else if (pct >= 80) warnings.push(`The database disk is ${pct}% full.`);
      }
    } catch (err) {
      storage = { error: failText(err) };
    }
  }

  // Errors recorded since the server started
  const log = getMongoEvents();
  const errorsOnly = log.events.filter((e) => e.type === "error" || e.level === "bad");
  const inPeriod = errorsOnly.filter((e) => new Date(e.at) >= since);
  const lastHour = inPeriod.filter((e) => now - new Date(e.at) <= 60 * MIN);
  if (lastHour.length) problems.push(`${lastHour.length} database error${lastHour.length === 1 ? "" : "s"} in the last hour.`);
  else if (inPeriod.length) warnings.push(`${inPeriod.length} database error${inPeriod.length === 1 ? "" : "s"} earlier in this period.`);

  const lastConnected = log.events.find((e) => e.type === "connection" && e.level === "ok");
  connection.connectedSince = lastConnected?.at || null;

  return {
    generatedAt: now.toISOString(),
    hours: h,
    since: since.toISOString(),
    status: problems.length ? "bad" : warnings.length ? "warn" : "ok",
    problems,
    warnings,
    connection,
    writeTest,
    storage,
    errors: {
      since: log.since,
      watching: log.watching,
      inPeriod: inPeriod.length,
      lastHour: lastHour.length,
      list: log.events.filter((e) => new Date(e.at) >= since).slice(0, 50),
    },
    collections,
    listError,
  };
}
