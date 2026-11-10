// Panel 2 Odoo health check. Odoo is never called here: every test passes its
// own stand-in for the call to Odoo, and the settings are made up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { watchOdooCall, getOdooCalls, resetOdooCalls, areaOf, maskText } from "../utils/odooCallLog.js";
import {
  assertReadOnly, readOnlyRpc, odooTargets, attendanceApi, templateChecklist, judgeTemplates,
  flowStatus, checkOdooLive, buildOdooHealth, WHATSAPP_QUEUE_CRON_ID,
} from "../utils/odooHealth.js";

const ENV = {
  ODOO_URL: "https://odoo.example.test", ODOO_DB: "db1", ODOO_USERNAME: "bot", ODOO_PASSWORD: "s3cret-pass",
  ODOO_COMMUNITY_API_TOKEN: "tok",
};

test("the health check refuses any Odoo call that is not a read", () => {
  for (const op of ["create", "write", "unlink", "message_post", "method_direct_trigger", "action_send_whatsapp_template", "copy"]) {
    assert.throws(() => assertReadOnly("object", "execute_kw", ["db", 1, "pw", "whatsapp.message", op, []]), /only reads/, op);
  }
  assert.throws(() => assertReadOnly("db", "drop", []), /only reads/);
  for (const op of ["search_read", "search_count", "read"]) assertReadOnly("object", "execute_kw", ["db", 1, "pw", "crm.lead", op, []]);
  assertReadOnly("common", "version", []);
  assertReadOnly("common", "authenticate", ["db", "u", "p", {}]);
});

test("a write never reaches Odoo, even if asked", async () => {
  const reached = [];
  const call = readOnlyRpc(async (...a) => { reached.push(a); return 1; });
  await assert.rejects(call({}, "object", "execute_kw", ["db", 1, "pw", "crm.lead", "create", [{}]]), /only reads/);
  assert.equal(reached.length, 0);
});

test("one Odoo connection when both senders use the same settings", () => {
  const t = odooTargets(ENV);
  assert.equal(t.length, 1);
  assert.equal(t[0].host, "odoo.example.test");
  assert.equal(t[0].whatsapp, true);
  assert.equal(t[0].setupError, "");
});

test("two connections when leads and WhatsApp go to different Odoos", () => {
  const t = odooTargets({ ...ENV, ODOO_COMMUNITY_URL: "https://community.example.test" });
  assert.deepEqual(t.map((x) => x.host), ["community.example.test", "odoo.example.test"]);
  assert.deepEqual(t.map((x) => x.whatsapp), [false, true]);
});

test("missing settings are named, and no password shows in the server name", () => {
  const t = odooTargets({ ODOO_PASSWORD: "" });
  const wa = t.find((x) => x.whatsapp);
  assert.match(wa.setupError, /ODOO_URL is not set/);
  const withCreds = odooTargets({ ...ENV, ODOO_URL: "https://user:hunter2@odoo.example.test" });
  assert.equal(withCreds[0].host, "odoo.example.test");
  assert.equal(attendanceApi({}).tokenSet, false);
  assert.equal(attendanceApi(ENV).tokenSet, true);
});

test("templates: a fallback that is approved is fine, a missing core one is a problem", () => {
  const checklist = templateChecklist({});
  const invite = checklist.find((c) => c.key === "invite");
  assert.ok(invite.anyOf && invite.names.length >= 2);
  const found = [
    { name: invite.names[0], template_name: invite.names[0], status: "pending" },
    { name: "Old display name", template_name: invite.names[1], status: "approved" }, // renamed in Odoo
  ];
  const judged = judgeTemplates(checklist, found);
  const inv = judged.find((t) => t.key === "invite");
  assert.equal(inv.state, "ok");
  assert.equal(inv.using, invite.names[1]);
  assert.match(inv.note, /waiting for meta/);
  assert.equal(judged.find((t) => t.key === "selected").state, "bad"); // core, missing
  assert.equal(judged.find((t) => t.key === "admin").state, "warn"); // outside the pipeline, missing
});

test("a send's status: nothing, fine, some failed, mostly failed", () => {
  assert.equal(flowStatus({ total: 0, failed: 0, stuck: 0 }), "quiet");
  assert.equal(flowStatus({ total: 10, failed: 0, stuck: 0 }), "ok");
  assert.equal(flowStatus({ total: 10, failed: 1, stuck: 0 }), "warn");
  assert.equal(flowStatus({ total: 10, failed: 0, stuck: 2 }), "warn");
  assert.equal(flowStatus({ total: 4, failed: 3, stuck: 0 }), "bad");
});

test("each call to Odoo is recorded without its arguments, and passed back unchanged", async () => {
  resetOdooCalls();
  const out = await watchOdooCall("server", "object", "execute_kw", ["db", 2, "s3cret-pass", "crm.lead", "create", [{ phone: "9876543210" }]], async () => 42);
  assert.equal(out, 42);
  const boom = new Error("Record 9876543210 failed");
  await assert.rejects(
    watchOdooCall("whatsapp", "object", "execute_kw", ["db", 2, "s3cret-pass", "whatsapp.composer", "action_send_whatsapp_template", []], async () => { throw boom; }),
    (err) => err === boom,
  );
  const refused = await watchOdooCall("server", "common", "authenticate", ["db", "u", "s3cret-pass", {}], async () => false);
  assert.equal(refused, false);

  const calls = getOdooCalls({ since: new Date(Date.now() - 3600e3) });
  assert.equal(calls.ok, 1);
  assert.equal(calls.failed, 2);
  const text = JSON.stringify(calls);
  assert.ok(!text.includes("s3cret-pass"), "password must never be kept");
  assert.ok(!text.includes("9876543210"), "phone numbers are shortened");
  assert.ok(text.includes("…3210"));
  const wa = calls.areas.find((a) => a.key === "whatsapp");
  assert.equal(wa.failingNow, true);
  assert.equal(calls.areas.find((a) => a.key === "leads").failingNow, false);
  assert.equal(calls.areas.find((a) => a.key === "login").failingNow, true);
  assert.equal(calls.errors[0].area, "login"); // newest first
  assert.equal(calls.errors[1].model, "whatsapp.composer");
  resetOdooCalls();
});

test("calls are grouped by what they are for", () => {
  assert.equal(areaOf({ service: "common", op: "authenticate" }), "login");
  assert.equal(areaOf({ service: "object", model: "crm.lead", op: "write" }), "leads");
  assert.equal(areaOf({ service: "object", model: "crm.lead", op: "message_post" }), "notes");
  assert.equal(areaOf({ service: "object", model: "discuss.channel", op: "message_post" }), "whatsapp");
  assert.equal(areaOf({ service: "object", model: "x_master_tutors", op: "create" }), "tutors");
  assert.equal(areaOf({ service: "object", model: "master_tutors", op: "search_read" }), "tutors");
  assert.equal(areaOf({ service: "object", model: "ir.cron", op: "method_direct_trigger" }), "queue");
  assert.equal(maskText("call 919876543210 now"), "call …3210 now");
  assert.equal(maskText("(#131026) Message undeliverable"), "(#131026) Message undeliverable"); // Meta's code stays readable
});

/** A stand-in Odoo that answers the health check's reads, and notes every call. */
function fakeOdoo({ login = 7, states = {}, templates = [], cron = { id: WHATSAPP_QUEUE_CRON_ID, name: "WhatsApp: send queue", active: true, nextcall: null } } = {}) {
  const seen = [];
  const rpc = async (target, service, method, args) => {
    seen.push({ service, method, model: args?.[3], op: args?.[4] });
    if (service === "common" && method === "version") return { server_version: "17.0+e" };
    if (service === "common" && method === "authenticate") return login;
    const [, , , model, op, params, kw] = args;
    if (model === "whatsapp.account") return [{ id: 1, name: "Saraswati WhatsApp" }];
    if (model === "whatsapp.template") return templates;
    if (model === "ir.cron") return cron ? [cron] : [];
    if (model === "whatsapp.message" && op === "search_count") {
      const domain = params[0];
      const state = domain.find((d) => Array.isArray(d) && d[0] === "state")?.[2];
      const inbound = domain.some((d) => Array.isArray(d) && d[0] === "message_type" && d[1] === "=");
      const stuck = domain.some((d) => Array.isArray(d) && d[0] === "create_date" && d[1] === "<");
      if (inbound) return 4;
      if (stuck) return states.stuck || 0;
      return states[state] || 0;
    }
    if (model === "whatsapp.message" && op === "search_read") {
      if (kw.limit === 1) return [{ create_date: "2026-11-09 10:00:00" }];
      return states.error ? [{ mobile_number: "+91 98765 43210", state: "error", failure_reason: "Message undeliverable", create_date: "2026-11-09 09:00:00", wa_template_id: [3, "Tutor Broadcast V6"] }] : [];
    }
    throw new Error(`unexpected ${model}.${op}`);
  };
  return { rpc, seen };
}

test("live check: connection, WhatsApp account, templates, messages and send job, all by reading", async () => {
  const names = [...new Set(templateChecklist(ENV).flatMap((c) => c.names))];
  const { rpc, seen } = fakeOdoo({
    templates: names.map((n) => ({ name: n, template_name: n, status: "approved" })),
    states: { sent: 10, delivered: 6, read: 3, error: 1 },
  });
  const live = await checkOdooLive({ env: ENV, now: new Date(), since: new Date(Date.now() - 86400e3), rpc });
  assert.equal(live.connections.length, 1);
  const c = live.connections[0];
  assert.ok(c.reachable && c.loginOk && c.version === "17.0+e", JSON.stringify(c));
  assert.equal("uid" in c, false);
  assert.deepEqual(live.whatsapp.accounts, ["Saraswati WhatsApp"]);
  assert.ok(live.whatsapp.templates.every((t) => t.state === "ok"));
  assert.equal(live.whatsapp.messages.total, 20);
  assert.equal(live.whatsapp.messages.failed, 1);
  assert.equal(live.whatsapp.messages.replies, 4);
  assert.equal(live.whatsapp.messages.failures[0].to, "…3210");
  assert.equal(live.whatsapp.queue.active, true);
  for (const s of seen) {
    assert.ok(s.service === "common" ? ["version", "authenticate"].includes(s.method) : ["search_read", "search_count", "read"].includes(s.op), JSON.stringify(s));
  }
});

test("a refused login, a stuck queue and a switched-off send job are problems", async () => {
  const refused = await buildOdooHealth(null, { env: ENV, rpc: fakeOdoo({ login: false }).rpc });
  assert.equal(refused.status, "bad");
  assert.ok(refused.problems.some((p) => /refused the login/.test(p)), refused.problems.join(" | "));
  assert.equal(refused.whatsapp, null);

  const stuck = await buildOdooHealth(null, {
    env: ENV,
    rpc: fakeOdoo({ states: { outgoing: 5, stuck: 5 }, cron: { id: WHATSAPP_QUEUE_CRON_ID, name: "WhatsApp: send queue", active: false } }).rpc,
  });
  assert.ok(stuck.problems.some((p) => /waiting in Odoo's queue/.test(p)), stuck.problems.join(" | "));
  assert.ok(stuck.problems.some((p) => /switched off/.test(p)));
  assert.ok(stuck.problems.some((p) => /Step 5/.test(p)), "templates missing in this fake Odoo");
});

test("an Odoo that cannot be reached is reported, not crashed on", async () => {
  const out = await buildOdooHealth(null, {
    hours: 5000, env: ENV,
    rpc: async () => { throw new Error("Could not reach Odoo at odoo.example.test: the connection was refused."); },
  });
  assert.equal(out.hours, 720);
  assert.equal(out.status, "bad");
  assert.equal(out.connections[0].reachable, false);
  assert.match(out.problems[0], /cannot be reached.*refused/);
  assert.ok(out.warnings.some((w) => /database is not connected/.test(w)));
  assert.ok(!JSON.stringify(out).includes("s3cret-pass"));
});

test("the switched-off x_tutor sync is not listed; master tutors is", async () => {
  const { readSendFlows } = await import("../utils/odooHealth.js");
  const db = { collection: () => ({ find: () => ({ toArray: async () => [] }), aggregate: () => ({ toArray: async () => [] }) }) };
  const off = await readSendFlows(db, { since: new Date(0), env: {} });
  assert.ok(off.some((f) => f.key === "odoo_tutor_sync"));
  assert.ok(!off.some((f) => f.key === "odoo_x_tutor_sync"));
  const on = await readSendFlows(db, { since: new Date(0), env: { ODOO_X_TUTOR_SYNC: "true" } });
  assert.ok(on.some((f) => f.key === "odoo_x_tutor_sync"));
});
