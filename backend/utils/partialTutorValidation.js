// Checks the partial tutor form before it is saved. Returns { value } or { error }.
// Kept apart from the route so the rules can be tested without a database.
export const EXPERIENCE_OPTIONS = [
  "0 year", "1 year", "2 year", "3 year", "4 year", "5 year",
  "5+ years", "10+ years", "15+ years", "20+ years", "25+ years", "30+ years",
];

export const OCCUPATION_OPTIONS = [
  "School Teacher", "College Lecturer", "Student", "Freelancer", "Working Professional", "Other",
];

const clip = (value, max) => String(value ?? "").trim().slice(0, max);

export function validatePartialTutor(body = {}) {
  const name = clip(body.name, 100);
  if (name.length < 3) return { error: "Name must be at least 3 characters" };

  const whatsapp = String(body.whatsapp ?? "").trim();
  if (!/^\d{10}$/.test(whatsapp)) return { error: "Enter a valid 10-digit WhatsApp number" };

  if (!EXPERIENCE_OPTIONS.includes(body.experience)) return { error: "Select your experience" };
  if (!OCCUPATION_OPTIONS.includes(body.occupation)) return { error: "Select your occupation" };

  const loc = body.location || {};
  const latitude = Number(loc.latitude);
  const longitude = Number(loc.longitude);
  if (loc.latitude == null || loc.longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { error: "Add your location on the map" };
  }

  const houseDetails = clip(loc.houseDetails, 200);
  if (houseDetails.length < 3) return { error: "Enter house, flat, or building details" };

  return {
    value: {
      name,
      whatsapp,
      experience: body.experience,
      occupation: body.occupation,
      location: {
        latitude,
        longitude,
        city: clip(loc.city, 50),
        area: clip(loc.area, 100),
        pincode: clip(loc.pincode, 10),
        placeLabel: clip(loc.placeLabel, 200),
        houseDetails,
        fullAddress: clip(loc.fullAddress, 400),
      },
    },
  };
}
