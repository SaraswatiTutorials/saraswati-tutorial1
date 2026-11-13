/**
 * agreementSync.js — copies each tutor's Odoo Sign agreement into MongoDB.
 *
 * Every AGREEMENT_SYNC_INTERVAL_MIN minutes (default 30) it reads every Odoo
 * Sign signer (sign.request.item) with its document, finds the tutor by email
 * or by the last 10 digits of a phone number, and writes the result to
 * Tutor.odooAgreement — and to PartialTutor.odooAgreement for partial tutors
 * who have not completed the full registration yet. Then "how many tutors have signed" is one MongoDB count.
 *
 * Odoo is only read (search_read / fields_get). In MongoDB only odooAgreement
 * is written, and only on tutors whose agreement changed. onboardingCompleted
 * is never touched.
 *
 * One tutor, several agreements: signed beats waiting beats refused beats
 * cancelled; between two of the same kind the newest one is kept.
 */

const SYNC_KEY = "odoo_agreement_sync";
const SYNC_INTERVAL_MIN = Number(process.env.AGREEMENT_SYNC_INTERVAL_MIN || 30);

const ITEM_FIELDS = ["id", "sign_request_id", "partner_id", "signer_email", "sms_number", "state", "signing_date", "create_date"];
const REQUEST_FIELDS = ["id", "reference", "template_id", "state", "create_date", "completion_date"];
const PARTNER_FIELDS = ["id", "name", "email", "phone", "mobile"];

const last10 = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length >= 10 ? d.slice(-10) : ""; };
const mail = (v) => String(v || "").trim().toLowerCase();
const m2oId = (v) => (Array.isArray(v) ? v[0] : null);
const m2oName = (v) => (Array.isArray(v) ? v[1] || "" : "");

/** Odoo datetimes are UTC "YYYY-MM-DD HH:MM:SS" (dates "YYYY-MM-DD"). */
export function odooDate(v) {
  if (!v || typeof v !== "string") return null;
  const d = new Date(v.length <= 10 ? `${v}T00:00:00Z` : `${v.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Odoo signer state → our status. */
export function statusOf(state) {
  if (state === "completed") return "signed";
  if (state === "refused") return "refused";
  if (state === "canceled" || state === "cancelled") return "cancelled";
  return "sent"; // "sent", "shared", or anything else still open
}

const RANK = { signed: 4, sent: 3, refused: 2, cancelled: 1, none: 0 };
const dateOf = (a) => (a.status === "signed" ? a.signedAt : a.sentAt)?.getTime() || 0;

/** True when `a` should replace `b` as the tutor's agreement. */
function better(a, b) {
  if (!b) return true;
  if (RANK[a.status] !== RANK[b.status]) return RANK[a.status] > RANK[b.status];
  return dateOf(a) > dateOf(b);
}

/**
 * Works out each tutor's agreement from the Odoo rows.
 * @returns {Map<string, object>} tutor _id → { status, signed, signedAt, sentAt, document, signRequestId }
 *   (tutors with no agreement in Odoo are not in the map)
 */
export function agreementsByTutor({ items, requests, partners, tutors }) {
  const reqById = new Map(requests.map((r) => [r.id, r]));
  const partnerById = new Map(partners.map((p) => [p.id, p]));

  const byNumber = new Map();
  const byEmail = new Map();
  const add = (map, key, t) => { if (!key) return; if (!map.has(key)) map.set(key, []); map.get(key).push(t); };
  for (const t of tutors) {
    for (const n of new Set([last10(t.phone), last10(t.whatsapp)])) add(byNumber, n, t);
    add(byEmail, mail(t.email), t);
  }

  const result = new Map();
  for (const it of items) {
    const req = reqById.get(m2oId(it.sign_request_id)) || {};
    const partner = partnerById.get(m2oId(it.partner_id)) || {};
    const email = mail(it.signer_email || partner.email);
    const numbers = [last10(it.sms_number), last10(partner.mobile), last10(partner.phone)].filter(Boolean);

    const matched = new Set([...numbers.flatMap((n) => byNumber.get(n) || []), ...(email ? byEmail.get(email) || [] : [])]);
    if (!matched.size) continue;

    const status = statusOf(it.state);
    const agreement = {
      status,
      signed: status === "signed",
      signedAt: status === "signed" ? odooDate(it.signing_date) || odooDate(req.completion_date) : null,
      sentAt: odooDate(req.create_date) || odooDate(it.create_date),
      document: req.reference || m2oName(req.template_id) || m2oName(it.sign_request_id) || "",
      signRequestId: m2oId(it.sign_request_id),
    };
    for (const t of matched) {
      const id = String(t._id);
      if (better(agreement, result.get(id))) result.set(id, agreement);
    }
  }
  return result;
}

const NONE = { status: "none", signed: false, signedAt: null, sentAt: null, document: "", signRequestId: null };
const time = (d) => (d ? new Date(d).getTime() : null);
function same(a = {}, b) {
  return (a.status || "none") === b.status && !!a.signed === b.signed &&
    time(a.signedAt) === time(b.signedAt) && time(a.sentAt) === time(b.sentAt) &&
    (a.document || "") === b.document && (a.signRequestId ?? null) === b.signRequestId;
}

/**
 * A read-only Odoo reader: asks only for the fields this Odoo has, since they
 * differ between Odoo versions.
 */
export async function makeOdooReader() {
  const { callOdooMethod, getOdooUid } = await import("./whatsappService.js");
  let uid = null;
  return async (model, domain, wanted) => {
    uid ||= await getOdooUid();
    const have = await callOdooMethod(uid, model, "fields_get", [], { attributes: ["type"] });
    const fields = wanted.filter((f) => have[f]);
    return callOdooMethod(uid, model, "search_read", [domain], { fields, context: { active_test: false } });
  };
}

/** Every Odoo Sign signer, with the documents and contacts they belong to. */
export async function readOdooSigners(readOdoo) {
  const items = (await readOdoo("sign.request.item", [], ITEM_FIELDS)) || [];
  const reqIds = [...new Set(items.map((i) => m2oId(i.sign_request_id)).filter(Boolean))];
  const partnerIds = [...new Set(items.map((i) => m2oId(i.partner_id)).filter(Boolean))];
  const requests = reqIds.length ? await readOdoo("sign.request", [["id", "in", reqIds]], REQUEST_FIELDS) : [];
  const partners = partnerIds.length ? await readOdoo("res.partner", [["id", "in", partnerIds]], PARTNER_FIELDS) : [];
  return { items, requests, partners };
}

/** Real MongoDB and Odoo. Loaded only when the sync runs, so tests stay in memory. */
async function defaultDeps() {
  const [{ default: Tutor }, { default: PartialTutor }, { default: SyncState }] = await Promise.all([
    import("../models/Tutor.js"), import("../models/PartialTutor.js"), import("../models/SyncState.js"),
  ]);
  return {
    readOdoo: await makeOdooReader(),
    findTutors: () => Tutor.find({}, { phone: 1, whatsapp: 1, email: 1, odooAgreement: 1 }).lean(),
    // Not a profile change, so updatedAt is left alone
    writeAgreements: (ops) => (ops.length ? Tutor.bulkWrite(ops, { ordered: false, timestamps: false }) : null),
    // Partial tutors who completed the registration are covered by their tutor record
    findPartials: () => PartialTutor.find({ registeredTutorId: null }, { whatsapp: 1, odooAgreement: 1 }).lean(),
    writePartialAgreements: (ops) => (ops.length ? PartialTutor.bulkWrite(ops, { ordered: false, timestamps: false }) : null),
    setState: (fields) => SyncState.findOneAndUpdate({ key: SYNC_KEY }, fields, { upsert: true }),
    log: console,
  };
}

let running = false;

/**
 * One sync run.
 * @returns {Promise<{signed:number, sent:number, changed:number, tutors:number, signers:number}>}
 */
export async function syncTutorAgreements(deps) {
  if (running) return { skipped: true };
  running = true;
  const d = deps || (await defaultDeps());
  try {
    await d.setState({ status: "running" });

    const { items, requests, partners } = await readOdooSigners(d.readOdoo);
    const now = new Date();
    /** The writes for one list of people, and how many signed / are waiting. */
    const plan = (people) => {
      const found = agreementsByTutor({ items, requests, partners, tutors: people });
      const ops = [];
      let signed = 0, sent = 0;
      for (const t of people) {
        // Odoo sent back no signers at all: keep what we have rather than wipe it
        const next = found.get(String(t._id)) || (items.length ? NONE : null);
        if (!next) continue;
        if (next.status === "signed") signed++;
        if (next.status === "sent") sent++;
        if (same(t.odooAgreement, next)) continue;
        ops.push({ updateOne: { filter: { _id: t._id }, update: { $set: { odooAgreement: { ...next, syncedAt: now } } } } });
      }
      return { ops, signed, sent };
    };

    const tutors = await d.findTutors();
    const t = plan(tutors);
    await d.writeAgreements(t.ops);

    const partials = d.findPartials ? await d.findPartials() : [];
    const p = plan(partials);
    if (d.writePartialAgreements) await d.writePartialAgreements(p.ops);

    const signed = t.signed, sent = t.sent;
    await d.setState({ status: "idle", lastSyncAt: now, lastSyncCount: signed, lastError: "" });
    const summary = {
      signed, sent, changed: t.ops.length + p.ops.length, tutors: tutors.length, signers: items.length,
      partialSigned: p.signed, partialSent: p.sent, partials: partials.length,
    };
    d.log.log(`[AgreementSync] ${signed} tutor(s) and ${p.signed} partial tutor(s) signed, ${sent + p.sent} waiting; ${summary.changed} updated (${items.length} Odoo signers).`);
    return summary;
  } catch (err) {
    await d.setState({ status: "error", lastError: err.message }).catch(() => {});
    throw err;
  } finally {
    running = false;
  }
}

/**
 * Count per agreement status, plus when the last sync ran. byStatus covers
 * registered tutors and partial tutors who have not registered yet together;
 * tutors / partials split them.
 */
export async function agreementSummary() {
  const [{ default: Tutor }, { default: PartialTutor }, { default: SyncState }] = await Promise.all([
    import("../models/Tutor.js"), import("../models/PartialTutor.js"), import("../models/SyncState.js"),
  ]);
  const byAgreement = [{ $group: { _id: { $ifNull: ["$odooAgreement.status", "none"] }, count: { $sum: 1 } } }];
  const [tutorGroups, partialGroups, state] = await Promise.all([
    Tutor.aggregate(byAgreement),
    PartialTutor.aggregate([{ $match: { registeredTutorId: null } }, ...byAgreement]),
    SyncState.findOne({ key: SYNC_KEY }).lean(),
  ]);
  const count = (groups) => {
    const c = { signed: 0, sent: 0, refused: 0, cancelled: 0, none: 0 };
    for (const g of groups) c[g._id] = (c[g._id] || 0) + g.count;
    return c;
  };
  const tutors = count(tutorGroups);
  const partials = count(partialGroups);
  const byStatus = Object.fromEntries(Object.keys({ ...tutors, ...partials }).map((k) => [k, (tutors[k] || 0) + (partials[k] || 0)]));
  const total = (c) => Object.values(c).reduce((a, b) => a + b, 0);
  return {
    totalTutors: total(tutors),
    totalPartials: total(partials),
    signed: tutors.signed,
    partialSigned: partials.signed,
    byStatus,
    tutors,
    partials,
    lastSyncAt: state?.lastSyncAt || null,
    syncStatus: state?.status || "never run",
    lastError: state?.lastError || "",
  };
}

export function startAgreementSyncScheduler() {
  console.log(`[AgreementSync] Copying Odoo Sign agreements to tutors every ${SYNC_INTERVAL_MIN} min`);
  const run = () => syncTutorAgreements().catch((err) => console.error("[AgreementSync] Failed:", err.message));
  setTimeout(run, 60_000); // a minute after start-up, after the tutor sync has begun
  setInterval(run, SYNC_INTERVAL_MIN * 60 * 1000);
}
