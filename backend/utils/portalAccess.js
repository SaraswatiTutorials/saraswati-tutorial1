import { phonePattern } from "./loginMatch.js";

// Whether a signed-in portal user may see or change one tuition (a ParentEnquiry):
// admins any, a tutor only students assigned to them, a parent only enquiries made with their number.
export function canAccessStudent(user, lead) {
  if (!user || !lead) return false;
  if (user.role === "admin") return true;
  if (user.role === "tutor") {
    return lead.assignedTutorId != null && String(lead.assignedTutorId) === String(user.id);
  }
  if (user.role === "parent") {
    const pattern = phonePattern(user.phone);
    return Boolean(pattern && pattern.test(String(lead.phone || "")));
  }
  return false;
}
