/**
 * free_codes.js — READ-ONLY: which tutor codes are free, checked everywhere at once.
 *
 * Changes nothing, in MongoDB or in Odoo. It reads every tutor code in:
 *   - Odoo `master_tutors` (archived records too)
 *   - Odoo `x_tutor` (the older tutor list, if your Odoo has it)
 *   - MongoDB `tutors` and `partialtutors`
 * Codes are compared by number, so TUT-319, tut0319 and TUT0319 count as one.
 *
 * Run it from the backend folder, where your .env is:
 *     cd backend
 *     node scratch/free_codes.js                 the next 10 free codes
 *     node scratch/free_codes.js 25              the next 25 free codes
 *     node scratch/free_codes.js TUT0319 TUT0177 is each of these free? who has it?
 *
 * The suggested codes are all above the highest code in use anywhere, so
 * nobody has ever had them. Use them in order, and save each one in Odoo
 * first: from then on new registrations skip it.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config(); // backend/.env, when run from the backend folder

const clean = (v) => String(v || "").trim().replace(/^['"]|['"]$/g, "");
const formatCode = (n) => `TUT${String(n).padStart(4, "0")}`;
/** The number in a tutor code (TUT-0319, tut319, TUT0319 → 319), or 0 when it is not one. */
export const codeNumber = (v) => {
  const m = /^\s*TUT[\s-]*0*(\d{1,6})\s*$/i.exec(String(v || ""));
  return m ? Number(m[1]) : 0;
};

// ── Odoo, read-only: only "authenticate" and "search_read" can be sent ─────────
const ODOO_URL = clean(process.env.ODOO_COMMUNITY_URL || process.env.ODOO_URL);
const JSONRPC = clean(process.env.ODOO_JSONRPC_URL) || (ODOO_URL ? `${ODOO_URL}/jsonrpc` : "");
const ODOO_DB = clean(process.env.ODOO_DB);
const ODOO_USER = clean(process.env.ODOO_USERNAME);
const ODOO_PASS = clean(process.env.ODOO_PASSWORD);

async function rpc(service, method, args) {
  const allowed = (service === "common" && method === "authenticate") ||
    (service === "object" && method === "execute_kw" && args[4] === "search_read");
  if (!allowed) throw new Error(`Refusing to send ${service}.${method} ${args[4] || ""}: this script only reads`);
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
  // active_test: false → archived records are included, they still hold their code
  return rpc("object", "execute_kw", [ODOO_DB, uid, ODOO_PASS, model, "search_read", [domain],
    { fields, context: { active_test: false } }]);
}

/**
 * Every place a code is held: [{ where, code, name, phone, archived }].
 * `readOdoo(model, domain, fields)` returns Odoo rows; `db` is a MongoDB database.
 */
export async function collectHolders({ db, readOdoo }) {
  const holders = [];

  let master;
  try {
    master = await readOdoo("master_tutors", [["tutor_id", "!=", false]], ["tutor_id", "name", "mobile", "active"]);
  } catch {
    // no archive on this list: there is no "active" field to ask for
    master = await readOdoo("master_tutors", [["tutor_id", "!=", false]], ["tutor_id", "name", "mobile"]);
  }
  for (const r of master || []) {
    holders.push({ where: "Odoo master_tutors", code: r.tutor_id, name: r.name, phone: r.mobile, archived: r.active === false });
  }

  let xTutorRead = true;
  try {
    const legacy = await readOdoo("x_tutor", [["x_studio_tutor_id_4", "!=", false]], ["x_studio_tutor_id_4", "x_name"]);
    for (const r of legacy || []) holders.push({ where: "Odoo x_tutor", code: r.x_studio_tutor_id_4, name: r.x_name, phone: "" });
  } catch {
    xTutorRead = false; // this Odoo has no x_tutor list
  }

  const tutors = await db.collection("tutors")
    .find({ tutorCode: { $type: "string", $ne: "" } }, { projection: { tutorCode: 1, name: 1, phone: 1 } }).toArray();
  for (const t of tutors) holders.push({ where: "MongoDB tutors", code: t.tutorCode, name: t.name, phone: t.phone });

  const partials = await db.collection("partialtutors")
    .find({ tutorCode: { $type: "string", $ne: "" } }, { projection: { tutorCode: 1, name: 1, whatsapp: 1 } }).toArray();
  for (const p of partials) holders.push({ where: "MongoDB partialtutors", code: p.tutorCode, name: p.name, phone: p.whatsapp });

  const counter = await db.collection("counters").findOne({ _id: "tutorCode" });
  return { holders, counterSeq: Number(counter?.seq) || 0, xTutorRead };
}

/** The next `count` codes above everything in use (and above the code counter). */
export function freeCodes({ holders, counterSeq = 0 }, count = 10) {
  const highest = Math.max(counterSeq, ...holders.map((h) => codeNumber(h.code)), 0);
  return { highest, codes: Array.from({ length: count }, (_, i) => formatCode(highest + 1 + i)) };
}

/** Who holds each asked-for code; an empty list means it is free. */
export function checkCodes({ holders }, asked) {
  return asked.map((text) => {
    const n = codeNumber(text);
    return { asked: text, valid: n > 0, code: n ? formatCode(n) : "", heldBy: n ? holders.filter((h) => codeNumber(h.code) === n) : [] };
  });
}

async function main() {
  const uri = clean(process.env.MONGO_URI);
  if (!uri) { console.error("MONGO_URI is not set. Run this from the backend folder: cd backend; node scratch/free_codes.js"); process.exit(1); }
  if (!JSONRPC || !ODOO_DB) { console.error("Odoo settings are missing from .env, so Odoo's codes can't be checked."); process.exit(1); }

  const args = process.argv.slice(2);
  const asked = args.filter((a) => !/^\d+$/.test(a));
  const count = Math.min(Number(args.find((a) => /^\d+$/.test(a))) || 10, 200);

  // autoIndex off and no models loaded: connecting builds nothing in your database
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
  try {
    const data = await collectHolders({ db: mongoose.connection.db, readOdoo: odooRead });
    if (!data.xTutorRead) console.log("(Odoo has no x_tutor list; checked master_tutors only.)");

    if (asked.length) {
      for (const r of checkCodes(data, asked)) {
        if (!r.valid) { console.log(`${r.asked}: not a tutor code`); continue; }
        if (!r.heldBy.length) { console.log(`${r.code}: FREE`); continue; }
        console.log(`${r.code}: TAKEN by`);
        for (const h of r.heldBy) {
          console.log(`   - ${h.where}${h.archived ? " (archived)" : ""}: ${h.name || "(no name)"} ${h.phone || ""}`.trimEnd());
        }
      }
    } else {
      const { highest, codes } = freeCodes(data, count);
      console.log(`Highest code in use anywhere: ${formatCode(highest)}`);
      console.log(`Free codes (nobody has ever had these), use them in order:`);
      console.log(codes.join("\n"));
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error("Check failed:", err.message); process.exit(1); });
}
