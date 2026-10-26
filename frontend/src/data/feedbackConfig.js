// Issue types for the feedback form on the parent enquiry and tutor registration pages.
// Keys must match FEEDBACK_CATEGORIES in backend/models/Feedback.js.
export const FEEDBACK_CATEGORY_LABELS = {
  form: "Problem filling the form",
  upload: "Document / photo upload problem",
  location: "Location / address problem",
  error: "Error or page not working",
  fees: "Question about fees or plans",
  suggestion: "Suggestion",
  other: "Other",
};

// Issue types offered on each form (tutors upload documents; parents see fees)
export const FEEDBACK_CATEGORIES_BY_SOURCE = {
  "parent-enquiry": ["form", "location", "error", "fees", "suggestion", "other"],
  "tutor-registration": ["form", "upload", "location", "error", "suggestion", "other"],
};

export const FEEDBACK_SOURCE_LABELS = {
  "parent-enquiry": "Parent Enquiry",
  "tutor-registration": "Tutor Registration",
};
