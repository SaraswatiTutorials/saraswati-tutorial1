// One person, one tutor record. Before anybody registers (the full website
// form or the short partial form) this looks for a tutor who already has the
// same phone/WhatsApp number. Email is not checked: one email can be shared.
// Registered tutors of every status count, and so does a short-form sign-up
// that hasn't become a full registration yet (once it has, the registered
// tutor stands for it).
//
// The answer only says THAT someone is registered and on what, never who:
// anybody can type a number into the form.
import Tutor from "../models/Tutor.js";
import PartialTutor from "../models/PartialTutor.js";
import { phonePattern } from "./loginMatch.js";

export const TUTOR_EXISTS = "TUTOR_EXISTS";

/**
 * @param {{ phones?: string[] }} who
 * @returns {Promise<null | { matchedOn: "phone", source: "tutor" | "partial" }>}
 */
export async function findExistingTutor({ phones = [] } = {}) {
  const last10 = [...new Set(phones.map((p) => String(p || "").replace(/\D/g, "").slice(-10)).filter((d) => d.length === 10))];
  const patterns = last10.map(phonePattern).filter(Boolean);

  if (patterns.length) {
    const byPhone = { $or: patterns.flatMap((re) => [{ phone: re }, { whatsapp: re }]) };
    if (await Tutor.findOne(byPhone, { _id: 1 }).lean()) return { matchedOn: "phone", source: "tutor" };
    const partial = await PartialTutor.findOne(
      { $or: patterns.map((re) => ({ whatsapp: re })), registeredTutorId: null },
      { _id: 1 },
    ).lean();
    if (partial) return { matchedOn: "phone", source: "partial" };
  }
  return null;
}

/** The 409 body both registration routes send, and the check endpoint mirrors. */
export function tutorExistsBody(found) {
  return {
    success: false,
    exists: true,
    code: TUTOR_EXISTS,
    matchedOn: found.matchedOn,
    source: found.source,
    message: "A tutor with this phone number is already registered.",
  };
}
