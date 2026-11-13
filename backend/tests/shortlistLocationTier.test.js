// The Panel 2 shortlist fills its places by how far each tutor's map location
// can be trusted (picked on a map first, area centres last), then by distance,
// within 8 km. Tutors, partial sign-ups and road distance are in-memory fakes;
// nothing reaches MongoDB, Odoo, WhatsApp or the network. Dry runs only.
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

const modulePath = (rel) => new URL(`../${rel}`, import.meta.url).href;

// The family in Koramangala; 0.009° of latitude is about 1 km
const LAT = 12.9352, LNG = 77.6245;
const LEAD = {
  _id: "lead1", requirementId: "REQ-TIER", latitude: LAT, longitude: LNG,
  area: "Koramangala", city: "Bangalore", pincode: "560034",
  wards: [{ studentName: "Asha", classGrade: "8", curriculum: "CBSE", subjectsNeeded: ["Maths"] }],
};
const north = (km) => (km == null ? null : LAT + km * 0.009);
const tutor = (id, km, extra = {}) => ({
  _id: id, name: `Tutor ${id}`, tutorCode: `TUT0${id}`, status: "approved", phone: `98000000${id}`, whatsapp: `98000000${id}`,
  area: "Koramangala", city: "Bangalore", pincode: "560034", experience: "5 year", occupation: "School Teacher",
  latitude: north(km), longitude: km == null ? null : LNG, ...extra,
});
const partial = (id, km, extra = {}) => ({
  _id: `p${id}`, name: `Partial ${id}`, tutorCode: `TUT0${id}`, whatsapp: `97000000${id}`, status: "new",
  experience: "5 year", occupation: "School Teacher", createdAt: new Date(),
  location: { latitude: north(km), longitude: km == null ? null : LNG, area: "Koramangala", city: "Bangalore", pincode: "560034" },
  ...extra,
});

let tutors, partials;

before(async () => {
  mock.module(modulePath("models/Tutor.js"), {
    defaultExport: {
      find: () => {
        const copy = () => tutors.map((t) => ({ ...t }));
        const p = Promise.resolve(copy());
        p.lean = async () => copy();
        return p;
      },
    },
  });
  mock.module(modulePath("models/PartialTutor.js"), {
    defaultExport: { find: () => ({ sort: () => ({ lean: async () => partials.map((p) => ({ ...p })) }) }) },
  });
  mock.module(modulePath("models/BroadcastLog.js"), { defaultExport: function BroadcastLog() {} });
  // No road distance: everyone is measured in a straight line
  mock.module(modulePath("utils/roadDistance.js"), {
    namedExports: {
      roadDistancesKm: async (origin, points) => ({
        km: points.map(() => null), enabled: false, asked: 0, fromCache: 0, requests: 0, failed: false, reason: "off in tests",
      }),
    },
  });
  const noop = async () => null;
  mock.module(modulePath("utils/whatsappService.js"), {
    namedExports: { sendWhatsAppToTutor: noop, buildBroadcastMessage: () => "", chooseRequirementTemplate: noop },
  });
  mock.module(modulePath("utils/tutorOptionsMessage.js"), { namedExports: { sendTutorCards: noop, sendTutorOptions: noop } });
  mock.module(modulePath("utils/topThreeScheduler.js"), { namedExports: { rankInterested: () => [] } });
  mock.module(modulePath("utils/odooService.js"), { namedExports: { updateLeadAssignment: noop } });
  globalThis.fetch = async () => { throw new Error("Network access is disabled in tests"); };
});

beforeEach(() => {
  tutors = [];
  partials = [];
});

const shortlist = async (opts = {}) => {
  const { shortlistTutors } = await import(modulePath("utils/pipelineStages.js"));
  return shortlistTutors(LEAD, { dryRun: true, ...opts });
};
const names = (plan) => plan.tutors.map((t) => t.name);

test("tiers come first: a picked-on-map pin at 7 km beats an area centre at 1 km", async () => {
  tutors = [
    tutor("1", 1, { geoSource: "backfill" }),                                    // tier 5
    tutor("2", 2, { geoSource: "home-address", geoPrecision: "pincode" }),        // tier 4
    tutor("3", 3, { geoSource: "home-address", geoPrecision: "part of address" }), // tier 3
    tutor("4", 4, { geoSource: "home-address", geoPrecision: "full address" }),    // tier 2
    tutor("5", 7),                                                                // tier 1, own pin
  ];
  const plan = await shortlist({ includePartial: false });
  assert.deepEqual(names(plan), ["Tutor 5", "Tutor 4", "Tutor 3", "Tutor 2", "Tutor 1"]);
  assert.deepEqual(plan.tutors.map((t) => t.locationTier), [1, 2, 3, 4, 5]);
  assert.equal(plan.tutors[0].locationSource, "Picked on map");
  assert.equal(plan.tutors[4].locationSource, "Area centre (not home)");
});

test("within a tier, the nearest come first", async () => {
  tutors = [tutor("1", 6), tutor("2", 2), tutor("3", 4)];
  const plan = await shortlist({ includePartial: false });
  assert.deepEqual(names(plan), ["Tutor 2", "Tutor 3", "Tutor 1"]);
});

test("8 km is the default limit, for every tier", async () => {
  tutors = [tutor("1", 7.5), tutor("2", 8.6), tutor("3", 8.6, { geoSource: "backfill" })];
  const plan = await shortlist({ includePartial: false });
  assert.equal(plan.radiusKm, 8);
  assert.deepEqual(names(plan), ["Tutor 1"]);
});

test("partial-form entries count as picked on map", async () => {
  tutors = [tutor("1", 1, { geoSource: "backfill" })];
  partials = [partial("9", 5)];
  const plan = await shortlist();
  assert.deepEqual(names(plan), ["Partial 9", "Tutor 1"]);
  assert.equal(plan.tutors[0].locationTier, 1);
});

test("a registered tutor who also filled the partial form is measured from the partial-form pin", async () => {
  // Registered pin is a pincode guess 7 km away; their partial-form pin is 1 km away
  tutors = [tutor("1", 7, { geoSource: "home-address", geoPrecision: "pincode", whatsapp: "9811111111" }), tutor("2", 3)];
  partials = [partial("8", 1, { whatsapp: "+91 98111 11111" })];
  const plan = await shortlist();
  assert.deepEqual(names(plan), ["Tutor 1", "Tutor 2"]); // both tier 1 now; Tutor 1 is nearer
  const t1 = plan.tutors[0];
  assert.equal(t1.locationTier, 1);
  assert.equal(t1.locationSource, "Picked on map (partial form)");
  assert.ok(Math.abs(t1.distanceKm - 1) < 0.2, t1.distanceKm);
  assert.ok(!names(plan).includes("Partial 8"), "the same person is not listed twice");
});

test("…but not when the registered location was picked on a map too", async () => {
  tutors = [tutor("1", 2, { whatsapp: "9811111111" })];
  partials = [partial("8", 6, { whatsapp: "9811111111" })];
  const plan = await shortlist();
  assert.ok(Math.abs(plan.tutors[0].distanceKm - 2) < 0.2);
  assert.equal(plan.tutors[0].locationSource, "Picked on map");
});

test("…and not when the partial-form pin is far off (a mistake, e.g. another city)", async () => {
  tutors = [tutor("1", 3, { geoSource: "backfill", whatsapp: "9811111111" })];
  partials = [partial("8", 400, { whatsapp: "9811111111" })];
  const plan = await shortlist();
  assert.equal(plan.tutors[0].locationTier, 5);
  assert.ok(Math.abs(plan.tutors[0].distanceKm - 3) < 0.2);
});

test("no location at all comes last, still judged on area", async () => {
  tutors = [tutor("1", null), tutor("2", 5, { geoSource: "backfill" })];
  const plan = await shortlist({ includePartial: false });
  assert.deepEqual(names(plan), ["Tutor 2", "Tutor 1"]);
  assert.equal(plan.tutors[1].locationTier, 6);
});
