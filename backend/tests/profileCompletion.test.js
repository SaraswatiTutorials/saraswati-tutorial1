// What a partial tutor must add in the portal to become a registered tutor.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STILL_NEEDED, knownFromPartial, validateCompletion, registrationFromPartial,
} from "../utils/profileCompletion.js";

const good = () => ({
  email: " priya@example.test ", gender: "Female", qualification: "M.Sc Physics",
  grades: ["Class 9-10 (Secondary)", "Not a grade"], boards: ["CBSE", "CBSE"], subjects: ["Physics"],
  hasOccupation: "yes", occupation: "School Teacher", organization: "DPS",
  maxTravelDistance: "10 km", hasVehicle: "yes", vehicleNumber: "KA01AB1234", timings: ["5-6 PM"],
  photo: "https://res.cloudinary.test/p.jpg", idProof: "https://res.cloudinary.test/id.pdf", expCert: "https://res.cloudinary.test/c.pdf",
  agreement: true, attendanceAgreement: true,
});

const partial = {
  _id: "65f0000000000000000000a1", name: "Priya Rao", whatsapp: "9876543210",
  experience: "3 year", occupation: "Student", tutorCode: "TUT0250",
  location: { city: "Bangalore", area: "Koramangala", pincode: "560034", latitude: 12.93, longitude: 77.62,
    houseDetails: "Flat 4B", placeLabel: "Koramangala, Bengaluru", fullAddress: "" },
};

test("asks only what the short form did not", () => {
  const keys = STILL_NEEDED.map((n) => n.key);
  for (const k of ["name", "whatsapp", "phone", "experience", "location", "city"]) assert.ok(!keys.includes(k), k);
  for (const k of ["email", "gender", "qualification", "grades", "boards", "subjects", "timings", "documents", "agreements"]) assert.ok(keys.includes(k), k);
});

test("what the short form gave is shown back", () => {
  assert.deepEqual(knownFromPartial(partial), {
    name: "Priya Rao", whatsapp: "9876543210", experience: "3 year", occupation: "Student",
    city: "Bangalore", area: "Koramangala", pincode: "560034", address: "Flat 4B, Koramangala, Bengaluru",
  });
});

test("a complete form is accepted and cleaned", () => {
  const { value, error } = validateCompletion(good());
  assert.equal(error, undefined);
  assert.equal(value.email, "priya@example.test");
  assert.deepEqual(value.grades, ["Class 9-10 (Secondary)"]); // unknown choices dropped
  assert.deepEqual(value.boards, ["CBSE"]); // repeats dropped
});

test("each missing piece is named, the same way the full form names it", () => {
  const cases = [
    [{ email: "" }, "Email address is required"],
    [{ email: "nope" }, "Enter a valid email address"],
    [{ gender: "" }, "Select your gender"],
    [{ qualification: " " }, "Enter your qualification"],
    [{ grades: [] }, "Select at least one grade"],
    [{ boards: ["Nope"] }, "Select at least one board"],
    [{ subjects: [] }, "Select at least one subject"],
    [{ hasOccupation: "" }, "Say whether you have worked in a school, college or institute"],
    [{ occupation: "" }, "Select your occupation"],
    [{ maxTravelDistance: "100 km" }, "Select how far you can travel"],
    [{ hasVehicle: "maybe" }, "Say whether you have a vehicle"],
    [{ vehicleNumber: "" }, "Enter vehicle number"],
    [{ timings: [] }, "Select at least one available timing"],
    [{ photo: "" }, "Profile photo is required"],
    [{ idProof: "not a link" }, "ID Proof is required"],
    [{ expCert: "" }, "Education Certificate is required"],
    [{ agreement: false }, "You must agree to the placement fee terms"],
    [{ attendanceAgreement: "true" }, "You must agree to the attendance marking guidelines"],
  ];
  for (const [change, message] of cases) assert.equal(validateCompletion({ ...good(), ...change }).error, message, JSON.stringify(change));
});

test("no occupation or vehicle: those details are not needed", () => {
  const { value } = validateCompletion({ ...good(), hasOccupation: "no", occupation: "", hasVehicle: "no", vehicleNumber: "" });
  assert.equal(value.occupation, "");
  assert.equal(value.vehicleNumber, "");
});

test("the registration keeps the short form's details and is always pending", () => {
  const { value } = validateCompletion({ ...good(), status: "approved" });
  const reg = registrationFromPartial(partial, value);
  assert.equal(reg.status, "pending");
  assert.equal(reg.phone, "9876543210");
  assert.equal(reg.whatsapp, "9876543210");
  assert.equal(reg.name, "Priya Rao");
  assert.equal(reg.experience, "3 year");
  assert.equal(reg.occupation, "School Teacher"); // what they said now
  assert.equal(reg.latitude, 12.93);
  assert.deepEqual(reg.locations, ["Koramangala, Bangalore"]);
  assert.deepEqual(reg.documents, { idProof: "https://res.cloudinary.test/id.pdf", expCert: "https://res.cloudinary.test/c.pdf", otherDoc: "" });
  assert.equal(reg.fromPartialTutorId, partial._id);
  const noJob = registrationFromPartial(partial, validateCompletion({ ...good(), hasOccupation: "no" }).value);
  assert.equal(noJob.occupation, "Student"); // the short form's answer stays
});
