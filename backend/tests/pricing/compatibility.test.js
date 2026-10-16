import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import mongoose from "mongoose";

import ParentEnquiry from "../../models/ParentEnquiry.js";
import pricingRouter from "../../routes/pricingRoutes.js";
import { calculateQuote, toEnquiryFields } from "../../utils/pricing/feeEngine.js";
import { ENQUIRY_FEE_FIELDS } from "../../utils/pricing/submissionValidation.js";

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

describe("existing database structure is respected (read-only checks)", () => {
  test("every fee field the engine writes already exists on the ParentEnquiry schema", () => {
    for (const field of ENQUIRY_FEE_FIELDS) {
      assert.ok(ParentEnquiry.schema.path(field), `ParentEnquiry.${field} must already exist`);
    }
  });

  test("costPerClass is not a schema field, so it is dropped on save exactly as before", () => {
    assert.equal(ParentEnquiry.schema.path("costPerClass"), undefined);
    const quote = calculateQuote({
      planType: "elite", daysPerWeek: 3, hoursPerDay: 1, preferredMode: "Online",
      wards: [{ classGrade: "10", curriculum: "CBSE" }],
    });
    assert.ok("costPerClass" in toEnquiryFields(quote));
  });

  test("ParentEnquiry schema keeps strict mode (unknown fields cannot be persisted)", () => {
    assert.notEqual(ParentEnquiry.schema.get("strict"), false);
  });

  test("pricing modules never import mongoose or models", () => {
    for (const file of [
      "utils/pricing/feeConfig.js",
      "utils/pricing/feeEngine.js",
      "utils/pricing/submissionValidation.js",
      "routes/pricingRoutes.js",
    ]) {
      const src = read(file);
      assert.doesNotMatch(src, /mongoose|models\//, file);
    }
  });

  test("tests never opened a database connection", () => {
    assert.equal(mongoose.connection.readyState, 0);
  });
});

describe("shared pricing files", () => {
  const frontendDir = new URL("../../../frontend/src/pricing/", import.meta.url);
  for (const file of ["feeConfig.js", "feeEngine.js"]) {
    test(`frontend copy of ${file} is identical to the backend copy`, (t) => {
      const target = new URL(file, frontendDir);
      if (!existsSync(target)) return t.skip("frontend not present");
      assert.equal(readFileSync(target, "utf8"), read(`utils/pricing/${file}`), "run `npm run sync:pricing`");
    });
  }
});

describe("pricing API (no database)", () => {
  const handlerFor = (method, path) =>
    pricingRouter.stack.find((l) => l.route?.path === path && l.route.methods[method]).route.stack[0].handle;
  const call = (method, path, req) => {
    const res = {
      statusCode: 200, payload: null,
      status(c) { this.statusCode = c; return this; },
      json(d) { this.payload = d; return this; },
    };
    handlerFor(method, path)({ query: {}, body: {}, ...req }, res);
    return res;
  };

  test("GET /options hides Foundation for Class 6 and returns prices", () => {
    const res = call("get", "/options", { query: { classGrade: "6", curriculum: "CBSE" } });
    const plans = Object.fromEntries(res.payload.plans.map((p) => [p.id, p]));
    assert.equal(plans.foundation.available, false);
    assert.equal(plans.advance.available, true);
    const advance36 = plans.advance.options.find((o) => o.days === 3 && o.hours === 1);
    assert.deepEqual(advance36, { days: 3, hours: 1, status: "available", price: 5000 });
    assert.equal(plans.advance.options.find((o) => o.days === 3 && o.hours === 1.5).price, 7500);
  });

  test("GET /options requires a class", () => {
    assert.equal(call("get", "/options", { query: {} }).statusCode, 400);
  });

  test("POST /options intersects availability across students", () => {
    const res = call("post", "/options", { body: { wards: [{ classGrade: "6" }, { classGrade: "10" }] } });
    assert.equal(res.payload.plans.find((p) => p.id === "foundation").available, false);
  });

  test("POST /quote returns the breakdown, and 400 for invalid combinations", () => {
    const ok = call("post", "/quote", {
      body: { planType: "advance", daysPerWeek: 3, hoursPerDay: 1.5, preferredMode: "Home",
        wards: [{ classGrade: "6", curriculum: "CBSE", subjectsNeeded: ["Mathematics"] }] },
    });
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.payload.monthlyPayable, 7500);

    const bad = call("post", "/quote", {
      body: { planType: "foundation", daysPerWeek: 3, hoursPerDay: 1.5, wards: [{ classGrade: "6" }] },
    });
    assert.equal(bad.statusCode, 400);
    assert.equal(bad.payload.errors[0].code, "UNAVAILABLE");
  });
});
