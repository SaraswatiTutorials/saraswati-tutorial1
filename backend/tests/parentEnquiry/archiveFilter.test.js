// Archived parent enquiries are left out of queries unless asked for.
// Uses the real model's query hooks on unsent queries: no database connection.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import ParentEnquiry from "../../models/ParentEnquiry.js";
import { hideArchived, hideArchivedInAggregate } from "../../models/ParentEnquiry.js";

const filterAfterHook = (query) => {
  hideArchived.call(query);
  return query.getFilter();
};

describe("Queries skip archived enquiries", () => {
  test("a plain find gets archived: { $ne: true } added", () => {
    const filter = filterAfterHook(ParentEnquiry.find({ status: "New Lead" }));
    assert.deepEqual(filter, { status: "New Lead", archived: { $ne: true } });
  });

  test("findById and countDocuments are covered too", () => {
    assert.deepEqual(filterAfterHook(ParentEnquiry.findById("6adacf6ec39b2da289b284ea")).archived, { $ne: true });
    assert.deepEqual(filterAfterHook(ParentEnquiry.countDocuments({})).archived, { $ne: true });
  });

  test("a query that filters on archived itself is left alone", () => {
    const filter = filterAfterHook(ParentEnquiry.find({ archived: true }));
    assert.deepEqual(filter, { archived: true });
  });

  test("includeArchived returns everything", () => {
    const filter = filterAfterHook(ParentEnquiry.find({}).setOptions({ includeArchived: true }));
    assert.deepEqual(filter, {});
  });

  test("the hook is registered for the query types the app uses", () => {
    const hooked = new Set(ParentEnquiry.schema.s.hooks._pres.keys());
    for (const op of ["find", "findOne", "countDocuments", "distinct", "findOneAndUpdate", "updateOne", "updateMany", "aggregate"]) {
      assert.ok(hooked.has(op), `${op} is not hooked`);
    }
  });
});

describe("Aggregations skip archived enquiries", () => {
  test("a $match is added at the start of the pipeline", () => {
    const agg = ParentEnquiry.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]);
    hideArchivedInAggregate.call(agg);
    assert.deepEqual(agg.pipeline()[0], { $match: { archived: { $ne: true } } });
    assert.equal(agg.pipeline().length, 2);
  });

  test("a pipeline that already matches on archived is left alone", () => {
    const agg = ParentEnquiry.aggregate([{ $match: { archived: true } }]);
    hideArchivedInAggregate.call(agg);
    assert.equal(agg.pipeline().length, 1);
  });
});
