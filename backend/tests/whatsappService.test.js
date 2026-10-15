import { test } from "node:test";
import assert from "node:assert/strict";
import { toOdooDatetime } from "../utils/whatsappService.js";

test("Odoo datetimes are UTC without 'T' or timezone (Odoo rejects '2026-10-14T16:18:37.268Z')", () => {
  assert.equal(toOdooDatetime(new Date("2026-10-14T16:18:37.268Z")), "2026-10-14 16:18:37");
});
