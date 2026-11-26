// Tutor cards to the parent: the "Tutor Profile Card v2" template with the
// tutor's profile photo as the header (sent by the code), "Tutor Option n of
// total" at the top, the details laid out like the office's card with a blank
// line between them, and every tutor gets one. A student is shown as "Tutor".
// WhatsApp is mocked: nothing is sent.
import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

const sent = [];
let approved = (names) => names[0];
const brokenPhotos = new Set(); // header pictures the mocked WhatsApp refuses
before(() => {
  mock.module(new URL("../utils/whatsappService.js", import.meta.url).href, {
    namedExports: {
      sendWhatsAppToTutor: async (opts) => {
        sent.push(opts);
        return brokenPhotos.has(opts.headerImageUrl)
          ? { success: false, failureReason: "Unknown Error" }
          : { success: true };
      },
      firstApprovedTemplate: async (names) => approved(names),
    },
  });
});
beforeEach(() => { sent.length = 0; approved = (names) => names[0]; brokenPhotos.clear(); });

const lead = { phone: "919999999999" };
const tutors = [
  { name: "Tutor A", experience: "5 years", distanceKm: 1.5, photo: "https://example.test/a.jpg" },
  { name: "Tutor B", experience: "3 years", distanceKm: 4 },               // no photo
  { name: "Tutor C", experience: "", distanceKm: null, photo: "" },        // no photo
];
const noProfiles = { loadProfiles: async () => new Map() };

const niraj = {
  name: "Niraj Kumar Singh", qualification: "Graduated", experience: "15yrs",
  subjects: ["Maths", "English", "Science", "Hindi", "Computer"], area: "Marathahalli",
  hasVehicle: "yes", vehicleNumber: "KA50EB8431", occupation: "Lead Engineer in MNC",
  languages: ["English"], photo: "https://example.test/niraj.jpg",
};

test("every tutor gets a v2 card: photo (else logo) and Tutor Option 1/2/3 of 3", async () => {
  const { sendTutorCards, DEFAULT_CARD_PHOTO } = await import("../utils/tutorOptionsMessage.js");
  const r = await sendTutorCards(lead, tutors, noProfiles);
  assert.equal(r.sent, 3);
  assert.equal(r.templateName, "tutor_profile_card_v2");
  assert.deepEqual(sent.map((s) => s.headerImageUrl), ["https://example.test/a.jpg", DEFAULT_CARD_PHOTO, DEFAULT_CARD_PHOTO]);
  assert.deepEqual(sent.map((s) => [s.templateVars["{{1}}"], s.templateVars["{{2}}"]]), [["1", "3"], ["2", "3"], ["3", "3"]]);
  for (const s of sent) {
    assert.equal(s.templateName, "tutor_profile_card_v2");
    assert.equal(s.forceTemplate, true);
  }
});

test("v2 card: {{1}}/{{2}} option number, {{3}}–{{10}} the details, spaced out", async () => {
  const { buildTutorCard } = await import("../utils/tutorOptionsMessage.js");
  const { templateVars, messageBody, headerImageUrl } = buildTutorCard(niraj, 2, 3);
  assert.deepEqual(templateVars, {
    "{{1}}": "2",
    "{{2}}": "3",
    "{{3}}": "Niraj Kumar Singh",
    "{{4}}": "Graduated",
    "{{5}}": "15yrs",
    "{{6}}": "Maths, English, Science, Hindi, Computer",
    "{{7}}": "Marathahalli",
    "{{8}}": "Yes (KA50EB8431)",
    "{{9}}": "Lead Engineer in MNC",
    "{{10}}": "English",
  });
  assert.equal(headerImageUrl, "https://example.test/niraj.jpg");
  assert.match(messageBody, /^\*Tutor Option 2 of 3\*\n\nDear Parent,/);
  assert.match(messageBody, /Full Name: Niraj Kumar Singh\n\nQualification: Graduated\n\n\*Teaching Experience: 15yrs\*\n\n/);
  assert.match(messageBody, /This tutor has been shortlisted for your registered tuition requirement/);
  for (const v of Object.values(templateVars)) assert.ok(!v.includes("\n"));
});

test("while v2 awaits Meta, the approved v1 card fills its eight {{1}}–{{8}}", async () => {
  approved = (names) => names[1];
  const { sendTutorCards } = await import("../utils/tutorOptionsMessage.js");
  const r = await sendTutorCards(lead, [niraj], noProfiles);
  assert.equal(r.templateName, "tutor_profile_card");
  assert.equal(Object.keys(sent[0].templateVars).length, 8);
  assert.equal(sent[0].templateVars["{{1}}"], "Niraj Kumar Singh");
  assert.equal(sent[0].templateVars["{{6}}"], "Yes (KA50EB8431)");
  assert.equal(sent[0].templateVars["{{8}}"], "English");
});

test("a student is shown as Tutor", async () => {
  const { buildTutorCard, displayOccupation } = await import("../utils/tutorOptionsMessage.js");
  assert.equal(displayOccupation("Student"), "Tutor");
  assert.equal(displayOccupation("college student"), "Tutor");
  assert.equal(displayOccupation("School Teacher"), "School Teacher");
  const { templateVars, messageBody } = buildTutorCard({ name: "Asha", occupation: "Student" }, 1, 1);
  assert.equal(templateVars["{{9}}"], "Tutor");
  assert.doesNotMatch(messageBody, /Student/);
});

test("if neither profile card were approved, Tutor Option Card2 (if restored) goes instead", async () => {
  approved = (names) => names[2];
  const { sendTutorCards } = await import("../utils/tutorOptionsMessage.js");
  const r = await sendTutorCards(lead, [{ ...niraj, distanceKm: 2, occupation: "Student" }], noProfiles);
  assert.equal(r.templateName, "tutor_option_card2");
  assert.equal(sent[0].headerImageUrl, "https://example.test/niraj.jpg");
  assert.deepEqual(Object.keys(sent[0].templateVars), ["position", "tutor_details", "experience", "distance"]);
  assert.match(sent[0].templateVars.tutor_details, /Occupation: Tutor/);
  assert.equal(sent[0].templateVars.distance, "2 km");
});

test("stored profile fills what the caller left out", async () => {
  const { sendTutorCards } = await import("../utils/tutorOptionsMessage.js");
  await sendTutorCards(lead, [{ name: "Tutor A", tutorCode: "TUT0001", distanceKm: 3 }], {
    loadProfiles: async () => new Map([["TUT0001", { qualification: "M.Sc", occupation: "Student", photo: "https://example.test/p.jpg" }]]),
  });
  assert.equal(sent[0].headerImageUrl, "https://example.test/p.jpg");
  assert.equal(sent[0].templateVars["{{3}}"], "Tutor A");
  assert.equal(sent[0].templateVars["{{4}}"], "M.Sc");
  assert.equal(sent[0].templateVars["{{9}}"], "Tutor");
});

test("header photo: JPG/PNG as is, WEBP asked for as JPG, a PDF or nothing gets the logo", async () => {
  const { cardPhotoUrl, DEFAULT_CARD_PHOTO } = await import("../utils/tutorOptionsMessage.js");
  assert.equal(cardPhotoUrl("https://res.cloudinary.com/x/image/upload/v1/a.jpg"), "https://res.cloudinary.com/x/image/upload/v1/a.jpg");
  assert.equal(cardPhotoUrl("https://res.cloudinary.com/x/image/upload/v1/a.png"), "https://res.cloudinary.com/x/image/upload/v1/a.png");
  assert.equal(cardPhotoUrl("https://res.cloudinary.com/x/image/upload/v1/a.webp"), "https://res.cloudinary.com/x/image/upload/f_jpg/v1/a.jpg");
  assert.equal(cardPhotoUrl("https://res.cloudinary.com/x/image/upload/v1/id.pdf"), DEFAULT_CARD_PHOTO);
  assert.equal(cardPhotoUrl(""), DEFAULT_CARD_PHOTO);
});

test("if the tutor's photo is refused, the card still goes with the logo", async () => {
  const { sendTutorCards, DEFAULT_CARD_PHOTO } = await import("../utils/tutorOptionsMessage.js");
  brokenPhotos.add("https://broken.test/p.jpg");
  const r = await sendTutorCards(lead, [{ name: "Tutor P", photo: "https://broken.test/p.jpg" }], noProfiles);
  assert.equal(sent.length, 2);
  assert.equal(sent[0].headerImageUrl, "https://broken.test/p.jpg");
  assert.equal(sent[1].headerImageUrl, DEFAULT_CARD_PHOTO);
  assert.equal(r.sent, 1);
  assert.equal(r.results[0].photo, false);
});

test("location: area, else the first three places without the city repeated", async () => {
  const { tutorDetails } = await import("../utils/tutorOptionsMessage.js");
  assert.equal(tutorDetails({ area: "Marathahalli", locations: ["X, Bangalore"] }).Location, "Marathahalli");
  assert.equal(tutorDetails({ locations: ["Brookefield, Bangalore", "Kundalahalli, Bangalore", "AECS Layout, Bangalore", "Whitefield, Bangalore"] }).Location,
    "Brookefield, Kundalahalli, AECS Layout");
  assert.equal(tutorDetails({ locations: [], city: "Bangalore" }).Location, "Bangalore");
});

test("vehicle on the card: 'Yes (number)' with a vehicle, otherwise 'Paid'", async () => {
  const { buildTutorCard, vehicleOf } = await import("../utils/tutorOptionsMessage.js");
  assert.equal(vehicleOf({ hasVehicle: "yes", vehicleNumber: "KA50EB8431" }), "Yes (KA50EB8431)");
  assert.equal(vehicleOf({ hasVehicle: "no" }), "Paid");
  assert.equal(vehicleOf({ hasVehicle: "yes", vehicleNumber: "" }), "Paid", "no vehicle number on file");
  assert.equal(vehicleOf({}), "Paid", "not filled in");
  const { templateVars, messageBody } = buildTutorCard({ ...niraj, hasVehicle: "no", vehicleNumber: "" }, 1, 3);
  assert.equal(templateVars["{{8}}"], "Paid");
  assert.match(messageBody, /Vehicle: Paid/);
});
