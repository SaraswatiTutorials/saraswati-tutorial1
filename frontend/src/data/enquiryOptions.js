// Choices offered on the admin Edit form. These match the lists in pages/ParentEnquiryForm.jsx;
// change both together.

export const dayOptions = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const classOptions = [
  "1-5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "Degree Courses",
];

export const getCurriculumOptions = (classGrade) => {
  if (!classGrade) return [];
  const cg = String(classGrade).trim();
  if (["1-5", "6", "7", "8", "9", "10"].includes(cg)) {
    return ["CBSE", "ICSE", "IGCSE", "IB", "NIOS", "Others"];
  }
  if (["11", "12"].includes(cg)) {
    return ["CBSE", "ISC", "IB", "IGCSE", "State Board", "Other"];
  }
  if (cg === "Degree Courses") {
    return [
      "B.Com",
      "BBA",
      "BCA / MCA",
      "B.Sc",
      "B.A",
      "B.E / B.Tech",
      "Diploma",
      "Other"
    ];
  }
  return ["CBSE", "ICSE", "IGCSE", "IB", "NIOS", "ISC", "State Board", "Other"];
};

export const subjectOptions = [
  "Mathematics",
  "Science",
  "Physics",
  "Chemistry",
  "Biology",
  "English",
  "Hindi",
  "Kannada",
  "Sanskrit",
  "Social Studies",
  "History",
  "Geography",
  "Economics",
  "Political Science",
  "Accountancy",
  "Business Studies",
  "Computer Science",
  "Informatics Practices",
  "Programming",
  "Statistics",
  "French",
  "German",
  "Spoken English",
];

export const preferredModeOptions = [
  "Online / One-to-One Tuition",
  "Home Tuition / In-Person",
];

export const preferredGenderOptions = ["Male", "Female", "Flexible"];
