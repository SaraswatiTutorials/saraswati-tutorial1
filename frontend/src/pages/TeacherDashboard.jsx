import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
import ThemeToggle from "../components/ThemeToggle";
import "@fontsource-variable/inter";
import {
  formatClassTimeRange,
  classTimeError,
  CLASS_DURATION_OPTIONS,
  classMinutes,
  addMinutesToTime,
  logMinutes,
  formatHours,
} from "../utils/classTime";
import TimeInput12 from "../components/TimeInput12";
import { 
  LogOut, 
  Check, 
  X, 
  Calendar, 
  BookOpen, 
  BookOpenCheck,
  User, 
  Clock, 
  AlertCircle,
  Search,
  CheckCircle2,
  HelpCircle,
  FileDown,
  Bell
} from "lucide-react";

export default function TeacherDashboard() {
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Server's confirmation after marking, e.g. which month a late class was counted in
  const [notice, setNotice] = useState("");
  const [currentTab, setCurrentTab] = useState("active"); // "active" or "history"
  const [historyLogs, setHistoryLogs] = useState({}); // studentId -> array of logs
  const [loadingHistoryLogsId, setLoadingHistoryLogsId] = useState(null);
  const [expandedLogsStudentId, setExpandedLogsStudentId] = useState(null);

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
    // Mount only: re-running after a logout clears the token would redirect again and drop the login message
  }, []);

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
            message: `You have missed ${st.missedClasses} classes with ${st.studentName} (${st.requirementId}) in ${st.currentMonthLabel || `Month ${cycle}`}. Please reschedule with the parent and keep attendance up to date.`,
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

  return (
    <div data-dashboard className="min-h-screen bg-[#f5f4f0] dark:bg-slate-950 pb-16 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {/* Navigation Header */}
      <header className="sticky top-0 z-30 bg-[#f5f4f0]/85 dark:bg-slate-950/85 backdrop-blur text-slate-900 dark:text-white">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white">
              {tutorName.charAt(0)}
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">{tutorName}</h1>
              {tutorCode && (
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase">Tutor ID: {tutorCode}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTutorAlerts((v) => !v)}
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 shadow-sm transition hover:text-indigo-600 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
                aria-label={`Notifications (${tutorAlerts.length})`}
                aria-expanded={showTutorAlerts}
                title="Notifications"
              >
                <Bell className="h-[18px] w-[18px]" />
                {tutorAlerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#f5f4f0] dark:border-slate-950 bg-rose-500 px-1 text-xs font-bold text-white">
                    {tutorAlerts.length}
                  </span>
                )}
              </button>

              {showTutorAlerts && (
                <>
                  <div className="fixed inset-0 z-40 bg-slate-950/40 sm:hidden" onClick={() => setShowTutorAlerts(false)} />
                  <div className="fixed left-4 right-4 top-20 z-50 mx-auto max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-slate-800 dark:text-slate-100 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-96">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Notifications ({tutorAlerts.length})
                      </span>
                      <div className="flex items-center gap-2">
                        {tutorAlerts.length > 0 && (
                          <button
                            type="button"
                            onClick={() => dismissTutorAlerts(tutorAlerts.map((a) => a.id))}
                            className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                          >
                            Clear All
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
                        <p className="py-6 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
                          <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
                          No new notifications
                        </p>
                      ) : (
                        tutorAlerts.map((alert) => (
                          <div key={alert.id} className="flex flex-col gap-2 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/40 p-3 text-xs">
                            <p className="font-semibold leading-normal text-slate-800 dark:text-slate-200">{alert.message}</p>
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => dismissTutorAlerts([alert.id])}
                                className="rounded-lg border border-rose-200 dark:border-rose-900/50 bg-white dark:bg-slate-900 px-3 py-1 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
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
            <ThemeToggle buttonClassName="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 shadow-sm transition hover:text-indigo-600 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer" />
            <button 
              onClick={handleLogout}
              className="flex items-center justify-center h-10 w-10 sm:w-auto sm:px-4 gap-2 rounded-full bg-white dark:bg-slate-900 shadow-sm text-slate-700 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 transition text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
              title="Log Out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Dashboard Main Container */}
      <main className="mx-auto max-w-4xl px-4 mt-6">
        <div className="flex flex-col gap-4">
          
          {tutorAlerts.length > 0 && (
            <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/95 dark:bg-rose-950/30 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4" role="status">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500 text-white">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    Missed classes ({tutorAlerts.length})
                  </p>
                  <p className="mt-0.5 break-words text-sm font-medium leading-snug text-slate-800 dark:text-slate-200">{tutorAlerts[0].message}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => dismissTutorAlerts([tutorAlerts[0].id])}
                  className="flex-1 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-rose-100 dark:hover:bg-rose-950/40 transition cursor-pointer sm:flex-none"
                >
                  Dismiss
                </button>
                {tutorAlerts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setShowTutorAlerts(true)}
                    className="flex-1 rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-700 transition cursor-pointer sm:flex-none"
                  >
                    View All ({tutorAlerts.length})
                  </button>
                )}
              </div>
            </div>
          )}

          {notice && (
            <div className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-3.5 sm:p-4" role="status">
              <div className="flex min-w-0 items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="break-words text-sm font-medium leading-snug text-emerald-900 dark:text-emerald-200">{notice}</p>
              </div>
              <button
                type="button"
                onClick={() => setNotice("")}
                aria-label="Dismiss"
                className="shrink-0 rounded-lg p-1 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Welcome Card & Search */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:shadow-none">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Attendance Portal</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
              Easily manage and submit daily attendance for your active tuitions. Changes sync immediately.
            </p>
            
            <div className="relative mt-6">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Search by student name or req ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-9 pr-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Subtabs Selector */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 mb-2 px-1">
            <button
              onClick={() => setCurrentTab("active")}
              className={`pb-3 text-xs font-bold transition-all relative cursor-pointer ${
                currentTab === "active"
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
              }`}
            >
              Active Tuitions
              {currentTab === "active" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setCurrentTab("history")}
              className={`pb-3 text-xs font-bold transition-all relative cursor-pointer ${
                currentTab === "history"
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
              }`}
            >
              Attendance History
              {currentTab === "history" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
              )}
            </button>
          </div>

          {/* Student List Section */}
          {currentTab === "active" ? (
            <div>
              <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">My Students ({filteredStudents.length})</h3>
                {loading && <span className="text-xs font-bold text-slate-500 dark:text-slate-400 animate-pulse">Updating...</span>}
              </div>

              {error && (
                <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900 p-4 mb-4 text-center">
                  <p className="text-xs font-bold text-rose-700 dark:text-rose-400">{error}</p>
                  <button 
                    onClick={fetchStudents}
                    className="mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 underline"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {!loading && filteredStudents.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:shadow-none flex flex-col items-center justify-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">No students found</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      You don't have any active students matching this query.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {filteredStudents.map((student) => {
                    const percent = Math.min(100, Math.round((student.completedClasses / student.totalClasses) * 100)) || 0;
                    
                    return (
                      <div 
                        key={student._id} 
                        className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:shadow-none hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
                      >
                        {/* Top Header info */}
                        <div className="p-5 pb-4">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex flex-wrap items-center gap-2 [&>span]:whitespace-nowrap">
                              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                              <span className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-2 py-0.5 rounded-lg">
                                {student.requirementId}
                              </span>
                              <span className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold px-2.5 py-0.5 rounded-lg">
                                {student.currentMonthLabel || `Month ${student.currentPackageCycle || 1} (Cycle ${student.currentPackageCycle || 1})`}
                              </span>
                              {student.cycleDates && (
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                                  {student.cycleDates}
                                </span>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5 justify-end whitespace-nowrap text-xs font-bold text-slate-500 dark:text-slate-400">
                              <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                              <span>{student.completedClasses} / {student.totalClasses} Classes</span>
                            </div>
                          </div>

                          <h4 className="text-sm font-bold text-slate-800 dark:text-white">{student.studentName}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">Schedule: {student.classSchedule || "Not scheduled"}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-semibold">Duration: {student.classDuration || "Not provided"}</p>
                          
                          {/* Progress Bar */}
                          <div className="mt-3">
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                                style={{ width: `${percent}%` }}
                              ></div>
                            </div>
                            <div className="flex justify-between items-center mt-1.5 text-xs font-bold text-slate-400 dark:text-slate-500">
                              <span>Remaining: {student.remainingClasses}</span>
                              <span>{percent}% Completed</span>
                            </div>
                          </div>
                        </div>

                        {/* CTA Buttons */}
                        <div className="bg-slate-50/50 dark:bg-slate-950/20 border-t border-slate-100 dark:border-slate-800 p-3 grid grid-cols-3 gap-2">
                          <button
                            onClick={() => openMarkModal(student, "Done")}
                            className="flex items-center justify-center gap-1 h-9 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-xs font-bold transition-all cursor-pointer shadow-xs"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Done
                          </button>
                          <button
                            onClick={() => openMarkModal(student, "Missed")}
                            className="flex items-center justify-center gap-1 h-9 rounded-xl border border-rose-200 dark:border-rose-800/80 bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-bold transition-all cursor-pointer shadow-xs"
                          >
                            <X className="h-3.5 w-3.5" />
                            Missed
                          </button>
                          <button
                            onClick={() => window.open(`${API_BASE}/attendance/download-history/${student._id}?cycle=all`, "_blank")}
                            title="Download complete attendance history CSV"
                            className="flex items-center justify-center gap-1 h-9 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-xs font-bold transition-all cursor-pointer shadow-xs"
                          >
                            <FileDown className="h-3.5 w-3.5" />
                            Export CSV
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Attendance History Logs</h3>
              </div>

              {filteredStudents.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:shadow-none flex flex-col items-center justify-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">No students found</h4>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {filteredStudents.map((student) => {
                    const isLogsExpanded = expandedLogsStudentId === student._id;
                    const remaining = Math.max(0, student.totalClasses - student.completedClasses);
                    return (
                      <div 
                        key={student._id + "-history-card"} 
                        className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:shadow-none overflow-hidden"
                      >
                        <div 
                          onClick={() => {
                            if (isLogsExpanded) {
                              setExpandedLogsStudentId(null);
                            } else {
                              setExpandedLogsStudentId(student._id);
                              fetchHistoryLogs(student._id);
                            }
                          }}
                          className="p-5 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all"
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex flex-wrap items-center gap-1.5 [&>span]:whitespace-nowrap">
                              <span className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-2 py-0.5 rounded-lg">
                                {student.requirementId}
                              </span>
                              <span className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold px-2.5 py-0.5 rounded-lg">
                                {student.currentMonthLabel || `Month ${student.currentPackageCycle || 1} (Cycle ${student.currentPackageCycle || 1})`}
                              </span>
                              {student.cycleDates && (
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                                  {student.cycleDates}
                                </span>
                              )}
                            </div>
                            <span className="shrink-0 whitespace-nowrap text-xs font-bold text-slate-400 dark:text-slate-500 hover:underline">
                              {isLogsExpanded ? "Collapse" : "Tap to view timeline"}
                            </span>
                          </div>

                          <h4 className="text-sm font-bold text-slate-800 dark:text-white">{student.studentName}</h4>
                          
                          {/* Summary grid */}
                          <div className="grid grid-cols-4 gap-1.5 mt-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
                            <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-2 border border-slate-100 dark:border-slate-800/50">
                              <span className="block uppercase text-xs text-slate-400 dark:text-slate-500">Total</span>
                              <strong className="text-slate-800 dark:text-white font-semibold">{student.totalClasses}</strong>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-2 border border-slate-100 dark:border-slate-800/50">
                              <span className="block uppercase text-xs text-slate-400 dark:text-slate-500">Completed</span>
                              <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">{student.completedClasses}</strong>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-2 border border-slate-100 dark:border-slate-800/50">
                              <span className="block uppercase text-xs text-slate-400 dark:text-slate-500">Missed</span>
                              <strong className="text-rose-500 dark:text-rose-400 font-semibold">{student.missedClasses || 0}</strong>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-2 border border-slate-100 dark:border-slate-800/50">
                              <span className="block uppercase text-xs text-slate-400 dark:text-slate-500">Left</span>
                              <strong className="text-indigo-600 dark:text-indigo-400 font-semibold">{remaining}</strong>
                            </div>
                          </div>
                        </div>

                        {isLogsExpanded && (
                          <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/55 dark:bg-slate-950/20 p-4 animate-slideFade">
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-3">Timeline & Topics Covered</span>
                            
                            {loadingHistoryLogsId === student._id ? (
                              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 text-center animate-pulse py-2">
                                Fetching class timeline...
                              </p>
                            ) : !historyLogs[student._id] ? (
                              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 text-center py-2">
                                No history logs loaded.
                              </p>
                            ) : historyLogs[student._id].length === 0 ? (
                              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 text-center py-2">
                                No classes logged yet.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {historyLogs[student._id].map((log, index) => {
                                  const classNum = historyLogs[student._id].length - index;
                                  return (
                                    <div key={log._id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-3 text-xs">
                                      <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-semibold text-slate-800 dark:text-white">
                                            Class {classNum} ({log.date}{formatClassTimeRange(log.classStartTime, log.classEndTime) ? ` · ${formatClassTimeRange(log.classStartTime, log.classEndTime)}` : ""}{log.status === "Done" && formatHours(logMinutes(log)) ? ` · ${formatHours(logMinutes(log))}` : ""})
                                          </span>
                                          <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-1.5 py-0.2 rounded">
                                            Month {log.packageCycle || 1}
                                          </span>
                                        </div>
                                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                          log.status === "Done"
                                            ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                                            : "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400"
                                        }`}>
                                          {log.status === "Done" ? "Done" : "Missed"}
                                        </span>
                                      </div>
                                      
                                      {log.status === "Done" ? (
                                        <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold"><strong className="text-slate-700 dark:text-slate-200 font-semibold">Topics Covered:</strong> {log.topicsCovered}</p>
                                      ) : (
                                        <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                                          <strong className="text-slate-700 dark:text-slate-200 font-semibold">Reason:</strong> {log.missedReason === "Other" ? log.customReason : log.missedReason}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Attendance Modal (Mandatory Popup) */}
      {showModal && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 animate-slideFade">
            
            {/* Modal Header */}
            <div className={`px-6 py-5 flex items-center justify-between border-b ${
              modalType === "Done" ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300" : "bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/60 text-rose-800 dark:text-rose-300"
            }`}>
              <div className="flex items-center gap-2">
                {modalType === "Done" ? <BookOpenCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> : <HelpCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />}
                <h3 className="text-sm font-bold">
                  {modalType === "Done" ? "Record Class Completion" : "Record Missed Class"}
                </h3>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleMarkAttendance}>
              <div className="p-6 space-y-4">
                
                {/* Basic Student Reference */}
                <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 flex justify-between items-center">
                  <span>Student: <strong className="text-slate-900 dark:text-white">{selectedStudent.studentName}</strong></span>
                  <span>ID: <strong className="text-slate-900 dark:text-white">{selectedStudent.requirementId}</strong></span>
                </div>

                {/* Class Date Field */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Class Date</label>
                  <input
                    type="date"
                    required
                    value={classDate}
                    max={getLocalDateString()}
                    onChange={(e) => setClassDate(e.target.value)}
                    className="w-full h-11 px-4 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950 text-slate-800 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Class Time */}
                <div>
                  <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Class Time</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">From</span>
                      <TimeInput12
                        required
                        value={classStartTime}
                        onChange={changeClassStartTime}
                        ariaLabel="Class start time"
                        className="h-11 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950 text-slate-800 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">To</span>
                      <TimeInput12
                        required
                        value={classEndTime}
                        onChange={setClassEndTime}
                        ariaLabel="Class end time"
                        className="h-11 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950 text-slate-800 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    {selectedStudent.usualClassStartTime
                      ? "Filled with the usual class time. Change it if this class was at a different time."
                      : "Select the time this class was scheduled for."}
                  </p>
                </div>

                {/* Class Duration */}
                <div>
                  <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Class Duration</span>
                  <div className="grid grid-cols-4 gap-2">
                    {CLASS_DURATION_OPTIONS.map((minutes) => {
                      const selected = classMinutes(classStartTime, classEndTime) === minutes;
                      return (
                        <button
                          key={minutes}
                          type="button"
                          onClick={() => pickClassDuration(minutes)}
                          className={`flex items-center justify-center gap-1 px-2 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            selected
                              ? "border-indigo-500 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 shadow-sm"
                              : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {selected && <CheckCircle2 className="h-3.5 w-3.5" />}
                          {formatHours(minutes)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Duration: <strong className="text-slate-700 dark:text-slate-200">{formatHours(classMinutes(classStartTime, classEndTime)) || "—"}</strong>
                    {selectedStudent.plannedClassMinutes ? ` · Plan: ${formatHours(selectedStudent.plannedClassMinutes)} per class` : ""}
                  </p>
                  {modalType === "Done" &&
                    selectedStudent.plannedClassMinutes &&
                    classMinutes(classStartTime, classEndTime) &&
                    classMinutes(classStartTime, classEndTime) !== selectedStudent.plannedClassMinutes && (
                      <p className="mt-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                        This is different from the student's plan. The admin will review it.
                      </p>
                    )}
                </div>

                {/* DONE Popup: Topics Covered */}
                {modalType === "Done" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      What topics did you cover today?
                    </label>
                    <textarea
                      rows="3"
                      required
                      placeholder="e.g. Trigonometry formula revision, Chapter 4 Exercises, solved test paper discussion..."
                      value={topicsCovered}
                      onChange={(e) => setTopicsCovered(e.target.value)}
                      className="w-full p-4 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950 text-slate-800 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    ></textarea>
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1">
                      Provide a clear breakdown of sections/topics covered during this session.
                    </p>
                  </div>
                )}

                {/* MISSED Popup: Reason Selection */}
                {modalType === "Missed" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Why was today's class missed?
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {missedReasons.map((reason) => (
                          <button
                            key={reason}
                            type="button"
                            onClick={() => {
                              setMissedReason(reason);
                              setModalError("");
                            }}
                            className={`px-3 py-2.5 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                              missedReason === reason
                                ? "border-rose-500 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 font-semibold shadow-sm"
                                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            {reason}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Textbox if "Other" is selected */}
                    {missedReason === "Other" && (
                      <div className="animate-slideFade">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Specify reason
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Heavy rain / storm in locality, internet down..."
                          value={customReason}
                          onChange={(e) => setCustomReason(e.target.value)}
                          className="w-full h-11 px-4 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950 text-slate-800 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Modal Errors */}
                {modalError && (
                  <div className="rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/60 p-3 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <p className="text-xs font-bold text-rose-700 dark:text-rose-400">{modalError}</p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 dark:bg-slate-950/40 px-6 py-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-md disabled:opacity-50 ${
                    modalType === "Done" ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20" : "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
                  }`}
                >
                  {submitting ? "Submitting..." : "Submit Attendance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
