/**
 * What a partial tutor still has to give to become a fully registered tutor,
 * and the check on what they send from the tutor portal.
 *
 * The full registration form (frontend/src/pages/TutorRegistration.jsx) asks
 * for everything below. The partial form already took their name, WhatsApp
 * number, experience, occupation and location, so those are not asked again.
 * The choices are the same as the full form's (frontend/src/data/tutorFormOptions.js).
 */

export const GENDER_OPTIONS = ["Male", "Female", "Other"];
export const TRAVEL_DISTANCE_OPTIONS = ["5 km", "10 km", "15 km", "20+ km"];
export const GRADE_OPTIONS = [
  "Class 1-5 (Primary)",
  "Class 6-8 (Middle)",
  "Class 9-10 (Secondary)",
  "Class 11-12 (Senior Secondary)",
];
export const BOARD_OPTIONS = ["CBSE", "ICSE", "IB", "IGCSE", "State Board"];
export const SUBJECT_OPTIONS = [
  "Mathematics", "Science", "Physics", "Chemistry", "Biology",
  "English", "Hindi", "Kannada", "Commerce", "Social Studies",
];
export const TIMING_OPTIONS = ["5:00 AM – 9:00 AM", "4-5 PM", "5-6 PM", "6-7 PM", "7-8 PM"];
export const OCCUPATION_OPTIONS = [
  "School Teacher", "College Lecturer", "Student", "Freelancer", "Working Professional", "Other",
];

/** Everything the full registration needs that the partial form did not ask. */
export const STILL_NEEDED = [
  { key: "email", label: "Email address" },
  { key: "gender", label: "Gender" },
  { key: "qualification", label: "Qualification" },
  { key: "grades", label: "Grades you can teach" },
  { key: "boards", label: "Boards you can teach" },
  { key: "subjects", label: "Subjects you can teach" },
  { key: "hasOccupation", label: "School, college or institute experience" },
  { key: "maxTravelDistance", label: "How far you can travel" },
  { key: "hasVehicle", label: "Vehicle" },
  { key: "timings", label: "Available timings" },
  { key: "documents", label: "Profile photo, ID proof and education certificate" },
  { key: "agreements", label: "Placement fee and attendance agreements" },
];

/** What the partial form already gave, shown in the portal and carried into the registration. */
export function knownFromPartial(p) {
  const loc = p?.location || {};
  return {
    name: p?.name || "",
    whatsapp: p?.whatsapp || "",
    experience: p?.experience || "",
    occupation: p?.occupation || "",
    city: loc.city || "",
    area: loc.area || "",
    pincode: loc.pincode || "",
    address: loc.fullAddress || [loc.houseDetails, loc.placeLabel].filter(Boolean).join(", "),
  };
}

const clip = (value, max) => String(value ?? "").trim().slice(0, max);
const isUrl = (value) => /^https?:\/\/\S+$/i.test(String(value || "").trim());
const pickList = (value, allowed) =>
  Array.isArray(value) ? [...new Set(value.filter((v) => allowed.includes(v)))] : [];

/** Checks what the portal form sends. Returns { value } or { error }. */
export function validateCompletion(body = {}) {
  const email = clip(body.email, 200);
  if (!email) return { error: "Email address is required" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address" };

  if (!GENDER_OPTIONS.includes(body.gender)) return { error: "Select your gender" };

  const qualification = clip(body.qualification, 150);
  if (qualification.length < 2) return { error: "Enter your qualification" };

  const grades = pickList(body.grades, GRADE_OPTIONS);
  if (!grades.length) return { error: "Select at least one grade" };
  const boards = pickList(body.boards, BOARD_OPTIONS);
  if (!boards.length) return { error: "Select at least one board" };
  const subjects = pickList(body.subjects, SUBJECT_OPTIONS);
  if (!subjects.length) return { error: "Select at least one subject" };

  if (!["yes", "no"].includes(body.hasOccupation)) {
    return { error: "Say whether you have worked in a school, college or institute" };
  }
  const occupation = body.hasOccupation === "yes" ? clip(body.occupation, 60) : "";
  if (body.hasOccupation === "yes" && !OCCUPATION_OPTIONS.includes(occupation)) {
    return { error: "Select your occupation" };
  }

  if (!TRAVEL_DISTANCE_OPTIONS.includes(body.maxTravelDistance)) return { error: "Select how far you can travel" };

  if (!["yes", "no"].includes(body.hasVehicle)) return { error: "Say whether you have a vehicle" };
  const vehicleNumber = body.hasVehicle === "yes" ? clip(body.vehicleNumber, 20) : "";
  if (body.hasVehicle === "yes" && !vehicleNumber) return { error: "Enter vehicle number" };

  const timings = pickList(body.timings, TIMING_OPTIONS);
  if (!timings.length) return { error: "Select at least one available timing" };

  if (!isUrl(body.photo)) return { error: "Profile photo is required" };
  if (!isUrl(body.idProof)) return { error: "ID Proof is required" };
  if (!isUrl(body.expCert)) return { error: "Education Certificate is required" };
  const otherDoc = isUrl(body.otherDoc) ? String(body.otherDoc).trim() : "";

  if (body.agreement !== true) return { error: "You must agree to the placement fee terms" };
  if (body.attendanceAgreement !== true) return { error: "You must agree to the attendance marking guidelines" };

  return {
    value: {
      email, gender: body.gender, qualification, grades, boards, subjects,
      hasOccupation: body.hasOccupation, occupation, organization: clip(body.organization, 150),
      maxTravelDistance: body.maxTravelDistance, hasVehicle: body.hasVehicle, vehicleNumber, timings,
      photo: String(body.photo).trim(), idProof: String(body.idProof).trim(), expCert: String(body.expCert).trim(), otherDoc,
      agreement: true, attendanceAgreement: true,
    },
  };
}

/**
 * The full registration, built from the partial form and what the portal sent.
 * Always "pending": like any registration, it waits for an admin's approval.
 */
export function registrationFromPartial(p, v) {
  const loc = p.location || {};
  const occupation = v.hasOccupation === "yes" ? v.occupation : (p.occupation || "");
  return {
    name: p.name,
    phone: p.whatsapp,
    whatsapp: p.whatsapp,
    email: v.email,
    gender: v.gender,
    experience: p.experience || "",
    qualification: v.qualification,
    occupation,
    hasOccupation: v.hasOccupation,
    organization: v.organization,
    grades: v.grades,
    boards: v.boards,
    subjects: v.subjects,
    timings: v.timings,
    maxTravelDistance: v.maxTravelDistance,
    hasVehicle: v.hasVehicle,
    vehicleNumber: v.vehicleNumber,
    city: loc.city || "",
    area: loc.area || "",
    pincode: loc.pincode || "",
    fullAddress: loc.fullAddress || [loc.houseDetails, loc.placeLabel].filter(Boolean).join(", "),
    placeLabel: loc.placeLabel || "",
    houseDetails: loc.houseDetails || "",
    latitude: loc.latitude ?? null,
    longitude: loc.longitude ?? null,
    locations: loc.area ? [`${loc.area}${loc.city ? `, ${loc.city}` : ""}`] : [],
    photo: v.photo,
    documents: { idProof: v.idProof, expCert: v.expCert, otherDoc: v.otherDoc },
    agreement: true,
    attendanceAgreement: true,
    status: "pending",
    fromPartialTutorId: p._id,
  };
}
