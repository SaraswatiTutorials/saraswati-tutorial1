// Sample data for the public parent dashboard preview (/parent-dashboard). None of it
// is a real student's. Dates are worked out from today so the preview always looks current.

const CLASS_START_HOUR = 17;
const CLASS_END_HOUR = 18;
const TOTAL_CLASSES = 20;
const COMPLETED_CLASSES = 14;
const MISSED_CLASSES = 1;
const MISSED_POSITION = 3; // how many classes back the missed one was

const SUBJECT_BY_WEEKDAY = { 1: "Mathematics", 2: "Science", 3: "English", 4: "Mathematics", 5: "Science" };

const TOPICS_BY_SUBJECT = {
  Mathematics: ["Trigonometry: Introduction", "Quadratic Equations", "Linear Equations: Revision", "Polynomials: Part 2", "Polynomials: Part 1"],
  Science: ["Atoms and Molecules", "Is Matter Pure?", "Matter in Our Surroundings: Revision", "Matter in Our Surroundings"],
  English: ["Grammar and Tenses", "The Sound of Music", "The Fun They Had"],
};

export const SAMPLE_TUTOR = {
  name: "Mrs. Priya Nair",
  initials: "PN",
  qualification: "M.Sc. Mathematics, B.Ed",
  experience: "8 years of teaching",
  rating: 4.8,
};

export const SAMPLE_PLAN = { title: "Advance Growth Plan", classLabel: "Class 9", board: "CBSE" };

export const SAMPLE_SUBJECTS = [
  {
    name: "Mathematics",
    tests: [62, 68, 72, 78],
    now: "Trigonometry",
    topics: [
      { name: "Polynomials", status: "Completed" },
      { name: "Linear Equations", status: "Completed" },
      { name: "Quadratic Equations", status: "In progress" },
      { name: "Trigonometry", status: "Started" },
    ],
  },
  {
    name: "Science",
    tests: [70, 74, 80, 84],
    now: "Atoms and Molecules",
    topics: [
      { name: "Matter in Our Surroundings", status: "Completed" },
      { name: "Is Matter Pure?", status: "Completed" },
      { name: "Atoms and Molecules", status: "In progress" },
    ],
  },
  {
    name: "English",
    tests: [72, 76, 82, 85],
    now: "Grammar and Tenses",
    topics: [
      { name: "The Fun They Had", status: "Completed" },
      { name: "The Sound of Music", status: "Completed" },
      { name: "Grammar and Tenses", status: "In progress" },
    ],
  },
];

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const isClassDay = (date) => Boolean(SUBJECT_BY_WEEKDAY[date.getDay()]);

export const dayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const formatShortDate = (date) =>
  date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

const average = (values) => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

// The classes already over (newest first) and the next ones (soonest first)
function buildSessions(now) {
  const today = startOfDay(now);
  const past = [];
  const upcoming = [];
  const topicCursor = {};

  for (let back = now.getHours() >= CLASS_END_HOUR ? 0 : 1; past.length < COMPLETED_CLASSES + MISSED_CLASSES; back += 1) {
    const date = addDays(today, -back);
    if (!isClassDay(date)) continue;
    const subject = SUBJECT_BY_WEEKDAY[date.getDay()];
    const missed = past.length === MISSED_POSITION;
    const topics = TOPICS_BY_SUBJECT[subject];
    const topic = missed ? "" : topics[(topicCursor[subject] = (topicCursor[subject] ?? -1) + 1) % topics.length];
    past.push({ date, subject, topic, status: missed ? "missed" : "done", reason: missed ? "Student unavailable" : "" });
  }

  for (let ahead = now.getHours() >= CLASS_END_HOUR ? 1 : 0; upcoming.length < TOTAL_CLASSES - COMPLETED_CLASSES; ahead += 1) {
    const date = addDays(today, ahead);
    if (isClassDay(date)) upcoming.push({ date, subject: SUBJECT_BY_WEEKDAY[date.getDay()], status: "upcoming" });
  }

  return { past, upcoming };
}

function describeNextClass(next, now) {
  const today = startOfDay(now);
  const dayDifference = Math.round((next.date - today) / 86400000);
  const when = dayDifference === 0 ? "Today" : dayDifference === 1 ? "Tomorrow" : formatShortDate(next.date);

  let countdown = "";
  if (dayDifference === 0) {
    const minutes = CLASS_START_HOUR * 60 - (now.getHours() * 60 + now.getMinutes());
    if (minutes <= 0) countdown = "Happening now";
    else countdown = minutes < 60 ? `In ${minutes} min` : `In ${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }
  return { ...next, when, time: "5:00 PM – 6:00 PM", countdown };
}

// Monday-to-Sunday weeks covering every class, for the attendance calendar
function buildCalendar(sessions, today) {
  const byDay = new Map(sessions.map((session) => [dayKey(session.date), session]));
  const dates = sessions.map((session) => session.date.getTime());
  const mondayOf = (date) => addDays(date, -((date.getDay() + 6) % 7));

  const weeks = [];
  const last = new Date(Math.max(...dates));
  for (let monday = mondayOf(new Date(Math.min(...dates))); monday <= last; monday = addDays(monday, 7)) {
    weeks.push(
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(monday, index);
        const session = byDay.get(dayKey(date));
        return { date, key: dayKey(date), subject: session?.subject || "", status: session?.status || "none", isToday: dayKey(date) === dayKey(today) };
      })
    );
  }
  return weeks;
}

export function buildSample(now = new Date()) {
  const today = startOfDay(now);
  const { past, upcoming } = buildSessions(now);
  const sessions = [...past, ...upcoming];
  const weeks = buildCalendar(sessions, today);

  const latestAverage = average(SAMPLE_SUBJECTS.map((subject) => subject.tests.at(-1)));
  const previousAverage = average(SAMPLE_SUBJECTS.map((subject) => subject.tests.at(-2)));

  const dueDate = (days) => formatShortDate(addDays(today, days));

  return {
    stats: {
      total: TOTAL_CLASSES,
      completed: COMPLETED_CLASSES,
      missed: MISSED_CLASSES,
      remaining: TOTAL_CLASSES - COMPLETED_CLASSES,
      attendancePercent: Math.round((COMPLETED_CLASSES / (COMPLETED_CLASSES + MISSED_CLASSES)) * 100),
      progressPercent: Math.round((COMPLETED_CLASSES / TOTAL_CLASSES) * 100),
      averageScore: latestAverage,
      scoreChange: latestAverage - previousAverage,
      homeworkDone: 8,
      homeworkTotal: 10,
    },
    log: past,
    nextClass: describeNextClass(upcoming[0], now),
    thisWeek: weeks.find((week) => week.some((day) => day.isToday)) || weeks.at(-1),
    weeks,
    homework: {
      toDo: [
        { subject: "Mathematics", task: "Exercise 8.3, questions 1 to 10", due: dueDate(1) },
        { subject: "English", task: "Essay: A season I enjoy", due: dueDate(4) },
      ],
      done: [
        { subject: "Science", task: "Lab report: Photosynthesis", marks: "18 / 20", remark: "Clear diagrams and neat observations." },
        { subject: "Mathematics", task: "Polynomials worksheet", marks: "27 / 30", remark: "Strong work. Check signs while factorising." },
        { subject: "English", task: "Comprehension: The Sound of Music", marks: "9 / 10", remark: "Good understanding of the passage." },
        { subject: "Science", task: "Quiz: Is Matter Pure?", marks: "16 / 20", remark: "Revise the separation methods." },
      ],
    },
    remarks: (studentFirstName) => [
      {
        date: formatShortDate(past.find((session) => session.status === "done").date),
        text: `${studentFirstName} has improved well in Trigonometry and picks up new concepts quickly. A little more practice with angle calculations will help.`,
      },
      {
        date: formatShortDate(past[6].date),
        text: `${studentFirstName} finished the polynomial exercises with over 90% accuracy, so we moved to the next chapter ahead of schedule.`,
      },
    ],
  };
}
