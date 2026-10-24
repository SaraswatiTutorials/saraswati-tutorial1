// REQ-/STU- IDs come from a counter that only goes up. Models are mocked in memory:
// no database connection.
import { test, describe, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

const modulePath = (rel) => new URL(`../../${rel}`, import.meta.url).href;

let enquiries = []; // { requirementId, websiteStudentId, archived }
let counters = new Map();
let queryOptions = [];

class Query {
  constructor(run) { this.run = run; this.options = {}; }
  setOptions(o) { Object.assign(this.options, o); return this; }
  sort() { return this; }
  select() { return this; }
  lean() { return this; }
  then(resolve, reject) {
    queryOptions.push(this.options);
    // Same rule as the real model: archived ones only with includeArchived
    const rows = enquiries.filter((e) => this.options.includeArchived || !e.archived);
    return Promise.resolve(this.run(rows)).then(resolve, reject);
  }
}

const FakeParentEnquiry = {
  findOne: (q) => new Query((rows) =>
    rows.filter((e) => q.requirementId.test(e.requirementId)).sort((a, b) => b.requirementId.localeCompare(a.requirementId))[0] || null),
  exists: (q) => new Query((rows) =>
    rows.some((e) => q.$or.some((c) => (c.requirementId && e.requirementId === c.requirementId) || (c.websiteStudentId && e.websiteStudentId === c.websiteStudentId))) ? { _id: 1 } : null),
};

const FakeCounter = {
  async updateOne({ _id }, { $max }) {
    counters.set(_id, Math.max(counters.get(_id) ?? 0, $max.seq));
  },
  async findOneAndUpdate({ _id }, { $inc }) {
    counters.set(_id, (counters.get(_id) ?? 0) + $inc.seq);
    return { _id, seq: counters.get(_id) };
  },
};

let nextEnquiryIds;
before(async () => {
  mock.module(modulePath("models/ParentEnquiry.js"), { defaultExport: FakeParentEnquiry });
  mock.module(modulePath("models/Counter.js"), { defaultExport: FakeCounter });
  ({ nextEnquiryIds } = await import(modulePath("utils/requirementId.js")));
});

beforeEach(() => {
  enquiries = [];
  counters = new Map();
  queryOptions = [];
});

const add = (n, extra = {}) => {
  const padded = String(n).padStart(5, "0");
  enquiries.push({ requirementId: `REQ-${padded}`, websiteStudentId: `STU-${padded}`, ...extra });
};

describe("Next REQ ID", () => {
  test("continues after the highest existing ID", async () => {
    add(365); add(366);
    assert.deepEqual(await nextEnquiryIds(), { requirementId: "REQ-00367", websiteStudentId: "STU-00367" });
  });

  test("an archived enquiry's number is not reused (the REQ-00367 case)", async () => {
    add(366); add(367, { archived: true });
    assert.equal((await nextEnquiryIds()).requirementId, "REQ-00368");
  });

  test("a number is not reused even if its enquiry was erased from the database", async () => {
    add(366);
    assert.equal((await nextEnquiryIds()).requirementId, "REQ-00367");
    // REQ-00367 is never saved (or is deleted directly in MongoDB)
    assert.equal((await nextEnquiryIds()).requirementId, "REQ-00368");
  });

  test("skips a number whose STU- ID is already taken", async () => {
    add(366);
    enquiries.push({ requirementId: "", websiteStudentId: "STU-00367" });
    assert.equal((await nextEnquiryIds()).requirementId, "REQ-00368");
  });

  test("starts at REQ-00001 with no enquiries", async () => {
    assert.equal((await nextEnquiryIds()).requirementId, "REQ-00001");
  });

  test("every lookup includes archived enquiries", async () => {
    add(366);
    await nextEnquiryIds();
    assert.ok(queryOptions.length > 0);
    assert.ok(queryOptions.every((o) => o.includeArchived === true));
  });
});
