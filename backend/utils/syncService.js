/**
 * syncService.js — Saraswati Tutorials
 *
 * Bidirectional sync between Odoo and MongoDB Tutor collection.
 *
 * Two sync sources:
 *   1. x_master_tutors  — legacy source, simpler field names (x_tutor_id, x_mobile, …)
 *   2. x_tutor          — confirmed active model used by Matching Tutors window action
 *                         uses x_studio_* field names (confirmed by live record inspection)
 *
 * Architecture Decision: Odoo is Master for tutor PROFILE fields.
 *                        MongoDB is Master for BROADCAST / OPERATIONAL fields.
 *
 * Conflict Resolution:
 *   - Profile fields (name, area, city, subjects, grades, timings, pincode, phone, tutorCode):
 *       Odoo always wins — synced from Odoo to MongoDB every TUTOR_SYNC_INTERVAL_MIN minutes
 *   - Operational fields (onboardingCompleted, onboardingMessageSentAt, availabilityStatus,
 *       broadcast history):
 *       MongoDB always wins — NEVER overwritten by Odoo sync
 *
 * Key field mapping (x_tutor → MongoDB):
 *   x_studio_tutor_id_4      → tutorCode   ← CONFIRMED correct by live Odoo record #5
 *   x_studio_full_name_1     → name
 *   x_studio_mobile_number_3 → phone       ← CONFIRMED correct by live Odoo record #5
 *   x_studio_whatsapp_number_2 → whatsapp  ← CONFIRMED correct by live Odoo record #5
 *   x_studio_email_address_2 → email
 *   x_studio_city_3          → city
 *   x_studio_area_3          → area
 *   x_studio_pincode_3       → pincode
 *   x_studio_full_address    → fullAddress
 *   x_studio_qualification_2 → qualification
 *   x_studio_experience_2    → experience
 *   x_studio_grade_can_teach → grades (comma-separated)
 *   x_studio_board_can_teach → boards (comma-separated)
 *   x_studio_subject_2       → subjects (comma-separated)
 *   x_studio_perferred_timings → timings (comma-separated)
 */

import dotenv from "dotenv";
dotenv.config();

import Tutor from "../models/Tutor.js";
import SyncState from "../models/SyncState.js";
import { callOdooMethod, getOdooUid } from "./whatsappService.js";
import { matchOdooTutor } from "./odooTutorMatch.js";

// How the syncs look tutors up: see utils/odooTutorMatch.js
const matchDeps = {
  findTutors: (query) => Tutor.find(query, { phone: 1, whatsapp: 1 }).lean(),
  countOdooCode: async (code) => {
    const uid = await getOdooUid();
    return callOdooMethod(uid, "master_tutors", "search_count", [[["tutor_id", "=", code]]]);
  },
};

const SYNC_INTERVAL_MIN = Number(process.env.TUTOR_SYNC_INTERVAL_MIN || 15);
const SYNC_KEY      = "odoo_tutor_sync";
const SYNC_KEY_XTUTOR = "odoo_x_tutor_sync";

/**
 * The x_tutor sync is off unless ODOO_X_TUTOR_SYNC=true. The live Odoo has no
 * x_tutor model ("Object x_tutor doesn't exist"), so every run failed; tutors
 * still come across from master_tutors.
 */
export function xTutorSyncEnabled(env = process.env) {
  return String(env.ODOO_X_TUTOR_SYNC || "").trim().toLowerCase() === "true";
}

/**
 * Parse a comma-separated string into an array of trimmed strings.
 */
function parseCommaSeparated(str) {
  if (!str) return [];
  return String(str)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Fetch all Odoo x_master_tutors records changed since a given timestamp.
 *
 * @param {Date|null} since - Fetch records with write_date > since (null = fetch all)
 * @returns {Promise<Array>}
 */
async function fetchOdooTutorsSince(since) {
  try {
    const uid = await getOdooUid();

    const domain = [];
    if (since) {
      // Odoo datetime format: "YYYY-MM-DD HH:MM:SS"
      const sinceStr = since.toISOString().replace("T", " ").substring(0, 19);
      domain.push(["write_date", ">", sinceStr]);
    }

    const records = await callOdooMethod(
      uid,
      "master_tutors",
      "search_read",
      [domain],
      {
        fields: [
          "id",
          "tutor_id",
          "name",
          "gender",
          "mobile",
          "whatsapp",
          "email",
          "city",
          "area",
          "full_address",
          "pincode",
          "grades",
          "boards",
          "subjects",
          "preferred_timings",
          "max_travel_distance",
          "experience",
          "qualification",
          "availability",
          "locations_can_teach",
          "write_date",
        ],
        limit: 500, // process max 500 per sync cycle
      }
    );

    return records || [];
  } catch (err) {
    console.error("[SyncService] Failed to fetch Odoo tutors:", err.message);
    return [];
  }
}

/**
 * Sync changed Odoo tutor records into MongoDB.
 * Only PROFILE fields are updated — operational/broadcast fields are never touched.
 *
 * @returns {Promise<{synced: number, errors: number}>}
 */
export async function syncOdooTutorsToMongo() {
  // ── Load last sync state ──────────────────────────────────────────────────
  let state = await SyncState.findOne({ key: SYNC_KEY });
  const since = state?.lastSyncAt || null;

  // ── Mark sync as running ──────────────────────────────────────────────────
  await SyncState.findOneAndUpdate(
    { key: SYNC_KEY },
    { status: "running" },
    { upsert: true }
  );

  let synced = 0;
  let errors = 0;
  let skippedUnsafe = 0;

  try {
    const odooTutors = await fetchOdooTutorsSince(since);
    console.log(
      `[SyncService] Fetched ${odooTutors.length} Odoo tutors changed since ` +
      `${since ? since.toISOString() : "beginning"}`
    );

    for (const ot of odooTutors) {
      try {
        if (!ot.tutor_id && !ot.mobile) {
          continue; // Can't match without tutor code or mobile
        }

        // ── Build profile-only update payload ──────────────────────────────
        // NEVER include: onboardingCompleted, onboardingMessageSentAt,
        //                availabilityStatus, broadcastHistory
        const profileUpdate = {
          name:              ot.name || undefined,
          gender:            ot.gender || undefined,
          email:             ot.email || undefined,
          city:              ot.city || undefined,
          area:              ot.area || undefined,
          fullAddress:       ot.full_address || undefined,
          pincode:           ot.pincode || undefined,
          experience:        ot.experience || undefined,
          qualification:     ot.qualification || undefined,
          maxTravelDistance: ot.max_travel_distance || undefined,
        };

        // Array fields — only update if Odoo has data
        if (ot.grades) {
          profileUpdate.grades = parseCommaSeparated(ot.grades);
        }
        if (ot.boards) {
          profileUpdate.boards = parseCommaSeparated(ot.boards);
        }
        if (ot.subjects) {
          profileUpdate.subjects = parseCommaSeparated(ot.subjects);
        }
        if (ot.preferred_timings) {
          profileUpdate.timings = parseCommaSeparated(ot.preferred_timings);
        }
        if (ot.locations_can_teach) {
          profileUpdate.locations = parseCommaSeparated(ot.locations_can_teach);
        }

        // Remove undefined keys
        Object.keys(profileUpdate).forEach(
          (k) => profileUpdate[k] === undefined && delete profileUpdate[k]
        );

        // ── Which MongoDB tutor this is: the code and the number must agree ─
        const target = await matchOdooTutor(ot, matchDeps);
        if (target.skip) {
          skippedUnsafe++;
          console.warn(`[SyncService] Skipped Odoo tutor ${ot.tutor_id || ot.mobile}: ${target.skip}`);
          continue;
        }

        // Only update existing — never create from Odoo sync alone
        const result = target.id
          ? await Tutor.findByIdAndUpdate(target.id, { $set: profileUpdate }, { new: false })
          : null;

        if (result) {
          synced++;
        } else {
          console.warn(
            `[SyncService] Tutor not found in MongoDB for Odoo record: ` +
            `tutorCode=${ot.tutor_id}, mobile=${ot.mobile}`
          );
        }
      } catch (tutorErr) {
        console.error(
          `[SyncService] Error syncing Odoo tutor ${ot.tutor_id}: ${tutorErr.message}`
        );
        errors++;
      }
    }

    // ── Update sync state ─────────────────────────────────────────────────
    await SyncState.findOneAndUpdate(
      { key: SYNC_KEY },
      {
        lastSyncAt: new Date(),
        lastSyncCount: synced,
        lastError: errors > 0 ? `${errors} tutor(s) failed to sync` : "",
        status: "idle",
      },
      { upsert: true }
    );

    console.log(
      `[SyncService] ✅ Sync complete: ${synced} updated, ${errors} errors` +
      (skippedUnsafe ? `, ${skippedUnsafe} skipped (shared code or number mismatch)` : "")
    );
    return { synced, errors, skippedUnsafe };

  } catch (err) {
    console.error("[SyncService] Critical sync error:", err.message);
    await SyncState.findOneAndUpdate(
      { key: SYNC_KEY },
      { lastError: err.message, status: "error" },
      { upsert: true }
    );
    return { synced, errors: errors + 1 };
  }
}

/**
 * Get the current sync state for monitoring.
 * @returns {Promise<Object|null>}
 */
export async function getSyncState() {
  try {
    return await SyncState.findOne({ key: SYNC_KEY });
  } catch {
    return null;
  }
}

// =============================================================================
// x_tutor SYNC  (confirmed active model — used by Matching Tutors window)
// =============================================================================

/**
 * Fetch all records from Odoo x_tutor changed since a given timestamp.
 * Uses the confirmed correct x_studio_* field names.
 *
 * @param {Date|null} since
 * @returns {Promise<Array>}
 */
async function fetchXTutorsSince(since) {
  try {
    const uid = await getOdooUid();
    const domain = [];
    if (since) {
      const sinceStr = since.toISOString().replace("T", " ").substring(0, 19);
      domain.push(["write_date", ">", sinceStr]);
    }

    const records = await callOdooMethod(
      uid,
      "x_tutor",
      "search_read",
      [domain],
      {
        fields: [
          "id",
          // ── Identity (confirmed by live inspection of Odoo record #5) ──────
          "x_studio_tutor_id_4",    // tutorCode  e.g. "TUT-001"
          "x_studio_full_name_1",   // name
          // ── Contact ───────────────────────────────────────────────────────
          "x_studio_mobile_number_3",   // phone
          "x_studio_whatsapp_number_2", // whatsapp
          "x_studio_email_address_2",   // email
          // ── Location ──────────────────────────────────────────────────────
          "x_studio_city_3",        // city
          "x_studio_area_3",        // area
          "x_studio_pincode_3",     // pincode
          "x_studio_full_address",  // fullAddress
          // ── Profile ───────────────────────────────────────────────────────
          "x_studio_qualification_2",    // qualification
          "x_studio_experience_2",       // experience
          "x_studio_grade_can_teach",    // grades (comma-separated)
          "x_studio_board_can_teach",    // boards (comma-separated)
          "x_studio_subject_2",          // subjects (comma-separated)
          "x_studio_perferred_timings",  // timings (comma-separated)
          "x_studio_max_travel_distance",// maxTravelDistance
          // ── Status ────────────────────────────────────────────────────────
          "x_studio_availability_status", // availabilityStatus (selection)
          "write_date",
        ],
        limit: 500,
      }
    );
    return records || [];
  } catch (err) {
    console.error("[SyncService/x_tutor] Failed to fetch records:", err.message);
    return [];
  }
}

/**
 * Sync changed x_tutor records into MongoDB.
 *
 * Match strategy (in order):
 *   1. By tutorCode  (x_studio_tutor_id_4)  — most reliable
 *   2. By phone      (x_studio_mobile_number_3) — fallback
 *   3. By whatsapp   (x_studio_whatsapp_number_2) — second fallback
 *
 * Behaviour:
 *   - If a matching MongoDB Tutor exists → update profile + tutorCode/phone/whatsapp.
 *   - tutorCode is treated as a profile field here (it comes FROM Odoo, Odoo is master).
 *   - Operational fields (onboardingCompleted, availabilityStatus, etc.) are NEVER touched.
 *
 * @param {boolean} [fullResync=false] - If true, ignore lastSyncAt and fetch all records.
 * @returns {Promise<{synced: number, skipped: number, errors: number}>}
 */
export async function syncXTutorToMongo(fullResync = false) {
  let state = await SyncState.findOne({ key: SYNC_KEY_XTUTOR });
  const since = fullResync ? null : (state?.lastSyncAt || null);

  await SyncState.findOneAndUpdate(
    { key: SYNC_KEY_XTUTOR },
    { status: "running" },
    { upsert: true }
  );

  let synced  = 0;
  let skipped = 0;
  let errors  = 0;

  try {
    const odooTutors = await fetchXTutorsSince(since);
    console.log(
      `[SyncService/x_tutor] Fetched ${odooTutors.length} record(s) ` +
      `changed since ${since ? since.toISOString() : "beginning"}`
    );

    for (const ot of odooTutors) {
      try {
        const tutorCode = (ot.x_studio_tutor_id_4 || "").trim();
        const phone     = (ot.x_studio_mobile_number_3 || "").trim().replace(/\D/g, "").slice(-10);
        const whatsapp  = (ot.x_studio_whatsapp_number_2 || "").trim().replace(/\D/g, "").slice(-10);
        const name      = (ot.x_studio_full_name_1 || "").trim();

        if (!tutorCode && !phone && !whatsapp) {
          skipped++;
          continue; // nothing safe to match on (a name alone is not enough)
        }

        // ── Which MongoDB tutor this is: the code and the number must agree ─
        // Matching by name, or copying the code and numbers across, is how one
        // person's details ended up on another's record; neither is done now.
        const target = await matchOdooTutor({ tutor_id: tutorCode, mobile: phone, whatsapp }, { findTutors: matchDeps.findTutors });
        if (target.skip || !target.id) {
          skipped++;
          if (target.skip) console.warn(`[SyncService/x_tutor] Skipped id=${ot.id}: ${target.skip}`);
          continue;
        }

        // ── Build profile update payload ─────────────────────────────────────
        // Never the tutor code, phone or WhatsApp number: those say who it is.
        const profileUpdate = {};
        if (name)       profileUpdate.name       = name;

        const email       = (ot.x_studio_email_address_2   || "").trim();
        const city        = (ot.x_studio_city_3            || "").trim();
        const area        = (ot.x_studio_area_3            || "").trim();
        const pincode     = (ot.x_studio_pincode_3         || "").trim();
        const fullAddress = (ot.x_studio_full_address      || "").trim();
        const qual        = (ot.x_studio_qualification_2   || "").trim();
        const exp         = (ot.x_studio_experience_2      || "").trim();
        const maxTravel   = (ot.x_studio_max_travel_distance || "").trim();

        if (email)       profileUpdate.email            = email;
        if (city)        profileUpdate.city             = city;
        if (area)        profileUpdate.area             = area;
        if (pincode)     profileUpdate.pincode          = pincode;
        if (fullAddress) profileUpdate.fullAddress      = fullAddress;
        if (qual)        profileUpdate.qualification    = qual;
        if (exp)         profileUpdate.experience       = exp;
        if (maxTravel)   profileUpdate.maxTravelDistance = maxTravel;

        if (ot.x_studio_grade_can_teach)   profileUpdate.grades   = parseCommaSeparated(ot.x_studio_grade_can_teach);
        if (ot.x_studio_board_can_teach)   profileUpdate.boards   = parseCommaSeparated(ot.x_studio_board_can_teach);
        if (ot.x_studio_subject_2)         profileUpdate.subjects = parseCommaSeparated(ot.x_studio_subject_2);
        if (ot.x_studio_perferred_timings) profileUpdate.timings  = parseCommaSeparated(ot.x_studio_perferred_timings);

        // NEVER touch: onboardingCompleted, onboardingMessageSentAt,
        //              availabilityStatus, status, broadcastHistory

        const result = await Tutor.findByIdAndUpdate(target.id, { $set: profileUpdate }, { new: false });

        if (result) {
          synced++;
          console.log(
            `[SyncService/x_tutor] ✅ Updated: ${name || tutorCode || phone} ` +
            `(tutorCode: ${tutorCode || "(none)"})`
          );
        } else {
          skipped++;
          console.warn(
            `[SyncService/x_tutor] ⚠️  No MongoDB match for Odoo x_tutor record ` +
            `id=${ot.id} name="${name}" tutorCode="${tutorCode}" phone="${phone}"`
          );
        }
      } catch (tutorErr) {
        errors++;
        console.error(`[SyncService/x_tutor] ❌ Error for record id=${ot.id}:`, tutorErr.message);
      }
    }

    await SyncState.findOneAndUpdate(
      { key: SYNC_KEY_XTUTOR },
      {
        lastSyncAt:    new Date(),
        lastSyncCount: synced,
        lastError:     errors > 0 ? `${errors} record(s) failed` : "",
        status:        "idle",
      },
      { upsert: true }
    );

    console.log(
      `[SyncService/x_tutor] ✅ Sync complete: ${synced} updated, ` +
      `${skipped} skipped (no MongoDB match), ${errors} errors`
    );
    return { synced, skipped, errors };

  } catch (err) {
    console.error("[SyncService/x_tutor] Critical sync error:", err.message);
    await SyncState.findOneAndUpdate(
      { key: SYNC_KEY_XTUTOR },
      { lastError: err.message, status: "error" },
      { upsert: true }
    );
    return { synced, skipped, errors: errors + 1 };
  }
}

/**
 * Start the periodic Odoo → MongoDB sync scheduler.
 * Runs every TUTOR_SYNC_INTERVAL_MIN minutes.
 * Runs BOTH x_master_tutors sync AND x_tutor sync.
 */
export function startSyncScheduler() {
  const intervalMs = SYNC_INTERVAL_MIN * 60 * 1000;
  console.log(
    `[SyncService] Starting Odoo→MongoDB tutor sync every ${SYNC_INTERVAL_MIN} min ` +
    `(master_tutors${xTutorSyncEnabled() ? " + x_tutor" : "; x_tutor sync is off"})`
  );

  const runBothSyncs = () => Promise.allSettled([
    syncOdooTutorsToMongo().catch(err => console.error("[SyncService] master_tutors sync error:", err.message)),
    // Read on each run, so the setting can change without a redeploy
    xTutorSyncEnabled()
      ? syncXTutorToMongo().catch(err => console.error("[SyncService] x_tutor sync error:", err.message))
      : Promise.resolve(),
  ]);

  // Run immediately on startup to catch any missed changes
  setTimeout(() => { runBothSyncs(); }, 30_000);

  setInterval(() => { runBothSyncs(); }, intervalMs);
}
