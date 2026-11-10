// A new Odoo tutor's ID (upsertMasterTutor) never repeats a partial tutor's,
// and a partial tutor registering fully keeps theirs. Odoo is a stand-in
// answering in memory; .env is never loaded and nothing leaves this process.
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

const modulePath = (rel) => new URL(`../${rel}`, import.meta.url).href;

let odooCodes, created, existingByMobile;

before(async () => {
  mock.module("dotenv", { defaultExport: { config: () => ({}) }, namedExports: { config: () => ({}) } });
  mock.module("node-fetch", {
    defaultExport: async (url, opts) => {
      const { params } = JSON.parse(opts.body);
      const { service, method, args } = params;
      let result = null;
      if (service === "common" && method === "authenticate") result = 2;
      else {
        const [, , , model, op, opArgs] = args;
        if (model !== "master_tutors") throw new Error(`unexpected model ${model}`);
        if (op === "search_read" && JSON.stringify(opArgs).includes('"mobile"')) result = existingByMobile;
        else if (op === "search_count") result = odooCodes.length;
        else if (op === "search_read") result = odooCodes.map((c) => ({ tutor_id: c }));
        else if (op === "create") { created.push(opArgs[0]); result = 900 + created.length; }
        else if (op === "write") result = true;
        else throw new Error(`unexpected ${op}`);
      }
      const text = JSON.stringify({ jsonrpc: "2.0", id: 1, result });
      return { ok: true, status: 200, url, headers: { get: () => "application/json" }, text: async () => text, json: async () => JSON.parse(text) };
    },
  });
});

beforeEach(() => {
  odooCodes = ["TUT0001", "TUT0002", "TUT0003"];
  created = [];
  existingByMobile = [];
});

const tutor = { name: "New Person", phone: "9811111111", email: "n@example.test" };
const upsert = async (data, options) => (await import(modulePath("utils/odooService.js"))).upsertMasterTutor(data, options);

test("as before: the next free number after Odoo's", async () => {
  const res = await upsert(tutor);
  assert.equal(res.tutorCode, "TUT0004");
  assert.equal(created[0].tutor_id, "TUT0004");
});

test("numbers held by partial tutors are skipped", async () => {
  const res = await upsert(tutor, { reservedCodes: ["TUT0004", "tut0005"] });
  assert.equal(res.tutorCode, "TUT0006");
});

test("a partial tutor registering fully keeps their ID", async () => {
  const res = await upsert(tutor, { reservedCodes: ["TUT0004", "TUT0210"], preferredCode: "TUT0210" });
  assert.equal(res.tutorCode, "TUT0210");
  assert.equal(created[0].tutor_id, "TUT0210");
});

test("...unless Odoo already uses that ID for someone else", async () => {
  const res = await upsert(tutor, { preferredCode: "TUT0002" });
  assert.equal(res.tutorCode, "TUT0004");
});

test("someone already in Odoo keeps Odoo's ID; nothing is created", async () => {
  existingByMobile = [{ id: 55, tutor_id: "TUT0002" }];
  const res = await upsert(tutor, { preferredCode: "TUT0210" });
  assert.equal(res.tutorCode, "TUT0002");
  assert.equal(created.length, 0);
});

test("Odoo's tutor IDs can be listed (read only)", async () => {
  const { listOdooTutorCodes } = await import(modulePath("utils/odooService.js"));
  assert.deepEqual(await listOdooTutorCodes(), ["TUT0001", "TUT0002", "TUT0003"]);
});
