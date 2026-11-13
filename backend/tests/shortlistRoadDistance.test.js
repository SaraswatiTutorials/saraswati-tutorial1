// The Panel 2 shortlist uses road distance where it has it. Tutors and partial
// sign-ups are in-memory fakes, road distance is a fake; nothing reaches
// MongoDB, Odoo, WhatsApp, openrouteservice or the network. Dry runs only.
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

const modulePath = (rel) => new URL(`../${rel}`, import.meta.url).href;

// The family in Koramangala; 0.009° of latitude is about 1 km
const LEAD = {
  _id: "lead1", requirementId: "REQ-RD1", latitude: 12.9352, longitude: 77.6245,
  area: "Koramangala", city: "Bangalore", pincode: "560034",
  wards: [{ studentName: "Asha", classGrade: "8", curriculum: "CBSE", subjectsNeeded: ["Maths"] }],
};
const tutor = (id, kmNorth, extra = {}) => ({
  _id: id, name: `Tutor ${id}`, tutorCode: `TUT0${id}`, status: "approved", phone: `90000000${id}`,
  area: "Koramangala", city: "Bangalore", pincode: "560034", experience: "5 year", occupation: "School Teacher",
  latitude: kmNorth == null ? null : 12.9352 + kmNorth * 0.009, longitude: kmNorth == null ? null : 77.6245,
  ...extra,
});

let tutors, roadKm, roadCalls, roadAnswer;

before(async () => {
  mock.module(modulePath("models/Tutor.js"), {
    defaultExport: {
      find: (q, projection) => {
        const p = Promise.resolve(tutors);
        p.lean = async () => tutors;
        return p;
      },
    },
  });
  mock.module(modulePath("models/PartialTutor.js"), {
    defaultExport: { find: () => ({ sort: () => ({ lean: async () => [] }) }) },
  });
  mock.module(modulePath("models/BroadcastLog.js"), { defaultExport: function BroadcastLog() {} });
  mock.module(modulePath("utils/roadDistance.js"), {
    namedExports: {
      roadDistancesKm: async (origin, points) => {
        roadCalls.push({ origin, points });
        if (roadAnswer) return roadAnswer(points);
        return {
          km: points.map((p) => roadKm[p.lat.toFixed(4)] ?? null),
          enabled: true, asked: points.length, fromCache: 0, requests: 1, failed: false, reason: "",
        };
      },
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
  roadCalls = [];
  roadAnswer = null;
  // 3 km away in a straight line but 12 km round the lake by road; 6 km both
  // ways roughly; 11 km straight (never asked about); no pin at all.
  tutors = [tutor("1", 3), tutor("2", 6), tutor("3", 11), tutor("4", null)];
  roadKm = {
    [(12.9352 + 3 * 0.009).toFixed(4)]: 12.4,
    [(12.9352 + 6 * 0.009).toFixed(4)]: 7.3,
  };
});

const shortlist = async () => {
  const { shortlistTutors } = await import(modulePath("utils/pipelineStages.js"));
  return shortlistTutors(LEAD, { dryRun: true, includePartial: false, radiusKm: 10 });
};

test("'within 10 km' is by road: close as the crow flies but far by road is left out", async () => {
  const plan = await shortlist();
  const names = plan.tutors.map((t) => t.name);
  assert.ok(!names.includes("Tutor 1"), names); // 3 km straight, 12.4 km by road
  assert.ok(names.includes("Tutor 2"));
  const t2 = plan.tutors.find((t) => t.name === "Tutor 2");
  assert.equal(t2.distanceKm, 7.3);
  assert.equal(t2.distanceSource, "road");
  assert.ok(Math.abs(t2.straightKm - 6) < 0.2, t2.straightKm);
  assert.match(t2.reason, /7\.3 km/);
});

test("nobody already beyond the radius in a straight line is asked about", async () => {
  await shortlist();
  assert.equal(roadCalls.length, 1);
  assert.equal(roadCalls[0].points.length, 2); // tutors 1 and 2; not 3 (11 km) or 4 (no pin)
  assert.deepEqual(roadCalls[0].origin, { lat: 12.9352, lng: 77.6245 });
});

test("a tutor with no pin is still judged on area, as before", async () => {
  const plan = await shortlist();
  const t4 = plan.tutors.find((t) => t.name === "Tutor 4");
  assert.ok(t4);
  assert.equal(t4.distanceKm, null);
  assert.equal(t4.distanceSource, undefined);
});

test("ranked by road distance", async () => {
  tutors.push(tutor("5", 2));
  roadKm[(12.9352 + 2 * 0.009).toFixed(4)] = 9.1;
  const plan = await shortlist();
  const withKm = plan.tutors.filter((t) => t.distanceKm != null).map((t) => [t.name, t.distanceKm]);
  assert.deepEqual(withKm, [["Tutor 2", 7.3], ["Tutor 5", 9.1]]); // 5 is nearer in a straight line
});

test("Panel 2 is told it is by road", async () => {
  const plan = await shortlist();
  assert.equal(plan.distanceMode, "road");
  assert.equal(plan.roadDistance.used, 2);
  assert.equal(plan.roadDistance.asked, 2);
});

test("service down or no key: everyone keeps the straight line, marked as such", async () => {
  roadAnswer = (points) => ({ km: points.map(() => null), enabled: true, asked: points.length, fromCache: 0, requests: 1, failed: true, reason: "openrouteservice answered 429: Quota exceeded" });
  const plan = await shortlist();
  const t1 = plan.tutors.find((t) => t.name === "Tutor 1");
  assert.ok(t1, "back to the straight line, tutor 1 is in again");
  assert.equal(t1.distanceSource, "straight");
  assert.ok(Math.abs(t1.distanceKm - 3) < 0.2);
  assert.equal(plan.distanceMode, "straight");
  assert.match(plan.roadDistance.reason, /429/);
});

test("if the road distance code throws, the shortlist still works", async () => {
  roadAnswer = () => { throw new Error("boom"); };
  const plan = await shortlist();
  assert.ok(plan.ok);
  assert.equal(plan.distanceMode, "straight");
  assert.equal(plan.roadDistance.reason, "boom");
});
