/**
 * A tutor who can log in to the tutor portal: a registered tutor (tutors
 * collection), or a partial tutor (the short sign-up form). Partial tutors
 * picked in Panel 2 are assigned to students by their partial-form record's
 * id, so a token carrying that id sees exactly their own students.
 */
import mongoose from "mongoose";
import Tutor from "../models/Tutor.js";
import PartialTutor from "../models/PartialTutor.js";
import { phonePattern } from "./loginMatch.js";

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A partial tutor logs in with their tutor ID or their full WhatsApp number. */
export function partialTutorLoginQuery(identifier) {
  const clean = String(identifier || "").trim();
  if (!clean) return null;
  const or = [{ tutorCode: new RegExp(`^${escapeRegex(clean)}$`, "i") }];
  const phone = /^[\d\s+\-().]+$/.test(clean) ? phonePattern(clean) : null;
  if (phone) or.push({ whatsapp: phone });
  return { $or: or };
}

/** The newest partial-form entry for this ID or number, or null. */
export async function findPartialTutorForLogin(identifier) {
  const query = partialTutorLoginQuery(identifier);
  if (!query) return null;
  return PartialTutor.findOne(query).sort({ createdAt: -1 });
}

/** The same shape as a Tutor where the portal reads it; `doc` is the record itself. */
export function partialAccount(p) {
  return {
    _id: p._id,
    name: p.name || "",
    tutorCode: p.tutorCode || "",
    email: "",
    phone: p.whatsapp || "",
    whatsapp: p.whatsapp || "",
    photo: p.photo || "",
    isPartial: true,
    doc: p,
  };
}

/** A registered tutor, or a partial tutor as partialAccount(), by id. */
export async function findTutorAccount(id) {
  if (!id) return null;
  const tutor = await Tutor.findById(id);
  if (tutor) return tutor;
  if (!mongoose.isValidObjectId(String(id))) return null;
  const partial = await PartialTutor.findById(id);
  return partial ? partialAccount(partial) : null;
}
