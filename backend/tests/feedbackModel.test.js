// The real Feedback schema (validated without a database connection) must accept
// what the feedback route saves, and the frontend's issue types must match its list.
import { test } from "node:test";
import assert from "node:assert/strict";
import Feedback, { FEEDBACK_SOURCES, FEEDBACK_CATEGORIES } from "../models/Feedback.js";

test("every form and issue type the route allows is accepted by the schema", () => {
  for (const source of FEEDBACK_SOURCES) {
    for (const category of FEEDBACK_CATEGORIES) {
      const doc = new Feedback({ source, category, message: "Something broke", step: 2 });
      assert.equal(doc.validateSync(), undefined, `${source} / ${category}`);
    }
  }
});

test("the schema refuses a missing message or unknown form/issue type", () => {
  assert.ok(new Feedback({ source: "parent-enquiry", category: "error" }).validateSync()?.errors.message);
  assert.ok(new Feedback({ source: "homepage", category: "error", message: "x" }).validateSync()?.errors.source);
  assert.ok(new Feedback({ source: "parent-enquiry", category: "spam", message: "x" }).validateSync()?.errors.category);
});

test("the frontend offers only issue types the backend accepts, with a label for each", async () => {
  const url = new URL("../../frontend/src/data/feedbackConfig.js", import.meta.url);
  const config = await import(url.href);
  assert.deepEqual(Object.keys(config.FEEDBACK_CATEGORY_LABELS).sort(), [...FEEDBACK_CATEGORIES].sort());
  assert.deepEqual(Object.keys(config.FEEDBACK_CATEGORIES_BY_SOURCE).sort(), [...FEEDBACK_SOURCES].sort());
  for (const keys of Object.values(config.FEEDBACK_CATEGORIES_BY_SOURCE)) {
    for (const key of keys) assert.ok(FEEDBACK_CATEGORIES.includes(key), key);
  }
});
