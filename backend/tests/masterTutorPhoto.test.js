// A tutor's photo may only go onto their own Odoo Master Tutors record.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickOwnMasterTutor } from "../utils/odooService.js";

const records = [
  { id: 10, tutor_id: "TUT0010", mobile: "+91 98450 11111", whatsapp: "" },
  { id: 11, tutor_id: "TUT0011", mobile: "9845022222", whatsapp: "" },
  { id: 12, tutor_id: "", mobile: "9845033333", whatsapp: "" },
];

test("matches by tutor code or phone", () => {
  assert.equal(pickOwnMasterTutor(records, { tutorCode: "tut0010" }).record.id, 10);
  assert.equal(pickOwnMasterTutor(records, { phone: "919845033333" }).record.id, 12);
  assert.equal(pickOwnMasterTutor(records, { odooId: 11, tutorCode: "TUT0011", phone: "9845022222" }).record.id, 11);
});

test("a stale Odoo id pointing at someone else is refused", () => {
  const r = pickOwnMasterTutor(records, { odooId: 11, tutorCode: "TUT0099", phone: "9000000000" });
  assert.equal(r.record, null);
  assert.match(r.reason, /#11 does not match/);
});

test("code and phone pointing at two different records is refused", () => {
  const r = pickOwnMasterTutor(records, { tutorCode: "TUT0010", phone: "9845022222" });
  assert.equal(r.record, null);
});

test("a record with another tutor's code is never taken by phone alone", () => {
  const r = pickOwnMasterTutor(records, { tutorCode: "TUT0050", phone: "9845011111" });
  assert.equal(r.record, null);
});

test("renumbered code is accepted only when phone AND full name both match", () => {
  const recs = [{ id: 76, name: "Bhoomika L", tutor_id: "TUT0076", mobile: "9845076217", whatsapp: "" }];
  assert.equal(pickOwnMasterTutor(recs, { tutorCode: "TUT-050", phone: "9845076217", name: "Bhoomika  L." }).record.id, 76);
  assert.equal(pickOwnMasterTutor(recs, { tutorCode: "TUT-050", phone: "9845076217", name: "Bhoomika Rao" }).record, null);
  assert.equal(pickOwnMasterTutor(recs, { tutorCode: "TUT-050", phone: "9000000000", name: "Bhoomika L" }).record, null);
});

test("a stale id to another person's record is refused even with a name", () => {
  const recs = [{ id: 189, name: "Anurag Bharti", tutor_id: "0257", mobile: "9800009867", whatsapp: "" }];
  assert.equal(pickOwnMasterTutor(recs, { odooId: 189, tutorCode: "TUT0189", phone: "9800000299", name: "M Daniel" }).record, null);
});

test("no match, no record", () => {
  assert.equal(pickOwnMasterTutor(records, { tutorCode: "TUT0077", phone: "9000000000" }).record, null);
});
