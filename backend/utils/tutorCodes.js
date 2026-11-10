/**
 * TUT0001-style tutor IDs for partial tutors (the short sign-up form), from the
 * same numbering as fully registered tutors.
 *
 * A fully registered tutor's ID is made when Odoo's master_tutors record is
 * created (upsertMasterTutor in odooService.js). A partial tutor never reaches
 * Odoo, so their ID is made here, and the two never collide:
 *   - here, a new number is always above every TUT ID in Odoo, in the tutors
 *     collection and on other partial tutors, and taken from a counter that
 *     only goes up, so two forms sent at the same moment get different IDs;
 *   - upsertMasterTutor is handed the partial tutors' IDs to skip, and a
 *     partial tutor who registers fully keeps the ID they already have.
 * Every partial-form entry gets its own ID, never one already in use — not
 * even when the same number fills the form twice or is already a registered
 * tutor. A unique index on PartialTutor.tutorCode backs this up.
 */
import Counter from "../models/Counter.js";
import Tutor from "../models/Tutor.js";
import PartialTutor from "../models/PartialTutor.js";
import { phonePattern } from "./loginMatch.js";

const COUNTER_ID = "tutorCode";
const CODE_PATTERN = /^TUT\d+$/i;

export function formatTutorCode(n) {
  return `TUT${String(n).padStart(4, "0")}`;
}

/** 0 for anything that is not a TUT number. */
export function tutorCodeNumber(code) {
  const m = /^TUT(\d+)$/i.exec(String(code || "").trim());
  return m ? Number(m[1]) : 0;
}

/** Every TUT ID held by a partial tutor, for upsertMasterTutor to skip. */
export async function partialTutorCodes() {
  const rows = await PartialTutor.find({ tutorCode: CODE_PATTERN }, { tutorCode: 1 }).lean();
  return [...new Set(rows.map((r) => r.tutorCode.toUpperCase()))];
}

/**
 * The ID this WhatsApp number already has, if any: a registered tutor's first,
 * then another partial-form entry by the same person.
 */
export async function existingCodeForPhone(phone, { excludeId = null } = {}) {
  const pattern = phonePattern(phone);
  if (!pattern) return "";
  const tutor = await Tutor.findOne(
    { $or: [{ phone: pattern }, { whatsapp: pattern }], tutorCode: CODE_PATTERN },
    { tutorCode: 1 },
  ).lean();
  if (tutor?.tutorCode) return tutor.tutorCode;
  const partial = await PartialTutor.findOne(
    { whatsapp: pattern, tutorCode: CODE_PATTERN, ...(excludeId ? { _id: { $ne: excludeId } } : {}) },
    { tutorCode: 1 },
  ).sort({ createdAt: 1 }).lean();
  return partial?.tutorCode || "";
}

async function highestOnRecord(odooCodes) {
  const [tutors, partials] = await Promise.all([
    Tutor.find({ tutorCode: CODE_PATTERN }, { tutorCode: 1 }).lean(),
    PartialTutor.find({ tutorCode: CODE_PATTERN }, { tutorCode: 1 }).lean(),
  ]);
  let top = 0;
  for (const c of [...tutors.map((t) => t.tutorCode), ...partials.map((p) => p.tutorCode), ...odooCodes]) {
    top = Math.max(top, tutorCodeNumber(c));
  }
  return top;
}

/** A TUT ID nobody has. `odooCodes` is every tutor_id in Odoo's master_tutors. */
export async function nextTutorCode({ odooCodes = [] } = {}) {
  await Counter.updateOne(
    { _id: COUNTER_ID },
    { $max: { seq: await highestOnRecord(odooCodes) } },
    { upsert: true },
  );
  const inOdoo = new Set(odooCodes.map((c) => String(c).toUpperCase()));
  for (;;) {
    const { seq } = await Counter.findOneAndUpdate(
      { _id: COUNTER_ID },
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );
    const code = formatTutorCode(seq);
    if (inOdoo.has(code)) continue;
    const taken = (await Tutor.exists({ tutorCode: code })) || (await PartialTutor.exists({ tutorCode: code }));
    if (!taken) return code;
  }
}

/**
 * Gives a partial tutor their own new ID, unless they have one. Returns the
 * ID, or "" when none could be given yet.
 *
 * `odooCodes` (or `readOdooCodes()`) is Odoo's tutor IDs, null when Odoo
 * cannot be read. Without them no number is handed out: one that only Odoo
 * knows about could be repeated. The person gets their ID on the next try
 * (their next login, or the server's next start).
 */
export async function assignPartialTutorCode(partial, { readOdooCodes = async () => null, odooCodes = null, quiet = false } = {}) {
  if (!partial) return "";
  if (partial.tutorCode) return partial.tutorCode;

  let fromOdoo = odooCodes;
  if (!fromOdoo) {
    try { fromOdoo = await readOdooCodes(); } catch { fromOdoo = null; }
  }
  if (!fromOdoo) {
    if (!quiet) console.warn(`[TutorCode] Odoo's tutor IDs could not be read, so ${partial._id} gets an ID on the next try.`);
    return "";
  }
  const code = await nextTutorCode({ odooCodes: fromOdoo });

  // Only fills an empty ID, so a second call at the same moment can't overwrite the first
  const res = await PartialTutor.updateOne(
    { _id: partial._id, $or: [{ tutorCode: "" }, { tutorCode: { $exists: false } }] },
    { $set: { tutorCode: code } },
  );
  if (res.modifiedCount === 0) {
    const fresh = await PartialTutor.findById(partial._id, { tutorCode: 1 }).lean();
    return fresh?.tutorCode || code;
  }
  partial.tutorCode = code;
  return code;
}

/**
 * Gives every partial tutor without an ID one, oldest first, so the earliest
 * sign-ups get the lowest numbers. Safe to run any number of times.
 */
export async function backfillPartialTutorCodes({ readOdooCodes = async () => null } = {}) {
  const missing = await PartialTutor.find({ $or: [{ tutorCode: "" }, { tutorCode: { $exists: false } }] })
    .sort({ createdAt: 1 }).lean();
  if (!missing.length) return { assigned: 0 };
  let odooCodes = null;
  try { odooCodes = await readOdooCodes(); } catch { odooCodes = null; }
  if (!odooCodes) {
    console.warn(`[TutorCode] Odoo's tutor IDs could not be read; ${missing.length} partial tutor(s) get their IDs on the next start.`);
    return { assigned: 0, odooRead: false };
  }
  let assigned = 0;
  for (const p of missing) {
    try {
      if (await assignPartialTutorCode(p, { odooCodes, quiet: true })) assigned += 1;
    } catch (err) {
      console.error(`[TutorCode] Could not give ${p._id} an ID:`, err.message);
    }
  }
  return { assigned, odooRead: !!odooCodes };
}
