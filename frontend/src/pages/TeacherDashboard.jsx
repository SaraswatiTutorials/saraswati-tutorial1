import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
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
  FileDown
} from "lucide-react";

export default function TeacherDashboard() {
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  const navigate = useNavigate();
  const tutorId = localStorage.getItem("tutorId");
  const tutorName = localStorage.getItem("tutorName") || "Teacher";
  const tutorCode = localStorage.getItem("tutorCode") || "";
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
  }, [tutorId, token]);

  async function fetchStudents() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/attendance/tutor/${tutorId}/students`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
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

  function handleLogout() {
    localStorage.removeItem("tutorToken");
    localStorage.removeItem("tutorId");
    localStorage.removeItem("tutorName");
    localStorage.removeItem("tutorCode");
    navigate("/teacher/login");
  }

  function openMarkModal(student, type) {
    setSelectedStudent(student);
    setModalType(type);
    setClassDate(getLocalDateString());
    setTopicsCovered("");
    setMissedReason("");
    setCustomReason("");
    setModalError("");
    setShowModal(true);
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

  // Filter students based on search query
  const filteredStudents = students.filter(student =>
    student.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.requirementId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-16 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {/* Navigation Header */}
      <header className="sticky top-0 z-10 bg-slate-900 dark:bg-slate-950 text-white shadow-md border-b border-slate-800/50">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-900/30">
              {tutorName.charAt(0)}
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight">{tutorName}</h1>
              <p className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">Tutor ID: {tutorCode}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center h-10 w-10 sm:w-auto sm:px-4 gap-2 rounded-2xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition-all text-xs font-bold cursor-pointer"
            title="Log Out"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Dashboard Main Container */}
      <main className="mx-auto max-w-4xl px-4 mt-6">
        <div className="flex flex-col gap-4">
          
          {/* Welcome Card & Search */}
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-950 rounded-3xl p-6 text-white shadow-xl border border-indigo-950">
            <h2 className="text-xl font-extrabold tracking-tight">Attendance Portal</h2>
            <p className="text-xs text-indigo-200 mt-1 max-w-md">
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
                className="w-full h-11 pl-9 pr-4 rounded-2xl bg-white/10 border border-white/15 text-white placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Subtabs Selector */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 mb-2 px-1">
            <button
              onClick={() => setCurrentTab("active")}
              className={`pb-3 text-xs font-black transition-all relative cursor-pointer ${
                currentTab === "active"
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-slate-500 dark:text-slate-450 hover:text-slate-800 dark:hover:text-white"
              }`}
            >
              Active Tuitions
              {currentTab === "active" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-650 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setCurrentTab("history")}
              className={`pb-3 text-xs font-black transition-all relative cursor-pointer ${
                currentTab === "history"
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-slate-500 dark:text-slate-450 hover:text-slate-800 dark:hover:text-white"
              }`}
            >
              Attendance History
              {currentTab === "history" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-650 rounded-full" />
              )}
            </button>
          </div>

          {/* Student List Section */}
          {currentTab === "active" ? (
            <div>
              <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">My Students ({filteredStudents.length})</h3>
                {loading && <span className="text-[11px] font-bold text-slate-500 dark:text-slate-405 animate-pulse">Updating...</span>}
              </div>

              {error && (
                <div className="rounded-3xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900 p-4 mb-4 text-center">
                  <p className="text-xs font-bold text-rose-700 dark:text-rose-400">{error}</p>
                  <button 
                    onClick={fetchStudents}
                    className="mt-2 text-xs font-black text-indigo-600 dark:text-indigo-400 underline"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {!loading && filteredStudents.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 text-center border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center gap-3">
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
                        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
                      >
                        {/* Top Header info */}
                        <div className="p-5 pb-4">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                              <span className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-black px-2 py-0.5 rounded-lg">
                                {student.requirementId}
                              </span>
                              <span className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-black px-2.5 py-0.5 rounded-lg">
                                {student.currentMonthLabel || `Month ${student.currentPackageCycle || 1} (Cycle ${student.currentPackageCycle || 1})`}
                              </span>
                              {student.cycleDates && (
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                                  {student.cycleDates}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 justify-end text-[10px] font-bold text-slate-500 dark:text-slate-400">
                              <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                              <span>{student.completedClasses} / {student.totalClasses} Classes</span>
                            </div>
                          </div>

                          <h4 className="text-sm font-black text-slate-800 dark:text-white">{student.studentName}</h4>
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
                            <div className="flex justify-between items-center mt-1.5 text-[9px] font-black text-slate-400 dark:text-slate-500">
                              <span>Remaining: {student.remainingClasses}</span>
                              <span>{percent}% Completed</span>
                            </div>
                          </div>
                        </div>

                        {/* CTA Buttons */}
                        <div className="bg-slate-50/50 dark:bg-slate-950/20 border-t border-slate-100 dark:border-slate-800 p-3 grid grid-cols-3 gap-2">
                          <button
                            onClick={() => openMarkModal(student, "Done")}
                            className="flex items-center justify-center gap-1 h-9 rounded-xl border border-emerald-250 dark:border-emerald-800/80 bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-450 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-[11px] font-black transition-all cursor-pointer shadow-xs"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Done
                          </button>
                          <button
                            onClick={() => openMarkModal(student, "Missed")}
                            className="flex items-center justify-center gap-1 h-9 rounded-xl border border-rose-250 dark:border-rose-800/80 bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-450 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-[11px] font-black transition-all cursor-pointer shadow-xs"
                          >
                            <X className="h-3.5 w-3.5" />
                            Missed
                          </button>
                          <button
                            onClick={() => window.open(`${API_BASE}/attendance/download-history/${student._id}?cycle=all`, "_blank")}
                            title="Download complete attendance history CSV"
                            className="flex items-center justify-center gap-1 h-9 rounded-xl border border-indigo-250 dark:border-indigo-800/80 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-[11px] font-black transition-all cursor-pointer shadow-xs"
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
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">Attendance History Logs</h3>
              </div>

              {filteredStudents.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 text-center border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-50">
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
                        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
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
                            <div className="flex items-center gap-1.5">
                              <span className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-black px-2 py-0.5 rounded-lg">
                                {student.requirementId}
                              </span>
                              <span className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-black px-2.5 py-0.5 rounded-lg">
                                {student.currentMonthLabel || `Month ${student.currentPackageCycle || 1} (Cycle ${student.currentPackageCycle || 1})`}
                              </span>
                              {student.cycleDates && (
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                                  {student.cycleDates}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:underline">
                              {isLogsExpanded ? "Collapse" : "Tap to view timeline"}
                            </span>
                          </div>

                          <h4 className="text-sm font-black text-slate-800 dark:text-white">{student.studentName}</h4>
                          
                          {/* Summary grid */}
                          <div className="grid grid-cols-4 gap-1.5 mt-3 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-2 border border-slate-100 dark:border-slate-800/50">
                              <span className="block uppercase text-[8px] text-slate-400 dark:text-slate-500">Total</span>
                              <strong className="text-slate-800 dark:text-white font-extrabold">{student.totalClasses}</strong>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-2 border border-slate-100 dark:border-slate-800/50">
                              <span className="block uppercase text-[8px] text-slate-400 dark:text-slate-500">Completed</span>
                              <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold">{student.completedClasses}</strong>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-2 border border-slate-100 dark:border-slate-800/50">
                              <span className="block uppercase text-[8px] text-slate-400 dark:text-slate-500">Missed</span>
                              <strong className="text-rose-500 dark:text-rose-400 font-extrabold">{student.missedClasses || 0}</strong>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-2 border border-slate-100 dark:border-slate-800/50">
                              <span className="block uppercase text-[8px] text-slate-400 dark:text-slate-500">Left</span>
                              <strong className="text-indigo-650 dark:text-indigo-400 font-extrabold">{remaining}</strong>
                            </div>
                          </div>
                        </div>

                        {isLogsExpanded && (
                          <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/55 dark:bg-slate-950/20 p-4 animate-slideFade">
                            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-3">Timeline & Topics Covered</span>
                            
                            {loadingHistoryLogsId === student._id ? (
                              <p className="text-xs font-bold text-slate-500 dark:text-slate-450 text-center animate-pulse py-2">
                                Fetching class timeline...
                              </p>
                            ) : !historyLogs[student._id] ? (
                              <p className="text-xs font-bold text-slate-500 dark:text-slate-450 text-center py-2">
                                No history logs loaded.
                              </p>
                            ) : historyLogs[student._id].length === 0 ? (
                              <p className="text-xs font-bold text-slate-500 dark:text-slate-450 text-center py-2">
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
                                          <span className="font-extrabold text-slate-800 dark:text-white">Class {classNum} ({log.date})</span>
                                          <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-[9px] font-black px-1.5 py-0.2 rounded">
                                            Month {log.packageCycle || 1}
                                          </span>
                                        </div>
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                                          log.status === "Done"
                                            ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                                            : "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400"
                                        }`}>
                                          {log.status === "Done" ? "Done" : "Missed"}
                                        </span>
                                      </div>
                                      
                                      {log.status === "Done" ? (
                                        <p className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold"><strong className="text-slate-700 dark:text-slate-200 font-extrabold">Topics Covered:</strong> {log.topicsCovered}</p>
                                      ) : (
                                        <p className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                                          <strong className="text-slate-700 dark:text-slate-200 font-extrabold">Reason:</strong> {log.missedReason === "Other" ? log.customReason : log.missedReason}
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
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 animate-slideFade">
            
            {/* Modal Header */}
            <div className={`px-6 py-5 flex items-center justify-between border-b ${
              modalType === "Done" ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-350" : "bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/60 text-rose-800 dark:text-rose-350"
            }`}>
              <div className="flex items-center gap-2">
                {modalType === "Done" ? <BookOpenCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> : <HelpCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />}
                <h3 className="text-sm font-black">
                  {modalType === "Done" ? "Record Class Completion" : "Record Missed Class"}
                </h3>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-450 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleMarkAttendance}>
              <div className="p-6 space-y-4">
                
                {/* Basic Student Reference */}
                <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 flex justify-between items-center">
                  <span>Student: <strong className="text-slate-900 dark:text-white">{selectedStudent.studentName}</strong></span>
                  <span>ID: <strong className="text-slate-900 dark:text-white">{selectedStudent.requirementId}</strong></span>
                </div>

                {/* Class Date Field */}
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">Class Date</label>
                  <input
                    type="date"
                    required
                    value={classDate}
                    onChange={(e) => setClassDate(e.target.value)}
                    className="w-full h-11 px-4 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950 text-slate-800 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* DONE Popup: Topics Covered */}
                {modalType === "Done" && (
                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
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
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-1">
                      Provide a clear breakdown of sections/topics covered during this session.
                    </p>
                  </div>
                )}

                {/* MISSED Popup: Reason Selection */}
                {modalType === "Missed" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
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
                            className={`px-3 py-2.5 rounded-xl border text-[11px] font-bold text-left transition-all cursor-pointer ${
                              missedReason === reason
                                ? "border-rose-500 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-450 font-extrabold shadow-sm"
                                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-450"
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
                        <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
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
                  <div className="rounded-xl bg-rose-50 dark:bg-rose-955/20 border border-rose-100 dark:border-rose-900/60 p-3 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-450 shrink-0 mt-0.5" />
                    <p className="text-[11px] font-bold text-rose-700 dark:text-rose-400">{modalError}</p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 dark:bg-slate-950/40 px-6 py-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-505 dark:text-slate-450 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black text-white transition-all cursor-pointer shadow-md disabled:opacity-50 ${
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
