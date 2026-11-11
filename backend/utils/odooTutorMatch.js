// Which MongoDB tutor an Odoo tutor record is, for the Odoo → MongoDB syncs.
//
// The syncs copy Odoo's name, email, experience, areas and timings onto the
// tutor they match. Matching on the tutor code alone went wrong once several
// tutors had been given the same code (Odoo used to number new tutors as
// "count + 1", which re-used codes after deletions): the sync kept writing one
// person's details over another's. So a record is only applied when the code
// AND the mobile/WhatsApp number agree, or when there is no doubt at all.
// Anything doubtful is skipped and reported, never guessed.
import { phonePattern } from "./loginMatch.js";

const last10 = (v) => {
  const d = String(v || "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : "";
};

/**
 * @param {{ tutor_id?: string, mobile?: string, whatsapp?: string }} ot  the Odoo record
 * @param {{
 *   findTutors: (query: object) => Promise<Array<{_id:any, phone?:string, whatsapp?:string}>>,
 *   countOdooCode?: (code: string) => Promise<number>,
 * }} deps
 * @returns {Promise<{ id?: any, skip?: string }>}  `id` to update, `skip` with the reason,
 *   or neither when no MongoDB tutor matches.
 */
export async function matchOdooTutor(ot, { findTutors, countOdooCode } = {}) {
  const code = String(ot?.tutor_id || "").trim();
  const numbers = [...new Set([last10(ot?.mobile), last10(ot?.whatsapp)].filter(Boolean))];
  const hasNumber = (t) => numbers.some((n) => n === last10(t.phone) || n === last10(t.whatsapp));

  if (code) {
    const holders = await findTutors({ tutorCode: code });
    if (!holders.length) return {};

    if (holders.length > 1) {
      // Several tutors share this code: only the one with this number is this person
      const same = holders.filter(hasNumber);
      if (same.length === 1) return { id: same[0]._id };
      return { skip: `${holders.length} tutors share code ${code} and ${numbers.length ? "none or several have this number" : "Odoo has no number to tell them apart"}` };
    }

    const [t] = holders;
    if (!numbers.length || hasNumber(t)) return { id: t._id };
    // One tutor has the code but a different number. That's either their number
    // changed in Odoo (fine) or Odoo itself holds this code more than once (not
    // fine: each copy would overwrite this tutor in turn).
    const inOdoo = countOdooCode ? await countOdooCode(code).catch(() => null) : null;
    if (inOdoo === 1) return { id: t._id };
    return { skip: inOdoo == null
      ? `code ${code} is on a tutor with a different number, and Odoo couldn't be asked whether the code is shared`
      : `code ${code} is held by ${inOdoo} Odoo records and the MongoDB tutor has a different number` };
  }

  if (!numbers.length) return {};
  const or = numbers.flatMap((n) => { const re = phonePattern(n); return [{ phone: re }, { whatsapp: re }]; });
  const byNumber = await findTutors({ $or: or });
  if (byNumber.length === 1) return { id: byNumber[0]._id };
  if (byNumber.length > 1) return { skip: `${byNumber.length} tutors have number ${numbers[0]}` };
  return {};
}
