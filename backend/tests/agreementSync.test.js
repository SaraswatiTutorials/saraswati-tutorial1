// Tutors' Odoo Sign agreements are copied into MongoDB. Odoo and MongoDB are
// stand-ins in memory; nothing leaves this process.
import { test } from "node:test";
import assert from "node:assert/strict";
import { agreementsByTutor, syncTutorAgreements, odooDate, statusOf } from "../utils/agreementSync.js";

const quiet = { log() {}, warn() {}, error() {} };

const tutors = () => [
  { _id: "t1", phone: "+91 98765 43210", email: "asha@example.com" },
  { _id: "t2", phone: "9000000002", whatsapp: "", email: "" },
  { _id: "t3", phone: "9000000003", email: "c@example.com" },
  { _id: "t4", phone: "9000000004", email: "" },
];

const odoo = () => ({
  "sign.request": [
    { id: 10, reference: "Tutor Agreement - Asha", template_id: [1, "Tutor Agreement"], create_date: "2026-10-01 05:00:00", completion_date: "2026-10-02 06:00:00" },
    { id: 11, reference: "Tutor Agreement - B", template_id: [1, "Tutor Agreement"], create_date: "2026-10-05 05:00:00" },
    { id: 12, reference: "Tutor Agreement - Asha (old)", template_id: [1, "Tutor Agreement"], create_date: "2026-09-01 05:00:00" },
    { id: 13, reference: "Parent T&C", template_id: [2, "Parent T&C"], create_date: "2026-10-06 05:00:00" },
  ],
  "res.partner": [
    { id: 100, name: "Asha", email: "ASHA@example.com", mobile: "" },
    { id: 101, name: "B", email: "", mobile: "09000000002" },
    { id: 102, name: "Some parent", email: "parent@example.com", mobile: "8111111111" },
  ],
  "sign.request.item": [
    // Asha matched by email (different case); signed
    { id: 1, sign_request_id: [10, "Tutor Agreement - Asha"], partner_id: [100, "Asha"], state: "completed", signing_date: "2026-10-02 06:00:00" },
    // an older cancelled one must not beat the signed one
    { id: 2, sign_request_id: [12, "x"], partner_id: [100, "Asha"], state: "canceled" },
    // B matched by mobile; still to sign
    { id: 3, sign_request_id: [11, "Tutor Agreement - B"], partner_id: [101, "B"], state: "sent" },
    // a parent: matches no tutor
    { id: 4, sign_request_id: [13, "Parent T&C"], partner_id: [102, "Some parent"], state: "completed" },
  ],
});

const readFrom = (data) => async (model, domain) => {
  const rows = data[model] || [];
  const ids = domain.find((c) => c[0] === "id")?.[2];
  return ids ? rows.filter((r) => ids.includes(r.id)) : rows;
};

test("Odoo dates and states are read correctly", () => {
  assert.equal(odooDate("2026-10-02 06:00:00").toISOString(), "2026-10-02T06:00:00.000Z");
  assert.equal(odooDate(false), null);
  assert.equal(statusOf("completed"), "signed");
  assert.equal(statusOf("sent"), "sent");
  assert.equal(statusOf("canceled"), "cancelled");
});

test("each signer is matched to a tutor by email or phone; signed beats cancelled", () => {
  const d = odoo();
  const found = agreementsByTutor({ items: d["sign.request.item"], requests: d["sign.request"], partners: d["res.partner"], tutors: tutors() });
  assert.equal(found.get("t1").status, "signed");
  assert.equal(found.get("t1").document, "Tutor Agreement - Asha");
  assert.equal(found.get("t1").signedAt.toISOString(), "2026-10-02T06:00:00.000Z");
  assert.equal(found.get("t2").status, "sent");
  assert.equal(found.get("t2").signed, false);
  assert.equal(found.has("t3"), false);
  assert.equal(found.size, 2); // the parent matched nobody
});

function world({ data = odoo(), list = tutors() } = {}) {
  const writes = [];
  const states = [];
  return {
    writes, states,
    deps: {
      log: quiet,
      readOdoo: readFrom(data),
      findTutors: async () => list,
      writeAgreements: async (ops) => { writes.push(...ops); },
      setState: async (s) => { states.push(s); },
    },
  };
}

test("a sync stores the signed count and writes only tutors that changed", async () => {
  const list = tutors();
  // t3 was signed before but Odoo no longer has it → becomes "none"
  list[2].odooAgreement = { status: "signed", signed: true, signedAt: new Date("2026-01-01"), sentAt: null, document: "Old", signRequestId: 5 };
  const w = world({ list });
  const r = await syncTutorAgreements(w.deps);

  assert.equal(r.signed, 1);
  assert.equal(r.sent, 1);
  assert.deepEqual(w.writes.map((o) => o.updateOne.filter._id).sort(), ["t1", "t2", "t3"]); // t4 had nothing and still has nothing
  const t3 = w.writes.find((o) => o.updateOne.filter._id === "t3").updateOne.update.$set.odooAgreement;
  assert.equal(t3.status, "none");
  assert.equal(w.states.at(-1).status, "idle");
  assert.equal(w.states.at(-1).lastSyncCount, 1);

  // Second run with the stored values: nothing to write
  const stored = list.map((t) => {
    const op = w.writes.find((o) => o.updateOne.filter._id === t._id);
    return op ? { ...t, odooAgreement: op.updateOne.update.$set.odooAgreement } : t;
  });
  const w2 = world({ list: stored });
  const r2 = await syncTutorAgreements(w2.deps);
  assert.equal(r2.changed, 0);
  assert.equal(w2.writes.length, 0);
});

test("if Odoo returns no signers at all, stored agreements are kept", async () => {
  const list = tutors();
  list[0].odooAgreement = { status: "signed", signed: true, signedAt: new Date("2026-10-02"), document: "A", signRequestId: 10 };
  const w = world({ data: { "sign.request.item": [] }, list });
  await syncTutorAgreements(w.deps);
  assert.equal(w.writes.length, 0);
});

test("an Odoo error is recorded and nothing is written", async () => {
  const w = world();
  w.deps.readOdoo = async () => { throw new Error("Object sign.request.item doesn't exist"); };
  await assert.rejects(syncTutorAgreements(w.deps), /doesn't exist/);
  assert.equal(w.writes.length, 0);
  assert.equal(w.states.at(-1).status, "error");
});

test("partial tutors get their agreement stored too", async () => {
  const w = world();
  const partialWrites = [];
  w.deps.findPartials = async () => [{ _id: "p1", whatsapp: "9000000002" }, { _id: "p2", whatsapp: "9111111111" }];
  w.deps.writePartialAgreements = async (ops) => { partialWrites.push(...ops); };
  const r = await syncTutorAgreements(w.deps);
  assert.equal(r.partialSent, 1); // p1 has B's number, who was sent one
  assert.deepEqual(partialWrites.map((o) => o.updateOne.filter._id), ["p1"]);
  assert.equal(partialWrites[0].updateOne.update.$set.odooAgreement.status, "sent");
});
