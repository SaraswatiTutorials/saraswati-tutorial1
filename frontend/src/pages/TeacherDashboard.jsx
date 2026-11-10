import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
import "@fontsource-variable/inter";
import {
  formatClassTimeRange,
  classTimeError,
  CLASS_DURATION_OPTIONS,
  classMinutes,
  addMinutesToTime,
  formatHours,
} from "../utils/classTime";
import TimeInput12 from "../components/TimeInput12";
import { headerIconButton } from "../components/portal/PortalShell";
import TutorShell from "../components/portal/TutorShell";
import {
  cardClass,
  formatDay,
  monthName,
  StatTile,
  ProgressBar,
  StatusPill,
  ClassHistory,
  EmptyState,
  Avatar,
  PhotoPicker,
} from "../components/portal/PortalParts";
import { TutorAssignments } from "../components/portal/Assignments";
import CompleteProfile from "../components/portal/CompleteProfile";
import { uploadPortalPhoto } from "../utils/photo";
import {
  Check,
  X,
  Calendar,
  BookOpenCheck,
  Clock,
  AlertCircle,
  Search,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileDown,
  Bell,
  Users,
  UserRound,
  Target,
  History,
  ClipboardCheck,
  ChevronDown,
  Loader2,
  ClipboardList,
  Camera,
  ShieldCheck,
  BadgeCheck,
  ArrowRight,
} from "lucide-react";

export default function TeacherDashboard() {
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Server's confirmation after marking, e.g. which month a late class was counted in
  const [notice, setNotice] = useState("");
  const [currentTab, setCurrentTab] = useState("active"); // "active", "history", "assignments" or "verification"
  // Where the tutor is with full verification: partial, submitted, relogin or full
  const [verification, setVerification] = useState(null);
  const [tutorPhoto, setTutorPhoto] = useState(() => localStorage.getItem("tutorPhoto") || "");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [historyLogs, setHistoryLogs] = useState({}); // studentId -> array of logs
  const [loadingHistoryLogsId, setLoadingHistoryLogsId] = useState(null);
  const [expandedLogsStudentId, setExpandedLogsStudentId] = useState(null);
  const [historyMonth, setHistoryMonth] = useState({}); // studentId -> month shown in Class history

  const fetchHistoryLogs = async (studentId) => {
    setLoadingHistoryLogsId(studentId);
    try {
      const res = await fetch(`${API_BASE}/attendance/logs/${studentId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (isSessionExpired(res)) return;
      const data = await res.json();
      if (res.ok) {
        setHistoryLogs(prev => ({ 
          ...prev, 
          [studentId]: data.logs || [],
          [`${studentId}_cycles`]: data.cycles || []
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistoryLogsId(null);
    }
  };
  
  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [modalType, setModalType] = useState(""); // "Done" or "Missed"
  
  // Form States
  const [topicsCovered, setTopicsCovered] = useState("");
  const [missedReason, setMissedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [classDate, setClassDate] = useState("");
  // Class time ("HH:mm"), pre-filled with the student's usual time
  const [classStartTime, setClassStartTime] = useState("");
  const [classEndTime, setClassEndTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  const navigate = useNavigate();
  const tutorId = localStorage.getItem("tutorId");
  const tutorName = localStorage.getItem("tutorName") || "Teacher";
  // Older logins saved a missing code as the string "null"
  const storedCode = localStorage.getItem("tutorCode");
  const tutorCode = storedCode && storedCode !== "null" ? storedCode : "";
  const token = localStorage.getItem("tutorToken");

  const missedReasons = [
    "Cancelled by Parent",
    "Cancelled by Teacher",
    "Teacher Sick",
    "Student Unavailable",
    "Emergency",
    "Public Holiday",
    "Other"
  ];

  // Get local date string YYYY-MM-DD
  const getLocalDateString = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split("T")[0];
  };

  useEffect(() => {
    if (!tutorId || !token) {
      navigate("/teacher/login");
      return;
    }
    fetchStudents();
    fetchProfilePhoto();
    fetchVerification();
    // Mount only: re-running after a logout clears the token would redirect again and drop the login message
  }, []);

  // The photo from the tutor's registration, or one they changed since
  async function fetchProfilePhoto() {
    try {
      const res = await fetch(`${API_BASE}/portal/tutor/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      setTutorPhoto(data.tutor?.photo || "");
      localStorage.setItem("tutorPhoto", data.tutor?.photo || "");
    } catch {}
  }

  async function fetchVerification() {
    try {
      const res = await fetch(`${API_BASE}/portal/tutor/full-profile`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      setVerification(await res.json());
    } catch {}
  }

  async function changeProfilePhoto(file) {
    setPhotoBusy(true);
    try {
      const photo = await uploadPortalPhoto("tutor/photo", token, file);
      setTutorPhoto(photo);
      localStorage.setItem("tutorPhoto", photo);
      setNotice("Your profile photo has been updated.");
    } catch (err) {
      if (err.status === 401) return handleLogout("Your session has expired. Please sign in again.");
      alert(err.message);
    } finally {
      setPhotoBusy(false);
    }
  }

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 8000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function fetchStudents() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/attendance/tutor/${tutorId}/students`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (isSessionExpired(res)) return;
      const data = await res.json();
      if (res.ok) {
        setStudents(data.students);
      } else {
        setError(data.message || "Failed to load assigned students.");
      }
    } catch (err) {
      setError("Failed to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout(message) {
    localStorage.removeItem("tutorToken");
    localStorage.removeItem("tutorId");
    localStorage.removeItem("tutorName");
    localStorage.removeItem("tutorCode");
    localStorage.removeItem("tutorPhoto");
    navigate("/teacher/login", typeof message === "string" ? { state: { message } } : undefined);
  }

  // A rejected token (expired, or signed with an old server secret) can't recover by retrying
  function isSessionExpired(res) {
    if (res.status !== 401) return false;
    handleLogout("Your session has expired. Please sign in again.");
    return true;
  }

  function openMarkModal(student, type) {
    setSelectedStudent(student);
    setModalType(type);
    setClassDate(getLocalDateString());
    // Pre-fill the usual time; the duration comes from it, else from the student's plan
    const start = student.usualClassStartTime || "";
    const usualMinutes = classMinutes(start, student.usualClassEndTime);
    const duration = CLASS_DURATION_OPTIONS.includes(usualMinutes)
      ? usualMinutes
      : CLASS_DURATION_OPTIONS.includes(student.plannedClassMinutes) ? student.plannedClassMinutes : null;
    setClassStartTime(start);
    setClassEndTime(start && duration ? addMinutesToTime(start, duration) : student.usualClassEndTime || "");
    setTopicsCovered("");
    setMissedReason("");
    setCustomReason("");
    setModalError("");
    setShowModal(true);
  }

  // Changing the start time keeps the chosen duration
  function changeClassStartTime(newStart) {
    const minutes = classMinutes(classStartTime, classEndTime);
    setClassStartTime(newStart);
    if (newStart && minutes) setClassEndTime(addMinutesToTime(newStart, minutes));
  }

  function pickClassDuration(minutes) {
    if (!classStartTime) {
      setModalError("Select the class start time first.");
      return;
    }
    const end = addMinutesToTime(classStartTime, minutes);
    if (!end) {
      setModalError("The class can't end after midnight.");
      return;
    }
    setClassEndTime(end);
    setModalError("");
  }

  async function handleMarkAttendance(e) {
    e.preventDefault();
    setModalError("");
    setSubmitting(true);

    // Validations
    if (!classDate) {
      setModalError("Please select a date.");
      setSubmitting(false);
      return;
    }

    // Typed dates can get past the picker's max
    if (classDate > getLocalDateString()) {
      setModalError("You can't mark attendance for a future date.");
      setSubmitting(false);
      return;
    }

    const timeError = classTimeError(classStartTime, classEndTime);
    if (timeError) {
      setModalError(timeError);
      setSubmitting(false);
      return;
    }

    if (modalType === "Done" && !CLASS_DURATION_OPTIONS.includes(classMinutes(classStartTime, classEndTime))) {
      setModalError("Class duration must be 1, 1.5, 2 or 2.5 hours. Tap one of the duration buttons.");
      setSubmitting(false);
      return;
    }

    if (modalType === "Done" && !topicsCovered.trim()) {
      setModalError("Please enter the topics covered today.");
      setSubmitting(false);
      return;
    }

    if (modalType === "Missed") {
      if (!missedReason) {
        setModalError("Please select a reason.");
        setSubmitting(false);
        return;
      }
      if (missedReason === "Other" && !customReason.trim()) {
        setModalError("Please enter a custom reason.");
        setSubmitting(false);
        return;
      }
    }

    const payload = {
      parentEnquiryId: selectedStudent._id,
      tutorId,
      status: modalType,
      date: classDate,
      classStartTime,
      classEndTime,
      topicsCovered: modalType === "Done" ? topicsCovered : "",
      missedReason: modalType === "Missed" ? missedReason : "",
      customReason: modalType === "Missed" && missedReason === "Other" ? customReason : "",
    };

    try {
      const res = await fetch(`${API_BASE}/attendance/mark`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (isSessionExpired(res)) return;

      const data = await res.json();
      if (res.ok) {
        if (data.updatedStudentCard) {
          setStudents(prev => 
            prev.map(s => s._id === selectedStudent._id ? data.updatedStudentCard : s)
          );
        }
        if (historyLogs[selectedStudent._id]) {
          fetchHistoryLogs(selectedStudent._id);
        }
        setNotice(data.message || "");
        setShowModal(false);
      } else {
        if (data.updatedStudentCard) {
          setStudents(prev => 
            prev.map(s => s._id === selectedStudent._id ? data.updatedStudentCard : s)
          );
        }
        setModalError(data.message || "Failed to submit attendance.");
      }
    } catch (err) {
      setModalError("Server connection error.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Missed-class notifications ──────────────────────────────────────
  // A student with 2+ missed classes in the current month raises a notification.
  // The id includes the count, so a further missed class shows it again after a dismiss.
  const MISSED_ALERT_THRESHOLD = 2;
  const dismissedKey = `tutorDismissedAlerts:${tutorId || "unknown"}`;
  const [dismissedTutorAlerts, setDismissedTutorAlerts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(dismissedKey) || "[]");
    } catch {
      return [];
    }
  });
  const [showTutorAlerts, setShowTutorAlerts] = useState(false);

  const tutorAlerts = useMemo(
    () =>
      students
        .filter((st) => (st.missedClasses || 0) >= MISSED_ALERT_THRESHOLD)
        .map((st) => {
          const cycle = st.currentPackageCycle || 1;
          return {
            id: `missed-${st._id}-c${cycle}-${st.missedClasses}`,
            message: `You have missed ${st.missedClasses} classes with ${st.studentName} (${st.requirementId}) in ${monthName(st.currentMonthLabel, cycle)}. Please reschedule with the parent and keep attendance up to date.`,
          };
        })
        .filter((a) => !dismissedTutorAlerts.includes(a.id)),
    [students, dismissedTutorAlerts]
  );

  const dismissTutorAlerts = (ids) => {
    const updated = [...new Set([...dismissedTutorAlerts, ...ids])];
    setDismissedTutorAlerts(updated);
    try {
      localStorage.setItem(dismissedKey, JSON.stringify(updated));
    } catch {}
  };

  // Filter students based on search query
  const filteredStudents = students.filter(student =>
    student.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.requirementId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const firstName = tutorName.split(" ")[0];
  const totals = students.reduce(
    (sum, s) => ({
      done: sum.done + (s.completedClasses || 0),
      missed: sum.missed + (s.missedClasses || 0),
      left: sum.left + (s.remainingClasses || 0),
    }),
    { done: 0, missed: 0, left: 0 }
  );
  const todayLabel = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const toggleHistory = (studentId) => {
    if (expandedLogsStudentId === studentId) {
      setExpandedLogsStudentId(null);
    } else {
      setExpandedLogsStudentId(studentId);
      fetchHistoryLogs(studentId);
    }
  };

  const fieldClass =
    "w-full rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

  // ── Menu ────────────────────────────────────────────────────────────
  const stage = verification?.stage;
  const nav = [
    { id: "active", label: "Mark attendance", icon: ClipboardCheck, badge: students.length || null },
    { id: "history", label: "Class history", icon: History },
    { id: "assignments", label: "Tests", icon: ClipboardList },
    ...(stage === "partial" || stage === "submitted"
      ? [{ id: "verification", label: "Full verification", icon: ShieldCheck, badge: stage === "partial" ? "To do" : "In review", badgeTone: "amber" }]
      : []),
  ];
  // Once verification is done its menu item goes; don't leave the page on it
  const view = nav.some((n) => n.id === currentTab) ? currentTab : "active";
  const studentView = view !== "verification";

  const onConverted = (data) => {
    localStorage.setItem("tutorToken", data.token);
    localStorage.setItem("tutorId", data.tutor.id);
    localStorage.setItem("tutorName", data.tutor.name);
    localStorage.setItem("tutorCode", data.tutor.tutorCode || "");
    if (data.tutor.photo) localStorage.setItem("tutorPhoto", data.tutor.photo);
    window.location.reload();
  };
  const relogin = () => handleLogout("Please sign in again.");

  const statusLine =
    stage === "partial" ? { text: "Not verified yet", icon: ShieldCheck, cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" }
    : stage === "submitted" ? { text: "Verification in review", icon: Clock, cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" }
    : stage === "full" ? { text: "Verified tutor", icon: BadgeCheck, cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" }
    : null;
  const StatusIcon = statusLine?.icon;

  const profileCard = (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white p-4 dark:border-slate-800 dark:from-indigo-500/10 dark:via-slate-900 dark:to-slate-900">
      <div className="flex items-center gap-3">
        <PhotoPicker
          onPick={changeProfilePhoto}
          disabled={photoBusy}
          label={tutorPhoto ? "Change your profile photo" : "Add your profile photo"}
          className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
        >
          <Avatar src={tutorPhoto} name={tutorName} size="h-12 w-12" textClass="text-lg" className="ring-2 ring-white dark:ring-slate-900" />
          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white transition group-hover:bg-indigo-600 dark:border-slate-900 dark:bg-white dark:text-slate-900">
            {photoBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
          </span>
        </PhotoPicker>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{tutorName}</p>
          {tutorCode && <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{tutorCode}</p>}
        </div>
      </div>
      {statusLine && (
        <p className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusLine.cls}`}>
          <StatusIcon className="h-3.5 w-3.5" />
          {statusLine.text}
        </p>
      )}
    </div>
  );

  const searchBox = (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        placeholder="Search student or Req ID"
        aria-label="Search student or Req ID"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className={`${fieldClass} h-11 pl-10 pr-4`}
      />
    </div>
  );

  const viewHeading = {
    history: { title: "Class history", text: "Every class you have marked, month by month." },
    assignments: { title: "Tests", text: "Set tests for your students and add their marks." },
    verification: { title: "Full verification", text: "Add the remaining details to become a fully verified tutor." },
  }[view];

  return (
    <TutorShell
      nav={nav}
      current={view}
      onNavigate={setCurrentTab}
      profileCard={profileCard}
      onLogout={handleLogout}
      actions={
        <>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTutorAlerts((v) => !v)}
              className={headerIconButton}
              aria-label={`Notifications (${tutorAlerts.length})`}
              aria-expanded={showTutorAlerts}
              title="Notifications"
            >
              <Bell className="h-[18px] w-[18px]" />
              {tutorAlerts.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[11px] font-bold text-white dark:border-slate-950">
                  {tutorAlerts.length}
                </span>
              )}
            </button>

            {showTutorAlerts && (
              <>
                <div className="fixed inset-0 z-40 bg-slate-950/40 sm:bg-transparent" onClick={() => setShowTutorAlerts(false)} />
                <div className="fixed left-4 right-4 top-20 z-50 mx-auto max-w-md animate-fadeIn rounded-2xl border border-slate-200 bg-white p-4 text-slate-800 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-96">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      Notifications ({tutorAlerts.length})
                    </span>
                    <div className="flex items-center gap-2">
                      {tutorAlerts.length > 0 && (
                        <button
                          type="button"
                          onClick={() => dismissTutorAlerts(tutorAlerts.map((a) => a.id))}
                          className="text-xs font-semibold text-rose-600 hover:underline dark:text-rose-400 cursor-pointer"
                        >
                          Clear all
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowTutorAlerts(false)}
                        className="rounded-lg p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                        aria-label="Close notifications"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                    {tutorAlerts.length === 0 ? (
                      <p className="py-6 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                        <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
                        You're all caught up
                      </p>
                    ) : (
                      tutorAlerts.map((alert) => (
                        <div key={alert.id} className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-sm dark:border-rose-900/60 dark:bg-rose-950/40">
                          <p className="leading-snug text-slate-800 dark:text-slate-200">{alert.message}</p>
                          <div className="mt-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => dismissTutorAlerts([alert.id])}
                              className="rounded-lg border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/50 dark:bg-slate-900 dark:text-rose-400 cursor-pointer"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      }
    >
      <div className="animate-fadeIn space-y-6">
        {tutorAlerts.length > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/50 dark:bg-rose-950/30 sm:flex-row sm:items-center sm:justify-between" role="status">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500 text-white">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                  Missed classes need attention{tutorAlerts.length > 1 ? ` (${tutorAlerts.length})` : ""}
                </p>
                <p className="mt-0.5 break-words text-sm leading-snug text-slate-700 dark:text-slate-300">{tutorAlerts[0].message}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => dismissTutorAlerts([tutorAlerts[0].id])}
                className="flex-1 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-rose-100 dark:border-rose-900/50 dark:bg-slate-900 dark:text-slate-200 sm:flex-none cursor-pointer"
              >
                Dismiss
              </button>
              {tutorAlerts.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowTutorAlerts(true)}
                  className="flex-1 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 sm:flex-none cursor-pointer"
                >
                  View all
                </button>
              )}
            </div>
          </div>
        )}

        {notice && (
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30" role="status">
            <div className="flex min-w-0 items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="break-words text-sm font-medium leading-snug text-emerald-900 dark:text-emerald-200">{notice}</p>
            </div>
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss"
              className="shrink-0 rounded-lg p-1 text-emerald-700 transition hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/40 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {view === "active" ? (
          <>
            <section className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{todayLabel}</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Hello, {firstName}</h1>
              </div>
              {tutorCode && (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  Tutor ID · {tutorCode}
                </span>
              )}
            </section>

            {/* Short-form tutors: a nudge here, the form itself under Full verification */}
            {stage === "partial" && (
              <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white shadow-lg shadow-indigo-600/20 sm:p-6">
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" aria-hidden="true" />
                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                      <ShieldCheck className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-base font-bold">Complete your full verification</h2>
                      <p className="mt-0.5 text-sm text-indigo-100">
                        {verification.needed?.length || 0} details to add. Verified tutors get more tuition matches.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setCurrentTab("verification"); window.scrollTo({ top: 0 }); }}
                    className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-50 cursor-pointer"
                  >
                    Start now
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </section>
            )}
            {(stage === "submitted" || stage === "relogin") && (
              <CompleteProfile token={token} initialStatus={verification} onConverted={onConverted} onRelogin={relogin} />
            )}

            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Active students" value={students.length} icon={Users} tone="slate" />
              <StatTile label="Classes done" value={totals.done} icon={CheckCircle2} tone="emerald" hint="this month" />
              <StatTile label="Missed" value={totals.missed} icon={XCircle} tone="rose" hint="this month" />
              <StatTile label="Classes left" value={totals.left} icon={Target} tone="indigo" hint="this month" />
            </section>

            <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Your students</h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Mark each class as done or missed.</p>
              </div>
              {searchBox}
            </section>
          </>
        ) : (
          <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{viewHeading.title}</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{viewHeading.text}</p>
            </div>
            {studentView && searchBox}
          </section>
        )}

        {view === "verification" && (
          <CompleteProfile token={token} initialStatus={verification} defaultOpen onConverted={onConverted} onRelogin={relogin} />
        )}

        {studentView && error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center dark:border-rose-900 dark:bg-rose-950/20">
            <p className="text-sm font-medium text-rose-700 dark:text-rose-400">{error}</p>
            <button onClick={fetchStudents} className="mt-2 text-sm font-semibold text-indigo-600 underline dark:text-indigo-400 cursor-pointer">
              Try again
            </button>
          </div>
        )}

        {!studentView ? null : loading && students.length === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className={`${cardClass} h-56 animate-pulse`} />
            ))}
          </div>
        ) : filteredStudents.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title={searchQuery ? "No students match your search" : "No students assigned yet"}
            text={searchQuery ? "Try a different name or Req ID." : "When the team assigns you a student, they'll appear here."}
          />
        ) : view === "assignments" ? (
          <TutorAssignments
            students={filteredStudents}
            token={token}
            onSessionExpired={() => handleLogout("Your session has expired. Please sign in again.")}
          />
        ) : view === "active" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredStudents.map((student) => (
              <article key={student._id} className={`${cardClass} flex flex-col transition hover:shadow-md`}>
                <div className="flex-1 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar src={student.studentPhoto} name={student.studentName} size="h-11 w-11" />
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-bold text-slate-900 dark:text-white">{student.studentName}</h3>
                        <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                          {student.requirementId} · {monthName(student.currentMonthLabel, student.currentPackageCycle)}
                          {student.cycleDateRange && ` · ${student.cycleDateRange}`}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                      {student.completedClasses}/{student.totalClasses}
                    </span>
                  </div>

                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex items-start gap-2.5">
                      <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <dd className="text-slate-700 dark:text-slate-300">{student.classSchedule || "Not scheduled"}</dd>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <dd className="text-slate-700 dark:text-slate-300">
                        {formatClassTimeRange(student.usualClassStartTime, student.usualClassEndTime) || student.classDuration || "Time not set"}
                      </dd>
                    </div>
                    {student.latestLogDate && (
                      <div className="flex flex-wrap items-center gap-2.5">
                        <History className="h-4 w-4 shrink-0 text-slate-400" />
                        <dd className="text-slate-700 dark:text-slate-300">Last marked {formatDay(student.latestLogDate)}</dd>
                        <StatusPill status={student.currentAttendanceStatus} />
                      </div>
                    )}
                  </dl>

                  <div className="mt-5">
                    <ProgressBar done={student.completedClasses} total={student.totalClasses} />
                    <div className="mt-1.5 flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                      <span>{student.remainingClasses} classes left</span>
                      {(student.missedClasses || 0) > 0 && (
                        <span className="text-rose-600 dark:text-rose-400">{student.missedClasses} missed</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 border-t border-slate-100 p-3 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => openMarkModal(student, "Done")}
                    className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Class done
                  </button>
                  <button
                    type="button"
                    onClick={() => openMarkModal(student, "Missed")}
                    className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/60 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-950/30 cursor-pointer"
                  >
                    <XCircle className="h-4 w-4" />
                    Missed
                  </button>
                  <a
                    href={`${API_BASE}/attendance/download-history/${student._id}?cycle=all`}
                    title="Download attendance (CSV)"
                    aria-label={`Download attendance for ${student.studentName}`}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:text-white"
                  >
                    <FileDown className="h-4 w-4" />
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredStudents.map((student) => {
              const isOpen = expandedLogsStudentId === student._id;
              const logs = historyLogs[student._id];
              return (
                <article key={student._id + "-history"} className={`${cardClass} overflow-hidden`}>
                  <button
                    type="button"
                    onClick={() => toggleHistory(student._id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/40 sm:p-5 cursor-pointer"
                  >
                    <Avatar src={student.studentPhoto} name={student.studentName} />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-bold text-slate-900 dark:text-white">{student.studentName}</h3>
                      <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                        {student.requirementId} · {monthName(student.currentMonthLabel, student.currentPackageCycle)}
                      </p>
                    </div>
                    <div className="hidden gap-4 text-center text-xs sm:flex">
                      <div>
                        <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{student.completedClasses}</p>
                        <p className="text-slate-500 dark:text-slate-400">Done</p>
                      </div>
                      <div>
                        <p className="text-base font-bold text-rose-600 dark:text-rose-400">{student.missedClasses || 0}</p>
                        <p className="text-slate-500 dark:text-slate-400">Missed</p>
                      </div>
                      <div>
                        <p className="text-base font-bold text-indigo-600 dark:text-indigo-400">{student.remainingClasses}</p>
                        <p className="text-slate-500 dark:text-slate-400">Left</p>
                      </div>
                    </div>
                    <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40 sm:p-5">
                      {loadingHistoryLogsId === student._id && !logs ? (
                        <p className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500 dark:text-slate-400">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading classes...
                        </p>
                      ) : !logs ? (
                        <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Couldn't load the class history. Close and open it again.</p>
                      ) : (
                        <ClassHistory
                          logs={logs}
                          cycles={historyLogs[`${student._id}_cycles`] || []}
                          currentCycle={student.currentPackageCycle || 1}
                          selected={historyMonth[student._id] ?? (student.currentPackageCycle || 1)}
                          onSelect={(cycle) => setHistoryMonth((prev) => ({ ...prev, [student._id]: cycle }))}
                        />
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Attendance Modal (Mandatory Popup) */}
      {showModal && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true">
          <div className="flex max-h-[92vh] w-full animate-fadeIn flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:max-w-lg sm:rounded-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  modalType === "Done" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400" : "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                }`}>
                  {modalType === "Done" ? <BookOpenCheck className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {modalType === "Done" ? "Mark class as done" : "Mark class as missed"}
                  </h3>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {selectedStudent.studentName} · {selectedStudent.requirementId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleMarkAttendance} className="flex min-h-0 flex-1 flex-col">
              <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
                {/* Class Date Field */}
                <div>
                  <label htmlFor="class-date" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Class date</label>
                  <input
                    id="class-date"
                    type="date"
                    required
                    value={classDate}
                    max={getLocalDateString()}
                    onChange={(e) => setClassDate(e.target.value)}
                    className={`${fieldClass} h-11 px-4`}
                  />
                </div>

                {/* Class Time */}
                <div>
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Class time</span>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">From</span>
                      <TimeInput12
                        required
                        value={classStartTime}
                        onChange={changeClassStartTime}
                        ariaLabel="Class start time"
                        className={`${fieldClass} h-11`}
                      />
                    </div>
                    <div>
                      <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">To</span>
                      <TimeInput12
                        required
                        value={classEndTime}
                        onChange={setClassEndTime}
                        ariaLabel="Class end time"
                        className={`${fieldClass} h-11`}
                      />
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    {selectedStudent.usualClassStartTime
                      ? "Filled with the usual class time. Change it if this class was at a different time."
                      : "Select the time this class was scheduled for."}
                  </p>
                </div>

                {/* Class Duration */}
                <div>
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">Class duration</span>
                  <div className="grid grid-cols-4 gap-2">
                    {CLASS_DURATION_OPTIONS.map((minutes) => {
                      const selected = classMinutes(classStartTime, classEndTime) === minutes;
                      return (
                        <button
                          key={minutes}
                          type="button"
                          onClick={() => pickClassDuration(minutes)}
                          className={`flex h-10 items-center justify-center gap-1 rounded-xl border text-sm font-semibold transition cursor-pointer ${
                            selected
                              ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-300"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                          }`}
                        >
                          {selected && <Check className="h-3.5 w-3.5" />}
                          {formatHours(minutes)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    Duration: <strong className="font-semibold text-slate-700 dark:text-slate-200">{formatHours(classMinutes(classStartTime, classEndTime)) || "—"}</strong>
                    {selectedStudent.plannedClassMinutes ? ` · Plan: ${formatHours(selectedStudent.plannedClassMinutes)} per class` : ""}
                  </p>
                  {modalType === "Done" &&
                    selectedStudent.plannedClassMinutes &&
                    classMinutes(classStartTime, classEndTime) &&
                    classMinutes(classStartTime, classEndTime) !== selectedStudent.plannedClassMinutes && (
                      <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                        This is different from the student's plan. The admin will review it.
                      </p>
                    )}
                </div>

                {/* DONE Popup: Topics Covered */}
                {modalType === "Done" && (
                  <div>
                    <label htmlFor="topics-covered" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Topics covered
                    </label>
                    <textarea
                      id="topics-covered"
                      rows="3"
                      required
                      placeholder="e.g. Trigonometry formula revision, Chapter 4 exercises, test paper discussion"
                      value={topicsCovered}
                      onChange={(e) => setTopicsCovered(e.target.value)}
                      className={`${fieldClass} p-3.5`}
                    ></textarea>
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                      Parents can read this, so mention the chapters and sections clearly.
                    </p>
                  </div>
                )}

                {/* MISSED Popup: Reason Selection */}
                {modalType === "Missed" && (
                  <div className="space-y-4">
                    <div>
                      <span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Why was the class missed?
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {missedReasons.map((reason) => (
                          <button
                            key={reason}
                            type="button"
                            onClick={() => {
                              setMissedReason(reason);
                              setModalError("");
                            }}
                            className={`rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition cursor-pointer ${
                              missedReason === reason
                                ? "border-rose-500 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                            }`}
                          >
                            {reason}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Textbox if "Other" is selected */}
                    {missedReason === "Other" && (
                      <div className="animate-fadeIn">
                        <label htmlFor="custom-reason" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                          Specify reason
                        </label>
                        <input
                          id="custom-reason"
                          type="text"
                          required
                          placeholder="e.g. Heavy rain in the area, internet down"
                          value={customReason}
                          onChange={(e) => setCustomReason(e.target.value)}
                          className={`${fieldClass} h-11 px-4`}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Modal Errors */}
                {modalError && (
                  <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/60 dark:bg-rose-950/30">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{modalError}</p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/40">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="h-11 flex-1 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:flex-none sm:px-5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex h-11 flex-[2] items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-sm transition disabled:opacity-60 sm:ml-auto sm:flex-none sm:px-6 cursor-pointer ${
                    modalType === "Done" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? "Saving..." : "Save attendance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </TutorShell>
  );
}
