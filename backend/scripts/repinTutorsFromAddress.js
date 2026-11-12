/**
 * repinTutorsFromAddress.js — moves tutors' map pins from the centre of their
 * first teaching area to their own home address.
 *
 * Why: on 22 Oct 2026 a one-off job gave 213 tutors (geoSource "backfill") a
 * pin at the centre of the first area on their "locations I can teach" list,
 * not at their home. Road distances to parents were then measured from that
 * area centre (e.g. a tutor living in Arekere shown 1.3 km from a family in
 * Vijayanagar, really 16 km). This re-pins every such tutor who has a home
 * address saved, using the same OpenStreetMap search the site's location
 * picker uses (Nominatim, Photon when Nominatim refuses).
 *
 * PREVIEW BY DEFAULT: without --apply it only reads, and writes the plan to
 * backend/reports/repin-preview-<date>.json.
 *
 * Safety:
 *   - only tutors with geoSource "backfill" and a home address are touched;
 *   - an answer that is only a whole city, district or state is refused
 *     (that would be no better than the area centre); so is one outside the
 *     Bangalore area;
 *   - the old pin is kept in previousGeo, so it can be put back:
 *         node scripts/repinTutorsFromAddress.js --undo
 *   - name, phone and every other detail are left as they are. Only the
 *     address text is sent to the map search, never a name or number.
 *
 * Run from the backend folder:
 *     node scripts/repinTutorsFromAddress.js            preview, changes nothing
 *     node scripts/repinTutorsFromAddress.js --apply    re-pin from the last preview
 *     node scripts/repinTutorsFromAddress.js --undo     put the old pins back
 * Add --no-pin to any of these to work on tutors who have no pin at all but
 * saved a home address (their undo puts them back to no pin).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const NOMINATIM = "https://nominatim.openstreetmap.org";
const PHOTON = "https://photon.komoot.io";
// Same identity the site's location picker (routes/geoRoutes.js) sends
const USER_AGENT = "SaraswatiTutorial/1.0 (location picker; contact: support@saraswatitutorial.com)";
// Bangalore: west, south, east, north
const BOX = { w: 77.35, s: 12.75, e: 77.9, n: 13.25 };
// Answers vaguer than this are refused
const TOO_VAGUE = new Set(["city", "county", "state_district", "state", "country", "district", "region", "municipality"]);
const CITY_WORDS = /\b(bangalore|bengaluru|banglore|bangaluru|bengalore|bengalooru|karnataka|india)\b/gi;
// Words that say nothing about where a place is: a match on these alone is a guess
const GENERIC = new Set(("road rd main cross crs stage stg block blk layout phase sector street st extension extn " +
  "metro station stn bus stop pin pincode near opp opposite beside behind next to the and of no house flat floor " +
  "ground first second third 1st 2nd 3rd 4th 5th 6th 7th 8th 9th apartment apartments apt residency nilaya nilayam " +
  "pg ladies gents men women girls boys hostel hotel school college university temple church mosque colony quarters " +
  "quaters circle junction town city new old east west north south area hobli taluk village post office park lake " +
  "garden gate back front side complex tower towers enclave home homes living luxury coliving colive stay grand " +
  "bengaluru bangalore banglore bengalore karnataka india corporation ward nagar nagara satellite").split(" "));

/** A word reduced to its consonants, so spellings like Marathalli / Marathahalli agree. */
const skeleton = (w) => w.toLowerCase().replace(/[^a-z]/g, "").replace(/[aeiouhy]/g, "").replace(/(.)\1+/g, "$1");

/** The words in a search that name a place. */
export function placeWords(text) {
  return [...new Set(String(text || "").toLowerCase().split(/[^a-z]+/)
    .filter((w) => w.length >= 4 && !GENERIC.has(w)))];
}

/** True when the place found carries one of the place names searched for. */
export function sharesPlaceName(query, label) {
  const wanted = placeWords(query);
  if (!wanted.length) return false;
  const found = String(label || "").toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const foundSk = found.map(skeleton);
  return wanted.some((w) => {
    if (found.includes(w)) return true;
    const sk = skeleton(w);
    return sk.length >= 3 && foundSk.some((f) => f.length >= 3 && (f === sk || f.startsWith(sk) || sk.startsWith(f)));
  });
}

const REPORTS = path.join(process.cwd(), "reports");
const today = () => new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const inBox = (lat, lng) => lat >= BOX.s && lat <= BOX.n && lng >= BOX.w && lng <= BOX.e;

export function haversineKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Searches to try for one address, most specific first: the whole address,
 * then dropping leading parts (house number, cross, landmark), then the last
 * few words, then the pincode alone.
 */
export function searchesFor(address, pincode = "") {
  const raw = String(address || "").replace(/\s+/g, " ").trim();
  const pin = (raw.match(/\b5\d{5}\b/) || [])[0] || (/^\d{6}$/.test(String(pincode)) ? String(pincode) : "");
  const cleaned = raw
    .replace(/\b5\d{5}\b/g, " ")
    .replace(CITY_WORDS, " ")
    .replace(/\b(near|beside|behind|opp(osite)?|next to|nr)\b\.?/gi, ",")
    .replace(/[#]/g, " ")
    .replace(/\s*-\s*/g, " ")
    .replace(/\s+/g, " ");
  const parts = cleaned.split(/[,;]/).map((p) => p.trim()).filter((p) => p.length > 2);
  const out = [];
  const add = (q) => { const s = q.trim(); if (s && !out.includes(s)) out.push(s); };
  for (let i = 0; i < parts.length; i++) add(parts.slice(i).join(", "));
  // A single long part ("Beside X hotel Rajajinagar"): its last word (usually
  // the area) before longer word runs, which can hit a landmark of the same name
  const words = (parts.at(-1) || "").split(" ").filter(Boolean);
  if (words.length > 1 && words.at(-1).length > 3) add(words.at(-1));
  if (words.length > 2) add(words.slice(-2).join(" "));
  // A search with no place name in it ("metro", "2nd stage") can only guess
  const searches = out.filter((q) => placeWords(q).length).slice(0, 6).map((q) => `${q}, Bengaluru`);
  if (pin) searches.push(`${pin}, Bengaluru`);
  return searches;
}

let lastNominatim = 0;
async function nominatim(q) {
  const wait = 1100 - (Date.now() - lastNominatim);
  if (wait > 0) await sleep(wait);
  lastNominatim = Date.now();
  const url = `${NOMINATIM}/search?format=json&addressdetails=1&limit=1&countrycodes=in&bounded=1` +
    `&viewbox=${BOX.w},${BOX.n},${BOX.e},${BOX.s}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json", "Accept-Language": "en" }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) { const e = new Error(`Nominatim ${res.status}`); e.status = res.status; throw e; }
  const [hit] = await res.json();
  if (!hit) return null;
  return { lat: Number(hit.lat), lng: Number(hit.lon), kind: hit.addresstype || hit.type || "", label: hit.display_name || "", via: "nominatim" };
}

async function photon(q) {
  const url = `${PHOTON}/api?limit=1&lang=en&bbox=${BOX.w},${BOX.s},${BOX.e},${BOX.n}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`Photon ${res.status}`);
  const f = (await res.json())?.features?.[0];
  if (!f) return null;
  const p = f.properties || {};
  const [lng, lat] = f.geometry?.coordinates || [];
  return { lat, lng, kind: p.type || p.osm_value || "", label: [p.name, p.street, p.district, p.city, p.postcode].filter(Boolean).join(", "), via: "photon" };
}

let nominatimDown = false;
// Nominatim, tried twice (it times out now and then); Photon when it refuses or keeps failing
async function lookup(q) {
  if (!nominatimDown) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try { return await nominatim(q); } catch (err) {
        if (err.status === 403 || err.status === 429) { nominatimDown = true; break; }
        if (attempt === 2) break;
        await sleep(2000);
      }
    }
  }
  return photon(q);
}

/** The best usable pin for one address, or { reason } why there is none. */
export async function geocodeAddress(address, pincode, find = lookup) {
  const searches = searchesFor(address, pincode);
  const pin = (String(address || "").match(/\b5\d{5}\b/) || [])[0] || (/^\d{6}$/.test(String(pincode)) ? String(pincode) : "");
  for (const [i, q] of searches.entries()) {
    let hit = null;
    try { hit = await find(q); } catch (err) {
      if (i === searches.length - 1) return { reason: `map search failed: ${err.message}` };
      continue;
    }
    if (!hit || !Number.isFinite(hit.lat) || !Number.isFinite(hit.lng)) continue;
    if (!inBox(hit.lat, hit.lng)) continue;
    if (TOO_VAGUE.has(String(hit.kind).toLowerCase())) continue;
    const byPincode = /^\d{6}, Bengaluru$/.test(q);
    // The place found must be the one asked for: same pincode, or a place name in common
    const foundPins = String(hit.label).match(/\b5\d{5}\b/g) || [];
    if (pin && foundPins.length && !foundPins.includes(pin)) continue;
    if (byPincode ? !foundPins.includes(q.slice(0, 6)) : !sharesPlaceName(q, hit.label)) continue;
    return { ...hit, query: q, precision: byPincode ? "pincode" : (i === 0 ? "full address" : "part of address") };
  }
  return { reason: "no place in Bangalore found for this address" };
}

// Which tutors a run is for: those pinned at an area centre (default), or,
// with --no-pin, those who have no pin at all but did save a home address
const NO_PIN = process.argv.includes("--no-pin");
const MODE = NO_PIN ? "nopin" : "backfill";
const NEEDS = NO_PIN
  ? { $or: [{ latitude: null }, { latitude: { $exists: false } }] }
  : { geoSource: "backfill" };
const previewFile = (date) => path.join(REPORTS, `repin-preview-${date}${NO_PIN ? "-nopin" : ""}.json`);

async function preview(db) {
  const tutors = (await db.collection("tutors").find(NEEDS, {
    projection: { name: 1, tutorCode: 1, phone: 1, fullAddress: 1, pincode: 1, latitude: 1, longitude: 1, locations: { $slice: 1 } },
  }).sort({ createdAt: 1 }).toArray()).filter((t) => String(t.fullAddress || "").trim().length > 5);

  const plan = [];
  for (const [n, t] of tutors.entries()) {
    const g = await geocodeAddress(t.fullAddress, t.pincode);
    const hadPin = Number.isFinite(t.latitude) && Number.isFinite(t.longitude);
    const old = hadPin ? { lat: t.latitude, lng: t.longitude } : { lat: null, lng: null };
    const row = {
      id: String(t._id), name: t.name, tutorCode: t.tutorCode || "", phone: t.phone || "",
      address: t.fullAddress, oldArea: t.locations?.[0] || "", old, mode: MODE,
    };
    if (g.reason) row.skip = g.reason;
    else {
      row.new = { lat: Number(g.lat.toFixed(7)), lng: Number(g.lng.toFixed(7)) };
      row.movedKm = hadPin ? Number(haversineKm(old, row.new).toFixed(2)) : null;
      Object.assign(row, { precision: g.precision, matched: g.label, query: g.query, via: g.via, kind: g.kind });
    }
    plan.push(row);
    const what = row.movedKm == null ? "new pin" : `moved ${row.movedKm} km`;
    console.log(`${String(n + 1).padStart(3)}/${tutors.length} ${(t.name || "").slice(0, 24).padEnd(25)} ${row.skip ? `SKIP: ${row.skip}` : `${row.precision}, ${what} → ${String(row.matched).slice(0, 60)}`}`);
  }
  fs.mkdirSync(REPORTS, { recursive: true });
  const file = previewFile(today());
  fs.writeFileSync(file, JSON.stringify(plan, null, 2));
  const ok = plan.filter((r) => !r.skip);
  console.log(`
${ok.length} of ${plan.length} can be pinned; ${plan.length - ok.length} skipped.`);
  console.log(`Plan: ${file}
Nothing changed. Check it, then run again with --apply${NO_PIN ? " --no-pin" : ""}`);
}

function latestPreview() {
  const pattern = NO_PIN ? /^repin-preview-.*-nopin.json$/ : /^repin-preview-d{4}-d{2}-d{2}.json$/;
  const files = fs.existsSync(REPORTS) ? fs.readdirSync(REPORTS).filter((f) => pattern.test(f)).sort() : [];
  if (!files.length) throw new Error("No preview found: run without --apply first.");
  return path.join(REPORTS, files.at(-1));
}

async function apply(db) {
  const file = latestPreview();
  const plan = JSON.parse(fs.readFileSync(file, "utf8")).filter((r) => r.new);
  let done = 0;
  for (const r of plan) {
    const hadPin = r.old.lat != null;
    // Only if the tutor still has the pin (or no pin) the preview saw
    const still = hadPin
      ? { geoSource: "backfill", latitude: r.old.lat, longitude: r.old.lng }
      : { $or: [{ latitude: null }, { latitude: { $exists: false } }] };
    const res = await db.collection("tutors").updateOne(
      { _id: new mongoose.Types.ObjectId(r.id), ...still },
      { $set: {
        latitude: r.new.lat, longitude: r.new.lng, geoSource: "home-address", geoPrecision: r.precision,
        geoRepinnedAt: new Date(),
        previousGeo: { latitude: r.old.lat, longitude: r.old.lng, source: hadPin ? "backfill" : "none" },
      } },
    );
    done += res.modifiedCount;
  }
  console.log(`Pinned ${done} of ${plan.length} tutors from ${path.basename(file)}.`);
}

// Puts back what was there before: the area-centre pin, or no pin (--no-pin)
async function undo(db) {
  const source = NO_PIN ? "none" : "backfill";
  const res = await db.collection("tutors").updateMany(
    { geoSource: "home-address", "previousGeo.source": source },
    [{ $set: { latitude: "$previousGeo.latitude", longitude: "$previousGeo.longitude", geoSource: NO_PIN ? null : "backfill" } },
      { $unset: ["previousGeo", "geoPrecision", "geoRepinnedAt"] }],
  );
  console.log(`Put back the previous ${NO_PIN ? "(empty) " : ""}pin on ${res.modifiedCount} tutors.`);
}

async function main() {
  const uri = String(process.env.MONGO_URI || "").replace(/^["']|["']$/g, "");
  if (!uri) { console.error("MONGO_URI is not set. Run from the backend folder."); process.exit(1); }
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
  try {
    const db = mongoose.connection.db;
    if (process.argv.includes("--undo")) await undo(db);
    else if (process.argv.includes("--apply")) await apply(db);
    else await preview(db);
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error("Failed:", err.message); process.exit(1); });
}
