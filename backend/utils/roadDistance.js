// Road distance, in km by car, from a parent's map pin to tutors' map pins,
// from openrouteservice (OpenStreetMap roads, the same map data as the site's
// location picker). Used by the Panel 2 shortlist instead of the straight line.
//
// Set ORS_API_KEY to turn it on. Optional:
//   ORS_BASE_URL       default https://api.heigit.org/openrouteservice
//   ORS_PROFILE        default driving-car (a two-wheeler covers the same roads)
//   ORS_TIMEOUT_MS     default 8000, per request
//   ORS_MATRIX_BATCH   default 200 tutors per request (the API allows 3,500 pairs)
//   ORS_ROAD_DISTANCE  "false" switches it off without removing the key
//
// Only coordinates are sent, never names or numbers. Answers are kept in the
// road_distance_cache collection for 90 days, so running the same shortlist
// again costs nothing from the daily allowance. Whatever cannot be worked out
// (no key, service down, allowance used up, a pin nowhere near a road) comes
// back as null and the caller keeps the straight-line figure for it.
import mongoose from "mongoose";

export const ORS_DEFAULT_BASE = "https://api.heigit.org/openrouteservice";
const CACHE_COLLECTION = "road_distance_cache";
const CACHE_DAYS = 90;
const MAX_REQUESTS = 8; // per shortlist, including retries of smaller batches

export function roadDistanceConfig(env = process.env) {
  const key = String(env.ORS_API_KEY || "").trim();
  const batch = Number(env.ORS_MATRIX_BATCH || 200);
  return {
    enabled: !!key && String(env.ORS_ROAD_DISTANCE || "").toLowerCase() !== "false",
    key,
    base: String(env.ORS_BASE_URL || ORS_DEFAULT_BASE).replace(/\/+$/, ""),
    profile: String(env.ORS_PROFILE || "driving-car"),
    timeoutMs: Number(env.ORS_TIMEOUT_MS || 8000),
    batchSize: Math.max(1, Math.min(Number.isFinite(batch) ? batch : 200, 3000)),
  };
}

const validPoint = (p) =>
  !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
  Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && !(p.lat === 0 && p.lng === 0);

// ~1 m: the same two pins always give the same key
const pairKey = (a, b) => `${a.lat.toFixed(5)},${a.lng.toFixed(5)}>${b.lat.toFixed(5)},${b.lng.toFixed(5)}`;

/** The cache in MongoDB; quietly does nothing when the database isn't connected. */
export function mongoRoadCache() {
  let indexed = false;
  const col = () => (mongoose.connection?.readyState === 1 ? mongoose.connection.db.collection(CACHE_COLLECTION) : null);
  return {
    async get(keys) {
      const c = col();
      if (!c || !keys.length) return new Map();
      const rows = await c.find({ _id: { $in: keys } }, { projection: { km: 1 } }).toArray();
      return new Map(rows.map((r) => [r._id, r.km]));
    },
    async set(entries) {
      const c = col();
      if (!c || !entries.length) return;
      if (!indexed) {
        indexed = true;
        await c.createIndex({ at: 1 }, { expireAfterSeconds: CACHE_DAYS * 86400 }).catch(() => {});
      }
      await c.bulkWrite(
        entries.map(([key, km]) => ({ updateOne: { filter: { _id: key }, update: { $set: { km, at: new Date() } }, upsert: true } })),
        { ordered: false },
      );
    },
  };
}

class OrsError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function askOrs(cfg, origin, points, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const res = await fetchImpl(`${cfg.base}/v2/matrix/${encodeURIComponent(cfg.profile)}`, {
      method: "POST",
      headers: { Authorization: cfg.key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        locations: [[origin.lng, origin.lat], ...points.map((p) => [p.lng, p.lat])],
        sources: [0],
        destinations: points.map((_, i) => i + 1),
        metrics: ["distance"],
        units: "km",
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      let detail = "";
      try { const body = await res.json(); detail = body?.error?.message || body?.error || ""; } catch { /* not JSON */ }
      throw new OrsError(`openrouteservice answered ${res.status}${detail ? `: ${String(detail).slice(0, 160)}` : ""}`, res.status);
    }
    const data = await res.json();
    const row = data?.distances?.[0];
    if (!Array.isArray(row) || row.length !== points.length) throw new OrsError("openrouteservice sent an unexpected answer", 0);
    return row.map((km) => (typeof km === "number" && Number.isFinite(km) ? Math.round(km * 10) / 10 : null));
  } catch (err) {
    if (err.name === "AbortError") throw new OrsError(`openrouteservice took longer than ${cfg.timeoutMs} ms`, 0);
    if (err instanceof OrsError) throw err;
    throw new OrsError(`openrouteservice could not be reached: ${err.message}`, 0);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {{lat:number,lng:number}} origin  the parent's pin
 * @param {Array<{lat:number,lng:number}|null>} points  the tutors' pins
 * @returns {Promise<{ km: Array<number|null>, enabled: boolean, asked: number,
 *   fromCache: number, requests: number, failed: boolean, reason: string }>}
 *   km[i] is the road distance to points[i], or null when it isn't known.
 */
export async function roadDistancesKm(origin, points, {
  env = process.env, fetchImpl = globalThis.fetch, cache = mongoRoadCache(), log = console,
} = {}) {
  const cfg = roadDistanceConfig(env);
  const out = { km: points.map(() => null), enabled: cfg.enabled, asked: 0, fromCache: 0, requests: 0, failed: false, reason: "" };
  if (!cfg.enabled) return { ...out, reason: "ORS_API_KEY is not set" };
  if (!validPoint(origin)) return { ...out, reason: "the parent has no map pin" };

  const wanted = points.map((p, i) => (validPoint(p) ? i : -1)).filter((i) => i >= 0);
  if (!wanted.length) return out;

  // 1. What we already know
  const keys = new Map(wanted.map((i) => [i, pairKey(origin, points[i])]));
  let known = new Map();
  try { known = await cache.get([...new Set(keys.values())]); } catch (err) { log.warn?.(`[RoadDistance] cache read failed: ${err.message}`); }
  const missing = [];
  for (const i of wanted) {
    const km = known.get(keys.get(i));
    if (typeof km === "number") { out.km[i] = km; out.fromCache += 1; } else missing.push(i);
  }

  // 2. Ask for the rest, in batches. A batch the service refuses as a bad
  // request (one pin nowhere near a road can do that) is split and retried, so
  // one odd pin does not cost everyone their road distance.
  const fresh = [];
  const queue = [];
  for (let s = 0; s < missing.length; s += cfg.batchSize) queue.push(missing.slice(s, s + cfg.batchSize));
  while (queue.length) {
    const batch = queue.shift();
    if (out.requests >= MAX_REQUESTS) { out.failed = true; out.reason ||= "too many requests for one shortlist"; break; }
    out.requests += 1;
    out.asked += batch.length;
    try {
      const kms = await askOrs(cfg, origin, batch.map((i) => points[i]), fetchImpl);
      batch.forEach((i, j) => {
        out.km[i] = kms[j];
        if (kms[j] != null) fresh.push([keys.get(i), kms[j]]);
      });
    } catch (err) {
      out.failed = true;
      out.reason = err.message;
      log.warn?.(`[RoadDistance] ${err.message}`);
      const badRequest = err.status === 400 || err.status === 404;
      if (badRequest && batch.length > 1) {
        const half = Math.ceil(batch.length / 2);
        queue.unshift(batch.slice(0, half), batch.slice(half));
        continue;
      }
      // Key refused, allowance used up, service down: no point asking again now
      if (!badRequest) break;
    }
  }

  // 3. Remember the answers
  if (fresh.length) {
    try { await cache.set(fresh); } catch (err) { log.warn?.(`[RoadDistance] cache write failed: ${err.message}`); }
  }
  if (!out.failed) out.reason = "";
  return out;
}
