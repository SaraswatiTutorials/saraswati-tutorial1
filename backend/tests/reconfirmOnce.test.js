// The parent re-confirmation goes once per enquiry. MongoDB is a stand-in.
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { reconfirmRequirement } from "../utils/pipelineStages.js";

function useRecorded(rows) {
  const fake = {
    collection: () => ({
      find: (q) => {
        let out = rows.filter((r) => r.requirementId === q.requirementId && r.sent === q.sent);
        const c = { sort: () => c, limit: (n) => { out = out.slice(0, n); return c; }, next: async () => out[0] || null };
        return c;
      },
    }),
  };
  const before = Object.getOwnPropertyDescriptor(mongoose.connection, "db");
  Object.defineProperty(mongoose.connection, "db", { value: fake, configurable: true, writable: true });
  return () => (before ? Object.defineProperty(mongoose.connection, "db", before) : delete mongoose.connection.db);
}

const lead = { _id: "l1", phone: "9876543210", requirementId: "REQ-1", odooLeadId: 55, wards: [{ classGrade: "5" }] };

test("after one re-confirmation has gone out, it is refused — even when asked to resend", async () => {
  const restore = useRecorded([{ requirementId: "REQ-1", sent: true, sentAt: new Date("2026-11-20T10:00:00Z") }]);
  try {
    for (const options of [{ dryRun: true }, { dryRun: false }, { dryRun: false, resend: true }]) {
      const r = await reconfirmRequirement(lead, options);
      assert.equal(r.ok, false, JSON.stringify(options));
      assert.match(r.reason, /once per enquiry/);
    }
  } finally { restore(); }
});

test("a failed attempt does not count: it can be tried again (preview shown)", async () => {
  const restore = useRecorded([{ requirementId: "REQ-1", sent: false, failureReason: "Odoo down" }]);
  try {
    const r = await reconfirmRequirement(lead, { dryRun: true });
    assert.equal(r.ok, true);
    assert.deepEqual(r.buttons, ["Yes,Correct", "Change some details"]);
  } finally { restore(); }
});

test("an enquiry never re-confirmed can be sent (preview shown)", async () => {
  const restore = useRecorded([]);
  try {
    const r = await reconfirmRequirement(lead, { dryRun: true });
    assert.equal(r.ok, true);
    assert.equal(r.templateName, "re_confirmation_copy");
  } finally { restore(); }
});
