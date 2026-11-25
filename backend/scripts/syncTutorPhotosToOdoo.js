/**
 * Copies tutors' profile photos from the website onto their own Odoo
 * Master Tutors record (master_tutors.profile_photo).
 *
 *   node scripts/syncTutorPhotosToOdoo.js            # dry run: lists what it would do
 *   node scripts/syncTutorPhotosToOdoo.js --apply    # writes the photos to Odoo
 *
 * Safety:
 *  - A photo goes only onto a record whose tutor code or phone number matches
 *    that tutor, with nothing on it pointing to someone else (pickOwnMasterTutor).
 *  - An Odoo record that already has a photo is never changed.
 *  - If two different website tutors would land on the same Odoo record, neither
 *    is copied; they are listed for a person to check.
 *  - The match is checked again in Odoo right before each write.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import Tutor from "../models/Tutor.js";
import PartialTutor from "../models/PartialTutor.js";
import { callOdoo, setMasterTutorPhoto, pickOwnMasterTutor } from "../utils/odooService.js";

dotenv.config();

const APPLY = process.argv.includes("--apply");

const clean = (v) => String(v || "").trim().replace(/^['"]|['"]$/g, "");
const DB = clean(process.env.ODOO_DB || "saraswati-tutorial");
const USER = clean(process.env.ODOO_USERNAME || "admin");
const PASS = clean(process.env.ODOO_PASSWORD || "");
const last10 = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length >= 10 ? d.slice(-10) : ""; };

async function main() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

  const uid = await callOdoo("common", "authenticate", [DB, USER, PASS, {}]);
  if (!uid) throw new Error("Odoo login failed");
  const records = await callOdoo("object", "execute_kw", [
    DB, uid, PASS, "master_tutors", "search_read", [[]],
    { fields: ["id", "name", "tutor_id", "mobile", "whatsapp", "profile_photo"], context: { bin_size: true } },
  ]);

  const full = await Tutor.find({ photo: /^https?:\/\// }).select("name tutorCode phone whatsapp photo odooLeadId").lean();
  const partial = await PartialTutor.find({ photo: /^https?:\/\// }).select("name tutorCode whatsapp photo").lean();

  // Website tutor → their own Odoo record, or the reason there is none.
  const claims = new Map(); // odoo id → [{ person, record }]
  const skipped = [];
  for (const t of [...full, ...partial]) {
    const who = { odooId: t.odooLeadId, tutorCode: t.tutorCode, phone: t.whatsapp || t.phone, name: t.name };
    const { record, reason } = pickOwnMasterTutor(records, who);
    const label = `${t.tutorCode || "-"} ${t.name}`;
    if (!record) { skipped.push(`${label}: ${reason}`); continue; }
    if (!claims.has(record.id)) claims.set(record.id, []);
    claims.get(record.id).push({ t, who, record, label });
  }

  const counts = { copied: 0, alreadyHasPhoto: 0, conflicts: 0, noSafeMatch: skipped.length, failed: 0 };
  const conflicts = [];
  for (const [id, list] of claims) {
    const record = list[0].record;
    // One person may have a full and a partial record: same code or phone is fine.
    const samePerson = list.every((c) =>
      (c.t.tutorCode && c.t.tutorCode === list[0].t.tutorCode)
      || (last10(c.who.phone) && last10(c.who.phone) === last10(list[0].who.phone)));
    if (!samePerson) {
      counts.conflicts++;
      conflicts.push(`Odoo #${id} ${record.name} (${record.tutor_id || "no code"}) is claimed by: ${list.map((c) => c.label).join("; ")}`);
      continue;
    }
    if (record.profile_photo) { counts.alreadyHasPhoto++; continue; }

    const chosen = list.find((c) => full.includes(c.t)) || list[0]; // a full registration wins
    const line = `${chosen.label} → Odoo #${id} ${record.name} (${record.tutor_id || "no code"})`;
    if (!APPLY) { counts.copied++; console.log(`would copy  ${line}`); continue; }
    try {
      const r = await setMasterTutorPhoto({ ...chosen.who, photoUrl: chosen.t.photo, overwrite: false });
      if (r.updated && r.odooId === id) { counts.copied++; console.log(`copied      ${line}`); }
      else { counts.failed++; console.log(`not copied  ${line}: ${r.reason || `matched #${r.odooId} on the live check`}`); }
    } catch (err) {
      counts.failed++;
      console.log(`FAILED      ${line}: ${err.message}`);
    }
  }

  if (conflicts.length) console.log(`\nNot copied — two different tutors point at the same Odoo record:\n  ${conflicts.join("\n  ")}`);
  if (skipped.length) console.log(`\nNot copied — no safe Odoo match:\n  ${skipped.join("\n  ")}`);
  console.log(`\nOdoo tutors: ${records.length}. Website tutors with a photo: ${full.length + partial.length}.`);
  console.log(`${APPLY ? "Copied" : "Would copy"}: ${counts.copied}. Already had a photo (left alone): ${counts.alreadyHasPhoto}. ` +
    `Conflicts: ${counts.conflicts}. No safe match: ${counts.noSafeMatch}. Failed: ${counts.failed}.`);
  if (!APPLY) console.log("Dry run — nothing was written. Add --apply to copy the photos.");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
