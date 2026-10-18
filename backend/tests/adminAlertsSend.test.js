// notifyAdminOfNewEnquiry always sends the approved Odoo template, so wording
// edited in Odoo is used even when the admin chatted in the last 24 hours.
import { test, mock } from "node:test";
import assert from "node:assert/strict";

const calls = [];
mock.module(new URL("../utils/whatsappService.js", import.meta.url).href, {
  namedExports: {
    sendWhatsAppToTutor: async (args) => {
      calls.push(args);
      return { success: true };
    },
  },
});
const { notifyAdminOfNewEnquiry } = await import("../utils/adminAlerts.js");

test("new enquiry alert is always sent as the template", async () => {
  process.env.ADMIN_WHATSAPP = "919999999999";
  await notifyAdminOfNewEnquiry({ requirementId: "REQ-1", parentName: "P", phone: "1", wards: [] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].forceTemplate, true);
  assert.equal(calls[0].templateName, "admin_new_enquiry_alert");
});
