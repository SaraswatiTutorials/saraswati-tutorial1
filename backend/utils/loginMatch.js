// Lookups for the passwordless tutor and parent logins. Everything matches exactly:
// a partial phone number or a regex character must never pick some other person's record.

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Matches a stored number ending in these 10 digits, written with or without spaces,
// hyphens, dots or a +91 / 0 prefix. Returns null for fewer than 10 digits.
export function phonePattern(input) {
  const digits = String(input || "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const last10 = digits.slice(-10);
  return new RegExp(`${last10.split("").join("[\\s\\-.]*")}\\s*$`);
}

// Tutor Code or email (case-insensitive), or a full phone/WhatsApp number
export function tutorLoginQuery(identifier) {
  const clean = String(identifier || "").trim();
  if (!clean) return null;

  const exact = new RegExp(`^${escapeRegex(clean)}$`, "i");
  const or = [{ tutorCode: exact }, { email: exact }];

  const phone = /^[\d\s+\-().]+$/.test(clean) ? phonePattern(clean) : null;
  if (phone) or.push({ phone }, { whatsapp: phone });

  return { $or: or };
}

// The parent's registered phone number; null when it isn't a full number
export function parentPhoneQuery(input) {
  const phone = phonePattern(input);
  return phone ? { phone } : null;
}
