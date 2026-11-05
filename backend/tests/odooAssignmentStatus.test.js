// updateLeadAssignment must not move an enrolled student back to a demo stage in Odoo.
// The HTTP client and .env loading are mocked, so nothing can reach Odoo or read real settings.
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

const calls = [];

before(() => {
  mock.module("dotenv", { defaultExport: { config: () => ({}) } });
  mock.module("node-fetch", {
    defaultExport: async (url, options) => {
      const { params } = JSON.parse(options.body);
      calls.push(params);
      return { status: 200, text: async () => JSON.stringify({ result: 1 }) };
    },
  });
  mock.method(console, "log", () => {});
});

beforeEach(() => {
  calls.length = 0;
});

async function writtenValues(details) {
  const { updateLeadAssignment } = await import("../utils/odooService.js");
  assert.equal(await updateLeadAssignment(42, details), true);
  const write = calls.find((call) => call.method === "execute_kw");
  return write.args.at(-1)[1];
}

test("a normal assignment moves the Odoo lead to Demo Scheduled", async () => {
  const values = await writtenValues({ tutorName: "New Tutor" });
  assert.equal(values.x_studio_lead_status, "Demo Scheduled");
  assert.equal(values.x_studio_assigned_tutor, "New Tutor");
});

test("keepStatus updates the tutor and leaves the Odoo status alone", async () => {
  const values = await writtenValues({ tutorName: "New Tutor", tutorCode: "T2", keepStatus: true });
  assert.equal("x_studio_lead_status" in values, false);
  assert.equal(values.x_studio_assigned_tutor, "New Tutor");
  assert.equal(values.x_studio_tutor_code, "T2");
});
