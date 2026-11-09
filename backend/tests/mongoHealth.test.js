// Panel 2 MongoDB health check: the parts that can be checked without a database,
// and the promise that a database which will not answer is reported, not crashed on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { maskDigits, getMongoEvents, recordMongoProblem } from "../utils/mongoErrorLog.js";
import { collectionStatus, safeHost, buildMongoHealth, runWriteTest, KNOWN_COLLECTIONS, WRITE_TEST_COLLECTION } from "../utils/mongoHealth.js";

test("phone numbers and other long digit runs are hidden in error messages", () => {
  assert.equal(
    maskDigits('E11000 duplicate key error dup key: { phone: "9876543210" }'),
    'E11000 duplicate key error dup key: { phone: "…3210" }',
  );
  assert.equal(maskDigits("code 11000 at port 27017"), "code 11000 at port 27017"); // short numbers stay readable
  assert.equal(maskDigits(null), "");
});

test("problems the health check finds are kept, newest first, and masked", () => {
  recordMongoProblem({ operation: "write test (write)", collection: WRITE_TEST_COLLECTION, message: "failed for 9123456789" });
  const { events, watching, since } = getMongoEvents();
  assert.equal(events[0].operation, "write test (write)");
  assert.equal(events[0].message, "failed for …6789");
  assert.equal(events[0].type, "error");
  assert.ok(since instanceof Date);
  assert.equal(watching.validation, true);
});

test("a collection's status says what it holds and how recently", () => {
  assert.equal(collectionStatus({ error: "too slow", exists: true, count: 5 }), "error");
  assert.equal(collectionStatus({ exists: false, count: 0 }), "missing");
  assert.equal(collectionStatus({ exists: true, count: 0 }), "empty");
  assert.equal(collectionStatus({ exists: true, count: 3, idKind: "custom" }), "fixed");
  assert.equal(collectionStatus({ exists: true, count: 3, idKind: "objectid", newInPeriod: 2 }), "active");
  assert.equal(collectionStatus({ exists: true, count: 3, idKind: "objectid", newInPeriod: 0 }), "quiet");
});

test("the server name is shown without the username or password", () => {
  assert.equal(safeHost({ options: { hosts: [{ host: "cluster0-shard-00-00.abc.mongodb.net", port: 27017 }] } }), "cluster0-shard-00-00.abc.mongodb.net");
  assert.equal(safeHost({ options: { hosts: [{ host: "a.net" }, { host: "b.net" }, { host: "c.net" }] } }), "a.net (+2 more)");
  assert.equal(safeHost(null), "");
});

test("the app's own collections are all named, and the core ones flagged", () => {
  for (const name of ["parentenquiries", "tutors", "broadcastlogs", "counters"]) assert.equal(KNOWN_COLLECTIONS[name].core, true, name);
  assert.ok(KNOWN_COLLECTIONS.partialtutors.label);
  assert.ok(KNOWN_COLLECTIONS[WRITE_TEST_COLLECTION]);
});

test("in local safe mode the write test never touches the database", async () => {
  const db = { collection: () => { throw new Error("must not be called"); } };
  const result = await runWriteTest(db, { safeMode: true });
  assert.equal(result.skipped, true);
  assert.equal(result.ok, null);
});

test("a database that will not answer is reported as a problem, not a crash", async () => {
  const db = {
    databaseName: "live",
    command: async () => { throw new Error("connection refused"); },
    listCollections: () => { throw new Error("must not be reached"); },
    collection: () => { throw new Error("must not be reached"); },
  };
  const out = await buildMongoHealth(db, { hours: 5000, readyState: 0 });
  assert.equal(out.hours, 720);
  assert.equal(out.status, "bad");
  assert.equal(out.connection.connected, false);
  assert.equal(out.connection.state, "disconnected");
  assert.match(out.problems[0], /Not connected: connection refused/);
  assert.deepEqual(out.collections, []);
});
