// Which MongoDB tutor an Odoo record updates. In-memory tutors; no database, no Odoo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchOdooTutor } from "../utils/odooTutorMatch.js";

// The TUT0192 case: three people were given the same code
const tutors = [
  { _id: "meghha", tutorCode: "TUT0192", phone: "9886492516", whatsapp: "9886492516" },
  { _id: "yashaswini", tutorCode: "TUT0192", phone: "9113582304", whatsapp: "" },
  { _id: "third", tutorCode: "TUT0192", phone: "9035401279", whatsapp: "9035401279" },
  { _id: "solo", tutorCode: "TUT0300", phone: "9000000001", whatsapp: "" },
  { _id: "nocode", tutorCode: "", phone: "+91 90000 00002", whatsapp: "" },
  { _id: "twinA", tutorCode: "", phone: "9000000003", whatsapp: "" },
  { _id: "twinB", tutorCode: "", phone: "9000000004", whatsapp: "9000000003" },
];

const matches = (t, q) => {
  if (q.tutorCode) return t.tutorCode === q.tutorCode;
  if (q.$or) return q.$or.some((c) => Object.entries(c).every(([k, re]) => typeof t[k] === "string" && re.test(t[k])));
  return false;
};
const deps = (odooCount) => ({
  findTutors: async (q) => tutors.filter((t) => matches(t, q)),
  countOdooCode: odooCount === undefined ? undefined : async () => odooCount,
});

test("a shared code: only the tutor with the same number is updated", async () => {
  assert.deepEqual(await matchOdooTutor({ tutor_id: "TUT0192", mobile: "9886492516" }, deps()), { id: "meghha" });
  assert.deepEqual(await matchOdooTutor({ tutor_id: "TUT0192", mobile: "+91 91135 82304" }, deps()), { id: "yashaswini" });
  assert.deepEqual(await matchOdooTutor({ tutor_id: "TUT0192", mobile: "", whatsapp: "9035401279" }, deps()), { id: "third" });
});

test("a shared code with no matching number is skipped, never guessed", async () => {
  const r = await matchOdooTutor({ tutor_id: "TUT0192", mobile: "9999999999" }, deps());
  assert.equal(r.id, undefined);
  assert.match(r.skip, /3 tutors share code TUT0192/);
  assert.match((await matchOdooTutor({ tutor_id: "TUT0192" }, deps())).skip, /no number/);
});

test("a unique code with the same number is updated", async () => {
  assert.deepEqual(await matchOdooTutor({ tutor_id: "TUT0300", mobile: "9000000001" }, deps()), { id: "solo" });
  assert.deepEqual(await matchOdooTutor({ tutor_id: "TUT0300" }, deps()), { id: "solo" }); // Odoo has no number
});

test("a unique code but a different number: updated only if Odoo holds that code once", async () => {
  assert.deepEqual(await matchOdooTutor({ tutor_id: "TUT0300", mobile: "9888888888" }, deps(1)), { id: "solo" }); // number changed in Odoo
  assert.match((await matchOdooTutor({ tutor_id: "TUT0300", mobile: "9888888888" }, deps(2))).skip, /held by 2 Odoo records/);
  assert.match((await matchOdooTutor({ tutor_id: "TUT0300", mobile: "9888888888" }, deps())).skip, /couldn't be asked/);
});

test("a code nobody has: no match", async () => {
  assert.deepEqual(await matchOdooTutor({ tutor_id: "TUT0999", mobile: "9000000001" }, deps()), {});
});

test("no code: matched by number, written any way", async () => {
  assert.deepEqual(await matchOdooTutor({ mobile: "9000000002" }, deps()), { id: "nocode" });
});

test("no code and the number is on two tutors: skipped", async () => {
  assert.match((await matchOdooTutor({ mobile: "9000000003" }, deps())).skip, /2 tutors have number/);
});

test("nothing to go on: no match", async () => {
  assert.deepEqual(await matchOdooTutor({}, deps()), {});
  assert.deepEqual(await matchOdooTutor({ mobile: "123" }, deps()), {});
});
