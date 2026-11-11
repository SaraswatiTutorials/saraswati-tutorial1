/**
 * tutor_code_report.js — READ-ONLY report of tutors who share a tutor code.
 *
 * Changes nothing, in MongoDB or in Odoo. It only reads:
 *   - MongoDB `tutors`: every record whose tutorCode is used more than once
 *   - Odoo `master_tutors`: the records holding those codes, and the record for
 *     each tutor's own mobile number (created when they registered, so it has
 *     their real name and details, and is never overwritten by the sync)
 *
 * It writes a spreadsheet (CSV) to backend/reports/, a folder git ignores,
 * because the report has tutors' names and numbers in it.
 *
 * Run it from the backend folder, where your .env is:
 *     cd backend
 *     node scratch/tutor_code_report.js
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config(); // backend/.env, when run from the backend folder

const clean = (v) => String(v || "").trim().replace(/^['"]|['"]$/g, "");
const last10 = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length >= 10 ? d.slice(-10) : ""; };
const norm = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
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
  return rpc("object", "execute_kw", [ODOO_DB, uid, ODOO_PASS, model, "search_read", [domain], { fields, limit: 200 }]);
}

const ODOO_FIELDS = ["id", "tutor_id", "name", "mobile", "whatsapp", "email", "create_date"];

// ── Spreadsheet ─────────────────────────────────────────────────────────────────
const COLUMNS = [
  "code", "copies", "suggested_action", "flags",
  "mongo_name", "real_name_in_odoo", "phone", "whatsapp", "mongo_email", "odoo_email",
  "status", "registered_on", "occupation", "odoo_code_for_this_number", "odoo_created_on",
  "photo", "id_proof", "mongo_id",
];
const csvCell = (v) => { const s = String(v ?? ""); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export async function buildReport({ db, readOdoo }) {
  const tutors = db.collection("tutors");

  // 1. Codes used by more than one tutor record
  const groups = await tutors.aggregate([
    { $match: { tutorCode: { $type: "string", $ne: "" } } },
    { $group: { _id: { $toUpper: { $trim: { input: "$tutorCode" } } }, ids: { $push: "$_id" }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { _id: 1 } },
  ]).toArray();
  const allCodes = new Set((await tutors.distinct("tutorCode")).map((c) => String(c || "").trim().toUpperCase()));

  const rows = [];
  const summary = [];
  for (const g of groups) {
    const code = g._id;
    const records = await tutors.find({ _id: { $in: g.ids } }, {
      projection: { name: 1, phone: 1, whatsapp: 1, email: 1, status: 1, createdAt: 1, occupation: 1, photo: 1, "documents.idProof": 1 },
    }).sort({ createdAt: 1 }).toArray();

    // 2. Odoo: who holds this code, and each person's own record by mobile number
    let holders = [];
    try { holders = await readOdoo("master_tutors", [["tutor_id", "=", code]], ODOO_FIELDS); } catch (e) { holders = null; }

    const enriched = [];
    for (const t of records) {
      const nums = [...new Set([last10(t.phone), last10(t.whatsapp)].filter(Boolean))];
      let own = [];
      for (const n of nums) {
        try {
          const found = await readOdoo("master_tutors", [["mobile", "ilike", n]], ODOO_FIELDS);
          own.push(...found.filter((o) => last10(o.mobile) === n));
        } catch { own = null; break; }
      }
      if (own) own = [...new Map(own.map((o) => [o.id, o])).values()];
      enriched.push({ t, own });
    }

    // 3. Who keeps the code: whoever had it first (the oldest real record). The
    // later holders got it because Odoo numbered new tutors "count + 1" after
    // deletions, so each of them needs a code of their own.
    // A test entry is judged by who the record really is: its own Odoo record's
    // name when there is one. An older record now SHOWING a test name because a
    // newer test registration's details were copied onto it is a real tutor.
    const shownNameLater = (i) => enriched.slice(i + 1).some((e) => norm(e.t.name) && norm(e.t.name) === norm(enriched[i].t.name));
    const isTest = (e, i) => {
      const real = e.own?.[0]?.name;
      if (real) return /test/i.test(real);
      return /test/i.test(e.t.name || "") && !shownNameLater(i);
    };
    // Who keeps the code: the person Odoo holds it for (their own Odoo record,
    // found by their number, has this code), so Odoo doesn't change for them.
    // If nobody here is in Odoo with it, the oldest real record keeps it.
    const holdsInOdoo = enriched
      .map((e, i) => ({ e, i, made: e.own?.find((o) => String(o.tutor_id || "").toUpperCase() === code)?.create_date }))
      .filter((x) => x.made && !isTest(x.e, x.i))
      .sort((a, b) => String(a.made).localeCompare(String(b.made)));
    const keeper = (holdsInOdoo[0]?.e || enriched.find((e, i) => !isTest(e, i)))?.t._id; // records are oldest first

    for (const [i, { t, own }] of enriched.entries()) {
      const flags = [];
      const odoo = own?.[0];
      if (own === null) flags.push("ODOO_NOT_READ");
      else if (!own.length) flags.push("NO_ODOO_RECORD_FOR_NUMBER");
      else if (own.length > 1) flags.push(`${own.length}_ODOO_RECORDS_FOR_NUMBER`);
      if (odoo && norm(odoo.name) !== norm(t.name)) flags.push("NAME_OVERWRITTEN");
      if (odoo && odoo.email && norm(odoo.email) !== norm(t.email)) flags.push("EMAIL_DIFFERS");
      // The old sync copied a newcomer's Odoo details onto the OLDEST record with
      // the code. So an older record with the same name as a newer one in the
      // group carries someone else's name; its phone, photo and ID proof are its own.
      // (Unless their own Odoo record, found by their number, confirms the name.)
      const myNums = [last10(t.phone), last10(t.whatsapp)].filter(Boolean);
      const sameNumberEarlier = enriched.slice(0, i).find((e) => myNums.includes(last10(e.t.phone)));
      const sameNameLater = !sameNumberEarlier && (!odoo || norm(odoo.name) !== norm(t.name))
        ? enriched.slice(i + 1).find((e) => norm(e.t.name) && norm(e.t.name) === norm(t.name) && !myNums.includes(last10(e.t.phone)))
        : null;
      if (sameNameLater) flags.push("LIKELY_OVERWRITTEN_BY_NEWER_RECORD");
      if (sameNumberEarlier) flags.push("SAME_NUMBER_AS_OLDER_RECORD");
      if (isTest({ t, own }, i)) flags.push("TEST_RECORD");
      const overwritten = flags.includes("NAME_OVERWRITTEN") || flags.includes("LIKELY_OVERWRITTEN_BY_NEWER_RECORD");
      const isKeeper = String(t._id) === String(keeper);

      const odooCode = String(odoo?.tutor_id || "").toUpperCase();
      let action;
      if (flags.includes("TEST_RECORD")) action = "TEST: probably delete";
      else if (sameNumberEarlier) action = "SAME PERSON TWICE (same number as an older record): delete this copy";
      else if (sameNameLater && !odoo) action = `${isKeeper ? "KEEPS CODE, but " : "NEEDS A NEW CODE, and "}CHECK BY HAND: name and email belong to the newer ${sameNameLater.t.phone}; find who this really is from the ID proof or by calling this number`;
      else if (!odoo) action = `${isKeeper ? "KEEP CODE" : "NEEDS A NEW CODE"} (no Odoo record for this number: CHECK BY HAND)`;
      else if (isKeeper) action = overwritten ? "KEEP CODE, restore details from Odoo" : "KEEP CODE";
      else if (odooCode && odooCode !== code && !allCodes.has(odooCode)) action = `SET CODE TO ${odooCode} (their own Odoo code)${overwritten ? ", restore details" : ""}`;
      else action = `NEEDS A NEW CODE${overwritten ? ", restore details from Odoo" : ""}`;

      rows.push({
        code, copies: records.length, suggested_action: action, flags: flags.join(" "),
        mongo_name: t.name, real_name_in_odoo: odoo?.name || "", phone: t.phone, whatsapp: t.whatsapp,
        mongo_email: t.email, odoo_email: odoo?.email || "", status: t.status, registered_on: day(t.createdAt),
        occupation: t.occupation, odoo_code_for_this_number: odoo?.tutor_id || "", odoo_created_on: day(odoo?.create_date),
        photo: t.photo, id_proof: t.documents?.idProof || "", mongo_id: String(t._id),
      });
    }
    summary.push({ code, mongo: records.length, odoo: holders === null ? "?" : holders.length });
  }
  return { rows, summary };
}

async function main() {
  const uri = clean(process.env.MONGO_URI);
  if (!uri) { console.error("MONGO_URI is not set. Run this from the backend folder: cd backend; node scratch/tutor_code_report.js"); process.exit(1); }
  if (!JSONRPC || !ODOO_DB) console.warn("Odoo settings missing: the report will have no Odoo columns.");

  // autoIndex off and no models loaded: connecting builds nothing in your database
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
  try {
    const { rows, summary } = await buildReport({
      db: mongoose.connection.db,
      readOdoo: JSONRPC && ODOO_DB ? odooRead : async () => { throw new Error("no Odoo settings"); },
    });
    const dir = path.join(process.cwd(), "reports");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `tutor-code-report-${new Date().toISOString().slice(0, 10)}.csv`);
    const csv = [COLUMNS.join(","), ...rows.map((r) => COLUMNS.map((c) => csvCell(r[c])).join(","))].join("\r\n");
    fs.writeFileSync(file, "﻿" + csv, "utf8"); // BOM so Excel shows names correctly

    console.log(`\nShared tutor codes: ${summary.length}   (records involved: ${rows.length})`);
    console.table(summary.map((s) => ({ code: s.code, "records in MongoDB": s.mongo, "records in Odoo": s.odoo })));
    const count = (re) => rows.filter((r) => re.test(r.suggested_action)).length;
    console.log(`Keep code: ${count(/^KEEP/)} · New code needed: ${count(/^NEEDS/)} · Own Odoo code: ${count(/^SET CODE/)} · Same person twice: ${count(/^SAME PERSON/)} · Test records: ${count(/^TEST/)} · Need checking by hand: ${count(/CHECK BY HAND/)}`);
    console.log(`Records whose name was overwritten by the old sync: ${rows.filter((r) => /OVERWRITTEN/.test(r.flags)).length}`);
    console.log(`\nReport saved (nothing was changed): ${file}\n`);
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error("Report failed:", err.message); process.exit(1); });
}
