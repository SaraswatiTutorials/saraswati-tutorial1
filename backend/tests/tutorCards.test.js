// Option cards to the parent carry no profile picture (4 Nov 2026), and every
// offered tutor gets one. WhatsApp is mocked: nothing is sent.
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

const sent = [];
before(() => {
  mock.module(new URL("../utils/whatsappService.js", import.meta.url).href, {
    namedExports: { sendWhatsAppToTutor: async (opts) => { sent.push(opts); return { success: true }; } },
  });
});
beforeEach(() => { sent.length = 0; });

const lead = { phone: "919999999999" };
const tutors = [
  { name: "Tutor A", experience: "5 years", distanceKm: 1.5, photo: "https://example.test/a.jpg" },
  { name: "Tutor B", experience: "3 years", distanceKm: 4 },               // no photo
  { name: "Tutor C", experience: "", distanceKm: null, photo: "" },        // no photo
];

test("every tutor gets a card, photo or not, and no card carries a picture", async () => {
  const { sendTutorCards } = await import("../utils/tutorOptionsMessage.js");
  const r = await sendTutorCards(lead, tutors);
  assert.equal(r.sent, 3);
  assert.equal(sent.length, 3);
  for (const s of sent) {
    assert.equal(s.headerImageUrl, undefined);
    assert.equal(s.templateName, "tutor_option_card_1");
  }
});

test("card values keep the template's {{1}}–{{4}} order", async () => {
  const { buildTutorCard } = await import("../utils/tutorOptionsMessage.js");
  const { templateVars, messageBody } = buildTutorCard(tutors[0], 1, 3);
  assert.deepEqual(Object.values(templateVars), ["1", "Tutor A", "5 years", "1.5 km"]);
  assert.match(messageBody, /^\*Tutor Option 1 of 3\*\n\n\*Tutor A\*/);
});
