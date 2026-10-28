// Tutor and parent login lookups must match one person exactly, never a partial number
// or a regex pattern typed into the login box.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { phonePattern, tutorLoginQuery, parentPhoneQuery } from "../utils/loginMatch.js";

describe("phonePattern", () => {
  test("matches the stored number in the formats found in the database", () => {
    const pattern = phonePattern("9876543210");
    for (const stored of ["9876543210", "09876543210", "+91 98765 43210", "98765 43210", "+919876543210", "98765-43210 "]) {
      assert.ok(pattern.test(stored), stored);
    }
  });

  test("accepts the number typed with a country code or spaces", () => {
    assert.ok(phonePattern("+91 98765 43210").test("9876543210"));
  });

  test("does not match a different number that contains the same digits", () => {
    assert.equal(phonePattern("9876543210").test("98765432101"), false);
    assert.equal(phonePattern("9876543210").test("19876543219"), false);
  });

  test("refuses partial numbers", () => {
    assert.equal(phonePattern("98765"), null);
    assert.equal(phonePattern("987654321"), null);
    assert.equal(phonePattern(""), null);
  });
});

describe("tutorLoginQuery", () => {
  const matches = (query, tutor) =>
    query.$or.some((clause) => {
      const [field, pattern] = Object.entries(clause)[0];
      return tutor[field] != null && pattern.test(tutor[field]);
    });
  const tutor = { tutorCode: "TUT0218", email: "Gyan@Example.com", phone: "7892046340", whatsapp: "" };

  test("logs in by tutor code or email, ignoring case", () => {
    assert.ok(matches(tutorLoginQuery("tut0218"), tutor));
    assert.ok(matches(tutorLoginQuery(" gyan@example.com "), tutor));
  });

  test("logs in by the full phone number", () => {
    assert.ok(matches(tutorLoginQuery("+91 78920 46340"), tutor));
  });

  test("regex characters and partial values match nobody", () => {
    for (const attempt of [".*", "TUT.*", "^T", "7892", "4634", "TUT021", "gyan@example"]) {
      assert.equal(matches(tutorLoginQuery(attempt), tutor), false, attempt);
    }
  });

  test("an empty identifier gives no query", () => {
    assert.equal(tutorLoginQuery("   "), null);
  });
});

describe("parentPhoneQuery", () => {
  test("needs a full phone number", () => {
    assert.equal(parentPhoneQuery("98765"), null);
    assert.ok(parentPhoneQuery("98765 43210").phone.test("+91 98765 43210"));
  });
});
