// End-to-end checks of the pricing endpoints through a real Express app on a
// random loopback port, wired like server.js (express.json → router → error handler).
// No database is involved: the pricing router imports only the fee engine.
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";

import pricingRoutes, { pricingErrorHandler } from "../../routes/pricingRoutes.js";

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/pricing", pricingRoutes);
  app.use("/api/pricing", pricingErrorHandler);
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api/pricing`;
});

after(() => new Promise((resolve) => server.close(resolve)));

const post = async (path, body, raw = false) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ? body : JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
};
const get = async (query) => {
  const res = await fetch(`${baseUrl}/options?${query}`);
  return { status: res.status, text: await res.text() };
};

// Nothing internal may leak: no stack frames, exception names or JS error text.
const assertSafe = (text) => {
  assert.doesNotMatch(text, /\bat \S+ \(|TypeError|SyntaxError|ReferenceError|Cannot read|stack|node_modules|\.js:\d+/);
};

const quoteBody = (overrides = {}) => ({
  planType: "advance",
  daysPerWeek: 3,
  hoursPerDay: 1.5,
  preferredMode: "Home Tuition / In-Person",
  wards: [{ studentName: "A", classGrade: "6", curriculum: "CBSE", subjectsNeeded: ["Mathematics"] }],
  ...overrides,
});

describe("valid requests still work", () => {
  test("POST /quote returns the monthly quote", async () => {
    const r = await post("/quote", quoteBody());
    assert.equal(r.status, 200);
    assert.equal(JSON.parse(r.text).monthlyPayable, 6750);
  });

  test("numeric strings for days and hours are accepted", async () => {
    const r = await post("/quote", quoteBody({ daysPerWeek: "3", hoursPerDay: "1.5" }));
    assert.equal(r.status, 200);
  });

  test("GET /options and POST /options return plans", async () => {
    assert.equal((await get("classGrade=9&curriculum=CBSE")).status, 200);
    assert.equal((await post("/options", { wards: [{ classGrade: "9" }] })).status, 200);
  });
});

describe("malformed requests get HTTP 400 with a generic message", () => {
  const cases = [
    ["malformed JSON body", "/quote", '{"planType": "advance", ', true],
    ["JSON array body", "/quote", [], false],
    ["JSON string body", "/options", '"hello"', true],
    ["null student", "/quote", quoteBody({ wards: [null] })],
    ["null student (options)", "/options", { wards: [null] }],
    ["number student", "/options", { wards: [5] }],
    ["array student", "/quote", quoteBody({ wards: [["6"]] })],
    ["wards not a list", "/quote", quoteBody({ wards: "x" })],
    ["empty wards", "/options", { wards: [] }],
    ["missing wards", "/quote", quoteBody({ wards: undefined })],
    ["class as number", "/quote", quoteBody({ wards: [{ classGrade: 6 }] })],
    ["class as object", "/options", { wards: [{ classGrade: { $gt: "" } }] }],
    ["curriculum as array", "/quote", quoteBody({ wards: [{ classGrade: "6", curriculum: ["CBSE"] }] })],
    ["subjects as string", "/quote", quoteBody({ wards: [{ classGrade: "6", subjectsNeeded: "Maths" }] })],
    ["subjects with non-strings", "/quote", quoteBody({ wards: [{ classGrade: "6", subjectsNeeded: [1, {}] }] })],
    ["planType as object", "/quote", quoteBody({ planType: { a: 1 } })],
    ["hours as boolean", "/quote", quoteBody({ hoursPerDay: true })],
    ["hours as array", "/quote", quoteBody({ hoursPerDay: [1.5] })],
    ["days as null", "/quote", quoteBody({ daysPerWeek: null })],
    ["preferredMode as number", "/quote", quoteBody({ preferredMode: 1 })],
  ];
  for (const [label, path, body, raw] of cases) {
    test(label, async () => {
      const r = await post(path, body, raw);
      assert.equal(r.status, 400, r.text);
      assert.equal(JSON.parse(r.text).message, "Invalid pricing request.");
      assertSafe(r.text);
    });
  }

  test("GET /options with a repeated (array) class parameter", async () => {
    const r = await get("classGrade=6&classGrade=9");
    assert.equal(r.status, 400);
    assertSafe(r.text);
  });

  test("GET /options without a class", async () => {
    const r = await get("curriculum=CBSE");
    assert.equal(r.status, 400);
    assertSafe(r.text);
  });
});

describe("well-formed but unpriceable requests get HTTP 400 with engine messages only", () => {
  for (const [label, overrides, code] of [
    ["off-grid hours 1.46", { hoursPerDay: 1.46 }, "INVALID_SCHEDULE"],
    ["unsupported 4 days", { daysPerWeek: 4 }, "INVALID_SCHEDULE"],
    ["Foundation for Class 6", { planType: "foundation" }, "UNAVAILABLE"],
    ["Advance 3×1 for Class 11", {
      hoursPerDay: 1,
      wards: [{ studentName: "A", classGrade: "11", curriculum: "CBSE", subjectsNeeded: ["Mathematics"] }],
    }, "UNAVAILABLE"],
    ["unknown plan", { planType: "platinum" }, "UNKNOWN_PLAN"],
  ]) {
    test(label, async () => {
      const r = await post("/quote", quoteBody(overrides));
      assert.equal(r.status, 400);
      const body = JSON.parse(r.text);
      assert.equal(body.errors[0].code, code);
      for (const key of Object.keys(body.errors[0])) {
        assert.ok(["code", "message", "studentIndex"].includes(key), `unexpected key ${key}`);
      }
      assertSafe(r.text);
    });
  }
});

describe("error handler", () => {
  const run = (err) => {
    const res = {
      headersSent: false, statusCode: 200, payload: null,
      status(c) { this.statusCode = c; return this; },
      json(d) { this.payload = d; return this; },
    };
    const original = console.error;
    console.error = () => {};
    try {
      pricingErrorHandler(err, {}, res, () => {});
    } finally {
      console.error = original;
    }
    return res;
  };

  test("unexpected errors become a generic 500 without details", () => {
    const res = run(new Error("secret internal detail at /srv/app.js:12"));
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.payload, { message: "Pricing is temporarily unavailable." });
  });

  test("oversized bodies keep their 4xx status with a generic message", () => {
    const res = run(Object.assign(new Error("request entity too large"), { status: 413, type: "entity.too.large" }));
    assert.equal(res.statusCode, 413);
    assert.deepEqual(res.payload, { message: "Invalid pricing request." });
  });
});
