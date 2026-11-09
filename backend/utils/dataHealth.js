/**
 * Panel 2 — data checks.
 *
 * Answers two questions for every kind of data the pipeline depends on:
 *   1. Is new data still arriving in the database?
 *   2. Is what arrived complete enough for the next step to use?
 *
 * Read only: nothing in this file writes, sends or changes anything. Every
 * query carries a time limit, so one slow collection shows as "could not
 * check" instead of hanging the page, and one source failing never hides the
 * others.
 */

import mongoose from "mongoose";

/** The longest period the page may ask about: 30 days. */
export const MAX_HOURS = 720;

/** Rows read per source. A busy month is a few hundred; this is a ceiling, not a target. */
const MAX_ROWS = 5000;

/** Shortlists are large and the matching workflow wrote hundreds of thousands, so only the newest are inspected. */
const SHORTLIST_SAMPLE = 500;

/** Examples listed under each check. The count is always the full number. */
const EXAMPLES = 5;

/** Per query. Generous, but short enough that the page always answers. */
const QUERY_MS = 8000;

const MIN = 60 * 1000;
const PANEL_SHORTLIST_SOURCE = "panel 2 shortlist button";

// ---------------------------------------------------------------
// Small helpers, exported so they can be tested on their own
// ---------------------------------------------------------------

export const digitsOf = (value) => String(value ?? "").replace(/\D/g, "");

/** The ten-digit mobile number inside whatever was typed, or "" when there is none. */
export function mobileOf(value) {
  const d = digitsOf(value);
  if (d.length === 10) return d;
  if (d.length === 11 && d.startsWith("0")) return d.slice(1);
  if (d.length === 12 && d.startsWith("91")) return d.slice(2);
  if (d.length === 13 && d.startsWith("091")) return d.slice(3);
  return "";
}

/**
 * What is wrong with a phone number, or "" when nothing is.
 * WhatsApp only reaches mobiles, and Indian mobiles start with 6 to 9.
 */
export function phoneProblem(value) {
  const d = digitsOf(value);
  if (!d) return "No number";
  const mobile = mobileOf(d);
  if (!mobile) return `Has ${d.length} digits`;
  if (!/^[6-9]/.test(mobile)) return "Not a mobile number";
  return "";
}

/** Both coordinates present and not the 0,0 a broken map picker leaves behind. */
export function hasCoordinates(lat, lng) {
  const a = Number(lat);
  const b = Number(lng);
  if (lat == null || lng == null || lat === "" || lng === "") return false;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return !(a === 0 && b === 0);
}

const blank = (v) => !String(v ?? "").trim();

/** A date from a Date, an ISO string or a number; null when it is none of those. */
export function toDate(value) {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** When a row was written: its own field when it has one, otherwise the time inside its ObjectId. */
function writtenAt(row, field) {
  const own = field ? toDate(row?.[field]) : null;
  if (own) return own;
  return row?._id && typeof row._id.getTimestamp === "function" ? row._id.getTimestamp() : null;
}

/**
 * Runs a list of rules over rows. A rule's `test` returns true, or a short
 * note naming what is wrong, when the row fails.
 */
export function runRules(rows, rules, describe) {
  return rules.map((rule) => {
    const hits = [];
    for (const row of rows) {
      const result = rule.test(row);
      if (result) hits.push({ row, note: typeof result === "string" ? result : "" });
    }
    return {
      key: rule.key,
      label: rule.label,
      help: rule.help,
      level: rule.level,
      count: hits.length,
      examples: hits.slice(0, EXAMPLES).map(({ row, note }) => {
        const d = describe(row);
        return { ref: d.ref || "", name: d.name || "", note: note || d.note || "", at: d.at || null };
      }),
    };
  });
}

/**
 * One word for a source. A problem outranks a warning; a source with nothing
 * new in the period is "quiet", which is not a fault but is worth seeing.
 */
export function sourceStatus(source) {
  if (source.error) return "unknown";
  const checks = source.checks || [];
  if (checks.some((c) => c.level === "bad" && c.count > 0)) return "bad";
  if (checks.some((c) => c.level === "warn" && c.count > 0)) return "warn";
  if (source.count === 0) return "quiet";
  return "ok";
}

const fact = (label, value) => ({ label, value });

/** Requirement IDs, out of `ids`, that have no enquiry in the database. Archived ones still count as existing. */
async function missingRequirements(db, ids) {
  const wanted = [...new Set(ids.filter(Boolean))];
  if (!wanted.length) return new Set();
  const found = await db.collection("parentenquiries")
    .distinct("requirementId", { requirementId: { $in: wanted } }, { maxTimeMS: QUERY_MS });
  const have = new Set(found);
  return new Set(wanted.filter((id) => !have.has(id)));
}

const unknownRequirementRule = (missing) => ({
  key: "unknown_requirement",
  label: "Points to an enquiry that is not in the database",
  help: "The requirement ID on this record matches no parent enquiry, so Panel 2 cannot show it against an enquiry.",
  level: "warn",
  test: (r) => !blank(r.requirementId) && missing.has(r.requirementId) && `Requirement ${r.requirementId}`,
});

// ---------------------------------------------------------------
// Sources, in the order data flows through the pipeline
// ---------------------------------------------------------------

async function parentEnquiries(db, { since, now }) {
  const coll = db.collection("parentenquiries");
  const real = { isDemoRecord: { $ne: true }, archived: { $ne: true } };
  const logs = db.collection("analyticslogs");
  const formLog = (action) => logs.countDocuments(
    { page_visited: "/parent-enquiry", action, createdAt: { $gte: since } }, { maxTimeMS: QUERY_MS });

  const [rows, newest, reached, saved] = await Promise.all([
    coll.find({ ...real, createdAt: { $gte: since } }, {
      projection: {
        requirementId: 1, parentName: 1, phone: 1, area: 1, pincode: 1, city: 1, latitude: 1, longitude: 1,
        wards: 1, odooLeadId: 1, odooSyncStatus: 1, odooSyncError: 1, createdAt: 1, updatedAt: 1,
      },
      maxTimeMS: QUERY_MS,
    }).sort({ createdAt: -1 }).limit(MAX_ROWS).toArray(),
    coll.find(real, { projection: { createdAt: 1 }, maxTimeMS: QUERY_MS }).sort({ createdAt: -1 }).limit(1).next(),
    formLog("backend_validation_success"),
    formLog("database_saved_success"),
  ]);

  // The same requirement ID on two enquiries, counted across the whole
  // collection: one of them is invisible to every step that looks it up.
  const ids = [...new Set(rows.map((r) => r.requirementId).filter(Boolean))];
  const dupes = ids.length
    ? await coll.aggregate([
        { $match: { requirementId: { $in: ids } } },
        { $group: { _id: "$requirementId", n: { $sum: 1 } } },
        { $match: { n: { $gt: 1 } } },
      ], { maxTimeMS: QUERY_MS }).toArray()
    : [];
  const dupeCount = new Map(dupes.map((d) => [d._id, d.n]));

  const ward = (r) => (Array.isArray(r.wards) ? r.wards[0] : null) || {};
  const subjectsMissing = (w) => (Array.isArray(w.subjectsNeeded) ? !w.subjectsNeeded.length : blank(w.subjectsNeeded));
  const anyLocation = (r) => hasCoordinates(r.latitude, r.longitude) || !blank(r.area) || !blank(r.pincode);
  const stuckBefore = new Date(now.getTime() - 10 * MIN);

  const checks = runRules(rows, [
    {
      key: "no_requirement_id", level: "bad",
      label: "Saved without a requirement ID",
      help: "Every Panel 2 step finds an enquiry by its requirement ID, so nothing can be done with this one.",
      test: (r) => blank(r.requirementId),
    },
    {
      key: "duplicate_requirement_id", level: "bad",
      label: "Requirement ID used by more than one enquiry",
      help: "Steps look an enquiry up by this ID and will only ever find one of them.",
      test: (r) => dupeCount.has(r.requirementId) && `Used ${dupeCount.get(r.requirementId)} times`,
    },
    {
      key: "odoo_failed", level: "bad",
      label: "Saved here but not sent to Odoo",
      help: "Odoo refused or could not be reached, so the lead is missing there and Odoo messages cannot be sent for it.",
      test: (r) => r.odooSyncStatus === "failed" && (r.odooSyncError || "Odoo sync failed"),
    },
    {
      key: "odoo_stuck", level: "warn",
      label: "Still waiting for Odoo after 10 minutes",
      help: "Sending to Odoo normally takes seconds. A server restart during the send leaves it waiting.",
      test: (r) => ["pending", "retrying"].includes(r.odooSyncStatus) && toDate(r.updatedAt || r.createdAt) < stuckBefore,
    },
    {
      key: "no_location", level: "bad",
      label: "No location at all",
      help: "No map pin, area or pincode, so no tutor can be matched to this family.",
      test: (r) => !anyLocation(r),
    },
    {
      key: "no_map_pin", level: "warn",
      label: "No map pin",
      help: "Tutors are matched on area and pincode only, and no distances can be shown.",
      test: (r) => anyLocation(r) && !hasCoordinates(r.latitude, r.longitude),
    },
    {
      key: "bad_phone", level: "warn",
      label: "Phone number does not look right",
      help: "WhatsApp messages to the parent will not arrive.",
      test: (r) => phoneProblem(r.phone),
    },
    {
      key: "no_class_or_subject", level: "warn",
      label: "Class or subjects missing",
      help: "Tutors cannot be matched on what is to be taught.",
      test: (r) => {
        const w = ward(r);
        if (blank(w.classGrade) && subjectsMissing(w)) return "No class or subjects";
        if (blank(w.classGrade)) return "No class";
        if (subjectsMissing(w)) return "No subjects";
        return false;
      },
    },
  ], (r) => ({ ref: r.requirementId || "(no ID)", name: r.parentName, at: r.createdAt }));

  // Every submission that passes the server's checks is logged once on
  // arrival and again once it is saved. Fewer saves than arrivals means a
  // save failed after the parent pressed submit.
  const lost = Math.max(0, reached - saved);
  checks.unshift({
    key: "not_saved", level: "bad",
    label: "Submitted but not saved",
    help: "These reached the server but the save to the database failed. The parent saw an error and may not have tried again.",
    count: lost,
    examples: [],
  });

  return {
    count: rows.length,
    lastAt: newest?.createdAt || null,
    facts: [
      fact("Submitted", reached),
      fact("Saved", saved),
      fact("New enquiries", rows.length),
    ],
    checks,
  };
}

async function registeredTutors(db, { since }) {
  const coll = db.collection("tutors");
  const [rows, newest, everyone] = await Promise.all([
    coll.find({ createdAt: { $gte: since } }, {
      projection: {
        name: 1, tutorCode: 1, phone: 1, whatsapp: 1, latitude: 1, longitude: 1, area: 1, city: 1, pincode: 1,
        status: 1, odooSyncStatus: 1, odooSyncError: 1, createdAt: 1,
      },
      maxTimeMS: QUERY_MS,
    }).sort({ createdAt: -1 }).limit(MAX_ROWS).toArray(),
    coll.find({}, { projection: { createdAt: 1 }, maxTimeMS: QUERY_MS }).sort({ createdAt: -1 }).limit(1).next(),
    coll.find({}, { projection: { phone: 1, whatsapp: 1 }, maxTimeMS: QUERY_MS }).limit(50000).toArray(),
  ]);

  // How many tutor records each mobile number appears on.
  const owners = new Map();
  for (const t of everyone) {
    for (const m of new Set([mobileOf(t.whatsapp), mobileOf(t.phone)].filter(Boolean))) {
      owners.set(m, (owners.get(m) || 0) + 1);
    }
  }
  const numberOf = (t) => t.whatsapp || t.phone;
  const anyLocation = (t) => hasCoordinates(t.latitude, t.longitude) || !blank(t.area) || !blank(t.pincode) || !blank(t.city);

  const checks = runRules(rows, [
    {
      key: "no_phone", level: "bad",
      label: "No WhatsApp or phone number",
      help: "This tutor can never be invited to a requirement.",
      test: (t) => blank(t.whatsapp) && blank(t.phone),
    },
    {
      key: "bad_phone", level: "warn",
      label: "Number does not look right",
      help: "Invitations to this tutor will not arrive.",
      test: (t) => !blank(numberOf(t)) && phoneProblem(numberOf(t)),
    },
    {
      key: "duplicate_phone", level: "warn",
      label: "Number already on another tutor record",
      help: "The same person may be registered twice and could be invited twice for one requirement.",
      test: (t) => {
        const m = mobileOf(numberOf(t));
        return m && owners.get(m) > 1 && `On ${owners.get(m)} records`;
      },
    },
    {
      key: "no_location", level: "bad",
      label: "No location at all",
      help: "Never shortlisted, because shortlists are built on where the tutor is.",
      test: (t) => !anyLocation(t),
    },
    {
      key: "no_map_pin", level: "warn",
      label: "No map pin",
      help: "Matched on area and pincode only; no distance can be worked out.",
      test: (t) => anyLocation(t) && !hasCoordinates(t.latitude, t.longitude),
    },
    {
      key: "approved_no_code", level: "warn",
      label: "Approved but has no tutor code",
      help: "Panel 2 and the parent's options identify tutors by code.",
      test: (t) => t.status === "approved" && blank(t.tutorCode),
    },
    {
      key: "odoo_failed", level: "warn",
      label: "Not sent to Odoo",
      help: "The tutor is missing in Odoo.",
      test: (t) => t.odooSyncStatus === "failed" && (t.odooSyncError || "Odoo sync failed"),
    },
    {
      key: "pending", level: "info",
      label: "Waiting for approval",
      help: "Not shortlisted until approved in the admin panel.",
      test: (t) => t.status === "pending",
    },
  ], (t) => ({ ref: t.tutorCode || t.name, name: t.tutorCode ? t.name : "", at: t.createdAt }));

  return {
    count: rows.length,
    lastAt: newest?.createdAt || null,
    facts: [
      fact("New registrations", rows.length),
      fact("Approved", rows.filter((t) => t.status === "approved").length),
      fact("Tutors on file", everyone.length),
    ],
    checks,
  };
}

async function partialTutors(db, { since }) {
  const coll = db.collection("partialtutors");
  const [rows, newest, everyone, approved] = await Promise.all([
    coll.find({ createdAt: { $gte: since } }, {
      projection: { name: 1, whatsapp: 1, location: 1, consent: 1, status: 1, createdAt: 1 },
      maxTimeMS: QUERY_MS,
    }).sort({ createdAt: -1 }).limit(MAX_ROWS).toArray(),
    coll.find({}, { projection: { createdAt: 1 }, maxTimeMS: QUERY_MS }).sort({ createdAt: -1 }).limit(1).next(),
    coll.find({}, { projection: { whatsapp: 1 }, maxTimeMS: QUERY_MS }).limit(50000).toArray(),
    db.collection("tutors").find({ status: "approved" }, { projection: { phone: 1, whatsapp: 1 }, maxTimeMS: QUERY_MS })
      .limit(50000).toArray(),
  ]);

  const entries = new Map();
  for (const p of everyone) {
    const m = mobileOf(p.whatsapp);
    if (m) entries.set(m, (entries.get(m) || 0) + 1);
  }
  const approvedNumbers = new Set(approved.flatMap((t) => [mobileOf(t.whatsapp), mobileOf(t.phone)]).filter(Boolean));
  const loc = (p) => p.location || {};
  const anyLocation = (p) => hasCoordinates(loc(p).latitude, loc(p).longitude)
    || !blank(loc(p).area) || !blank(loc(p).pincode) || !blank(loc(p).city);

  const checks = runRules(rows, [
    {
      key: "no_phone", level: "bad",
      label: "No WhatsApp number",
      help: "The form requires one, so this should not happen; this person cannot be invited.",
      test: (p) => blank(p.whatsapp),
    },
    {
      key: "bad_phone", level: "warn",
      label: "Number does not look right",
      help: "Invitations to this person will not arrive.",
      test: (p) => !blank(p.whatsapp) && phoneProblem(p.whatsapp),
    },
    {
      key: "no_consent", level: "bad",
      label: "No consent recorded",
      help: "The form asks for consent to WhatsApp contact. Without it this person should not be messaged.",
      test: (p) => p.consent?.accepted !== true,
    },
    {
      key: "no_location", level: "bad",
      label: "No location at all",
      help: "Never shortlisted, because shortlists are built on where the tutor is.",
      test: (p) => !anyLocation(p),
    },
    {
      key: "no_map_pin", level: "warn",
      label: "No map pin",
      help: "Matched on area and pincode only; no distance can be worked out.",
      test: (p) => anyLocation(p) && !hasCoordinates(loc(p).latitude, loc(p).longitude),
    },
    {
      key: "repeat", level: "info",
      label: "Filled in the form more than once",
      help: "Only the newest entry for a number is used in shortlists.",
      test: (p) => {
        const n = entries.get(mobileOf(p.whatsapp));
        return n > 1 && `${n} entries`;
      },
    },
    {
      key: "already_tutor", level: "info",
      label: "Already an approved tutor",
      help: "Left out of shortlists, because their registered record is used instead.",
      test: (p) => approvedNumbers.has(mobileOf(p.whatsapp)),
    },
  ], (p) => ({ ref: p.name || "(no name)", note: [loc(p).area, loc(p).city].filter(Boolean).join(", "), at: p.createdAt }));

  return {
    count: rows.length,
    lastAt: newest?.createdAt || null,
    facts: [
      fact("New entries", rows.length),
      fact("Entries on file", everyone.length),
    ],
    checks,
  };
}

const SYNC_JOBS = [
  { key: "odoo_tutor_sync", label: "Odoo master tutor list" },
  { key: "odoo_x_tutor_sync", label: "Odoo tutor form list" },
];

async function odooTutorSync(db, { now, env }) {
  const states = await db.collection("syncstates")
    .find({ key: { $in: SYNC_JOBS.map((j) => j.key) } }, { maxTimeMS: QUERY_MS }).toArray();
  const byKey = new Map(states.map((s) => [s.key, s]));
  const rows = SYNC_JOBS.map((job) => ({ ...job, state: byKey.get(job.key) || null }));

  const everyMin = Number(env.TUTOR_SYNC_INTERVAL_MIN || 15);
  // Three missed runs, and never less than an hour, before it is called late.
  const lateAfterMin = Math.max(60, everyMin * 3);

  const checks = runRules(rows, [
    {
      key: "never_ran", level: "warn",
      label: "Has never run against this database",
      help: "Tutor changes made in Odoo are not reaching this database.",
      test: (r) => !r.state,
    },
    {
      key: "error", level: "bad",
      label: "Last run stopped with an error",
      help: "Tutor changes made in Odoo since the last good run are missing here.",
      test: (r) => r.state?.status === "error" && (r.state.lastError || "Stopped with an error"),
    },
    {
      key: "late", level: "warn",
      label: `No successful run for over ${lateAfterMin >= 120 ? `${Math.round(lateAfterMin / 60)} hours` : `${lateAfterMin} minutes`}`,
      help: `It should run every ${everyMin} minutes. The server may be stopped or Odoo unreachable.`,
      test: (r) => {
        if (!r.state || r.state.status === "error") return false;
        const at = toDate(r.state.lastSyncAt);
        if (!at) return "Never finished a run";
        const mins = Math.round((now - at) / MIN);
        return mins > lateAfterMin && `Last good run ${mins >= 120 ? `${Math.round(mins / 60)} hours` : `${mins} minutes`} ago`;
      },
    },
    {
      key: "stuck", level: "warn",
      label: "Running for over 30 minutes",
      help: "A run normally takes a minute or two. It may have been cut off by a restart.",
      test: (r) => r.state?.status === "running" && toDate(r.state.updatedAt) < new Date(now.getTime() - 30 * MIN),
    },
    {
      key: "some_failed", level: "warn",
      label: "Some records failed in the last run",
      help: "The run finished, but these tutor records were not updated.",
      test: (r) => r.state?.status === "idle" && !blank(r.state.lastError) && r.state.lastError,
    },
  ], (r) => ({ ref: r.label, at: r.state?.lastSyncAt || null }));

  const lastAt = rows.map((r) => toDate(r.state?.lastSyncAt)).filter(Boolean).sort((a, b) => b - a)[0] || null;
  return {
    count: null, // not a stream of new rows, so never "quiet"
    lastAt,
    facts: rows.map((r) => fact(r.label, r.state?.lastSyncAt
      ? `${r.state.lastSyncCount ?? 0} updated`
      : "Not run")),
    checks,
  };
}

async function shortlists(db, { since }) {
  const coll = db.collection("tutor_shortlists");
  // By ObjectId time rather than matchedAt: _id is indexed, matchedAt alone
  // is not, and this collection is far too big to scan.
  const fromId = mongoose.Types.ObjectId.createFromTime(Math.floor(since.getTime() / 1000));
  const inPeriod = { _id: { $gte: fromId } };

  const [total, rows, newest] = await Promise.all([
    coll.countDocuments(inPeriod, { maxTimeMS: QUERY_MS }),
    coll.find(inPeriod, {
      projection: { requirementId: 1, source: 1, matchedAt: 1, tutorCount: 1, "tutors.rank": 1, partialCount: 1 },
      maxTimeMS: QUERY_MS,
    }).sort({ _id: -1 }).limit(SHORTLIST_SAMPLE).toArray(),
    coll.find({}, { projection: { matchedAt: 1 }, maxTimeMS: QUERY_MS }).sort({ _id: -1 }).limit(1).next(),
  ]);

  const missing = await missingRequirements(db, rows.map((r) => r.requirementId));
  const perRequirement = new Map();
  for (const r of rows) perRequirement.set(r.requirementId, (perRequirement.get(r.requirementId) || 0) + 1);
  const fromPanel = rows.filter((r) => r.source === PANEL_SHORTLIST_SOURCE).length;
  const size = (r) => (Array.isArray(r.tutors) ? r.tutors.length : Number(r.tutorCount) || 0);

  const checks = runRules(rows, [
    {
      key: "empty", level: "warn",
      label: "Saved with no tutors",
      help: "Panel 2 never saves an empty shortlist, so these came from the n8n matching workflow. Panel 2 skips them and uses the last one with tutors.",
      test: (r) => size(r) === 0,
    },
    unknownRequirementRule(missing),
    {
      key: "no_requirement_id", level: "bad",
      label: "Saved without a requirement ID",
      help: "Cannot be matched to any enquiry.",
      test: (r) => blank(r.requirementId),
    },
    {
      key: "from_n8n", level: "info",
      label: "Written by n8n, not the Panel 2 button",
      help: "In manual mode only the Panel 2 Shortlist button should be writing shortlists.",
      test: (r) => r.source !== PANEL_SHORTLIST_SOURCE && (r.source ? `Source: ${r.source}` : "No source recorded"),
    },
  ], (r) => ({ ref: r.requirementId || "(no ID)", note: `${size(r)} tutors`, at: writtenAt(r, "matchedAt") }));

  // The same enquiry shortlisted again and again points at a workflow on a loop.
  const repeated = [...perRequirement].filter(([, n]) => n > 5).sort((a, b) => b[1] - a[1]);
  checks.splice(1, 0, {
    key: "repeated", level: "warn",
    label: "Same enquiry shortlisted more than 5 times",
    help: "Something is saving shortlists on a timer. This is what filled the collection with hundreds of thousands of rows before.",
    count: repeated.length,
    examples: repeated.slice(0, EXAMPLES).map(([id, n]) => ({ ref: id || "(no ID)", name: "", note: `Saved ${n} times`, at: null })),
  });

  return {
    count: total,
    lastAt: newest ? writtenAt(newest, "matchedAt") : null,
    sampled: total > rows.length ? rows.length : null,
    facts: [
      fact("Saved in period", total),
      fact("From the Panel 2 button", fromPanel),
      fact("From n8n", rows.length - fromPanel),
    ],
    checks,
  };
}

async function invitations(db, { since, now }) {
  const coll = db.collection("broadcastlogs");
  const filter = { broadcastType: "requirement", createdAt: { $gte: since } };
  const [rows, newest] = await Promise.all([
    coll.find(filter, {
      projection: {
        tutorId: 1, tutorName: 1, tutorPhone: 1, tutorSource: 1, requirementId: 1, status: 1,
        failureReason: 1, whatsappMessageId: 1, responseStatus: 1, createdAt: 1, time: 1,
      },
      maxTimeMS: QUERY_MS,
    }).sort({ createdAt: -1 }).limit(MAX_ROWS).toArray(),
    coll.find({ broadcastType: "requirement" }, { projection: { createdAt: 1 }, maxTimeMS: QUERY_MS })
      .sort({ createdAt: -1 }).limit(1).next(),
  ]);

  const missing = await missingRequirements(db, rows.map((r) => r.requirementId));

  // The person each invitation went to, looked up in whichever list they came from.
  const idsFor = (source) => [...new Set(rows
    .filter((r) => (r.tutorSource === "partial") === (source === "partial") && r.tutorId)
    .map((r) => String(r.tutorId)))]
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  const [tutorIds, partialIds] = [idsFor("tutor"), idsFor("partial")];
  const [tutorsFound, partialsFound] = await Promise.all([
    tutorIds.length ? db.collection("tutors").distinct("_id", { _id: { $in: tutorIds } }, { maxTimeMS: QUERY_MS }) : [],
    partialIds.length ? db.collection("partialtutors").distinct("_id", { _id: { $in: partialIds } }, { maxTimeMS: QUERY_MS }) : [],
  ]);
  const found = new Set([...tutorsFound, ...partialsFound].map(String));

  const stuckBefore = new Date(now.getTime() - 15 * MIN);
  const handedOver = ["Sent", "Delivered", "Read", "Replied"];

  const checks = runRules(rows, [
    {
      key: "failed", level: "bad",
      label: "Failed to send",
      help: "Odoo or WhatsApp refused it. The tutor never got this invitation.",
      test: (r) => r.status === "Failed" && (r.failureReason || "No reason recorded"),
    },
    {
      key: "stuck", level: "warn",
      label: "Never finished sending",
      help: "Still marked as sending after 15 minutes, usually because the server restarted mid-send.",
      test: (r) => ["Pending", "Sending"].includes(r.status) && toDate(r.createdAt) < stuckBefore,
    },
    {
      key: "no_message_id", level: "warn",
      label: "Sent, but no WhatsApp message ID saved",
      help: "Delivery cannot be tracked for these, so Panel 2 cannot show whether they arrived.",
      test: (r) => handedOver.includes(r.status) && blank(r.whatsappMessageId),
    },
    {
      key: "no_phone", level: "bad",
      label: "Logged without a phone number",
      help: "A reply from this tutor cannot be matched to the invitation.",
      test: (r) => blank(r.tutorPhone),
    },
    {
      key: "no_requirement_id", level: "bad",
      label: "Logged without a requirement ID",
      help: "Cannot be shown against any enquiry.",
      test: (r) => blank(r.requirementId),
    },
    unknownRequirementRule(missing),
    {
      key: "unknown_tutor", level: "warn",
      label: "Tutor record no longer exists",
      help: "The tutor was deleted after being invited, so they cannot be offered or confirmed.",
      test: (r) => r.tutorId && mongoose.isValidObjectId(String(r.tutorId)) && !found.has(String(r.tutorId)),
    },
  ], (r) => ({ ref: r.tutorName || "(no name)", note: r.requirementId, at: r.createdAt || r.time }));

  return {
    count: rows.length,
    lastAt: newest?.createdAt || null,
    facts: [
      fact("Invitations", rows.length),
      fact("Failed", rows.filter((r) => r.status === "Failed").length),
      fact("Replied", rows.filter((r) => r.responseStatus && r.responseStatus !== "No Response").length),
    ],
    checks,
  };
}

async function whatsappReplies(db, { since, now }) {
  const coll = db.collection("inbound_messages");
  // The n8n router writes these, so the time may be a Date or a string;
  // the ObjectId time covers rows with neither.
  const fromId = mongoose.Types.ObjectId.createFromTime(Math.floor(since.getTime() / 1000));
  const filter = {
    $or: [
      { receivedAt: { $gte: since } },
      { receivedAt: { $gte: since.toISOString() } },
      { receivedAt: { $exists: false }, _id: { $gte: fromId } },
    ],
  };
  const [rows, newest] = await Promise.all([
    coll.find(filter, {
      projection: { route: 1, last10: 1, phone: 1, text: 1, receivedAt: 1, replyAppliedAt: 1, replyOutcome: 1, requirementId: 1 },
      maxTimeMS: QUERY_MS,
    }).sort({ _id: -1 }).limit(MAX_ROWS).toArray(),
    coll.find({}, { projection: { receivedAt: 1 }, maxTimeMS: QUERY_MS }).sort({ _id: -1 }).limit(1).next(),
  ]);

  const fromTutors = rows.filter((r) => r.route === "tutor");
  const unreadBefore = new Date(now.getTime() - 5 * MIN);
  const snippet = (r) => {
    const t = String(r.text || "").replace(/\s+/g, " ").trim();
    return t ? `"${t.length > 40 ? `${t.slice(0, 40)}…` : t}"` : "";
  };

  const checks = runRules(fromTutors, [
    {
      key: "not_read", level: "bad",
      label: "Tutor reply not read after 5 minutes",
      help: "This server reads tutor replies every minute. Unread ones mean the reply reader has stopped, so Interested answers are not being recorded.",
      test: (r) => !r.replyAppliedAt && (writtenAt(r, "receivedAt") || now) < unreadBefore,
    },
    {
      key: "no_phone", level: "bad",
      label: "Saved by n8n without the sender's number",
      help: "The reply cannot be matched to any tutor. This is the n8n handover problem the reply reader was built around.",
      test: (r) => r.replyOutcome === "no_phone",
    },
    {
      key: "no_invitation", level: "warn",
      label: "Clear yes or no, but no open invitation found",
      help: "No invitation to this number in the last 3 days was waiting for an answer, so it was not recorded.",
      test: (r) => r.replyOutcome === "no_open_invitation" && snippet(r),
    },
    {
      key: "unclear", level: "info",
      label: "Wording unclear, left for a person",
      help: "Neither a clear yes nor a clear no. Read it in Odoo and mark the tutor by hand.",
      test: (r) => r.replyOutcome === "left_for_a_person" && (snippet(r) || true),
    },
  ], (r) => ({ ref: r.last10 ? `…${String(r.last10).slice(-4)}` : "(no number)", at: writtenAt(r, "receivedAt") }));

  // Messages n8n saved without deciding who they are from.
  const unrouted = rows.filter((r) => blank(r.route));
  checks.push({
    key: "no_route", level: "info",
    label: "Saved without a route",
    help: "n8n did not mark these as from a tutor or a parent, so nothing here reads them.",
    count: unrouted.length,
    examples: unrouted.slice(0, EXAMPLES).map((r) => ({ ref: r.last10 ? `…${String(r.last10).slice(-4)}` : "(no number)", name: "", note: snippet(r), at: writtenAt(r, "receivedAt") })),
  });

  return {
    count: rows.length,
    lastAt: newest ? writtenAt(newest, "receivedAt") : null,
    facts: [
      fact("Messages received", rows.length),
      fact("From tutors", fromTutors.length),
      fact("Recorded as a reply", fromTutors.filter((r) => r.replyOutcome === "recorded").length),
    ],
    checks,
  };
}

async function topThree(db, { since }) {
  const coll = db.collection("tutor_top3");
  const [rows, newest] = await Promise.all([
    coll.find({ preparedAt: { $gte: since } }, {
      projection: { requirementId: 1, parentName: 1, sent: 1, failureReason: 1, tutors: 1, offeredCount: 1, preparedAt: 1 },
      maxTimeMS: QUERY_MS,
    }).sort({ preparedAt: -1 }).limit(MAX_ROWS).toArray(),
    coll.find({}, { projection: { preparedAt: 1 }, maxTimeMS: QUERY_MS }).sort({ preparedAt: -1 }).limit(1).next(),
  ]);
  const missing = await missingRequirements(db, rows.map((r) => r.requirementId));

  const checks = runRules(rows, [
    {
      key: "failed", level: "bad",
      label: "Not sent to the parent",
      help: "The options were prepared but WhatsApp did not take them, so the parent has nothing to choose from.",
      test: (r) => r.sent !== true && (r.failureReason || "No reason recorded"),
    },
    {
      key: "no_tutors", level: "bad",
      label: "Saved with no tutors offered",
      help: "There is nothing for the parent to choose.",
      test: (r) => !(Array.isArray(r.tutors) && r.tutors.length),
    },
    unknownRequirementRule(missing),
  ], (r) => ({ ref: r.requirementId || "(no ID)", name: r.parentName, at: r.preparedAt }));

  return {
    count: rows.length,
    lastAt: newest?.preparedAt || null,
    facts: [
      fact("Prepared", rows.length),
      fact("Sent", rows.filter((r) => r.sent === true).length),
    ],
    checks,
  };
}

async function parentChoices(db, { since }) {
  const coll = db.collection("tutor_assignments");
  const fromId = mongoose.Types.ObjectId.createFromTime(Math.floor(since.getTime() / 1000));
  const [rows, newest] = await Promise.all([
    coll.find({ $or: [{ resolvedAt: { $gte: since } }, { resolvedAt: { $exists: false }, _id: { $gte: fromId } }] }, {
      projection: { requirementId: 1, tutorName: 1, tutorCode: 1, choice: 1, resolvedAt: 1 },
      maxTimeMS: QUERY_MS,
    }).sort({ _id: -1 }).limit(MAX_ROWS).toArray(),
    coll.find({}, { projection: { resolvedAt: 1 }, maxTimeMS: QUERY_MS }).sort({ _id: -1 }).limit(1).next(),
  ]);

  const missing = await missingRequirements(db, rows.map((r) => r.requirementId));
  const ids = [...new Set(rows.map((r) => r.requirementId).filter(Boolean))];
  const offers = ids.length
    ? await db.collection("tutor_top3").find({ requirementId: { $in: ids }, sent: true },
        { projection: { requirementId: 1, "tutors.name": 1, "tutors.tutorCode": 1 }, maxTimeMS: QUERY_MS }).toArray()
    : [];
  const offeredFor = new Map();
  for (const o of offers) {
    if (!offeredFor.has(o.requirementId)) offeredFor.set(o.requirementId, []);
    offeredFor.get(o.requirementId).push(...(o.tutors || []));
  }

  const checks = runRules(rows, [
    {
      key: "no_tutor", level: "bad",
      label: "Saved without a tutor",
      help: "The parent's tap was recorded, but not which tutor it was for.",
      test: (r) => blank(r.tutorName) && blank(r.tutorCode),
    },
    {
      key: "not_offered", level: "warn",
      label: "Chosen tutor is not in the options sent",
      help: "The choice does not match any tutor this server offered for that enquiry. Check the parent picked from the latest message.",
      test: (r) => {
        if (blank(r.tutorName) && blank(r.tutorCode)) return false;
        const offered = offeredFor.get(r.requirementId);
        if (!offered) return "No options recorded as sent";
        const hit = offered.some((t) => (r.tutorCode && t.tutorCode === r.tutorCode)
          || (r.tutorName && String(t.name || "").trim().toLowerCase() === String(r.tutorName).trim().toLowerCase()));
        return !hit;
      },
    },
    unknownRequirementRule(missing),
  ], (r) => ({ ref: r.requirementId || "(no ID)", name: r.tutorName, note: r.choice ? `Option ${r.choice}` : "", at: writtenAt(r, "resolvedAt") }));

  return {
    count: rows.length,
    lastAt: newest ? writtenAt(newest, "resolvedAt") : null,
    facts: [fact("Choices received", rows.length)],
    checks,
  };
}

async function reconfirmations(db, { since }) {
  const coll = db.collection("parent_reconfirmations");
  const [rows, newest] = await Promise.all([
    coll.find({ sentAt: { $gte: since } }, {
      projection: { requirementId: 1, parentName: 1, sent: 1, failureReason: 1, sentAt: 1 },
      maxTimeMS: QUERY_MS,
    }).sort({ sentAt: -1 }).limit(MAX_ROWS).toArray(),
    coll.find({}, { projection: { sentAt: 1 }, maxTimeMS: QUERY_MS }).sort({ sentAt: -1 }).limit(1).next(),
  ]);
  const missing = await missingRequirements(db, rows.map((r) => r.requirementId));

  const checks = runRules(rows, [
    {
      key: "failed", level: "bad",
      label: "Not sent to the parent",
      help: "The parent was not asked to confirm their requirement.",
      test: (r) => r.sent !== true && (r.failureReason || "No reason recorded"),
    },
    unknownRequirementRule(missing),
  ], (r) => ({ ref: r.requirementId || "(no ID)", name: r.parentName, at: r.sentAt }));

  return {
    count: rows.length,
    lastAt: newest?.sentAt || null,
    facts: [
      fact("Asked", rows.length),
      fact("Sent", rows.filter((r) => r.sent === true).length),
    ],
    checks,
  };
}

/** What each source is, where its data comes from, and how to read it. */
export const SOURCES = [
  { key: "enquiries", label: "Parent enquiries", from: "Website booking form, saved here, then sent to Odoo", read: parentEnquiries },
  { key: "tutors", label: "Registered tutors", from: "Tutor registration form", read: registeredTutors },
  { key: "partials", label: "Partial tutor form", from: "Short tutor sign-up form", read: partialTutors },
  { key: "sync", label: "Odoo tutor sync", from: "Odoo to this database, on a timer", read: odooTutorSync },
  { key: "shortlists", label: "Shortlists", from: "Panel 2 Shortlist button and the n8n matching workflow", read: shortlists },
  { key: "invites", label: "Invitations to tutors", from: "Panel 2 Invite button, sent through Odoo", read: invitations },
  { key: "replies", label: "WhatsApp replies", from: "Saved by n8n, tutor replies read by this server", read: whatsappReplies },
  { key: "top3", label: "Top 3 sent to parents", from: "Panel 2 Top 3 button", read: topThree },
  { key: "choices", label: "Parent's choice", from: "Parent taps Tutor 1, 2 or 3, saved by n8n", read: parentChoices },
  { key: "reconfirm", label: "Parent reconfirmations", from: "Panel 2 Reconfirm button", read: reconfirmations },
];

/**
 * Every source, checked side by side. A source that fails to answer is
 * reported as such and never stops the others.
 */
export async function buildDataHealth(db, { hours = 24, now = new Date(), env = process.env } = {}) {
  const h = Math.min(Math.max(Math.round(Number(hours) || 24), 1), MAX_HOURS);
  const since = new Date(now.getTime() - h * 3600 * 1000);

  const started = Date.now();
  let pingMs = null;
  try {
    await db.command({ ping: 1 }, { maxTimeMS: QUERY_MS });
    pingMs = Date.now() - started;
  } catch {
    pingMs = null;
  }

  const sources = await Promise.all(SOURCES.map(async ({ key, label, from, read }) => {
    try {
      const out = await read(db, { since, now, env });
      const source = { key, label, from, error: "", ...out };
      return { ...source, status: sourceStatus(source) };
    } catch (err) {
      const timedOut = /time limit|MaxTimeMSExpired|operation exceeded/i.test(err?.message || "");
      return {
        key, label, from, count: null, lastAt: null, facts: [], checks: [], status: "unknown",
        error: timedOut ? "The database took too long to answer. Try a shorter period." : (err?.message || "Could not check"),
      };
    }
  }));

  const summary = { bad: 0, warn: 0, ok: 0, quiet: 0, unknown: 0 };
  for (const s of sources) summary[s.status] += 1;

  return {
    generatedAt: now.toISOString(),
    hours: h,
    since: since.toISOString(),
    database: { connected: pingMs != null, pingMs, name: db.databaseName || "" },
    summary,
    sources,
  };
}
