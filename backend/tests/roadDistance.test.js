// Road distance from openrouteservice. The service is a fake fetch and the cache
// is in memory; nothing reaches the network or MongoDB.
import { test } from "node:test";
import assert from "node:assert/strict";
import { roadDistancesKm, roadDistanceConfig, ORS_DEFAULT_BASE } from "../utils/roadDistance.js";

const KEY = "test-key-123";
const env = (extra = {}) => ({ ORS_API_KEY: KEY, ...extra });
const parent = { lat: 12.9352, lng: 77.6245 };
const tutors = [
  { lat: 12.9620, lng: 77.6400 },
  { lat: 12.9100, lng: 77.6000 },
  { lat: 12.9800, lng: 77.7000 },
];
const quiet = { warn: () => {} };

function memoryCache() {
  const store = new Map();
  return { store, async get(keys) { return new Map(keys.filter((k) => store.has(k)).map((k) => [k, store.get(k)])); }, async set(entries) { for (const [k, v] of entries) store.set(k, v); } };
}

// Answers like openrouteservice: one row of distances, in km
function fakeOrs(answer = (n, i) => 5 + i * 1.234, { status = 200, body } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const sent = JSON.parse(init.body);
    calls.push({ url, init, sent });
    if (typeof status === "function" ? status(sent) !== 200 : status !== 200) {
      const code = typeof status === "function" ? status(sent) : status;
      return { ok: false, status: code, json: async () => body || { error: { message: "nope" } } };
    }
    const n = sent.destinations.length;
    return { ok: true, status: 200, json: async () => ({ distances: [sent.destinations.map((_, i) => answer(n, i, sent))] }) };
  };
  return { calls, fetchImpl };
}

test("without ORS_API_KEY nothing is asked and everyone keeps the straight line", async () => {
  const ors = fakeOrs();
  const r = await roadDistancesKm(parent, tutors, { env: {}, fetchImpl: ors.fetchImpl, cache: memoryCache(), log: quiet });
  assert.deepEqual(r.km, [null, null, null]);
  assert.equal(r.enabled, false);
  assert.equal(ors.calls.length, 0);
  assert.equal(roadDistanceConfig({ ORS_API_KEY: KEY, ORS_ROAD_DISTANCE: "false" }).enabled, false);
});

test("asks the new heigit address once, by car, for distance only, with the key in the header", async () => {
  const ors = fakeOrs();
  const r = await roadDistancesKm(parent, tutors, { env: env(), fetchImpl: ors.fetchImpl, cache: memoryCache(), log: quiet });
  assert.equal(ors.calls.length, 1);
  const { url, init, sent } = ors.calls[0];
  assert.equal(url, `${ORS_DEFAULT_BASE}/v2/matrix/driving-car`);
  assert.equal(ORS_DEFAULT_BASE, "https://api.heigit.org/openrouteservice");
  assert.equal(init.method, "POST");
  assert.equal(init.headers.Authorization, KEY);
  assert.deepEqual(sent.locations[0], [77.6245, 12.9352]); // longitude first
  assert.deepEqual(sent.sources, [0]);
  assert.deepEqual(sent.destinations, [1, 2, 3]);
  assert.deepEqual(sent.metrics, ["distance"]); // no travel time
  assert.equal(sent.units, "km");
  assert.deepEqual(r.km, [5, 6.2, 7.5]); // one decimal
  assert.equal(r.failed, false);
});

test("only coordinates are sent", async () => {
  const ors = fakeOrs();
  await roadDistancesKm(parent, tutors, { env: env(), fetchImpl: ors.fetchImpl, cache: memoryCache(), log: quiet });
  assert.deepEqual(Object.keys(ors.calls[0].sent).sort(), ["destinations", "locations", "metrics", "sources", "units"]);
});

test("tutors without a usable pin are skipped, not sent", async () => {
  const ors = fakeOrs();
  const r = await roadDistancesKm(parent, [tutors[0], null, { lat: NaN, lng: 1 }, { lat: 0, lng: 0 }, tutors[1]],
    { env: env(), fetchImpl: ors.fetchImpl, cache: memoryCache(), log: quiet });
  assert.equal(ors.calls[0].sent.destinations.length, 2);
  assert.deepEqual(r.km.map((k) => k != null), [true, false, false, false, true]);
});

test("no parent pin: nothing asked", async () => {
  const ors = fakeOrs();
  const r = await roadDistancesKm({ lat: null, lng: null }, tutors, { env: env(), fetchImpl: ors.fetchImpl, cache: memoryCache(), log: quiet });
  assert.equal(ors.calls.length, 0);
  assert.match(r.reason, /no map pin/);
});

test("a tutor the service can't route to stays unknown; the rest are kept", async () => {
  const ors = fakeOrs((n, i) => (i === 1 ? null : 4));
  const r = await roadDistancesKm(parent, tutors, { env: env(), fetchImpl: ors.fetchImpl, cache: memoryCache(), log: quiet });
  assert.deepEqual(r.km, [4, null, 4]);
});

test("answers are remembered: the same shortlist again asks nothing", async () => {
  const cache = memoryCache();
  const ors = fakeOrs();
  await roadDistancesKm(parent, tutors, { env: env(), fetchImpl: ors.fetchImpl, cache, log: quiet });
  const again = await roadDistancesKm(parent, tutors, { env: env(), fetchImpl: ors.fetchImpl, cache, log: quiet });
  assert.equal(ors.calls.length, 1);
  assert.equal(again.fromCache, 3);
  assert.deepEqual(again.km, [5, 6.2, 7.5]);
});

test("only the new ones are asked about when some are remembered", async () => {
  const cache = memoryCache();
  const ors = fakeOrs();
  await roadDistancesKm(parent, tutors.slice(0, 2), { env: env(), fetchImpl: ors.fetchImpl, cache, log: quiet });
  await roadDistancesKm(parent, tutors, { env: env(), fetchImpl: ors.fetchImpl, cache, log: quiet });
  assert.equal(ors.calls[1].sent.destinations.length, 1);
});

test("many tutors go in batches", async () => {
  const many = Array.from({ length: 5 }, (_, i) => ({ lat: 12.9 + i / 100, lng: 77.6 }));
  const ors = fakeOrs(() => 3);
  const r = await roadDistancesKm(parent, many, { env: env({ ORS_MATRIX_BATCH: "2" }), fetchImpl: ors.fetchImpl, cache: memoryCache(), log: quiet });
  assert.deepEqual(ors.calls.map((c) => c.sent.destinations.length), [2, 2, 1]);
  assert.deepEqual(r.km, [3, 3, 3, 3, 3]);
});

test("a batch refused as a bad request is split, so one odd pin doesn't cost everyone", async () => {
  const odd = { lat: 13.5, lng: 78.5 };
  const points = [tutors[0], odd, tutors[1], tutors[2]];
  const ors = fakeOrs(() => 6, { status: (sent) => (sent.locations.some(([lng]) => lng === 78.5) ? 404 : 200) });
  const r = await roadDistancesKm(parent, points, { env: env(), fetchImpl: ors.fetchImpl, cache: memoryCache(), log: quiet });
  assert.deepEqual(r.km, [6, null, 6, 6]);
  assert.ok(ors.calls.length <= 8);
});

test("key refused or allowance used up: stops at once, everyone keeps the straight line", async () => {
  for (const status of [401, 403, 429, 503]) {
    const ors = fakeOrs(undefined, { status, body: { error: "Quota exceeded" } });
    const r = await roadDistancesKm(parent, tutors, { env: env({ ORS_MATRIX_BATCH: "1" }), fetchImpl: ors.fetchImpl, cache: memoryCache(), log: quiet });
    assert.equal(ors.calls.length, 1, String(status));
    assert.deepEqual(r.km, [null, null, null]);
    assert.equal(r.failed, true);
    assert.match(r.reason, new RegExp(String(status)));
  }
});

test("a slow service is given up on", async () => {
  const fetchImpl = (url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
  });
  const r = await roadDistancesKm(parent, tutors, { env: env({ ORS_TIMEOUT_MS: "30" }), fetchImpl, cache: memoryCache(), log: quiet });
  assert.equal(r.failed, true);
  assert.match(r.reason, /longer than 30 ms/);
});

test("an unreachable service or odd answer is a fallback, not a crash", async () => {
  const down = await roadDistancesKm(parent, tutors, { env: env(), fetchImpl: async () => { throw new Error("ECONNREFUSED"); }, cache: memoryCache(), log: quiet });
  assert.match(down.reason, /could not be reached/);
  const odd = await roadDistancesKm(parent, tutors, { env: env(), fetchImpl: async () => ({ ok: true, json: async () => ({ distances: [[1]] }) }), cache: memoryCache(), log: quiet });
  assert.deepEqual(odd.km, [null, null, null]);
});

test("a broken cache doesn't stop road distance", async () => {
  const ors = fakeOrs();
  const broken = { get: async () => { throw new Error("db down"); }, set: async () => { throw new Error("db down"); } };
  const r = await roadDistancesKm(parent, tutors, { env: env(), fetchImpl: ors.fetchImpl, cache: broken, log: quiet });
  assert.deepEqual(r.km, [5, 6.2, 7.5]);
});

test("the key never appears in what is reported or logged", async () => {
  const logged = [];
  const ors = fakeOrs(undefined, { status: 403 });
  const r = await roadDistancesKm(parent, tutors, { env: env(), fetchImpl: ors.fetchImpl, cache: memoryCache(), log: { warn: (m) => logged.push(m) } });
  assert.ok(!JSON.stringify(r).includes(KEY));
  assert.ok(!logged.join(" ").includes(KEY));
});

test("the address can be changed, e.g. back to the old one", async () => {
  const ors = fakeOrs();
  await roadDistancesKm(parent, tutors, { env: env({ ORS_BASE_URL: "https://api.openrouteservice.org/" }), fetchImpl: ors.fetchImpl, cache: memoryCache(), log: quiet });
  assert.equal(ors.calls[0].url, "https://api.openrouteservice.org/v2/matrix/driving-car");
});
