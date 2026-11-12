/**
 * Retries the Odoo master_tutors record for registered tutors who have no
 * tutor ID because Odoo failed when they registered (tutorRegistration.js
 * saves them in MongoDB anyway, and nothing used to try again).
 *
 * Every ID this hands out is unique:
 *   - a new ID comes from nextTutorCode (utils/tutorCodes.js): above every TUT
 *     ID in Odoo, on registered tutors and on partial tutors, and taken from a
 *     counter that only goes up, so it has never belonged to anyone;
 *   - a tutor who came from the partial form keeps that entry's ID, but only
 *     when nobody else (another tutor, or an Odoo record) has it;
 *   - before an ID is saved it is checked again: no other registered tutor,
 *     no partial tutor (other than their own entry) and no other Odoo record
 *     may hold it. If one does, nothing is saved and the tutor is marked
 *     "Needs a look", so they are not retried until staff clear it.
 * Odoo is written before MongoDB, and MongoDB only fills an empty ID, so a
 * registration finishing at the same moment is never overwritten.
 */
import Tutor from "../models/Tutor.js";
import PartialTutor from "../models/PartialTutor.js";
import { listOdooTutorCodes, upsertMasterTutor } from "./odooService.js";
import { callOdooMethod, getOdooUid } from "./whatsappService.js";
import { nextTutorCode, registeredTutorCodes, partialTutorCodes } from "./tutorCodes.js";

export const NEEDS_LOOK = "Needs a look:";
const CODE = /^TUT\d+$/;
const BATCH = 10;
// Leaves a registration that is still running alone
const MIN_AGE_MS = 10 * 60 * 1000;
const NO_CODE = [
  { tutorCode: { $exists: false } }, { tutorCode: null }, { tutorCode: { $regex: "^\\s*$" } },
  { tutorCode: { $in: ["false", "null", "undefined", "False"] } },
];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sameCode = (code) => new RegExp(`^\\s*${escape(code)}\\s*$`, "i");
const looksOffline = (msg) => /ENOTFOUND|EHOSTUNREACH|ECONNREFUSED|ETIMEDOUT|timed? ?out|fetch failed|socket hang up|login failed/i.test(msg);

export const defaultDeps = {
  now: () => Date.now(),
  findPending: (olderThan, limit) => Tutor.find({
    $and: [
      { $or: NO_CODE },
      { status: { $ne: "rejected" } },
      { createdAt: { $lt: olderThan } },
      { odooSyncError: { $not: new RegExp(`^${escape(NEEDS_LOOK)}`) } },
    ],
  }).sort({ createdAt: 1 }).limit(limit).lean(),
  readOdooCodes: () => listOdooTutorCodes({ timeoutMs: 15000 }),
  nextCode: (odooCodes) => nextTutorCode({ odooCodes }),
  reservedCodes: async () => [...await registeredTutorCodes(), ...await partialTutorCodes()],
  partialCode: async (id) => (id ? (await PartialTutor.findById(id, { tutorCode: 1 }).lean())?.tutorCode || "" : ""),
  // Other registered tutors / partial tutors holding the code
  tutorsWithCode: (code, notId) => Tutor.find({ tutorCode: sameCode(code), _id: { $ne: notId } }, { name: 1 }).lean(),
  partialsWithCode: (code, notId) => PartialTutor.find(
    { tutorCode: sameCode(code), ...(notId ? { _id: { $ne: notId } } : {}) }, { name: 1 },
  ).lean(),
  odooRecordsWithCode: async (code) => {
    const uid = await getOdooUid();
    return callOdooMethod(uid, "master_tutors", "search_read", [[["tutor_id", "=ilike", code]]],
      { fields: ["id"], context: { active_test: false } });
  },
  upsert: (data, options) => upsertMasterTutor(data, options),
  // Only fills an empty ID: false when the tutor got one in the meantime
  saveCode: async (id, { code, odooId }) => {
    const res = await Tutor.updateOne(
      { _id: id, $or: NO_CODE },
      { $set: { tutorCode: code, odooLeadId: odooId, odooSyncStatus: "synced", odooSyncError: "" } },
    );
    return res.modifiedCount > 0;
  },
  markFailed: (id, error, odooId) => Tutor.updateOne(
    { _id: id, $or: NO_CODE },
    { $set: { odooSyncStatus: "failed", odooSyncError: error, ...(odooId ? { odooLeadId: odooId } : {}) } },
  ),
  log: console,
};

/** The ID to ask Odoo for: their partial entry's, if nobody else has it, else a brand-new one. */
async function pickCode(tutor, odooCodes, deps) {
  const inOdoo = new Set(odooCodes.map((c) => String(c).trim().toUpperCase()));
  const own = String(await deps.partialCode(tutor.fromPartialTutorId) || "").trim().toUpperCase();
  if (CODE.test(own) && !inOdoo.has(own) && !(await deps.tutorsWithCode(own, tutor._id)).length) return own;
  return deps.nextCode(odooCodes);
}

/** Who else holds `code`, or "" when nobody does. */
async function heldBy(code, tutor, odooId, deps) {
  const [tutors, partials, odoo] = await Promise.all([
    deps.tutorsWithCode(code, tutor._id),
    deps.partialsWithCode(code, tutor.fromPartialTutorId || null),
    deps.odooRecordsWithCode(code),
  ]);
  if (tutors.length) return `tutor ${tutors.map((t) => t.name || t._id).join(", ")}`;
  if (partials.length) return `partial-form tutor ${partials.map((p) => p.name || p._id).join(", ")}`;
  const others = (odoo || []).filter((r) => r.id !== odooId);
  if (others.length) return `Odoo record${others.length > 1 ? "s" : ""} #${others.map((r) => r.id).join(", #")}`;
  return "";
}

/**
 * One pass: up to BATCH tutors without an ID, oldest first.
 * Returns { checked, fixed, failed, needsLook, odooDown }.
 */
export async function retryTutorOdooSync(overrides = {}) {
  const deps = { ...defaultDeps, ...overrides };
  const out = { checked: 0, fixed: 0, failed: 0, needsLook: 0, odooDown: false };

  const pending = await deps.findPending(new Date(deps.now() - MIN_AGE_MS), BATCH);
  if (!pending.length) return out;

  let odooCodes = null;
  try { odooCodes = await deps.readOdooCodes(); } catch { odooCodes = null; }
  if (!odooCodes) {
    deps.log.warn(`[TutorOdooRetry] Odoo can't be reached; ${pending.length} tutor(s) without an ID wait for the next run.`);
    return { ...out, odooDown: true };
  }

  for (const tutor of pending) {
    out.checked += 1;
    let odooId = null;
    try {
      const wanted = await pickCode(tutor, odooCodes, deps);
      const reservedCodes = await deps.reservedCodes();
      const res = await deps.upsert(tutor, { preferredCode: wanted, reservedCodes });
      odooId = res?.id ?? null;
      const code = String(res?.tutorCode || "").trim().toUpperCase();

      if (!odooId) throw new Error("Odoo returned no tutor record");
      if (!CODE.test(code)) {
        await deps.markFailed(tutor._id, `${NEEDS_LOOK} Odoo record #${odooId} has no usable tutor ID ("${res?.tutorCode || ""}")`, odooId);
        out.needsLook += 1;
        continue;
      }
      const clash = await heldBy(code, tutor, odooId, deps);
      if (clash) {
        await deps.markFailed(tutor._id, `${NEEDS_LOOK} Odoo record #${odooId} has ${code}, which ${clash} already has`, odooId);
        deps.log.warn(`[TutorOdooRetry] ${tutor.name || tutor._id}: ${code} is already ${clash}'s; not saved.`);
        out.needsLook += 1;
        continue;
      }
      if (await deps.saveCode(tutor._id, { code, odooId })) {
        out.fixed += 1;
        deps.log.log(`[TutorOdooRetry] ${tutor.name || tutor._id} is now ${code} (Odoo #${odooId}).`);
        if (!odooCodes.includes(code)) odooCodes.push(code);
      }
    } catch (err) {
      const msg = err?.message || String(err);
      out.failed += 1;
      try { await deps.markFailed(tutor._id, msg, odooId); } catch { /* reported below */ }
      deps.log.error(`[TutorOdooRetry] ${tutor.name || tutor._id}: ${msg}`);
      if (looksOffline(msg)) { out.odooDown = true; break; }
    }
  }
  return out;
}

let running = false;

/** Runs a pass 2 minutes after start, then every TUTOR_ODOO_RETRY_INTERVAL_MIN (default 30). */
export function startTutorOdooRetryScheduler(env = process.env) {
  const minutes = Math.max(5, Number(env.TUTOR_ODOO_RETRY_INTERVAL_MIN) || 30);
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const r = await retryTutorOdooSync();
      if (r.checked) console.log(`[TutorOdooRetry] Checked ${r.checked}: ${r.fixed} got an ID, ${r.failed} failed, ${r.needsLook} need a look.`);
    } catch (err) {
      console.error("[TutorOdooRetry] Run failed:", err.message);
    } finally {
      running = false;
    }
  };
  console.log(`[TutorOdooRetry] Starting — tutors without an ID are retried every ${minutes} min.`);
  setTimeout(run, 2 * 60 * 1000);
  setInterval(run, minutes * 60 * 1000);
}
