/**
 * missing_codes_report.js — READ-ONLY: tutors with no tutor code, and why.
 *
 * Changes nothing, in MongoDB or in Odoo. For every registered tutor whose
 * tutorCode is empty it shows what registration saved about Odoo (sync status,
 * error, linked Odoo record) and what Odoo has for their mobile number now:
 *   - Odoo has their record WITH a code   → MongoDB only missed copying it
 *   - Odoo has their record WITHOUT a code → the Odoo record needs a code
 *   - Odoo has no record for the number   → Odoo failed at registration
 * Partial-form tutors without a code are counted too.
 *
 * Run it from the backend folder, where your .env is:
 *     cd backend
 *     node scratch/missing_codes_report.js
 * It also writes backend/reports/missing-codes-<date>.csv (git ignores that folder).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config(); // backend/.env, when run from the backend folder

const clean = (v) => String(v || "").trim().replace(/^['"]|['"]$/g, "");
const last10 = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length >= 10 ? d.slice(-10) : ""; };
const day = (v) => (v ? new Date(v).toISOString().slice(0, 10) : "");

// ── Odoo, read-only: only "authenticate" and "search_read" can be sent ─────────
const ODOO_URL = clean(process.env.ODOO_COMMUNITY_URL || process.env.ODOO_URL);
const JSONRPC = clean(process.env.ODOO_JSONRPC_URL) || (ODOO_URL ? `${ODOO_URL}/jsonrpc` : "");
const ODOO_DB = clean(process.env.ODOO_DB);
const ODOO_USER = clean(process.env.ODOO_USERNAME);
const ODOO_PASS = clean(process.env.ODOO_PASSWORD);

async function rpc(service, method, args) {
  const allowed = (service === "common" && method === "authenticate") ||
    (service === "object" && method === "execute_kw" && args[4] === "search_read");
  if (!allowed) throw new Error(`Refusing to send ${service}.${method} ${args[4] || ""}: this report only reads`);
  const res = await fetch(JSONRPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: { service, method, args }, id: Date.now() }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.data?.message || data.error.message || "Odoo error");
  return data.result;
}

let uid = null;
async function odooRead(model, domain, fields) {
  if (!uid) {
    uid = await rpc("common", "authenticate", [ODOO_DB, ODOO_USER, ODOO_PASS, {}]);
    if (!uid) throw new Error("Odoo login failed: check ODOO_USERNAME / ODOO_PASSWORD in .env");
  }
  return rpc("object", "execute_kw", [ODOO_DB, uid, ODOO_PASS, model, "search_read", [domain],
    { fields, limit: 20, context: { active_test: false } }]);
}

// "", null, missing, or a leftover word like "false" all mean no code
const NO_CODE = { $or: [
  { tutorCode: { $exists: false } }, { tutorCode: null }, { tutorCode: { $regex: "^\\s*$" } },
  { tutorCode: { $in: ["false", "null", "undefined", "False"] } },
] };

/** One row per tutor without a code, with the reason. */
export async function buildMissingReport({ db, readOdoo }) {
  const tutors = await db.collection("tutors").find(NO_CODE, {
    projection: { name: 1, phone: 1, whatsapp: 1, status: 1, createdAt: 1, odooSyncStatus: 1, odooSyncError: 1, odooLeadId: 1, tutorCode: 1 },
  }).sort({ createdAt: 1 }).toArray();

  const rows = [];
  for (const t of tutors) {
    const numbers = [...new Set([last10(t.phone), last10(t.whatsapp)].filter(Boolean))];
    let odoo = [];
    let odooError = "";
    if (numbers.length) {
      const domain = numbers.length === 1
        ? ["|", ["mobile", "ilike", numbers[0]], ["whatsapp", "ilike", numbers[0]]]
        : ["|", "|", "|", ["mobile", "ilike", numbers[0]], ["whatsapp", "ilike", numbers[0]], ["mobile", "ilike", numbers[1]], ["whatsapp", "ilike", numbers[1]]];
      try {
        odoo = await readOdoo("master_tutors", domain, ["id", "tutor_id", "name", "mobile", "create_date"]);
      } catch (err) {
        odooError = err.message;
      }
    }
    // the record registration linked, else the oldest one for the number
    const linked = odoo.find((o) => o.id === t.odooLeadId);
    const rec = linked || odoo.sort((a, b) => String(a.create_date).localeCompare(String(b.create_date)))[0];
    const odooCode = rec && rec.tutor_id ? String(rec.tutor_id).trim() : "";

    let reason;
    let fix;
    let kind;
    if (odooError) { kind = "error"; reason = `could not check Odoo: ${odooError}`; fix = "run again"; }
    else if (!numbers.length) { kind = "bad-phone"; reason = "no valid mobile number saved"; fix = "fix the phone number by hand first"; }
    else if (rec && odooCode) { kind = "copy"; reason = `Odoo has their record with ${odooCode}; MongoDB never got it`; fix = `copy ${odooCode} into MongoDB`; }
    else if (rec) { kind = "odoo-no-code"; reason = `Odoo has their record (#${rec.id}) but its Tutor ID is empty`; fix = "give the Odoo record a new code, then copy it to MongoDB"; }
    else { kind = "create"; reason = "no Odoo record for this number: Odoo failed when they registered"; fix = "create their Odoo record (gets a new code)"; }

    rows.push({
      name: t.name || "", phone: t.phone || "", status: t.status || "", registered_on: day(t.createdAt),
      saved_sync_status: t.odooSyncStatus || "", saved_sync_error: t.odooSyncError || "",
      saved_odoo_id: t.odooLeadId ?? "", odoo_records_for_number: odoo.length,
      odoo_record_id: rec?.id ?? "", odoo_code: odooCode, odoo_name: rec?.name || "",
      reason, fix, kind, mongo_id: String(t._id),
    });
  }

  const partialsWithoutCode = await db.collection("partialtutors").countDocuments(NO_CODE);
  return { rows, partialsWithoutCode };
}

const COLUMNS = ["name", "phone", "status", "registered_on", "saved_sync_status", "saved_sync_error", "saved_odoo_id",
  "odoo_records_for_number", "odoo_record_id", "odoo_code", "odoo_name", "reason", "fix", "mongo_id"];
const csvCell = (v) => { const s = String(v ?? ""); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

async function main() {
  const uri = clean(process.env.MONGO_URI);
  if (!uri) { console.error("MONGO_URI is not set. Run this from the backend folder: cd backend; node scratch/missing_codes_report.js"); process.exit(1); }
  if (!JSONRPC || !ODOO_DB) { console.error("Odoo settings are missing from .env."); process.exit(1); }

  // autoIndex off and no models loaded: connecting builds nothing in your database
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
  try {
    const { rows, partialsWithoutCode } = await buildMissingReport({ db: mongoose.connection.db, readOdoo: odooRead });
    if (!rows.length) console.log("Every registered tutor has a tutor code.");
    for (const r of rows) {
      console.log(`${r.name || "(no name)"}  ${r.phone}  [${r.status}, registered ${r.registered_on}]`);
      console.log(`   saved at registration: sync ${r.saved_sync_status || "(none)"}${r.saved_sync_error ? ` — "${r.saved_sync_error}"` : ""}`);
      console.log(`   why: ${r.reason}`);
      console.log(`   fix: ${r.fix}`);
    }
    const tally = rows.reduce((m, r) => ((m[r.fix.split(" (")[0].split(":")[0]] = (m[r.fix.split(" (")[0].split(":")[0]] || 0) + 1), m), {});
    console.log(`\n${rows.length} registered tutor(s) without a code.`);
    for (const [fix, n] of Object.entries(tally)) console.log(`   ${n} × ${fix}`);
    console.log(`${partialsWithoutCode} partial-form tutor(s) without a code (they get one automatically at their next login or the server's next start, when Odoo can be read).`);

    if (rows.length) {
      const dir = path.join(process.cwd(), "reports");
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `missing-codes-${new Date().toISOString().slice(0, 10)}.csv`);
      fs.writeFileSync(file, [COLUMNS.join(","), ...rows.map((r) => COLUMNS.map((c) => csvCell(r[c])).join(","))].join("\n"));
      console.log(`\nSpreadsheet: ${file}`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error("Report failed:", err.message); process.exit(1); });
}
