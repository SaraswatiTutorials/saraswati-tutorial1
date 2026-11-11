/**
 * Saving a full tutor registration: the Odoo master_tutors record, then the
 * tutors collection, then clearing their saved draft. Used by the website's
 * registration form (POST /api/tutors) and by a partial tutor completing
 * their profile from the tutor portal, so both do exactly the same thing.
 * Moved here from routes/tutorRoutes.js unchanged.
 */
import Tutor from "../models/Tutor.js";
import TutorRegistrationDraft from "../models/TutorRegistrationDraft.js";
import { upsertMasterTutor } from "./odooService.js";
import { partialTutorCodes, registeredTutorCodes, existingCodeForPhone } from "./tutorCodes.js";

export function toCoordinate(value) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * For a new Odoo tutor record: the partial tutors' IDs to skip, and the ID
 * this person already has from the partial form, if any. Never stops a
 * registration: on any error it simply asks for nothing.
 */
export async function tutorCodeOptions(phone) {
  try {
    // A new Odoo code must not be one any tutor already has, in Odoo or here
    const [partialCodes, registeredCodes, preferredCode] = await Promise.all([
      partialTutorCodes(),
      registeredTutorCodes(),
      existingCodeForPhone(phone),
    ]);
    return { reservedCodes: [...partialCodes, ...registeredCodes], preferredCode };
  } catch (err) {
    console.warn("[TutorCode] Could not read partial tutor IDs:", err.message);
    return {};
  }
}

/**
 * Saves a registration whose phone and email have already been checked.
 * `preferredCode` overrides the tutor ID looked up by phone (a partial tutor
 * completing their profile keeps their own entry's ID). Returns the tutor.
 */
export async function registerTutor(body, { preferredCode } = {}) {
  const phone = body.phone;

  let odooRes = null;
  let odooSyncStatus = "pending";
  let odooSyncError = "";
  const codeOptions = await tutorCodeOptions(phone);
  if (preferredCode) codeOptions.preferredCode = preferredCode;
  try {
    odooRes = await upsertMasterTutor(body, codeOptions);
    if (odooRes && (odooRes.id || typeof odooRes === "number")) {
      odooSyncStatus = "synced";
    } else {
      odooSyncStatus = "failed";
      odooSyncError = "Odoo returned no tutor ID";
    }
  } catch (err) {
    console.error("[Odoo Error in upsertMasterTutor]:", err.message);
    odooSyncStatus = "failed";
    odooSyncError = err.message || "Odoo master tutor sync failed";
  }

  const hasVehicle = body.hasVehicle === "yes" ? "yes" : "no";
  const hasOccupation = body.hasOccupation === "yes" ? "yes" : "no";

  // Check for duplicate in MongoDB by phone number
  let tutor = await Tutor.findOne({ phone: phone.trim() });

  // Same mobile number written differently (+91, spaces, leading 0) is still the same tutor
  if (!tutor) {
    const phoneDigits = String(phone).replace(/\D/g, "");
    if (phoneDigits.length >= 10) {
      tutor = await Tutor.findOne({ phone: { $regex: `${phoneDigits.slice(-10)}$` } });
    }
  }

  // Explicitly extract all matching fields to ensure they are never lost during spread
  const tutorData = {
    ...body,
    hasVehicle,
    hasOccupation,
    odooLeadId: odooRes ? odooRes.id : (tutor ? tutor.odooLeadId : null),
    // If Odoo is down, a partial tutor still keeps the ID they already have
    tutorCode: odooRes ? odooRes.tutorCode : ((tutor && tutor.tutorCode) || codeOptions.preferredCode || null),
    odooSyncStatus,
    odooSyncError,
    // Matching fields — explicitly set so Mongoose strict mode never drops them
    gender: body.gender || "",
    dob: body.dob || "",
    whatsapp: body.whatsapp || body.phone || "",
    city: body.city || "",
    area: body.area || "",
    fullAddress: body.fullAddress || "",
    pincode: body.pincode || "",
    latitude: toCoordinate(body.latitude),
    longitude: toCoordinate(body.longitude),
    grades: Array.isArray(body.grades) ? body.grades : [],
    boards: Array.isArray(body.boards) ? body.boards : [],
    subjects: Array.isArray(body.subjects) ? body.subjects : [],
    timings: Array.isArray(body.timings) ? body.timings : [],
    locations: Array.isArray(body.locations) && body.locations.length
      ? body.locations
      : (body.area ? [body.area] : []),
    maxTravelDistance: body.maxTravelDistance || "",
  };

  if (tutor) {
    console.log(`[MongoDB] Tutor with phone ${phone} already exists. Updating existing record...`);
    tutor = await Tutor.findByIdAndUpdate(tutor._id, tutorData, { new: true, runValidators: true });
  } else {
    console.log(`[MongoDB] Creating new tutor record with phone ${phone}...`);
    tutor = new Tutor(tutorData);
    await tutor.save();
  }

  // Auto-delete matching draft on successful registration
  try {
    await TutorRegistrationDraft.deleteOne({ phone: phone.trim() });
    console.log(`[TutorDraft] Draft auto-deleted for phone ${phone} after registration.`);
  } catch (draftErr) {
    console.warn("[TutorDraft] Could not delete draft after registration:", draftErr.message);
  }

  return tutor;
}
