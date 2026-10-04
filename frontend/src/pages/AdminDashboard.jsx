import React, { useEffect, useMemo, useState, useRef } from "react";
import { useTheme } from "../context/ThemeContext";
import { useNavigate } from "react-router-dom";
import {
  Users,
  UserCheck,
  FileText,
  Mail,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Plus,
  Bell,
  RefreshCw,
  LogOut,
  Trash2,
  Edit,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  User,
  Phone,
  MapPin,
  Briefcase,
  GraduationCap,
  School,
  BookOpen,
  Lock,
  Unlock,
  Building2,
  Check,
  X,
  FileDown,
  Award,
  Settings,
  CreditCard,
  Activity,
  Globe,
  Laptop,
  Smartphone,
  Tablet,
  Eye,
  MousePointerClick,
  ExternalLink,
  FileCheck2
} from "lucide-react";

import { API_BASE } from "../config";
import ThemeToggle from "../components/ThemeToggle";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReChartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend as ReChartsLegend,
  BarChart,
  Bar
} from "recharts";

const EDUCATION_CERT_PASSWORD = "saraswati7250";

const LEAD_STATUSES = [
  "New Lead",
  "Fees Finalized",
  "Demo Scheduled",
  "Demo Cancelled",
  "Feedback Pending",
  "Enrolled",
  "Won",
  "Rejected",
  "Lost",
];

const FILTER_OPTIONS = [
  "All Leads",
  "New Lead",
  "Fees Finalized",
  "Demo Scheduled",
  "Demo Cancelled",
  "Feedback Pending",
  "Enrolled",
  "Won",
  "Rejected",
  "Lost",
];

const emptyTutor = {
  name: "",
  email: "",
  subject: "",
  qualification: "",
  location: "",
  experience: "",
  price: "",
  about: "",
  photo: "",
  phone: "",
  category: "",
  mode: "",
  whatsapp: "",
  gender: "Male",
  dob: "",
  city: "Bangalore",
  area: "",
  fullAddress: "",
  pincode: "",
  grades: [],
  boards: [],
  subjects: [],
  timings: [],
  maxTravelDistance: "10 km",
  availabilityStatus: "Available",
};

function normalizeLeadStatus(status) {
  if (!status || status === "New") return "New Lead";
  if (status === "Contacted") return "Fees Finalized";
  if (status === "Assigned") return "Demo Scheduled";
  if (status === "Closed") return "Won";
  return status;
}

function formatSubmittedDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  const datePart = date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const timePart = date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return `${datePart} | ${timePart}`;
}

function getClassDuration(parentEnquiry) {
  return (
    parentEnquiry?.classDuration ||
    parentEnquiry?.duration ||
    parentEnquiry?.preferredClassDuration ||
    parentEnquiry?.tuitionDuration ||
    parentEnquiry?.preference?.classDuration ||
    parentEnquiry?.preferences?.classDuration ||
    "Not provided"
  );
}

function getPreferredDays(days) {
  if (Array.isArray(days) && days.length > 0) return days.join(", ");
  if (typeof days === "string" && days.trim()) return days;
  return "Not provided";
}

function getSubjects(subjects) {
  if (Array.isArray(subjects) && subjects.length > 0) return subjects.join(", ");
  if (typeof subjects === "string" && subjects.trim()) return subjects;
  return "Not provided";
}

function isOnlineLead(parentEnquiry) {
  return String(parentEnquiry?.preferredMode || "")
    .toLowerCase()
    .includes("online");
}

function getLeadLocation(parentEnquiry) {
  return (
    parentEnquiry?.area ||
    parentEnquiry?.location ||
    parentEnquiry?.locality ||
    ""
  );
}

function buildSearchText(parentEnquiry) {
  const wardTexts =
    parentEnquiry?.wards?.map((ward) =>
      [
        ward.studentName,
        ward.fullName,
        ward.schoolName,
        ward.classGrade,
        ward.curriculum,
        Array.isArray(ward.subjectsNeeded)
          ? ward.subjectsNeeded.join(" ")
          : ward.subjectsNeeded,
      ]
        .filter(Boolean)
        .join(" ")
    ) || [];

  return [
    parentEnquiry.parentName,
    parentEnquiry.name,
    parentEnquiry.phone,
    parentEnquiry.email,
    parentEnquiry.area,
    parentEnquiry.pincode,
    parentEnquiry.address,
    parentEnquiry.preferredMode,
    parentEnquiry.preferredGender,
    parentEnquiry.preferredTime,
    parentEnquiry.startTime,
    parentEnquiry.endTime,
    getClassDuration(parentEnquiry),
    ...wardTexts,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function buildSuggestionValues(parentEnquiries) {
  const values = [];

  parentEnquiries.forEach((p) => {
    values.push(p.parentName, p.name, p.phone, p.area, p.pincode, p.address);

    p.wards?.forEach((ward) => {
      values.push(
        ward.studentName,
        ward.fullName,
        ward.schoolName,
        ward.classGrade,
        ward.curriculum
      );

      if (Array.isArray(ward.subjectsNeeded)) {
        values.push(...ward.subjectsNeeded);
      } else {
        values.push(ward.subjectsNeeded);
      }
    });
  });

  return [...new Set(values.filter(Boolean).map((v) => String(v).trim()))];
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [enquiries, setEnquiries] = useState([]);
  const [parentEnquiries, setParentEnquiries] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [tutorDrafts, setTutorDrafts] = useState([]);
  const [tutorDraftSearch, setTutorDraftSearch] = useState("");
  const [expandedTutorDraftId, setExpandedTutorDraftId] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [tutors, setTutors] = useState([]);
  const [leadTab, setLeadTab] = useState("active");

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [leadFilter, setLeadFilter] = useState("All Leads");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [showParents, setShowParents] = useState(true);
  const [showTutors, setShowTutors] = useState(true);

  const [matchingLeadId, setMatchingLeadId] = useState(null);
  const [selectedTutorIds, setSelectedTutorIds] = useState([]);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastTemplate, setBroadcastTemplate] = useState(
    `Hello {{TutorName}}\n\nA new tuition opportunity is available.\n\nLocation:\n{{Location}}\n\nGrade:\n{{ParentGrade}}\n\nTiming:\n{{Timing}}\n\nRequirement ID:\n{{RequirementID}}\n\nReply YES if interested.`
  );
  const [broadcastLogs, setBroadcastLogs] = useState([]);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [broadcastType, setBroadcastType] = useState("whatsapp");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [whatsappTemplates, setWhatsappTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [editingTutor, setEditingTutor] = useState(null);
  const [editForm, setEditForm] = useState(emptyTutor);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTutor, setNewTutor] = useState(emptyTutor);

  const [currentMainTab, setCurrentMainTab] = useState("leads"); // "leads" | "analytics" | "attendance" | "tutorDrafts" | "tncAcceptances"
  const [alerts, setAlerts] = useState([]);

  // T&C Acceptances state
  const [tncRecords, setTncRecords]         = useState([]);
  const [tncStats, setTncStats]             = useState({ totalAccepted: 0, totalDismissed: 0, total: 0 });
  const [tncFilter, setTncFilter]           = useState("all");  // "all" | "accepted" | "dismissed"
  const [tncLoading, setTncLoading]         = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("dismissedAlerts") || "[]");
    } catch {
      return [];
    }
  });
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);

  // States for tutor search panel tabs
  const [tutorPanelTab, setTutorPanelTab] = useState("matches"); // "matches" or "all"
  const [tutorSearchQuery, setTutorSearchQuery] = useState("");

  // States and helper functions for attendance tracking console
  const [attendanceLogs, setAttendanceLogs] = useState({});
  const [fetchingLogsLeadId, setFetchingLogsLeadId] = useState(null);

  const fetchLeadAttendanceLogs = async (leadId) => {
    if (!leadId) return;
    setFetchingLogsLeadId(leadId);
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE}/attendance/logs/${leadId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setAttendanceLogs(prev => ({
          ...prev,
          [leadId]: data.logs || [],
          [`${leadId}_meta`]: {
            cycles: data.cycles || [],
            studentCard: data.studentCard || null
          }
        }));
      }
    } catch (err) {
      console.error("Error fetching lead attendance logs:", err);
    } finally {
      setFetchingLogsLeadId(null);
    }
  };

  const fetchAlerts = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE}/attendance/admin-alerts`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setAlerts(data.alerts || []);
      }
    } catch (err) {
      console.error("Error fetching admin alerts:", err);
    }
  };

  const dismissAlert = (alertId) => {
    const updated = [...dismissedAlerts, alertId];
    setDismissedAlerts(updated);
    localStorage.setItem("dismissedAlerts", JSON.stringify(updated));
  };

  const activeAlerts = useMemo(() => {
    return alerts.filter(alert => !dismissedAlerts.includes(alert.id));
  }, [alerts, dismissedAlerts]);
  const [period, setPeriod] = useState("7d"); // "24h", "7d", "30d"
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  function handleLogout() {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminEmail");
    navigate("/admin-login");
  }

  const fetchAnalyticsData = async () => {
    setLoadingAnalytics(true);
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE}/analytics/stats?period=${period}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch (err) {
      console.error("Error fetching analytics stats:", err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const fetchTncRecords = async (actionFilter = "all") => {
    setTncLoading(true);
    try {
      const token = localStorage.getItem("adminToken");
      const query = actionFilter !== "all" ? `?action=${actionFilter}` : "";
      const res = await fetch(`${API_BASE}/tnc/all${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTncRecords(data.records || []);
        setTncStats({
          totalAccepted:  data.totalAccepted  || 0,
          totalDismissed: data.totalDismissed || 0,
          total:          data.total          || 0,
        });
      }
    } catch (err) {
      console.error("[TNC] fetch error:", err);
    } finally {
      setTncLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);

    try {
      const token = localStorage.getItem("adminToken");
      const headers = {
        "Authorization": `Bearer ${token}`,
      };

      const [eRes, peRes, bRes, tRes, dRes, tdRes] = await Promise.all([
        fetch(`${API_BASE}/enquiries`, { headers }),
        fetch(`${API_BASE}/parent-enquiries`, { headers }),
        fetch(`${API_BASE}/bookings`, { headers }),
        fetch(`${API_BASE}/tutors`, { headers }),
        fetch(`${API_BASE}/parent-enquiries/drafts`, { headers }),
        fetch(`${API_BASE}/tutors/drafts`, { headers }),
      ]);

      if (
        eRes.status === 401 ||
        peRes.status === 401 ||
        bRes.status === 401 ||
        tRes.status === 401 ||
        dRes.status === 401 ||
        tdRes.status === 401
      ) {
        handleLogout();
        return;
      }

      const [eData, peData, bData, tData, dData, tdData] = await Promise.all([
        eRes.json(),
        peRes.json(),
        bRes.json(),
        tRes.json(),
        dRes.json(),
        tdRes.json(),
      ]);

      setEnquiries(Array.isArray(eData) ? eData : []);
      setParentEnquiries(Array.isArray(peData) ? peData : []);
      setBookings(Array.isArray(bData) ? bData : []);
      setTutors(Array.isArray(tData) ? tData : []);
      setDrafts(Array.isArray(dData) ? dData : []);
      setTutorDrafts(Array.isArray(tdData) ? tdData : []);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWhatsAppTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE}/broadcast-dashboard/whatsapp-templates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setWhatsappTemplates(data.templates || []);
    } catch (err) {
      console.error("Error fetching WhatsApp templates:", err);
      setWhatsappTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const fetchBroadcastLogs = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE}/parent-enquiries/broadcast-logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBroadcastLogs(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Error fetching broadcast logs:", err);
    }
  };

  const handleUpdateResponseStatus = async (logId, responseStatus) => {
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE}/parent-enquiries/broadcast-logs/${logId}/response`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ responseStatus })
      });
      if (res.ok) {
        setBroadcastLogs(prev =>
          prev.map(log => log._id === logId ? { ...log, responseStatus } : log)
        );
      } else {
        alert("Failed to update response status");
      }
    } catch (err) {
      console.error("Error updating response status:", err);
      alert("Error updating response status");
    }
  };

  const handleSendBroadcast = async () => {
    if (selectedTutorIds.length === 0 || !matchingLeadId) return;
    setSendingBroadcast(true);
    setBroadcastResults([]);
    try {
      const token = localStorage.getItem("adminToken");
      const adminEmail = localStorage.getItem("adminEmail") || "";

      // Build distance/match maps for privacy-safe message
      const distanceTiers = {};
      const distancesKm = {};
      const matchPercentages = {};
      matchedTutors.forEach(t => {
        if (t.distanceTier) distanceTiers[t._id] = t.distanceTier;
        if (t.distanceKm != null) distancesKm[t._id] = t.distanceKm;
        if (t.matchPercentage != null) matchPercentages[t._id] = t.matchPercentage;
      });

      const res = await fetch(`${API_BASE}/parent-enquiries/${matchingLeadId}/broadcast`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          tutorIds: selectedTutorIds,
          adminName: "Admin",
          adminEmail,
          distanceTiers,
          distancesKm,
          matchPercentages,
          templateId: selectedTemplateId || undefined,
        })
      });

      const data = await res.json();
      if (res.ok) {
        setBroadcastResults(data.results || []);
        fetchBroadcastLogs();
        fetchMatchingTutors(matchingLeadId);
      } else {
        alert(`Failed to send broadcast: ${data.message}`);
      }
    } catch (err) {
      console.error("Error sending broadcast:", err);
      alert("Failed to send broadcast due to an error.");
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleAssignTutor = async (tutorId, demoDate, demoTime) => {
    if (!matchingLeadId) return;
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE}/parent-enquiries/${matchingLeadId}/assign-tutor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ tutorId, demoDate, demoTime })
      });

      if (res.ok) {
        const data = await res.json();
        const msg = data.parentDetailsSent
          ? "✅ Tutor assigned! Parent details sent via WhatsApp."
          : `✅ Tutor assigned! (WhatsApp not sent: ${data.parentDetailsError || "unknown reason"})`;
        alert(msg);
        fetchData();
        fetchBroadcastLogs();
      } else {
        const errData = await res.json();
        alert(`Failed to assign tutor: ${errData.message}`);
      }
    } catch (err) {
      console.error("Error assigning tutor:", err);
    }
  };

  function getTargetGradeOption(classGrade) {
    const cg = String(classGrade || "").trim();
    if (["1 to 5", "1", "2", "3", "4", "5"].includes(cg)) return "Class 1-5 (Primary)";
    if (["6", "7", "8"].includes(cg)) return "Class 6-8 (Middle)";
    if (["9", "10"].includes(cg)) return "Class 9-10 (Secondary)";
    if (["11", "12", "PUC"].includes(cg)) return "Class 11-12 (Senior Secondary)";
    return "";
  }

  const [matchedTutors, setMatchedTutors] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [broadcastResults, setBroadcastResults] = useState([]);
  const [assignModalTutorId, setAssignModalTutorId] = useState(null);
  const [assignDemoDate, setAssignDemoDate] = useState("");
  const [assignDemoTime, setAssignDemoTime] = useState("");

  const fetchMatchingTutors = async (leadId) => {
    if (!leadId) {
      setMatchedTutors([]);
      return;
    }
    setLoadingMatches(true);
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE}/tutors/match`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ leadId })
      });
      if (res.ok) {
        const data = await res.json();
        setMatchedTutors(data.tutors || []);
      } else {
        console.error("Failed to fetch matching tutors");
      }
    } catch (err) {
      console.error("Error fetching matching tutors:", err);
    } finally {
      setLoadingMatches(false);
    }
  };

  useEffect(() => {
    fetchMatchingTutors(matchingLeadId);
  }, [matchingLeadId]);

  useEffect(() => {
    if (currentMainTab === "analytics") {
      fetchAnalyticsData();
    } else if (currentMainTab === "attendance") {
      fetchData();
    }
  }, [currentMainTab, period]);

  useEffect(() => {
    fetchData();
    fetchAlerts();
  }, []);

  const suggestionValues = useMemo(() => {
    return buildSuggestionValues(parentEnquiries);
  }, [parentEnquiries]);

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return [];

    return suggestionValues
      .filter((value) => value.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, suggestionValues]);

  const filteredParentEnquiries = useMemo(() => {
    const q = search.trim().toLowerCase();

    return parentEnquiries.filter((parentEnquiry) => {
      const status = normalizeLeadStatus(parentEnquiry.status);

      const matchesFilter =
        leadFilter === "All Leads" || status === leadFilter;

      const matchesSearch = !q || buildSearchText(parentEnquiry).includes(q);

      return matchesFilter && matchesSearch;
    });
  }, [parentEnquiries, search, leadFilter]);

  const filteredDrafts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return drafts.filter((draft) => {
      const formData = draft.formData || {};
      const emailOrPhoneMatch = draft.emailOrPhone?.toLowerCase().includes(q);
      const nameMatch =
        formData.parentName?.toLowerCase().includes(q) ||
        formData.name?.toLowerCase().includes(q);
      const phoneMatch = formData.phone?.toLowerCase().includes(q);
      const emailMatch = formData.email?.toLowerCase().includes(q);
      const addressMatch = formData.address?.toLowerCase().includes(q);
      const cityMatch = draft.geoInfo?.city?.toLowerCase().includes(q);

      const matchesSearch =
        !q ||
        emailOrPhoneMatch ||
        nameMatch ||
        phoneMatch ||
        emailMatch ||
        addressMatch ||
        cityMatch;

      return matchesSearch;
    });
  }, [drafts, search]);

  const filteredTutors = useMemo(() => {
    return tutors.filter(
      (t) =>
        t.name?.toLowerCase().includes(search.toLowerCase()) ||
        t.subject?.toLowerCase().includes(search.toLowerCase()) ||
        t.location?.toLowerCase().includes(search.toLowerCase()) ||
        t.email?.toLowerCase().includes(search.toLowerCase()) ||
        t.phone?.toLowerCase().includes(search.toLowerCase())
    );
  }, [tutors, search]);

  const pendingTutors = tutors.filter(
    (t) => !t.status || t.status === "pending"
  ).length;

  const approvedTutors = tutors.filter((t) => t.status === "approved").length;
  const rejectedTutors = tutors.filter((t) => t.status === "rejected").length;

  const updateLeadStatus = async (id, status) => {
    const token = localStorage.getItem("adminToken");
    try {
      const res = await fetch(`${API_BASE}/parent-enquiries/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        alert("Failed to update lead status");
        return;
      }

      const updated = await res.json();

      setParentEnquiries((prev) =>
        prev.map((item) => (item._id === id ? updated : item))
      );

      // Instantly trigger dashboard refetch to update tutor performance statistics
      fetchData();
    } catch (error) {
      console.error(error);
      alert("Failed to update lead status");
    }
  };

  const deleteTutor = async (id) => {
    const token = localStorage.getItem("adminToken");

    if (!window.confirm("Delete this tutor?")) return;

    try {
      const res = await fetch(`${API_BASE}/tutors/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        alert("Failed to delete tutor");
        return;
      }

      fetchData();
    } catch (error) {
      console.error(error);
      alert("Failed to delete tutor");
    }
  };

  const startEditTutor = (tutor) => {
    setEditingTutor(tutor);
    setEditForm({
      name: tutor.name || "",
      email: tutor.email || "",
      subject: tutor.subject || "",
      qualification: tutor.qualification || "",
      location: tutor.location || "",
      experience: tutor.experience || "",
      price: tutor.price || "",
      about: tutor.about || "",
      photo: tutor.photo || "",
      phone: tutor.phone || "",
      category: tutor.category || "",
      mode: tutor.mode || "",
      whatsapp: tutor.whatsapp || "",
      gender: tutor.gender || "Male",
      dob: tutor.dob || "",
      city: tutor.city || "Bangalore",
      area: tutor.area || "",
      fullAddress: tutor.fullAddress || "",
      pincode: tutor.pincode || "",
      grades: Array.isArray(tutor.grades) ? tutor.grades : [],
      boards: Array.isArray(tutor.boards) ? tutor.boards : [],
      subjects: Array.isArray(tutor.subjects) ? tutor.subjects : [],
      timings: Array.isArray(tutor.timings) ? tutor.timings : [],
      maxTravelDistance: tutor.maxTravelDistance || "10 km",
      availabilityStatus: tutor.availabilityStatus || "Available",
    });
  };

  const saveTutorEdit = async () => {
    const token = localStorage.getItem("adminToken");

    try {
      const res = await fetch(`${API_BASE}/tutors/${editingTutor._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });

      if (res.ok) {
        setEditingTutor(null);
        fetchData();
      } else {
        alert("Failed to update tutor");
      }
    } catch (error) {
      console.error(error);
      alert("Failed to update tutor");
    }
  };

  const createTutor = async () => {
    const token = localStorage.getItem("adminToken");

    try {
      const res = await fetch(`${API_BASE}/tutors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newTutor),
      });

      if (res.ok) {
        setShowAddForm(false);
        setNewTutor(emptyTutor);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.message || "Failed to add tutor");
      }
    } catch (error) {
      console.error(error);
      alert("Failed to add tutor");
    }
  };

  const approveTutor = async (id) => {
    const token = localStorage.getItem("adminToken");

    if (!window.confirm("Approve this tutor?")) return;

    try {
      const res = await fetch(`${API_BASE}/tutors/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          verified: true,
          status: "approved",
        }),
      });

      if (!res.ok) {
        alert("Failed to approve tutor");
        return;
      }

      alert("Tutor approved successfully");
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Error approving tutor");
    }
  };

  const rejectTutor = async (id) => {
    const token = localStorage.getItem("adminToken");
    const comment = prompt("Enter rejection reason:");

    if (!comment) {
      alert("Rejection reason is required");
      return;
    }

    if (!window.confirm("Reject this tutor?")) return;

    try {
      const res = await fetch(`${API_BASE}/tutors/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          verified: false,
          status: "rejected",
          adminComment: comment,
        }),
      });

      if (!res.ok) {
        alert("Failed to reject tutor");
        return;
      }

      alert("Tutor rejected with comment");
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Error rejecting tutor");
    }
  };

  const handleDeleteParentEnquiry = async (id) => {
    const token = localStorage.getItem("adminToken");
    try {
      const res = await fetch(`${API_BASE}/parent-enquiries/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setParentEnquiries((prev) => prev.filter((item) => item._id !== id));
      }
    } catch (err) {
      console.log(err);
    }
  };

  const handleDeleteDraft = async (id) => {
    if (!window.confirm("Are you sure you want to delete this incomplete draft lead?")) return;
    const token = localStorage.getItem("adminToken");
    try {
      const res = await fetch(`${API_BASE}/parent-enquiries/drafts/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setDrafts((prev) => prev.filter((item) => item._id !== id));
      } else {
        alert("Failed to delete draft");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to delete draft");
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e0f2fe,transparent_35%),radial-gradient(circle_at_bottom_right,#f3e8ff,transparent_30%),linear-gradient(135deg,#f8fafc,#f1f5f9)] dark:bg-[radial-gradient(circle_at_top_left,rgba(30,58,138,0.15),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(88,28,135,0.1),transparent_30%),linear-gradient(135deg,#0f172a,#090e1a)] px-4 py-8 md:px-6 md:py-12 transition-colors duration-300">
      <style>{`
        .animate-slideFade {
          animation: slideFade 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes slideFade {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.82);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border: 1px solid rgba(226, 232, 240, 0.6);
        }
        .dark .glass-card {
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border: 1px solid rgba(30, 41, 59, 0.8);
        }
      `}</style>

      <div className="mx-auto max-w-7xl">
        {/* Persistent Top System Alerts Banner */}
        {activeAlerts.length > 0 && (
          <div className="mb-6 rounded-2xl sm:rounded-3xl border border-rose-200 bg-rose-50/95 dark:border-rose-900/50 dark:bg-rose-950/30 backdrop-blur-xl p-3.5 sm:p-4 text-slate-900 dark:text-slate-100 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-slideFade">
            <div className="flex items-start sm:items-center gap-3">
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 animate-pulse shadow-md shadow-rose-500/20 mt-0.5 sm:mt-0">
                <Bell className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
              </div>
              <div>
                <p className="text-[11px] sm:text-xs font-black uppercase text-rose-600 tracking-wider">System Alert ({activeAlerts.length} Pending)</p>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5 leading-snug break-words">{activeAlerts[0]?.message}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 justify-end w-full sm:w-auto pt-2 sm:pt-0 border-t border-rose-200/60 sm:border-0">
              <button
                onClick={() => dismissAlert(activeAlerts[0].id)}
                className="flex-1 sm:flex-none rounded-xl border border-rose-200 dark:border-rose-900/50 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-rose-100 dark:hover:bg-rose-950/40 transition cursor-pointer text-center"
              >
                Dismiss
              </button>
              <button
                onClick={() => setShowAlertsDropdown(!showAlertsDropdown)}
                className="flex-1 sm:flex-none rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-rose-700 transition cursor-pointer text-center"
              >
                View All ({activeAlerts.length})
              </button>
            </div>
          </div>
        )}

        <div className="mb-8 rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl relative border border-slate-800/80 md:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.15),transparent)] pointer-events-none rounded-3xl overflow-hidden" />

          <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-blue-450 animate-ping" />
                <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-300">
                  Admin Control Center
                </p>
              </div>

              <h1 className="text-3.5xl font-black tracking-tight md:text-5xl bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                Saraswati Tutorial Dashboard
              </h1>

              <p className="mt-3 max-w-2xl text-xs font-semibold leading-relaxed text-slate-400 md:text-sm">
                Manage parent leads, tutor approvals, bookings, search, filters,
                and lead pipeline from one unified portal.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 items-center relative z-20">
              {/* Notification Center Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowAlertsDropdown(!showAlertsDropdown)}
                  className="flex items-center justify-center rounded-2xl bg-white/10 h-11 w-11 text-white ring-1 ring-white/20 transition duration-300 hover:bg-white/20 hover:scale-[1.02] cursor-pointer relative"
                  title="System Alerts"
                >
                  <Bell className="h-5 w-5" />
                  {activeAlerts.length > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-rose-500 rounded-full text-[10px] font-black flex items-center justify-center animate-pulse border-2 border-slate-900">
                      {activeAlerts.length}
                    </span>
                  )}
                </button>

                {showAlertsDropdown && (
                  <>
                    {/* Mobile Backdrop Overlay */}
                    <div
                      className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-[290] sm:hidden"
                      onClick={() => setShowAlertsDropdown(false)}
                    />
                    <div className="fixed left-4 right-4 top-20 max-w-md mx-auto sm:absolute sm:left-auto sm:right-0 sm:top-14 sm:w-96 rounded-3xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-2xl border border-slate-200 dark:border-slate-700 p-4.5 z-[300] animate-slideFade">
                      <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                          <Bell className="h-4 w-4 text-rose-500" />
                          <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">System Alerts ({activeAlerts.length})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {activeAlerts.length > 0 && (
                            <button
                              onClick={() => {
                                const allIds = activeAlerts.map(a => a.id);
                                const updated = [...dismissedAlerts, ...allIds];
                                setDismissedAlerts(updated);
                                localStorage.setItem("dismissedAlerts", JSON.stringify(updated));
                              }}
                              className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                            >
                              Clear All
                            </button>
                          )}
                          <button
                            onClick={() => setShowAlertsDropdown(false)}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg sm:hidden cursor-pointer"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 max-h-72 overflow-y-auto space-y-2 pr-1">
                        {activeAlerts.length === 0 ? (
                          <p className="text-xs font-bold text-slate-500 py-6 text-center">
                            ?? No pending attendance alerts!
                          </p>
                        ) : (
                          activeAlerts.map(alert => (
                            <div
                              key={alert.id}
                              className={`p-3 rounded-2xl border text-xs flex flex-col gap-2 ${
                                alert.severity === "high"
                                  ? "bg-rose-50/80 border-rose-200 text-rose-950 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-200"
                                  : "bg-amber-50/80 border-amber-200 text-amber-950 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-200"
                              }`}
                            >
                              <p className="font-semibold leading-normal text-slate-800 dark:text-slate-200">{alert.message}</p>
                              <div className="flex justify-end">
                                <button
                                  onClick={() => dismissAlert(alert.id)}
                                  className="text-[10px] font-black uppercase tracking-wider bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 px-3 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
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

              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition duration-300 hover:bg-emerald-600 hover:scale-[1.02] cursor-pointer"
              >
                <Plus className="h-4.5 w-4.5 stroke-[2.5]" />
                Add Tutor
              </button>

              <button
                onClick={fetchData}
                className="flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 transition duration-300 hover:bg-white/20 hover:scale-[1.02] cursor-pointer"
              >
                <RefreshCw className="h-4.5 w-4.5 stroke-[2.5]" />
                Refresh
              </button>

              <ThemeToggle />

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-2xl bg-rose-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-rose-500/20 transition duration-300 hover:bg-rose-600 hover:scale-[1.02] cursor-pointer"
              >
                <LogOut className="h-4.5 w-4.5 stroke-[2.5]" />
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Main Tab Switcher */}
        <div className="mb-8 flex flex-wrap border-b border-slate-200/80 dark:border-slate-800 gap-6">
          <button
            onClick={() => setCurrentMainTab("leads")}
            className={`pb-4 text-base font-extrabold transition-all relative cursor-pointer ${
              currentMainTab === "leads"
                ? "text-blue-600 font-extrabold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Admission Leads
            {currentMainTab === "leads" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setCurrentMainTab("analytics")}
            className={`pb-4 text-base font-extrabold transition-all relative cursor-pointer ${
              currentMainTab === "analytics"
                ? "text-blue-650 font-extrabold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Analytics &amp; Visitor Insights
            {currentMainTab === "analytics" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentMainTab("attendance");
              fetchData();
            }}
            className={`pb-4 text-base font-extrabold transition-all relative cursor-pointer ${
              currentMainTab === "attendance"
                ? "text-blue-650 font-extrabold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Attendance &amp; Class Tracking
            {currentMainTab === "attendance" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>

          {/* NEW: Tutor Drafts tab */}
          <button
            type="button"
            onClick={() => setCurrentMainTab("tutorDrafts")}
            className={`pb-4 text-base font-extrabold transition-all relative cursor-pointer ${
              currentMainTab === "tutorDrafts"
                ? "text-violet-600 font-extrabold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Tutor Drafts
            {tutorDrafts.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/40 px-2 py-0.5 text-[10px] font-black text-violet-700 dark:text-violet-300">
                {tutorDrafts.length}
              </span>
            )}
            {currentMainTab === "tutorDrafts" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600 rounded-full" />
            )}
          </button>
          {/* T&C Acceptances tab */}
          <button
            type="button"
            onClick={() => { setCurrentMainTab("tncAcceptances"); fetchTncRecords(tncFilter); }}
            className={`pb-4 text-base font-extrabold transition-all relative cursor-pointer ${
              currentMainTab === "tncAcceptances"
                ? "text-emerald-600 font-extrabold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            T&amp;C Acceptances
            {tncStats.totalAccepted > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:text-emerald-300">
                {tncStats.totalAccepted}
              </span>
            )}
            {currentMainTab === "tncAcceptances" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
            )}
          </button>
        </div>

        {/* ───────────────── T&C ACCEPTANCES PANEL ───────────────── */}
        {currentMainTab === "tncAcceptances" && (
          <div className="animate-slideFade">
            {/* Header */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  T&amp;C Acceptances
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Parents who clicked Accept or Dismiss on the Terms &amp; Conditions page.
                </p>
              </div>
              <button
                onClick={() => fetchTncRecords(tncFilter)}
                className="flex items-center gap-2 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2.5 text-sm font-bold text-emerald-700 dark:text-emerald-300 transition hover:bg-emerald-100 dark:hover:bg-emerald-900/40 cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: "Total Responses", value: tncStats.total,          color: "text-slate-700 dark:text-slate-200",  bg: "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700" },
                { label: "Accepted",        value: tncStats.totalAccepted,  color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700" },
                { label: "Dismissed",       value: tncStats.totalDismissed, color: "text-rose-700 dark:text-rose-300",     bg: "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-700" },
              ].map(s => (
                <div key={s.label} className={`rounded-2xl border p-4 text-center ${s.bg}`}>
                  <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Filter */}
            <div className="mb-4 flex gap-2 flex-wrap">
              {["all", "accepted", "dismissed"].map(f => (
                <button
                  key={f}
                  onClick={() => { setTncFilter(f); fetchTncRecords(f); }}
                  className={`rounded-xl px-4 py-1.5 text-xs font-bold capitalize transition cursor-pointer ${
                    tncFilter === f
                      ? "bg-emerald-600 text-white shadow"
                      : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                >
                  {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {/* Table */}
            {tncLoading ? (
              <div className="py-16 text-center">
                <RefreshCw className="mx-auto h-8 w-8 text-emerald-400 animate-spin mb-3" />
                <p className="text-sm text-slate-400">Loading records…</p>
              </div>
            ) : tncRecords.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-16 text-center">
                <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
                <p className="text-base font-black text-slate-400 dark:text-slate-500">No T&amp;C records yet</p>
                <p className="mt-1 text-sm text-slate-400 dark:text-slate-600">Records appear here when parents click Accept or Dismiss on the Terms &amp; Conditions page.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900 text-left">
                      {["#", "Action", "Name", "Phone", "Source", "IP Address", "Date & Time"].map(h => (
                        <th key={h} className="px-4 py-3 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap border-b border-slate-200 dark:border-slate-700">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {tncRecords.map((rec, idx) => (
                      <tr key={rec._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60 transition-colors">
                        <td className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500 font-mono">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            rec.action === "accepted"
                              ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                              : "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300"
                          }`}>
                            {rec.action === "accepted" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                            {rec.action.charAt(0).toUpperCase() + rec.action.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap">{rec.name || <span className="text-slate-400 italic">—</span>}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap font-mono text-xs">{rec.phone || <span className="text-slate-400 italic">—</span>}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">{rec.source || "tnc-page"}</td>
                        <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs font-mono whitespace-nowrap">{rec.ipAddress || "—"}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap">{formatSubmittedDate(rec.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ───────────────── TUTOR DRAFTS PANEL ───────────────── */}
        {currentMainTab === "tutorDrafts" && (
          <div className="animate-slideFade">
            {/* Header */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  Tutor Registration Drafts
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {tutorDrafts.length} incomplete tutor registration{tutorDrafts.length !== 1 ? "s" : ""} - auto-expire after 30 days.
                </p>
              </div>
              <button
                onClick={fetchData}
                className="flex items-center gap-2 rounded-2xl border border-violet-200 dark:border-violet-900/60 bg-violet-50 dark:bg-violet-900/20 px-4 py-2.5 text-sm font-bold text-violet-700 dark:text-violet-300 transition hover:bg-violet-100 dark:hover:bg-violet-900/40 cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>

            {/* Search */}
            <div className="mb-6 relative">
              <input
                type="text"
                value={tutorDraftSearch}
                onChange={(e) => setTutorDraftSearch(e.target.value)}
                placeholder="Search by name, phone, city, subjects..."
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 pl-10 text-sm font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 transition"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>

            {/* Draft Cards */}
            {tutorDrafts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-16 text-center">
                <GraduationCap className="mx-auto mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
                <p className="text-base font-black text-slate-400 dark:text-slate-500">No tutor drafts found</p>
                <p className="mt-1 text-sm text-slate-400 dark:text-slate-600">Drafts appear here when tutors save progress on the registration form.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tutorDrafts
                  .filter((d) => {
                    if (!tutorDraftSearch.trim()) return true;
                    const q = tutorDraftSearch.toLowerCase();
                    const fd = d.formData || {};
                    return (
                      (fd.name || "").toLowerCase().includes(q) ||
                      (d.phone || "").includes(q) ||
                      (fd.city || "").toLowerCase().includes(q) ||
                      (fd.qualification || "").toLowerCase().includes(q) ||
                      ((fd.subjects || []).join(" ")).toLowerCase().includes(q)
                    );
                  })
                  .map((draft) => {
                    const fd = draft.formData || {};
                    const isExpanded = expandedTutorDraftId === draft._id;
                    const stepLabels = ["", "Personal Info", "Teaching Profile", "Location & Docs"];
                    const stepColors = ["", "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300", "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300", "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"];

                    return (
                      <div
                        key={draft._id}
                        className="glass-card rounded-3xl overflow-hidden transition-all duration-300"
                      >
                        {/* Card Header */}
                        <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                          {/* Avatar */}
                          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-black text-lg shrink-0 shadow-lg shadow-violet-500/20">
                            {(fd.name || "?")[0].toUpperCase()}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <p className="font-black text-slate-900 dark:text-slate-100 text-base truncate">
                                {fd.name || <span className="text-slate-400 italic">Name not provided</span>}
                              </p>
                              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${stepColors[draft.stepReached] || "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                                Step {draft.stepReached} - {stepLabels[draft.stepReached] || "Unknown"}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                              {draft.phone && <span>Phone: {draft.phone}</span>}
                              {fd.city && <span>📍 {fd.city}{fd.area ? `, ${fd.area}` : ""}</span>}
                              {fd.qualification && <span>Qualification: {fd.qualification}</span>}
                              {(fd.subjects || []).length > 0 && (
                                <span>Subjects: {fd.subjects.slice(0, 3).join(", ")}{fd.subjects.length > 3 ? " +" + (fd.subjects.length - 3) : ""}</span>
                              )}
                            </div>
                            <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                              Last updated: {new Date(draft.updatedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => setExpandedTutorDraftId(isExpanded ? null : draft._id)}
                              className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              {isExpanded ? "Hide" : "Details"}
                            </button>
                            <button
                              onClick={async () => {
                                if (!window.confirm(`Delete draft for ${fd.name || draft.phone}?`)) return;
                                const token = localStorage.getItem("adminToken");
                                try {
                                  const res = await fetch(`${API_BASE}/tutors/drafts/${draft._id}`, {
                                    method: "DELETE",
                                    headers: { Authorization: `Bearer ${token}` },
                                  });
                                  if (res.ok) {
                                    setTutorDrafts((prev) => prev.filter((d) => d._id !== draft._id));
                                  } else {
                                    alert("Failed to delete draft");
                                  }
                                } catch (err) {
                                  alert("Error: " + err.message);
                                }
                              }}
                              className="flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-900/20 px-3.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        </div>

                        {/* Expanded Detail Panel */}
                        {isExpanded && (
                          <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-5 bg-slate-50/60 dark:bg-slate-900/30">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                              {[
                                { label: "Full Name", value: fd.name },
                                { label: "Phone", value: fd.phone || draft.phone },
                                { label: "WhatsApp", value: fd.whatsapp },
                                { label: "Email", value: fd.email },
                                { label: "Gender", value: fd.gender },
                                { label: "Date of Birth", value: fd.dob },
                                { label: "Qualification", value: fd.qualification },
                                { label: "Experience", value: fd.experience },
                                { label: "Occupation Status", value: fd.hasOccupation === "yes" ? `Working - ${fd.occupation || ""}` : "Not Working" },
                                { label: "City", value: fd.city },
                                { label: "Area", value: fd.area },
                                { label: "Full Address", value: fd.fullAddress },
                                { label: "Pincode", value: fd.pincode },
                                { label: "Has Vehicle", value: fd.hasVehicle === "yes" ? "Yes" : "No" },
                                { label: "Max Travel Distance", value: fd.maxTravelDistance },
                                { label: "Teaching Mode", value: fd.mode },
                                { label: "Grades", value: (fd.grades || []).join(", ") },
                                { label: "Boards", value: (fd.boards || []).join(", ") },
                                { label: "Subjects", value: (fd.subjects || []).join(", ") },
                                { label: "Timings", value: (fd.timings || []).join(", ") },
                                { label: "Languages", value: (fd.languages || []).join(", ") },
                                { label: "Service Areas", value: (fd.locations || []).join(", ") },
                                { label: "About", value: fd.about },
                                { label: "IP Address", value: draft.ipAddress },
                              ]
                                .filter((row) => row.value)
                                .map((row) => (
                                  <div key={row.label} className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3.5">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">{row.label}</p>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 break-words">{row.value}</p>
                                  </div>
                                ))}
                            </div>

                            {/* Uploaded Documents Section */}
                            {(fd.photoUrl || fd.idProofUrl || fd.expCertUrl || fd.otherDocUrl) && (
                              <div className="mt-5 space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                  Uploaded Documents
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {[
                                    { label: "Profile Photo",          url: fd.photoUrl },
                                    { label: "ID Proof",               url: fd.idProofUrl },
                                    { label: "Education Certificate",  url: fd.expCertUrl },
                                    { label: "Other Document",         url: fd.otherDocUrl },
                                  ].filter((d) => d.url).map((doc) => (
                                    <div
                                      key={doc.label}
                                      className="flex items-center justify-between rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/40 px-4 py-3"
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className="h-7 w-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                                          <FileCheck2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{doc.label}</span>
                                      </div>
                                      <a
                                        href={doc.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-xs font-black text-blue-600 dark:text-blue-400 hover:underline"
                                      >
                                        Open ↗
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {!(fd.photoUrl || fd.idProofUrl || fd.expCertUrl || fd.otherDocUrl) && draft.stepReached >= 3 && (
                              <div className="mt-5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 px-4 py-3 text-xs font-semibold text-amber-700 dark:text-amber-400">
                                ⚠ No documents uploaded yet in this draft.
                              </div>
                            )}

                            <div className="mt-5 flex justify-end">
                              <a
                                href="/tutor-register"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-violet-500/20 hover:opacity-90 transition cursor-pointer"
                              >
                                <GraduationCap className="h-4 w-4" />
                                Open Registration Form
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {currentMainTab === "leads" && (
          <>
            {loading && (
              <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm font-medium text-blue-700 flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                Loading latest dashboard data...
              </div>
            )}

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Total Tutors"
            value={tutors.length}
            subtitle={`${approvedTutors} approved`}
            icon={Award}
            gradientClass="bg-indigo-50 text-indigo-600"
          />

          <StatCard
            title="Active Parent Leads"
            value={parentEnquiries.length}
            subtitle={`${filteredParentEnquiries.length} visible`}
            icon={Users}
            gradientClass="bg-blue-50 dark:bg-blue-950/40 text-blue-650 dark:text-blue-400"
          />

          <StatCard
            title="Incomplete Drafts"
            value={drafts.length}
            subtitle={`${filteredDrafts.length} filtered`}
            icon={FileText}
            gradientClass="bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
          />

          <StatCard
            title="General Enquiries"
            value={enquiries.length}
            subtitle="Website enquiries"
            icon={Mail}
            gradientClass="bg-teal-50 dark:bg-teal-950/40 text-teal-650 dark:text-teal-400"
          />

          <StatCard
            title="Bookings"
            value={bookings.length}
            subtitle="Scheduled sessions"
            icon={Calendar}
            gradientClass="bg-purple-50 dark:bg-purple-950/40 text-purple-650 dark:text-purple-400"
          />
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <MiniStat title="Pending Tutors" value={pendingTutors} color="yellow" icon={Clock} />
          <MiniStat title="Approved Tutors" value={approvedTutors} color="green" icon={CheckCircle2} />
          <MiniStat title="Rejected Tutors" value={rejectedTutors} color="red" icon={XCircle} />
        </div>

        <div className="mb-8 rounded-3xl bg-white dark:bg-slate-900 p-5 shadow-sm border border-slate-200/80 dark:border-slate-800">
          <div className="grid gap-4 md:grid-cols-[1fr_240px_auto_auto_auto]">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Search className="h-5 w-5" />
              </div>
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => {
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                placeholder="Search parent, student, phone, area, subject, school..."
                className="h-12 w-full rounded-2xl border border-slate-200/80 dark:border-slate-700 pl-11 pr-4 text-sm font-semibold outline-none transition duration-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 bg-white dark:bg-slate-800 text-slate-800 dark:text-white"
              />

              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-14 z-30 overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 animate-slideFade">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onMouseDown={() => {
                        setSearch(suggestion);
                        setShowSuggestions(false);
                      }}
                      className="block w-full px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <select
                value={leadFilter}
                onChange={(e) => setLeadFilter(e.target.value)}
                className="h-12 w-full appearance-none rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 pr-10 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none transition duration-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                {FILTER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <ChevronDown className="h-4.5 w-4.5 stroke-[2.5]" />
              </div>
            </div>

            <button
              onClick={() => setShowParents(!showParents)}
              className={`flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition duration-300 cursor-pointer ${
                showParents
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {showParents ? "Hide Parent Leads" : "Show Parent Leads"}
            </button>

            <button
              onClick={() => setShowTutors(!showTutors)}
              className={`flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition duration-300 cursor-pointer ${
                showTutors
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20 hover:bg-purple-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {showTutors ? "Hide Tutors" : "Show Tutors"}
            </button>

            <button
              onClick={() => {
                fetchBroadcastLogs();
                setShowLogsModal(true);
              }}
              className="flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition duration-300 cursor-pointer"
            >
              <Users className="h-4 w-4" />
              View Broadcast Logs
            </button>
          </div>
        </div>

        {showParents && (
          <section className="mb-10 animate-slideFade">
            <SectionHeader
              icon={Users}
              title="Parent Leads"
              subtitle="Search, filter, and track every parent enquiry through the admission pipeline."
            />

            {/* Sub-tabs for Parent Leads */}
            <div className="mb-6 flex border-b border-slate-200/80 gap-6">
              <button
                onClick={() => setLeadTab("active")}
                className={`pb-4 text-sm font-extrabold transition-all relative cursor-pointer ${
                  leadTab === "active"
                    ? "text-blue-600"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Active Leads ({filteredParentEnquiries.length})
                {leadTab === "active" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                )}
              </button>
              <button
                onClick={() => setLeadTab("drafts")}
                className={`pb-4 text-sm font-extrabold transition-all relative cursor-pointer ${
                  leadTab === "drafts"
                    ? "text-blue-600"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Incomplete Drafts ({filteredDrafts.length})
                {leadTab === "drafts" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                )}
              </button>
            </div>

            {leadTab === "active" ? (
              filteredParentEnquiries.length === 0 ? (
                <EmptyState text="No parent leads found for this search or filter." />
              ) : (
                <div className="grid gap-5">
                  {filteredParentEnquiries.map((p) => {
                    const currentStatus = normalizeLeadStatus(p.status);
                    const submittedAt = formatSubmittedDate(p.createdAt);
                    const online = isOnlineLead(p);
                    const leadLocation = getLeadLocation(p);

                    const borderColors = {
                      "New Lead": "border-l-4 border-l-blue-500",
                      "Fees Finalized": "border-l-4 border-l-purple-500",
                      "Demo Scheduled": "border-l-4 border-l-amber-500",
                      "Demo Cancelled": "border-l-4 border-l-orange-400",
                      "Feedback Pending": "border-l-4 border-l-orange-500",
                      "Enrolled": "border-l-4 border-l-emerald-600",
                      "Won": "border-l-4 border-l-emerald-500",
                      "Rejected": "border-l-4 border-l-red-500",
                      "Lost": "border-l-4 border-l-rose-500",
                    };
                    const borderClass = borderColors[currentStatus] || "border-l-4 border-l-slate-400";

                    return (
                      <div
                        key={p._id}
                        className={`overflow-hidden rounded-3xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200/80 dark:border-slate-800 transition duration-300 hover:shadow-lg ${borderClass} animate-slideFade`}
                      >
                        <div className="border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800/80 dark:to-slate-900 p-5">
                          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">
                                  {p.parentName || p.name || "Unnamed Parent"}
                                </h3>

                                <Badge
                                  text={currentStatus}
                                  color={getStatusColor(currentStatus)}
                                />

                                {p.odooSyncStatus === "failed" ? (
                                  <Badge text={`⚠ Odoo Sync Failed${p.odooSyncError ? `: ${p.odooSyncError}` : ""}`} color="red" />
                                ) : (p.odooSyncStatus === "synced" || p.odooLeadId) ? (
                                  <Badge text={`Odoo Synced${p.odooLeadId ? ` (#${p.odooLeadId})` : ""}`} color="emerald" />
                                ) : null}

                                {online && <Badge text="Online" color="blue" />}

                                {!online && leadLocation && (
                                  <Badge text={leadLocation} color="slate" />
                                )}

                                {p.geoInfo?.city && (
                                  <Badge
                                    text={`Filled from: ${p.geoInfo.city}, ${p.geoInfo.region || ""}`}
                                    color="emerald"
                                  />
                                )}

                                {p.ipAddress && (
                                  <span className="text-xs text-slate-400 font-semibold">
                                    IP: {p.ipAddress}
                                  </span>
                                )}
                              </div>

                              <p className="mt-2 text-xs font-bold text-slate-400 dark:text-slate-500">
                                Submitted: {submittedAt}
                              </p>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <div className="relative">
                                <select
                                  value={currentStatus}
                                  onChange={(e) =>
                                    updateLeadStatus(p._id, e.target.value)
                                  }
                                  className="h-11 appearance-none rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-4 pr-10 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500"
                                >
                                  {LEAD_STATUSES.map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>
                                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                  <ChevronDown className="h-4 w-4" />
                                </div>
                              </div>

                              <button
                                onClick={() => {
                                  if (window.confirm("Delete this enquiry?")) {
                                    handleDeleteParentEnquiry(p._id);
                                  }
                                }}
                                className="h-11 flex items-center justify-center gap-1.5 rounded-2xl bg-rose-500 px-4 text-xs font-bold text-white transition hover:bg-rose-600 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-5 p-5 lg:grid-cols-3">
                          <div className="rounded-2xl bg-slate-50/60 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-5 transition hover:bg-slate-50 dark:hover:bg-slate-800">
                            <h4 className="mb-4 text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                              <User className="h-4 w-4 text-blue-500" />
                              Parent Details
                            </h4>

                            <div className="space-y-1">
                              <InfoRow icon={Phone} label="Phone" value={p.phone} />
                              <InfoRow icon={Mail} label="Email" value={p.email} />
                              {p.occupation && (
                                <InfoRow
                                  icon={Briefcase}
                                  label="Occupation"
                                  value={`${p.occupation}${
                                    p.occupationType ? ` (${p.occupationType})` : ""
                                  }`}
                                />
                              )}
                              {p.address ? (
                                <InfoRow icon={MapPin} label="Address" value={p.address} />
                              ) : (
                                <>
                                  <InfoRow icon={MapPin} label="Area" value={p.area} />
                                  <InfoRow icon={MapPin} label="PIN Code" value={p.pincode} />
                                </>
                              )}
                            </div>
                          </div>

                          <div className="rounded-2xl bg-slate-50/60 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-5 transition hover:bg-slate-50 dark:hover:bg-slate-800">
                            <h4 className="mb-4 text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                              <Settings className="h-4 w-4 text-purple-500" />
                              Tutor Preference
                            </h4>

                            <div className="space-y-1">
                              <InfoRow icon={BookOpen} label="Preferred Mode" value={p.preferredMode} />
                              <InfoRow icon={User} label="Preferred Gender" value={p.preferredGender} />
                              <InfoRow icon={Clock} label="Preferred Time" value={p.classTimingSlot || (p.startTime && p.endTime ? `${p.startTime} – ${p.endTime}` : (p.preferredTime && !p.preferredTime.includes("Days") ? p.preferredTime : "Flexible / Any Slot"))} />
                              <InfoRow icon={Clock} label="Class Duration" value={getClassDuration(p)} />
                              <InfoRow icon={Calendar} label="Preferred Days" value={getPreferredDays(p.preferredDays)} />
                              {p.classTimingType && (
                                <InfoRow icon={Clock} label="Timing Preference" value={p.classTimingType} />
                              )}
                              {p.classTimingSlot && (
                                <InfoRow icon={Clock} label="Timing Slot" value={p.classTimingSlot} />
                              )}
                              {p.pricingConsent !== undefined && (
                                <InfoRow icon={ShieldCheck} label="Pricing Consent" value={p.pricingConsent ? "Agreed" : "No"} />
                              )}
                            </div>
                          </div>

                          {p.planType && (
                            <div className="rounded-2xl bg-blue-50/40 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 p-5 transition hover:bg-blue-50/60 dark:hover:bg-blue-950/40">
                              <h4 className="mb-4 text-xs font-black uppercase tracking-wider text-blue-500 flex items-center gap-1.5">
                                <Award className="h-4 w-4 text-blue-500" />
                                Selected Plan & Pricing
                              </h4>
                              <div className="space-y-1">
                                <InfoRow icon={Award} label="Plan Type" value={p.planType.charAt(0).toUpperCase() + p.planType.slice(1)} />
                                <InfoRow icon={Calendar} label="Days / Week" value={p.daysPerWeek ? `${p.daysPerWeek} Days` : "Not specified"} />
                                <InfoRow icon={Clock} label="Hours / Day" value={p.hoursPerDay ? `${p.hoursPerDay} Hr` : "Not specified"} />
                                <InfoRow icon={CreditCard} label="Monthly Fee" value={p.monthlyFees ? `?${p.monthlyFees.toLocaleString('en-IN')}` : "Not specified"} />
                                {p.totalBaseFee && p.totalBaseFee !== p.monthlyFees && (
                                  <InfoRow icon={CreditCard} label="Total Base Fee" value={`?${p.totalBaseFee.toLocaleString('en-IN')}`} />
                                )}
                                {p.siblingDiscount > 0 && (
                                  <InfoRow icon={CreditCard} label="Sibling Concession" value={`-?${p.siblingDiscount.toLocaleString('en-IN')} (${p.siblingConcessionPercent}%)`} />
                                )}
                              </div>
                            </div>
                          )}

                          {(p.businessName || p.professionType || p.otherOccupation) && (
                            <div className="rounded-2xl bg-slate-50/60 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 p-5 transition hover:bg-slate-50 dark:hover:bg-slate-800">
                              <h4 className="mb-4 text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <Briefcase className="h-4 w-4 text-indigo-500" />
                                Dynamic Occupation Info
                              </h4>

                              <div className="space-y-1">
                                <InfoRow icon={Building2} label="Business Name" value={p.businessName} />
                                <InfoRow icon={Briefcase} label="Profession Type" value={p.professionType} />
                                <InfoRow icon={Briefcase} label="Other Occupation" value={p.otherOccupation} />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="px-5 pb-5">
                          <h4 className="mb-4 text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <GraduationCap className="h-4.5 w-4.5 text-indigo-500" />
                            Students / Wards
                          </h4>

                          <div className="grid gap-4 md:grid-cols-2">
                            {p.wards?.length ? (
                              p.wards.map((ward, index) => (
                                <div
                                  key={index}
                                  className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/40 p-5 shadow-sm transition duration-200 hover:shadow"
                                >
                                  <div className="mb-3.5 flex items-center justify-between">
                                    <h5 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                                      <User className="h-4 w-4 text-slate-400" />
                                      Student {index + 1}
                                    </h5>
                                    <span className="rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                                      {ward.classGrade ? `Class ${ward.classGrade}` : "Class NA"}
                                    </span>
                                  </div>

                                  <div className="space-y-0.5">
                                    <InfoRow icon={User} label="Student Name" value={ward.studentName || ward.fullName} />
                                    <InfoRow icon={School} label="School" value={ward.schoolName} />
                                    <InfoRow icon={GraduationCap} label="Class" value={ward.classGrade} />
                                    <InfoRow icon={BookOpen} label="Curriculum" value={ward.curriculum} />
                                    <InfoRow icon={BookOpen} label="Subjects" value={getSubjects(ward.subjectsNeeded)} />
                                    <InfoRow icon={AlertCircle} label="Special Notes" value={ward.specialNeeds} />
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                No ward data available.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Expandable Match Tutors Panel */}
                        <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-800 pt-5">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              {p.requirementId && (
                                <span className="rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-150 dark:border-indigo-800 px-3 py-1.5 text-xs font-black text-indigo-700 dark:text-indigo-300">
                                  ID: {p.requirementId}
                                </span>
                              )}
                              {p.assignedTutor && (
                                <span className="rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 text-xs font-black text-emerald-700 dark:text-emerald-300">
                                  Assigned Tutor: {p.assignedTutor}
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => {
                                if (matchingLeadId === p._id) {
                                  setMatchingLeadId(null);
                                  setSelectedTutorIds([]);
                                  setTutorPanelTab("matches");
                                  setTutorSearchQuery("");
                                } else {
                                  setMatchingLeadId(p._id);
                                  setSelectedTutorIds([]);
                                  setTutorPanelTab("matches");
                                  setTutorSearchQuery("");
                                }
                              }}
                              className={`h-11 flex items-center justify-center gap-1.5 rounded-2xl px-5 text-xs font-extrabold transition-all duration-200 cursor-pointer ${
                                matchingLeadId === p._id
                                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-lg shadow-slate-950/20"
                                  : "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                              }`}
                            >
                              <Search className="h-4 w-4" />
                              {matchingLeadId === p._id ? "Close Search" : "Search Tutor"}
                            </button>
                          </div>

                          {matchingLeadId === p._id && (
                            <div className="mt-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 p-5 animate-slideFade">
                              <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 dark:border-slate-700 pb-4">
                                <div>
                                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                                    Matching Tutors ({matchedTutors.length} found)
                                  </h4>
                                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                                    Matched on Grade, Timing, Gender, and Locality.
                                  </p>
                                </div>

                                {!loadingMatches && matchedTutors.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-2">
                                    {/* Select All */}
                                    <button
                                      onClick={() => {
                                        if (selectedTutorIds.length === matchedTutors.length) {
                                          setSelectedTutorIds([]);
                                        } else {
                                          setSelectedTutorIds(matchedTutors.map(t => t._id));
                                        }
                                      }}
                                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
                                    >
                                      {selectedTutorIds.length === matchedTutors.length
                                        ? "Deselect All"
                                        : "Select All"}
                                    </button>

                                    {/* Action dropdown/buttons */}
                                    {selectedTutorIds.length > 0 && (
                                      <>
                                        <button
                                          onClick={() => {
                                            setBroadcastType("whatsapp");
                                            setBroadcastResults([]);
                                            setSelectedTemplateId("");
                                            fetchWhatsAppTemplates();
                                            setShowBroadcastModal(true);
                                          }}
                                          className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white hover:bg-emerald-700 transition cursor-pointer shadow-sm shadow-emerald-600/10"
                                        >
                                          Send WhatsApp ({selectedTutorIds.length})
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (window.confirm(`Send email to ${selectedTutorIds.length} tutors?`)) {
                                              alert("Emails dispatched successfully!");
                                              setSelectedTutorIds([]);
                                            }
                                          }}
                                          className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-black text-white hover:bg-blue-700 transition cursor-pointer shadow-sm shadow-blue-600/10"
                                        >
                                          Send Email ({selectedTutorIds.length})
                                        </button>
                                        {selectedTutorIds.length === 1 && (
                                          <button
                                            onClick={() => {
                                              if (window.confirm("Assign this tutor to the lead?")) {
                                                handleAssignTutor(selectedTutorIds[0]);
                                              }
                                            }}
                                            className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-black text-white hover:bg-indigo-700 transition cursor-pointer shadow-sm shadow-indigo-600/10"
                                          >
                                            Assign Tutor
                                          </button>
                                        )}
                                        <button
                                          onClick={() => setSelectedTutorIds([])}
                                          className="rounded-xl bg-slate-200 dark:bg-slate-700 px-3 py-2 text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition cursor-pointer"
                                        >
                                          Clear Selection
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Tab selector for Best Matches vs Search All Tutors */}
                              <div className="mb-4 flex border-b border-slate-200/80 dark:border-slate-700 text-[11px] font-black uppercase tracking-wider">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTutorPanelTab("matches");
                                    setSelectedTutorIds([]);
                                  }}
                                  className={`pb-2.5 pr-4 transition-all relative cursor-pointer ${
                                    tutorPanelTab === "matches" ? "text-indigo-650 dark:text-indigo-400 font-black" : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                  }`}
                                >
                                  Best Matches ({matchedTutors.length})
                                  {tutorPanelTab === "matches" && (
                                    <span className="absolute bottom-0 left-0 right-4 h-0.5 bg-indigo-600 dark:bg-indigo-500 rounded-full" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTutorPanelTab("all");
                                    setSelectedTutorIds([]);
                                  }}
                                  className={`pb-2.5 px-4 transition-all relative cursor-pointer ${
                                    tutorPanelTab === "all" ? "text-indigo-650 dark:text-indigo-400 font-black" : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                  }`}
                                >
                                  Search Other Tutors
                                  {tutorPanelTab === "all" && (
                                    <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-indigo-600 dark:bg-indigo-500 rounded-full" />
                                  )}
                                </button>
                              </div>

                              {loadingMatches && tutorPanelTab === "matches" ? (
                                <div className="py-12 text-center text-xs font-bold text-slate-500 flex flex-col items-center justify-center gap-2">
                                  <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
                                  Searching Master Tutors at database level...
                                </div>
                              ) : (() => {
                                // Decide list of tutors to display based on selected tab
                                let tutorsList = [];
                                if (tutorPanelTab === "matches") {
                                  tutorsList = matchedTutors;
                                } else {
                                  // "Search Other Tutors" filters over ALL loaded database tutors
                                  tutorsList = tutors.filter(t => {
                                    const q = tutorSearchQuery.toLowerCase().trim();
                                    if (!q) return false; // Show nothing by default until query is typed
                                    return (
                                      String(t.name || "").toLowerCase().includes(q) ||
                                      String(t.phone || "").toLowerCase().includes(q) ||
                                      String(t.whatsapp || "").toLowerCase().includes(q) ||
                                      String(t.email || "").toLowerCase().includes(q) ||
                                      String(t.tutorCode || "").toLowerCase().includes(q)
                                    );
                                  });
                                }

                                return (
                                  <>
                                    {tutorPanelTab === "all" && (
                                      <div className="mb-4 relative">
                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                                          <Search className="h-3.5 w-3.5" />
                                        </span>
                                        <input
                                          type="text"
                                          placeholder="Type name, phone, email, or code to search any tutor..."
                                          value={tutorSearchQuery}
                                          onChange={(e) => setTutorSearchQuery(e.target.value)}
                                          className="w-full h-10 pl-9 pr-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800 dark:text-slate-200"
                                        />
                                      </div>
                                    )}

                                    {tutorPanelTab === "all" && !tutorSearchQuery.trim() && (
                                      <div className="py-8 text-center text-xs font-bold text-slate-400 dark:text-slate-500">
                                        Enter search query above to find any tutor in the master database.
                                      </div>
                                    )}

                                    {tutorPanelTab === "matches" && tutorsList.length === 0 && (
                                      <div className="py-6 text-center text-xs font-bold text-slate-400 dark:text-slate-500">
                                        No best matches found for this tuition location.
                                      </div>
                                    )}

                                    {tutorSearchQuery.trim() && tutorPanelTab === "all" && tutorsList.length === 0 && (
                                      <div className="py-6 text-center text-xs font-bold text-slate-400 dark:text-slate-500">
                                        No tutors found matching your search.
                                      </div>
                                    )}

                                    {tutorsList.length > 0 && (
                                      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                                        {tutorsList.map(t => {
                                    const isSelected = selectedTutorIds.includes(t._id);
                                    return (
                                      <div
                                        key={t._id}
                                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border transition duration-200 bg-white dark:bg-slate-800 ${
                                          isSelected ? "border-indigo-400 bg-indigo-50/20 dark:border-indigo-600 dark:bg-indigo-900/30" : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                                        }`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => {
                                              if (isSelected) {
                                                setSelectedTutorIds(selectedTutorIds.filter(id => id !== t._id));
                                              } else {
                                                setSelectedTutorIds([...selectedTutorIds, t._id]);
                                              }
                                            }}
                                            className="h-4.5 w-4.5 rounded text-indigo-600 dark:bg-slate-900 border-slate-300 dark:border-slate-600 focus:ring-indigo-500"
                                          />
                                          {t.photo ? (
                                            <img
                                              src={t.photo}
                                              alt={t.name}
                                              className="h-12 w-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                                            />
                                          ) : (
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 dark:from-indigo-900 dark:to-blue-900 text-xs font-black text-indigo-600 dark:text-indigo-300">
                                              {t.name?.charAt(0) || "?"}
                                            </div>
                                          )}

                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <p className="font-extrabold text-slate-900 dark:text-white text-sm">{t.name}</p>

                                              {/* Match % badge */}
                                              {t.matchPercentage !== undefined && t.matchPercentage > 0 ? (
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black border ${
                                                  t.matchPercentage >= 80
                                                    ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                                                    : t.matchPercentage >= 60
                                                    ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                                                    : "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                                                }`}>
                                                  {t.matchPercentage}% Match
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center rounded-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2 py-0.5 text-[10px] font-black text-slate-500 dark:text-slate-300">
                                                  No Match
                                                </span>
                                              )}

                                              {/* Distance badge */}
                                              {t.distanceTier && t.distanceTier !== "Unknown" && (
                                                <span className="inline-flex items-center rounded-full bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800 px-2 py-0.5 text-[10px] font-black text-violet-700 dark:text-violet-300">
                                                  📍 {t.distanceTier}
                                                </span>
                                              )}

                                              {/* Onboarding badge */}
                                              {t.onboardingCompleted ? (
                                                <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-250 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:text-emerald-300">
                                                  🟢 Ready to Broadcast
                                                </span>
                                              ) : t.onboardingMessageSentAt ? (
                                                <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-900/30 border border-amber-250 dark:border-amber-800 px-2 py-0.5 text-[10px] font-black text-amber-700 dark:text-amber-300">
                                                  🟡 Onboarding Sent
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center rounded-full bg-orange-50 dark:bg-orange-900/30 border border-orange-250 dark:border-orange-800 px-2 py-0.5 text-[10px] font-black text-orange-700 dark:text-orange-300">
                                                  🟠 Onboarding Pending
                                                </span>
                                              )}

                                              {/* Broadcast status overlay */}
                                              {t.broadcastStatus && (
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black border ${
                                                  t.broadcastResponseStatus === "Assigned"
                                                    ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
                                                    : t.broadcastResponseStatus === "Interested"
                                                    ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                                                    : t.broadcastResponseStatus === "Not Interested"
                                                    ? "bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                                                    : "bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"
                                                }`}>
                                                  {t.broadcastResponseStatus === "Assigned" ? "✓ Assigned" :
                                                   t.broadcastResponseStatus === "Interested" ? "✓ Interested" :
                                                   t.broadcastResponseStatus === "Not Interested" ? "✗ Not Interested" :
                                                   t.broadcastStatus === "Sent" || t.broadcastStatus === "Delivered" ? "📤 Sent" :
                                                   t.broadcastStatus === "Failed" ? "⚠ Failed" :
                                                   "Already Broadcast"}
                                                </span>
                                              )}
                                            </div>

                                            <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                                              <span className="bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2 py-0.5 rounded-full">
                                                {t.gender || "N/A"}
                                              </span>
                                              <span className="bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2 py-0.5 rounded-full">
                                                Exp: {t.experience || "N/A"}
                                              </span>
                                              <span className="bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2 py-0.5 rounded-full">
                                                {t.area || t.location || "N/A"}
                                              </span>
                                              {t.grades?.length > 0 && (
                                                <span className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 px-2 py-0.5 rounded-full text-indigo-600 dark:text-indigo-300">
                                                  {t.grades.join(", ")}
                                                </span>
                                              )}
                                              {t.boards?.length > 0 && (
                                                <span className="bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800 px-2 py-0.5 rounded-full text-teal-700 dark:text-teal-300">
                                                  {t.boards.slice(0,3).join(" • ")}
                                                </span>
                                              )}
                                              {t.subjects?.length > 0 && (
                                                <span className="bg-purple-50 dark:bg-purple-900/30 border border-purple-100 dark:border-purple-800 px-2 py-0.5 rounded-full text-purple-700 dark:text-purple-300">
                                                  {t.subjects.slice(0,3).join(", ")}
                                                </span>
                                              )}
                                              <span className={`px-2 py-0.5 rounded-full border ${
                                                t.availabilityStatus === "Available"
                                                  ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                                                  : t.availabilityStatus === "Busy"
                                                  ? "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                                                  : t.availabilityStatus === "Blocked"
                                                  ? "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
                                                  : "bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"
                                              }`}>
                                                {t.availabilityStatus || "Available"}
                                              </span>
                                              <span className={`px-2 py-0.5 rounded-full border ${
                                                t.status === "approved"
                                                  ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                                                  : t.status === "rejected"
                                                  ? "bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                                                  : "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                                              }`}>
                                                {t.status?.toUpperCase() || "PENDING"}
                                              </span>
                                              {t.qualification && (
                                                <span className="bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2 py-0.5 rounded-full">
                                                  {t.qualification}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                          <button
                                            onClick={() => {
                                              setAssignModalTutorId(t._id);
                                              setAssignDemoDate("");
                                              setAssignDemoTime("");
                                            }}
                                            className="px-3 py-1.5 text-xs font-black text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-indigo-150 dark:border-indigo-800 rounded-xl transition cursor-pointer"
                                          >
                                            Assign
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          );
                        })()}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              filteredDrafts.length === 0 ? (
                <EmptyState text="No incomplete draft leads found for this search." />
              ) : (
                <div className="grid gap-5">
                  {filteredDrafts.map((p) => (
                    <div
                      key={p._id}
                      className="overflow-hidden rounded-3xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200/80 dark:border-slate-800 border-l-4 border-l-amber-500 transition duration-300 hover:shadow-lg animate-slideFade"
                    >
                      <div className="border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-amber-50/20 to-white dark:from-amber-900/10 dark:to-slate-900 p-5">
                        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                                {p.formData?.parentName || p.formData?.name || "Anonymous Parent"}
                              </h3>

                              <Badge
                                text={`Dropped at Step ${p.stepReached}`}
                                color="yellow"
                              />

                              {p.geoInfo?.city && (
                                <Badge
                                  text={`Filled from: ${p.geoInfo.city}, ${p.geoInfo.region || ""}`}
                                  color="emerald"
                                />
                              )}

                              {p.ipAddress && (
                                <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold">
                                  IP: {p.ipAddress}
                                </span>
                              )}
                            </div>

                            <p className="mt-2 text-xs font-bold text-slate-400 dark:text-slate-500">
                              Last Updated: {formatSubmittedDate(p.updatedAt)}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDeleteDraft(p._id)}
                              className="h-11 flex items-center justify-center gap-1.5 rounded-2xl bg-rose-500 px-4 text-xs font-bold text-white transition hover:bg-rose-600 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete Draft
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-5 p-5 lg:grid-cols-3">
                        <div className="rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700 p-5 transition hover:bg-slate-50 dark:hover:bg-slate-800">
                          <h4 className="mb-4 text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                            <User className="h-4 w-4 text-blue-500" />
                            Contact Details
                          </h4>

                          <div className="space-y-1">
                            <InfoRow icon={Phone} label="Phone" value={p.formData?.phone || p.emailOrPhone} />
                            <InfoRow icon={Mail} label="Email" value={p.formData?.email || p.emailOrPhone} />
                            <InfoRow icon={MapPin} label="Address" value={p.formData?.address} />
                          </div>
                        </div>

                        {p.stepReached >= 3 && p.formData?.preferredMode ? (
                          <div className="rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700 p-5 transition hover:bg-slate-50 dark:hover:bg-slate-800">
                            <h4 className="mb-4 text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                              <Settings className="h-4 w-4 text-purple-500" />
                              Tutor Preference
                            </h4>
                            <div className="space-y-1">
                              <InfoRow icon={BookOpen} label="Preferred Mode" value={p.formData.preferredMode} />
                              <InfoRow icon={User} label="Preferred Gender" value={p.formData.preferredGender} />
                              <InfoRow icon={Clock} label="Preferred Time" value={p.formData.preferredTime || (p.formData.startTime && `${p.formData.startTime} - ${p.formData.endTime}`)} />
                              <InfoRow icon={Clock} label="Class Duration" value={p.formData.classDuration} />
                              <InfoRow icon={Calendar} label="Preferred Days" value={getPreferredDays(p.formData.preferredDays)} />
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-2xl bg-slate-50/40 dark:bg-slate-800/20 border border-dashed border-slate-200 dark:border-slate-700 p-5 flex flex-col justify-center items-center text-center">
                            <AlertCircle className="h-5 w-5 text-slate-400 mb-2" />
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500">Tutor Preferences</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-1">Not reached/filled yet</p>
                          </div>
                        )}

                        {p.formData?.planType ? (
                          <div className="rounded-2xl bg-amber-50/20 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-5 transition hover:bg-amber-50/30 dark:hover:bg-amber-900/20">
                            <h4 className="mb-4 text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-500 flex items-center gap-1.5">
                              <Award className="h-4 w-4 text-amber-700" />
                              Selected Plan & Pricing
                            </h4>
                            <div className="space-y-1">
                              <InfoRow icon={Award} label="Plan Type" value={p.formData.planType.charAt(0).toUpperCase() + p.formData.planType.slice(1)} />
                              <InfoRow icon={Calendar} label="Days / Week" value={p.formData.daysPerWeek ? `${p.formData.daysPerWeek} Days` : "Not specified"} />
                              <InfoRow icon={Clock} label="Hours / Day" value={p.formData.hoursPerDay ? `${p.formData.hoursPerDay} Hr` : "Not specified"} />
                              <InfoRow icon={CreditCard} label="Monthly Fee" value={p.formData.monthlyFees ? `?${p.formData.monthlyFees.toLocaleString('en-IN')}` : "Not specified"} />
                              {p.formData.totalBaseFee && p.formData.totalBaseFee !== p.formData.monthlyFees && (
                                <InfoRow icon={CreditCard} label="Total Base Fee" value={`?${p.formData.totalBaseFee.toLocaleString('en-IN')}`} />
                              )}
                              {p.formData.siblingDiscount > 0 && (
                                <InfoRow icon={CreditCard} label="Sibling Concession" value={`-?${p.formData.siblingDiscount.toLocaleString('en-IN')} (${p.formData.siblingConcessionPercent}%)`} />
                              )}
                            </div>
                          </div>
                        ) : null}

                        {p.geoInfo && Object.keys(p.geoInfo).length > 0 && (
                          <div className="rounded-2xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700 p-5 transition hover:bg-slate-50 dark:hover:bg-slate-800">
                            <h4 className="mb-4 text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                              <MapPin className="h-4 w-4 text-emerald-500" />
                              Geolocation Meta
                            </h4>
                            <div className="space-y-1">
                              <InfoRow icon={MapPin} label="IP Address" value={p.ipAddress} />
                              <InfoRow icon={MapPin} label="City" value={p.geoInfo.city} />
                              <InfoRow icon={MapPin} label="Region" value={p.geoInfo.region} />
                              <InfoRow icon={MapPin} label="Postal PIN" value={p.geoInfo.postal} />
                              <InfoRow icon={MapPin} label="Country" value={p.geoInfo.country} />
                              <InfoRow icon={Building2} label="Provider (Org)" value={p.geoInfo.org} />
                            </div>
                          </div>
                        )}
                      </div>

                      {p.stepReached >= 2 && p.formData?.wards?.length > 0 ? (
                        <div className="px-5 pb-5">
                          <h4 className="mb-4 text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                            <GraduationCap className="h-4.5 w-4.5 text-indigo-500" />
                            Wards/Students Details (Incomplete)
                          </h4>

                          <div className="grid gap-4 md:grid-cols-2">
                            {p.formData.wards.map((ward, index) => (
                              <div
                                key={index}
                                className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 p-5 shadow-sm"
                              >
                                <div className="mb-3.5 flex items-center justify-between">
                                  <h5 className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                                    <User className="h-4 w-4 text-slate-400" />
                                    Student {index + 1}
                                  </h5>
                                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                                    {ward.classGrade ? `Class ${ward.classGrade}` : "Class NA"}
                                  </span>
                                </div>

                                <div className="space-y-0.5">
                                  <InfoRow icon={User} label="Student Name" value={ward.studentName || ward.fullName} />
                                  <InfoRow icon={School} label="School" value={ward.schoolName} />
                                  <InfoRow icon={GraduationCap} label="Class" value={ward.classGrade} />
                                  <InfoRow icon={BookOpen} label="Curriculum" value={ward.curriculum} />
                                  <InfoRow icon={BookOpen} label="Subjects" value={getSubjects(ward.subjectsNeeded)} />
                                  <InfoRow icon={AlertCircle} label="Special Notes" value={ward.specialNeeds} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )
            )}
          </section>
        )}

        <section className="mb-10 animate-slideFade">
          <SectionHeader icon={Mail} title="Enquiries" subtitle="General website enquiries." />

          {enquiries.length === 0 ? (
            <EmptyState text="No enquiries yet." />
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {enquiries.map((e) => (
                <div
                  key={e._id}
                  className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200/80 dark:border-slate-800 transition duration-300 hover:shadow-lg"
                >
                  <p className="text-lg font-black text-slate-900 dark:text-white">
                    {e.parentName || e.name || "Unnamed"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Student: {e.studentName || "Not provided"}
                  </p>
                  <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                    {e.phone || "No phone"} | {e.email || "No email"}
                  </p>
                  <p className="mt-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Subject required: {e.subjectNeeded || e.subject || "Subject not provided"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mb-10 animate-slideFade">
          <SectionHeader icon={Calendar} title="Bookings" subtitle="Student booking requests." />

          {bookings.length === 0 ? (
            <EmptyState text="No bookings yet." />
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {bookings.map((b) => (
                <div
                  key={b._id}
                  className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200/80 dark:border-slate-800 transition duration-300 hover:shadow-lg"
                >
                  <p className="text-lg font-black text-slate-900 dark:text-white">
                    Tutor: {b.tutorName || "Tutor not provided"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-400">
                    Learner: {b.learnerName || "Learner not provided"} | Phone: {b.phone || "No phone"}
                  </p>
                  <p className="mt-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Slot: {b.preferredDate || "Date not provided"} - {b.preferredSlot || "Slot not provided"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {showTutors && (
          <section className="mb-10 animate-slideFade">
            <SectionHeader
              icon={Award}
              title="Tutors"
              subtitle="Approve, reject, edit, and manage tutors."
            />

            {tutors.length === 0 ? (
              <EmptyState text="No tutors yet." />
            ) : (
              <div className="grid gap-5">
                {filteredTutors.map((t) => {
                  const statusBorderColors = {
                    approved: "border-l-4 border-l-emerald-500",
                    rejected: "border-l-4 border-l-rose-500",
                    pending: "border-l-4 border-l-amber-500",
                  };
                  const tStatus = t.status || "pending";
                  const tBorderClass = statusBorderColors[tStatus] || "border-l-4 border-l-slate-400";

                  return (
                    <div
                      key={t._id}
                      className={`rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200/80 dark:border-slate-800 transition duration-300 hover:shadow-lg ${tBorderClass} animate-slideFade`}
                    >
                      <div className="flex flex-col justify-between gap-6 lg:flex-row">
                        <div className="flex flex-col gap-6 sm:flex-row items-start">
                          {t.photo ? (
                            <img
                              src={t.photo.replace(
                                "/upload/",
                                "/upload/f_auto,q_auto,w_180/"
                              )}
                              alt={t.name}
                              loading="lazy"
                              className="h-28 w-28 rounded-3xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
                            />
                          ) : (
                            <div className="flex h-28 w-28 items-center justify-center rounded-3xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-400">
                              No Image
                            </div>
                          )}

                          <div className="flex-1">
                            <div className="mb-3.5 flex flex-wrap items-center gap-2">
                              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                                {t.name || "Unnamed Tutor"}
                              </h3>

                              {t.status === "approved" && (
                                <Badge text="Approved" color="emerald" />
                              )}
                              {t.status === "rejected" && (
                                <Badge text="Rejected" color="red" />
                              )}
                              {(!t.status || t.status === "pending") && (
                                <Badge text="Pending" color="yellow" />
                              )}

                              {t.onboardingCompleted ? (
                                <Badge text="Onboarding Completed" color="emerald" />
                              ) : t.onboardingMessageSentAt ? (
                                <Badge text="Onboarding Sent" color="orange" />
                              ) : (
                                <Badge text="Onboarding Pending" color="slate" />
                              )}

                              {t.odooSyncStatus === "failed" ? (
                                <Badge text={`⚠ Odoo Sync Failed${t.odooSyncError ? `: ${t.odooSyncError}` : ""}`} color="red" />
                              ) : (t.odooSyncStatus === "synced" || t.odooLeadId) ? (
                                <Badge text={`Odoo Synced${t.tutorCode ? ` (${t.tutorCode})` : ""}`} color="emerald" />
                              ) : null}
                            </div>

                            <div className="grid gap-x-8 gap-y-2 text-sm text-slate-700 dark:text-slate-300 md:grid-cols-2">
                              <InfoRow icon={Mail} label="Email" value={t.email} />
                              <InfoRow icon={Phone} label="Phone" value={t.phone} />
                              <InfoRow
                                icon={Briefcase}
                                label="Occupation"
                                value={
                                  t.hasOccupation === "yes" ? t.occupation : "No"
                                }
                              />
                              <InfoRow icon={Building2} label="Organization" value={t.organization} />
                              <InfoRow icon={Award} label="Experience" value={t.experience} />
                              <InfoRow
                                icon={MapPin}
                                label="Locations"
                                value={t.locations?.join(", ")}
                              />
                              <InfoRow
                                icon={Briefcase}
                                label="Vehicle"
                                value={
                                  t.hasVehicle === "yes"
                                    ? `Yes (${t.vehicleNumber || "No number"})`
                                    : "No"
                                }
                              />
                              <InfoRow
                                icon={Clock}
                                label="Timings"
                                value={t.timings?.join(", ")}
                              />
                            </div>

                            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                              <p className="mb-2.5 text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                                <FileText className="h-4 w-4" />
                                Verification Documents
                              </p>

                              <div className="flex flex-wrap gap-2">
                                <DocumentLink
                                  href={t.documents?.idProof}
                                  label="ID Proof"
                                />

                                <ProtectedDocumentLink
                                  href={t.documents?.expCert}
                                  label="Education Certificate"
                                  password={EDUCATION_CERT_PASSWORD}
                                />

                                <DocumentLink
                                  href={t.documents?.otherDoc}
                                  label="Experience Certificate"
                                />
                              </div>
                            </div>

                            {t.performanceStats && (
                              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 animate-slideFade">
                                <p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                                  <Activity className="h-4 w-4 text-indigo-500" />
                                  CRM Performance Statistics
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                                  <div className="text-center p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
                                    <span className="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Total Assignments</span>
                                    <span className="block text-lg font-black text-slate-800 dark:text-white mt-0.5">{t.performanceStats.totalAssignments}</span>
                                  </div>
                                  <div className="text-center p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
                                    <span className="block text-[10px] font-black uppercase text-amber-500">Demo Scheduled</span>
                                    <span className="block text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">{t.performanceStats.demoScheduled}</span>
                                  </div>
                                  <div className="text-center p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
                                    <span className="block text-[10px] font-black uppercase text-rose-500">Demo Cancelled</span>
                                    <span className="block text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">{t.performanceStats.demoCancelled}</span>
                                  </div>
                                  <div className="text-center p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
                                    <span className="block text-[10px] font-black uppercase text-red-500">Rejected</span>
                                    <span className="block text-lg font-black text-red-650 dark:text-red-400 mt-0.5">{t.performanceStats.rejected}</span>
                                  </div>
                                  <div className="text-center p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
                                    <span className="block text-[10px] font-black uppercase text-emerald-500">Enrolled</span>
                                    <span className="block text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{t.performanceStats.successfullyEnrolled}</span>
                                  </div>
                                  <div className="text-center p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
                                    <span className="block text-[10px] font-black uppercase text-indigo-500">Active Tuitions</span>
                                    <span className="block text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5">{t.performanceStats.activeTuitionCount}</span>
                                  </div>
                                  <div className="col-span-2 text-center p-2 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/40 dark:to-purple-900/40 border border-indigo-150 dark:border-indigo-800 flex flex-col justify-center">
                                    <span className="block text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-300">Success Rate</span>
                                    <span className="block text-xl font-black text-indigo-700 dark:text-indigo-200">{t.performanceStats.successPercentage}%</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-row flex-wrap items-center gap-2 lg:flex-col lg:items-stretch lg:justify-start lg:w-32 shrink-0 border-t border-slate-100 dark:border-slate-800 pt-4 lg:border-t-0 lg:pt-0 lg:pl-4 lg:border-l lg:border-slate-105">
                          <button
                            onClick={() => approveTutor(t._id)}
                            className="flex-1 flex items-center justify-center gap-1 rounded-2xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition duration-200 hover:bg-emerald-700 hover:scale-[1.02] cursor-pointer"
                          >
                            <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                            Approve
                          </button>

                          <button
                            onClick={() => rejectTutor(t._id)}
                            className="flex-1 flex items-center justify-center gap-1 rounded-2xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white transition duration-200 hover:bg-rose-700 hover:scale-[1.02] cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5 stroke-[2.5]" />
                            Reject
                          </button>

                          <button
                            onClick={() => startEditTutor(t)}
                            className="flex-1 flex items-center justify-center gap-1 rounded-2xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition duration-200 hover:bg-blue-700 hover:scale-[1.02] cursor-pointer"
                          >
                            <Edit className="h-3.5 w-3.5 stroke-[2.5]" />
                            Edit
                          </button>

                          {!t.onboardingCompleted ? (
                            <button
                              onClick={async () => {
                                if (!window.confirm(`Mark ${t.name} as Onboarding Completed? This will also set status to Approved.`)) return;
                                try {
                                  const token = localStorage.getItem("adminToken");
                                  const res = await fetch(`${API_BASE}/tutors/${t._id}/mark-onboarded`, {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                    body: JSON.stringify({ onboardingCompleted: true }),
                                  });
                                  if (res.ok) { alert("✅ Tutor marked as Onboarding Completed!"); fetchData(); }
                                  else { const d = await res.json(); alert(`Failed: ${d.message}`); }
                                } catch (err) { console.error(err); alert("Error updating tutor onboarding."); }
                              }}
                              className="flex-1 flex items-center justify-center gap-1 rounded-2xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white transition duration-200 hover:bg-indigo-700 hover:scale-[1.02] cursor-pointer"
                            >
                              <UserCheck className="h-3.5 w-3.5 stroke-[2.5]" />
                              Mark Onboarded
                            </button>
                          ) : (
                            <button
                              onClick={async () => {
                                if (!window.confirm(`Reset onboarding for ${t.name}?`)) return;
                                try {
                                  const token = localStorage.getItem("adminToken");
                                  const res = await fetch(`${API_BASE}/tutors/${t._id}/mark-onboarded`, {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                    body: JSON.stringify({ onboardingCompleted: false }),
                                  });
                                  if (res.ok) { alert("✅ Onboarding reset to Pending."); fetchData(); }
                                  else { const d = await res.json(); alert(`Failed: ${d.message}`); }
                                } catch (err) { console.error(err); alert("Error resetting onboarding."); }
                              }}
                              className="flex-1 flex items-center justify-center gap-1 rounded-2xl bg-slate-500 px-4 py-2.5 text-xs font-bold text-white transition duration-200 hover:bg-slate-600 hover:scale-[1.02] cursor-pointer"
                            >
                              <XCircle className="h-3.5 w-3.5 stroke-[2.5]" />
                              Reset Onboarding
                            </button>
                          )}

                          <button
                            onClick={() => deleteTutor(t._id)}
                            className="flex-1 flex items-center justify-center gap-1 rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition duration-200 hover:bg-black hover:scale-[1.02] cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5 stroke-[2.5]" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

          </>
        )}

        {currentMainTab === "analytics" && (
          <AnalyticsConsole
            data={analyticsData}
            loading={loadingAnalytics}
            period={period}
            setPeriod={setPeriod}
            refresh={fetchAnalyticsData}
          />
        )}

        {currentMainTab === "attendance" && (
          <AdminAttendanceConsole
            parentEnquiries={parentEnquiries}
            fetchLeadAttendanceLogs={fetchLeadAttendanceLogs}
            attendanceLogs={attendanceLogs}
            fetchingLogsLeadId={fetchingLogsLeadId}
            setAttendanceLogs={setAttendanceLogs}
            fetchData={fetchData}
          />
        )}

        {editingTutor && (
          <TutorModal
            title="Edit Tutor"
            form={editForm}
            setForm={setEditForm}
            primaryText="Save Changes"
            onPrimary={saveTutorEdit}
            onClose={() => setEditingTutor(null)}
          />
        )}

        {showAddForm && (
          <TutorModal
            title="Add Tutor"
            form={newTutor}
            setForm={setNewTutor}
            primaryText="Add Tutor"
            onPrimary={createTutor}
            onClose={() => setShowAddForm(false)}
          />
        )}

        {/* Broadcast Confirm + Results Modal */}
        {showBroadcastModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-slideFade">
            <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 shadow-2xl flex flex-col relative z-50 max-h-[85vh]">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4 mb-4">
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white">
                    WhatsApp Broadcast
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                    Sending target messages to {selectedTutorIds.length} tutor(s) via Odoo WhatsApp.
                  </p>
                </div>
                <button
                  onClick={() => { setShowBroadcastModal(false); setBroadcastResults([]); }}
                  className="rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 p-2 text-slate-500 transition cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Privacy Notice */}
              <div className="mb-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3.5">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-200">
                  🔒 <strong>Privacy Protected:</strong> Parent details (name, phone, address, map link) are NEVER shared with tutors during broadcasts.
                </p>
              </div>

              {/* Template Picker */}
              {broadcastResults.length === 0 && (
                <div className="mb-4">
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    WhatsApp Template {loadingTemplates && <span className="font-normal text-slate-400">(loading...)</span>}
                  </label>
                  {whatsappTemplates.length > 0 ? (
                    <select
                      value={selectedTemplateId}
                      onChange={e => setSelectedTemplateId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition cursor-pointer"
                    >
                      <option value="">— Auto-select (use env default) —</option>
                      {whatsappTemplates.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name}{t.lang && t.lang !== "en" ? ` (${t.lang})` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                      {loadingTemplates ? "Fetching approved templates from Odoo…" : "No approved templates found — using environment default."}
                    </div>
                  )}
                </div>
              )}

              {/* Pre-broadcast Preview list */}
              {broadcastResults.length === 0 && (
                <div className="flex-1 overflow-y-auto space-y-2 mb-4 max-h-[260px] border border-slate-100 dark:border-slate-700 p-2 rounded-2xl bg-slate-50/50 dark:bg-slate-800/50">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Tutor Workflow Breakdown:</p>
                  {selectedTutorIds.map((tId) => {
                    const tutor = matchedTutors.find(t => t._id === tId);
                    if (!tutor) return null;
                    const isNewTutorWorkflow = !(tutor.status === "approved" && tutor.onboardingCompleted);
                    return (
                      <div key={tId} className="flex items-center justify-between rounded-xl p-2.5 border border-slate-200 dark:border-slate-700 text-xs font-bold bg-white dark:bg-slate-700 shadow-sm">
                        <span className="text-slate-800 dark:text-slate-200">{tutor.name}</span>
                        <span>
                          {isNewTutorWorkflow ? (
                            <span className="inline-flex items-center rounded-full bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 px-2 py-0.5 text-[10px] font-black text-orange-700 dark:text-orange-300">
                              🔐 Onboarding Msg (Odoo ID 72)
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:text-emerald-300">
                              📋 Requirement Msg
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Results (shown after send) */}
              {broadcastResults.length > 0 && (
                <div className="flex-1 overflow-y-auto space-y-2 mb-4 max-h-[260px]">
                  {broadcastResults.map((r, i) => {
                    const tutor = matchedTutors.find(t => t._id === r.tutorId);
                    const isNewTutorWorkflow = tutor ? !(tutor.status === "approved" && tutor.onboardingCompleted) : (r.workflow === "onboarding");
                    return (
                      <div key={i} className={`flex flex-col rounded-xl p-3 border text-xs font-bold ${
                        r.status === "Sent" ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                        : r.status === "Suppressed" ? "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
                        : "bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
                      }`}>
                        <div className="flex items-center justify-between">
                          <span>{r.tutorName || r.tutorId}</span>
                          <span className="flex items-center gap-2">
                            {r.status === "Sent" ? "✅ Sent" : r.status === "Suppressed" ? "⚠ Suppressed" : `❌ ${r.failureReason || "Failed"}`}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                          Workflow: {isNewTutorWorkflow ? "🔐 Onboarding Message" : "📋 Requirement Notification"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                <button
                  onClick={() => { setShowBroadcastModal(false); setSelectedTutorIds([]); setBroadcastResults([]); }}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition cursor-pointer"
                >
                  {broadcastResults.length > 0 ? "Close" : "Cancel"}
                </button>
                {broadcastResults.length === 0 && (
                  <button
                    onClick={handleSendBroadcast}
                    disabled={sendingBroadcast}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-xs font-black rounded-xl transition cursor-pointer text-white shadow-lg shadow-emerald-600/25 disabled:opacity-50 flex items-center gap-2"
                  >
                    {sendingBroadcast ? (
                      <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Sending...</>
                    ) : (
                      `Confirm & Send (${selectedTutorIds.length})`
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Assign Demo Modal */}
        {assignModalTutorId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-slideFade">
            <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 shadow-2xl">
              <h3 className="text-lg font-black text-slate-800 dark:text-white mb-1">Assign & Schedule Demo</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-5">
                Parent contact details will be sent to the tutor automatically via WhatsApp after assignment.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">Demo Date <span className="text-slate-400 font-semibold">(optional)</span></label>
                  <input
                    type="date"
                    value={assignDemoDate}
                    onChange={e => setAssignDemoDate(e.target.value)}
                    className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">Demo Time <span className="text-slate-400 font-semibold">(optional)</span></label>
                  <input
                    type="time"
                    value={assignDemoTime}
                    onChange={e => setAssignDemoTime(e.target.value)}
                    className="h-11 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>
              </div>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={() => setAssignModalTutorId(null)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleAssignTutor(assignModalTutorId, assignDemoDate, assignDemoTime);
                    setAssignModalTutorId(null);
                  }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-xs font-black rounded-xl transition cursor-pointer text-white shadow-lg shadow-indigo-600/20"
                >
                  Confirm Assignment
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Broadcast Logs Modal */}
        {showLogsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-slideFade">
            <div className="max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 shadow-2xl flex flex-col relative z-50">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4 mb-4">
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <Users className="h-5 w-5 text-indigo-500" />
                    Broadcast History Logs
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                    Real-time WhatsApp delivery tracking, tutor responses, and failure diagnostics.
                  </p>
                </div>
                <button
                  onClick={() => setShowLogsModal(false)}
                  className="rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 p-2 text-slate-500 transition cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[300px]">
                {broadcastLogs.length === 0 ? (
                  <div className="text-center py-20 text-xs text-slate-400 font-semibold italic">No broadcast events logged yet.</div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    <table className="w-full text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <thead>
                        <tr className="text-left border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900 text-[10px] text-slate-500 uppercase tracking-wider">
                          <th className="p-3">Time</th>
                          <th className="p-3">Tutor</th>
                          <th className="p-3">Req ID</th>
                          <th className="p-3">Match</th>
                          <th className="p-3">Delivery</th>
                          <th className="p-3">Failure Reason</th>
                          <th className="p-3">Response</th>
                          <th className="p-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {broadcastLogs.map((log) => {
                          const timeStr = formatSubmittedDate(log.time || log.createdAt);
                          return (
                            <tr key={log._id} className="border-b border-slate-200/70 dark:border-slate-700 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                              <td className="p-3 text-slate-500 dark:text-slate-400 text-[10px]">{timeStr}</td>
                              <td className="p-3 text-slate-900 dark:text-white font-bold">
                                <span className="block">{log.tutorName}</span>
                                {log.tutorCode && <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-black">{log.tutorCode}</span>}
                              </td>
                              <td className="p-3 text-indigo-600 dark:text-indigo-400 font-black text-[10px]">{log.requirementId}</td>
                              <td className="p-3">
                                {log.matchPercentage != null ? (
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                    log.matchPercentage >= 80 ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                                    : log.matchPercentage >= 60 ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                                    : "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                                  }`}>{log.matchPercentage}%</span>
                                ) : <span className="text-slate-400">—</span>}
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                  log.status === "Delivered" || log.status === "Read" || log.status === "Replied"
                                    ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                                    : log.status === "Sent"
                                    ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300"
                                    : log.status === "Failed"
                                    ? "bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                                    : log.status === "Suppressed"
                                    ? "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                                    : "bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"
                                }`}>
                                  {log.status}
                                </span>
                              </td>
                              <td className="p-3 text-[10px] text-rose-600 dark:text-rose-400 font-semibold max-w-[120px] truncate">
                                {log.failureReason || "—"}
                              </td>
                              <td className="p-3">
                                <select
                                  value={log.responseStatus || "No Response"}
                                  onChange={(e) => handleUpdateResponseStatus(log._id, e.target.value)}
                                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-black text-slate-700 dark:text-slate-300 rounded-lg p-1.5 outline-none focus:border-indigo-500 cursor-pointer"
                                >
                                  <option value="No Response">No Response</option>
                                  <option value="Interested">Interested</option>
                                  <option value="Not Interested">Not Interested</option>
                                  <option value="Accepted">Accepted</option>
                                  <option value="Rejected">Rejected</option>
                                  <option value="Assigned">Assigned</option>
                                  <option value="Joined">Joined</option>
                                </select>
                              </td>
                              <td className="p-3">
                                {log.status === "Failed" && log.retryCount < 3 && (
                                  <button
                                    onClick={async () => {
                                      const token = localStorage.getItem("adminToken");
                                      const res = await fetch(`${API_BASE}/parent-enquiries/broadcast-logs/${log._id}/retry`, {
                                        method: "POST",
                                        headers: { Authorization: `Bearer ${token}` }
                                      });
                                      const data = await res.json();
                                      alert(data.message);
                                      fetchBroadcastLogs();
                                    }}
                                    className="px-2.5 py-1 text-[10px] font-black bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-lg hover:bg-rose-100 transition cursor-pointer"
                                  >
                                    Retry
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                <button
                  onClick={() => setShowLogsModal(false)}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-xs font-black rounded-xl transition cursor-pointer text-white shadow-lg shadow-indigo-600/20"
                >
                  Close Logs
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getStatusColor(status) {
  if (status === "New Lead") return "blue";
  if (status === "Fees Finalized") return "purple";
  if (status === "Demo Scheduled") return "yellow";
  if (status === "Demo Cancelled") return "orange";
  if (status === "Feedback Pending") return "orange";
  if (status === "Enrolled") return "emerald";
  if (status === "Won") return "emerald";
  if (status === "Rejected") return "red";
  if (status === "Lost") return "red";
  return "slate";
}

function StatCard({ title, value, subtitle, icon: Icon, gradientClass }) {
  return (
    <div className="rounded-3xl p-6 shadow-sm border border-slate-200/60 dark:border-slate-800 transition duration-300 hover:-translate-y-1 hover:shadow-md glass-card bg-white dark:bg-slate-900 flex items-center justify-between">
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">{title}</p>
        <p className="mt-2 text-4xl font-black text-slate-900 dark:text-white tracking-tight">{value}</p>
        <p className="mt-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      {Icon && (
        <div className={`p-3.5 rounded-2xl ${gradientClass || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
          <Icon className="h-5 w-5 stroke-[2.5]" />
        </div>
      )}
    </div>
  );
}

const COMPACT_HEADER_LABELS = {
  requirementId: "Req ID",
  studentName: "Student",
  parentName: "Parent",
  teacherName: "Teacher",
  currentCycle: "Cycle",
  cycleDates: "Dates",
  totalClasses: "Total",
  completedClasses: "Done",
  missedClasses: "Missed",
  remainingClasses: "Left",
};

const DEFAULT_ATTENDANCE_COLUMNS = [
  { key: "requirementId", label: "Req ID", enabled: true },
  { key: "studentName", label: "Student", enabled: true },
  { key: "parentName", label: "Parent", enabled: true },
  { key: "teacherName", label: "Teacher", enabled: true },
  { key: "currentCycle", label: "Cycle", enabled: true },
  { key: "cycleDates", label: "Dates", enabled: true },
  { key: "totalClasses", label: "Total", enabled: true },
  { key: "completedClasses", label: "Done", enabled: true },
  { key: "missedClasses", label: "Missed", enabled: true },
  { key: "remainingClasses", label: "Left", enabled: true },
];

function AdminAttendanceConsole({
  parentEnquiries,
  fetchLeadAttendanceLogs,
  attendanceLogs,
  fetchingLogsLeadId,
  setAttendanceLogs,
  fetchData,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [activeCycleFilter, setActiveCycleFilter] = useState({}); // { [leadId]: 'all' | cycleNumber }
  const [attendanceColumns, setAttendanceColumns] = useState(() => {
    try {
      const saved = localStorage.getItem("attendanceColumnsConfig");
      if (!saved) return DEFAULT_ATTENDANCE_COLUMNS;
      const parsed = JSON.parse(saved);
      const existingKeys = new Set(parsed.map((c) => c.key));
      const missingDefaults = DEFAULT_ATTENDANCE_COLUMNS.filter((c) => !existingKeys.has(c.key));
      return [...parsed, ...missingDefaults];
    } catch {
      return DEFAULT_ATTENDANCE_COLUMNS;
    }
  });

  const formatCycleDateRange = (lead, cycleNum, includeYear = false) => {
    const cycle = cycleNum || lead.currentPackageCycle || 1;
    const start = lead.classStartDate ? new Date(lead.classStartDate) : new Date(lead.createdAt || Date.now());
    const cycleStart = new Date(start);
    cycleStart.setMonth(cycleStart.getMonth() + (cycle - 1));
    const cycleEnd = new Date(cycleStart);
    cycleEnd.setMonth(cycleEnd.getMonth() + 1);
    cycleEnd.setDate(cycleEnd.getDate() - 1);
    const formatDate = (d) =>
      d.toLocaleDateString("en-US", includeYear ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric" });
    return `${formatDate(cycleStart)} – ${formatDate(cycleEnd)}`;
  };

  // Edit Tuition Inline States
  const [tDuration, setTDuration] = useState("");
  const [tTotalClasses, setTTotalClasses] = useState("");
  const [tCompletedClasses, setTCompletedClasses] = useState("");
  const [tSchedule, setTSchedule] = useState("");
  const [startNewCycle, setStartNewCycle] = useState(false);
  const [tuitionUpdating, setTuitionUpdating] = useState(false);
  const [tuitionError, setTuitionError] = useState("");

  // Edit Log Inline States
  const [editingLogId, setEditingLogId] = useState(null);
  const [logStatus, setLogStatus] = useState("Done");
  const [logDate, setLogDate] = useState("");
  const [logTopics, setLogTopics] = useState("");
  const [logMissedReason, setLogMissedReason] = useState("");
  const [logCustomReason, setLogCustomReason] = useState("");
  const [logUpdating, setLogUpdating] = useState(false);
  const [logError, setLogError] = useState("");

  const adminToken = localStorage.getItem("adminToken");

  const missedReasons = [
    "Cancelled by Parent",
    "Cancelled by Teacher",
    "Teacher Sick",
    "Student Unavailable",
    "Emergency",
    "Public Holiday",
    "Other"
  ];

  const filtered = parentEnquiries.filter((p) => {
    const studentName = p.wards?.map((w) => w.studentName).join(", ") || "";
    const teacherName = p.assignedTutor || "";
    const parentName = p.parentName || "";
    const reqId = p.requirementId || "";
    const query = searchTerm.toLowerCase();

    return (
      studentName.toLowerCase().includes(query) ||
      teacherName.toLowerCase().includes(query) ||
      parentName.toLowerCase().includes(query) ||
      reqId.toLowerCase().includes(query)
    );
  });

  const handleToggleExpand = (p) => {
    if (expandedId === p._id) {
      setExpandedId(null);
      setEditingLogId(null);
    } else {
      setExpandedId(p._id);
      setEditingLogId(null);
      fetchLeadAttendanceLogs(p._id);
      
      // Pre-fill tuition details inline form
      setTDuration(p.classDuration || "");
      setTTotalClasses(p.totalClasses !== null && p.totalClasses !== undefined ? p.totalClasses : "");
      setTCompletedClasses(p.completedClasses || 0);
      setTSchedule(p.classSchedule || "");
      setStartNewCycle(false);
      setTuitionError("");
    }
  };

  const handleUpdateTuitionInline = async (e, leadId) => {
    e.preventDefault();
    setTuitionError("");
    setTuitionUpdating(true);

    try {
      const res = await fetch(`${API_BASE}/attendance/update-tuition/${leadId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          classDuration: tDuration,
          totalClasses: Number(tTotalClasses),
          completedClasses: Number(tCompletedClasses),
          classSchedule: tSchedule,
          startNewCycle,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert("✅ Tuition configuration updated successfully!");
        fetchData();
      } else {
        setTuitionError(data.message || "Failed to update tuition details.");
      }
    } catch (err) {
      setTuitionError("Failed to connect to the server.");
    } finally {
      setTuitionUpdating(false);
    }
  };

  const startEditLogInline = (log) => {
    setEditingLogId(log._id);
    setLogStatus(log.status || "Done");
    setLogDate(log.date || "");
    setLogTopics(log.topicsCovered || "");
    setLogMissedReason(log.missedReason || "");
    setLogCustomReason(log.customReason || "");
    setLogError("");
  };

  const handleUpdateLogInline = async (e, logId, leadId) => {
    e.preventDefault();
    setLogError("");
    setLogUpdating(true);

    if (logStatus === "Done" && !logTopics.trim()) {
      setLogError("Topics covered is required.");
      setLogUpdating(false);
      return;
    }

    if (logStatus === "Missed" && !logMissedReason) {
      setLogError("Please select a reason.");
      setLogUpdating(false);
      return;
    }

    if (logStatus === "Missed" && logMissedReason === "Other" && !logCustomReason.trim()) {
      setLogError("Please specify custom reason.");
      setLogUpdating(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/attendance/log/${logId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          status: logStatus,
          date: logDate,
          topicsCovered: logStatus === "Done" ? logTopics : "",
          missedReason: logStatus === "Missed" ? logMissedReason : "",
          customReason: logStatus === "Missed" && logMissedReason === "Other" ? logCustomReason : "",
        }),
      });

      if (res.ok) {
        setEditingLogId(null);
        alert("✅ Log updated successfully!");
        fetchData();
        fetchLeadAttendanceLogs(leadId);
      } else {
        const data = await res.json();
        setLogError(data.message || "Failed to update log.");
      }
    } catch (err) {
      setLogError("Failed to connect to the server.");
    } finally {
      setLogUpdating(false);
    }
  };

  const handleDeleteLog = async (leadId, logId) => {
    if (!window.confirm("⚠️ Delete this attendance log? Completed count will be updated.")) return;

    try {
      const res = await fetch(`${API_BASE}/attendance/log/${logId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      if (res.ok) {
        alert("✅ Log deleted successfully!");
        fetchData();
        fetchLeadAttendanceLogs(leadId);
      } else {
        const data = await res.json();
        alert(data.message || "Failed to delete log.");
      }
    } catch (err) {
      alert("Failed to connect to the server.");
    }
  };

  const [syncingOdoo, setSyncingOdoo] = useState(false);
  const [syncingLeadId, setSyncingLeadId] = useState(null);

  const handleSyncAllToOdoo = async () => {
    if (syncingOdoo) return;
    if (!window.confirm("🔄 Sync all student attendance metrics and session logs to Odoo CRM?")) return;
    setSyncingOdoo(true);
    try {
      const res = await fetch(`${API_BASE}/attendance/sync-all-to-odoo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${data.message}`);
        fetchData();
        if (expandedId) fetchLeadAttendanceLogs(expandedId);
      } else {
        alert(`❌ Odoo sync failed: ${data.message}`);
      }
    } catch (err) {
      alert("Failed to connect to the server during Odoo sync.");
    } finally {
      setSyncingOdoo(false);
    }
  };

  const handleSyncSingleLeadToOdoo = async (leadId) => {
    if (syncingLeadId === leadId) return;
    setSyncingLeadId(leadId);
    try {
      const res = await fetch(`${API_BASE}/attendance/sync-lead-to-odoo/${leadId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ ${data.message}`);
        fetchData();
        fetchLeadAttendanceLogs(leadId);
      } else {
        alert(`❌ Sync failed: ${data.message}`);
      }
    } catch (err) {
      alert("Failed to connect to the server.");
    } finally {
      setSyncingLeadId(null);
    }
  };

  const [retryingLogId, setRetryingLogId] = useState(null);

  const handleRetryLogSync = async (logId, leadId) => {
    setRetryingLogId(logId);
    try {
      const res = await fetch(`${API_BASE}/attendance/retry-sync/${logId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert("✅ Attendance successfully synchronized to Odoo Community!");
        fetchLeadAttendanceLogs(leadId);
      } else {
        alert(`❌ Retry failed: ${data.error || data.message || "Unknown error"}`);
        fetchLeadAttendanceLogs(leadId);
      }
    } catch (err) {
      alert("Failed to connect to the server.");
    } finally {
      setRetryingLogId(null);
    }
  };

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200/80 dark:border-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">Attendance & Class Tracking Dashboard</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Centralized monitoring of teacher logs, completed classes, remaining classes, and topics covered.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-80">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Search student, parent, teacher, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-9 pr-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-all text-slate-800 dark:text-white"
            />
          </div>

          <button
            type="button"
            onClick={handleSyncAllToOdoo}
            disabled={syncingOdoo}
            className="flex items-center gap-1.5 px-3.5 h-11 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-xs font-black text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition cursor-pointer shrink-0 shadow-sm disabled:opacity-50"
            title="Sync all student attendance metrics and class logs to Odoo CRM"
          >
            <RefreshCw className={`h-4 w-4 ${syncingOdoo ? "animate-spin text-indigo-600" : "text-indigo-500"}`} />
            {syncingOdoo ? "Syncing Odoo..." : "Sync Odoo"}
          </button>

          <button
            type="button"
            onClick={() => {
              fetchData();
              if (expandedId) fetchLeadAttendanceLogs(expandedId);
            }}
            className="flex items-center gap-1.5 px-3.5 h-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer shrink-0 shadow-sm"
          >
            <RefreshCw className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => setShowCustomizeModal(true)}
            className="flex items-center gap-1.5 px-3.5 h-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer shrink-0 shadow-sm"
          >
            <Settings className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            Columns
          </button>
        </div>
      </div>

      <div className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-x-auto xl:overflow-x-hidden">
        <table className="w-full text-left border-collapse table-auto text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {attendanceColumns.filter(c => c.enabled).map(c => (
                <th
                  key={c.key}
                  className={`py-3 px-2 ${
                    ["totalClasses", "completedClasses", "missedClasses", "remainingClasses", "currentCycle", "cycleDates"].includes(c.key)
                      ? "text-center"
                      : "text-left"
                  }`}
                >
                  {COMPACT_HEADER_LABELS[c.key] || c.label}
                </th>
              ))}
              <th className="py-3 px-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={attendanceColumns.filter(c => c.enabled).length + 1} className="py-12 text-center text-slate-400 font-bold">
                  No tracking records found matching search query.
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const isExpanded = expandedId === p._id;
                const studentName = p.wards?.map((w) => w.studentName).join(", ") || "Unknown Student";
                const hasTotal = p.totalClasses !== null && p.totalClasses !== undefined;
                const totalDisplay = hasTotal ? p.totalClasses : "—";
                const completed = p.completedClasses || 0;
                const remainingDisplay = hasTotal ? Math.max(0, p.totalClasses - completed) : "—";

                const tutorMissedLogs = attendanceLogs[p._id]?.filter((l) => l.status === "Missed") || [];
                const missedCount = attendanceLogs[p._id] ? tutorMissedLogs.length : "-";

                return (
                  <React.Fragment key={p._id}>
                    <tr
                      onClick={() => handleToggleExpand(p)}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-all cursor-pointer border-b border-slate-100 dark:border-slate-800 ${
                        isExpanded ? "bg-slate-50/40 dark:bg-slate-800/40 font-extrabold" : ""
                      }`}
                    >
                      {attendanceColumns.filter(c => c.enabled).map(c => {
                        if (c.key === "requirementId") {
                          return (
                            <td key={c.key} className="py-2.5 px-2">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded text-[10px] font-black font-mono whitespace-nowrap">
                                  {p.requirementId || "REQ-N/A"}
                                </span>
                                {p.odooLeadId && (
                                  <a
                                    href={`https://odoo.saraswatitutorial.com/web#id=${p.odooLeadId}&model=crm.lead&view_type=form`}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[9px] font-black text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 px-1 py-0.2 rounded hover:underline inline-flex items-center"
                                    title={`Linked to Odoo Lead #${p.odooLeadId} — Click to view in Odoo`}
                                  >
                                    Odoo
                                  </a>
                                )}
                              </div>
                            </td>
                          );
                        }
                        if (c.key === "studentName") {
                          return (
                            <td key={c.key} className="py-2.5 px-2">
                              <div className="font-extrabold text-slate-800 dark:text-slate-100 truncate max-w-[130px]" title={studentName}>{studentName}</div>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold truncate max-w-[130px]">{p.classDuration || "1 hr"}</div>
                            </td>
                          );
                        }
                        if (c.key === "parentName") {
                          return (
                            <td key={c.key} className="py-2.5 px-2">
                              <div className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[110px]" title={p.parentName || "Unknown"}>
                                {p.parentName || "Unknown"}
                              </div>
                            </td>
                          );
                        }
                        if (c.key === "teacherName") {
                          return (
                            <td key={c.key} className="py-2.5 px-2">
                              <div className="font-semibold text-slate-600 dark:text-slate-300 truncate max-w-[110px]" title={p.assignedTutor || "Not Assigned"}>
                                {p.assignedTutor || "Not Assigned"}
                              </div>
                            </td>
                          );
                        }
                        if (c.key === "currentCycle") {
                          const cycle = p.currentPackageCycle || 1;
                          return (
                            <td key={c.key} className="py-2.5 px-1.5 text-center whitespace-nowrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
                                Month {cycle}
                              </span>
                            </td>
                          );
                        }
                        if (c.key === "cycleDates") {
                          return (
                            <td key={c.key} className="py-2.5 px-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap text-center">
                              {formatCycleDateRange(p)}
                            </td>
                          );
                        }
                        if (c.key === "totalClasses") {
                          return (
                            <td key={c.key} className="py-2.5 px-1 text-center text-slate-500 dark:text-slate-400 font-semibold">{totalDisplay}</td>
                          );
                        }
                        if (c.key === "completedClasses") {
                          return (
                            <td key={c.key} className="py-2.5 px-1 text-center text-emerald-600 dark:text-emerald-400 font-black">{completed}</td>
                          );
                        }
                        if (c.key === "missedClasses") {
                          return (
                            <td key={c.key} className="py-2.5 px-1 text-center text-rose-500 dark:text-rose-400 font-black">{missedCount}</td>
                          );
                        }
                        if (c.key === "remainingClasses") {
                          return (
                            <td key={c.key} className="py-2.5 px-1 text-center text-indigo-600 dark:text-indigo-400 font-black">{remainingDisplay}</td>
                          );
                        }
                        return null;
                      })}
                      <td className="py-2.5 px-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-black bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 transition cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleExpand(p);
                          }}
                        >
                          {isExpanded ? "Close" : "Logs"}
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-slate-50/30 dark:bg-slate-800/30">
                        <td colSpan={attendanceColumns.filter(c => c.enabled).length + 1} className="p-5 border-t border-slate-100 dark:border-slate-800">
                          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-inner">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                              
                              {/* Left Columns: Timeline and Logs */}
                              <div className="lg:col-span-2 space-y-4">
                                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Class Logs & Topics History</h4>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={() => handleSyncSingleLeadToOdoo(p._id)}
                                      disabled={syncingLeadId === p._id}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-xs font-black rounded-xl transition-all cursor-pointer shadow-xs disabled:opacity-50"
                                      title="Sync this student's attendance metrics and logs to Odoo CRM"
                                    >
                                      <RefreshCw className={`h-3.5 w-3.5 ${syncingLeadId === p._id ? "animate-spin text-purple-600" : "text-purple-500"}`} />
                                      {syncingLeadId === p._id ? "Syncing..." : "Push to Odoo"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => window.open(`${API_BASE}/attendance/download-history/${p._id}?cycle=all`, "_blank")}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-black rounded-xl transition-all cursor-pointer shadow-xs"
                                    >
                                      <FileDown className="h-3.5 w-3.5" /> Download History CSV
                                    </button>
                                  </div>
                                </div>

                                {fetchingLogsLeadId === p._id ? (
                                  <p className="text-xs font-bold text-slate-500 animate-pulse text-center py-4">
                                    Loading attendance history...
                                  </p>
                                ) : !attendanceLogs[p._id] ? (
                                  <p className="text-xs font-bold text-slate-500 text-center py-4">
                                    Failed to fetch logs. Click view again.
                                  </p>
                                ) : attendanceLogs[p._id].length === 0 ? (
                                  <p className="text-xs font-bold text-slate-500 text-center py-4">
                                    No classes logged for this requirement yet.
                                  </p>
                                ) : (() => {
                                  const allLogs = attendanceLogs[p._id] || [];
                                  const meta = attendanceLogs[`${p._id}_meta`];
                                  const leadCycles = meta?.cycles || [];
                                  const logCycles = allLogs.map(l => l.packageCycle || 1);
                                  const maxCycle = Math.max(p.currentPackageCycle || 1, ...logCycles, ...(leadCycles.map(c => c.cycleNumber || 1)), 1);
                                  const availableCycles = [];
                                  for (let cyc = 1; cyc <= maxCycle; cyc++) {
                                    availableCycles.push(cyc);
                                  }
                                  const currentSelectedCycle = activeCycleFilter[p._id] !== undefined 
                                    ? activeCycleFilter[p._id] 
                                    : (p.currentPackageCycle || 1);

                                  const selectedCycleObj = leadCycles.find(c => c.cycleNumber === currentSelectedCycle);
                                  const cycleDates = selectedCycleObj ? selectedCycleObj.dates : formatCycleDateRange(p, currentSelectedCycle, true);
                                  
                                  const filteredLogs = currentSelectedCycle === "all"
                                    ? allLogs
                                    : allLogs.filter(l => (l.packageCycle || 1) === currentSelectedCycle);

                                  return (
                                    <div className="space-y-4">
                                      {/* Month / Cycle Selection Tabs */}
                                      <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-700 pb-2.5 overflow-x-auto">
                                        <span className="text-[10px] font-black text-slate-400 uppercase mr-1 shrink-0">Month / Cycle:</span>
                                        {availableCycles.map((cyc) => {
                                          const isSelected = currentSelectedCycle === cyc;
                                          const isCurrent = (p.currentPackageCycle || 1) === cyc;
                                          return (
                                            <button
                                              key={cyc}
                                              type="button"
                                              onClick={() => setActiveCycleFilter(prev => ({ ...prev, [p._id]: cyc }))}
                                              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                                                isSelected
                                                  ? "bg-indigo-600 text-white shadow-sm"
                                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                              }`}
                                            >
                                              Month {cyc} (Cycle {cyc})
                                              {isCurrent && (
                                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold ${isSelected ? "bg-indigo-800 text-white" : "bg-emerald-100 text-emerald-700"}`}>
                                                  Active
                                                </span>
                                              )}
                                            </button>
                                          );
                                        })}
                                        <button
                                          type="button"
                                          onClick={() => setActiveCycleFilter(prev => ({ ...prev, [p._id]: "all" }))}
                                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                                            currentSelectedCycle === "all"
                                              ? "bg-indigo-600 text-white shadow-sm"
                                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                          }`}
                                        >
                                          All Cycles ({allLogs.length})
                                        </button>
                                      </div>

                                      {/* Cycle Summary Card */}
                                      {currentSelectedCycle !== "all" && (
                                        <div className="bg-gradient-to-r from-indigo-50/80 via-slate-50 to-white rounded-2xl border border-indigo-100 p-4 shadow-xs">
                                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                            <div>
                                              <div className="flex items-center gap-2">
                                                <h5 className="text-sm font-black text-indigo-950">Month {currentSelectedCycle} (Cycle {currentSelectedCycle})</h5>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                                  (p.currentPackageCycle || 1) === currentSelectedCycle 
                                                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200" 
                                                    : "bg-slate-200 text-slate-700"
                                                }`}>
                                                  {(p.currentPackageCycle || 1) === currentSelectedCycle ? "Current Active Cycle" : "Archived Cycle"}
                                                </span>
                                              </div>
                                              <p className="text-xs font-bold text-slate-500 mt-0.5">Cycle Dates: {cycleDates}</p>
                                            </div>
                                            <div className="text-xs font-bold text-slate-600">
                                              Current Assigned: <strong className="text-slate-800 dark:text-slate-100">{p.assignedTutor || "Not Assigned"}</strong>
                                            </div>
                                          </div>

                                          <div className="grid grid-cols-4 gap-2 text-center text-xs">
                                            <div className="bg-white dark:bg-slate-800 rounded-xl p-2 border border-slate-200 dark:border-slate-700 shadow-xs">
                                              <span className="text-[9px] font-black uppercase text-slate-400 block">Total</span>
                                              <strong className="text-sm font-black text-slate-800 dark:text-slate-100">
                                                {selectedCycleObj?.totalClasses ?? (p.totalClasses || 12)}
                                              </strong>
                                            </div>
                                            <div className="bg-white dark:bg-slate-800 rounded-xl p-2 border border-slate-200 dark:border-slate-700 shadow-xs">
                                              <span className="text-[9px] font-black uppercase text-slate-400 block">Completed</span>
                                              <strong className="text-sm font-black text-emerald-600">
                                                {selectedCycleObj?.completedClasses ?? filteredLogs.filter(l => l.status === "Done").length}
                                              </strong>
                                            </div>
                                            <div className="bg-white dark:bg-slate-800 rounded-xl p-2 border border-slate-200 dark:border-slate-700 shadow-xs">
                                              <span className="text-[9px] font-black uppercase text-slate-400 block">Missed</span>
                                              <strong className="text-sm font-black text-rose-500">
                                                {selectedCycleObj?.missedClasses ?? filteredLogs.filter(l => l.status === "Missed").length}
                                              </strong>
                                            </div>
                                            <div className="bg-white dark:bg-slate-800 rounded-xl p-2 border border-slate-200 dark:border-slate-700 shadow-xs">
                                              <span className="text-[9px] font-black uppercase text-slate-400 block">Remaining</span>
                                              <strong className="text-sm font-black text-indigo-600">
                                                {selectedCycleObj?.remainingClasses ?? Math.max(0, (selectedCycleObj?.totalClasses ?? p.totalClasses ?? 12) - filteredLogs.filter(l => l.status === "Done").length)}
                                              </strong>
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* Logs in selected cycle */}
                                      {filteredLogs.length === 0 ? (
                                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 text-center py-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                          No class logs recorded for Month {currentSelectedCycle}.
                                        </p>
                                      ) : (
                                        <div className="space-y-3">
                                          {filteredLogs.map((log, idx) => {
                                            const logIndex = filteredLogs.length - idx;
                                            const isEditingThisLog = editingLogId === log._id;

                                            if (isEditingThisLog) {
                                              return (
                                                <form
                                                  key={log._id}
                                                  onSubmit={(e) => handleUpdateLogInline(e, log._id, p._id)}
                                                  className="bg-slate-55 rounded-xl border border-indigo-200 p-4 space-y-3 shadow-sm"
                                                >
                                                  <p className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">Editing Class {logIndex} log (Month {log.packageCycle || 1})</p>
                                                  {logError && <p className="text-xs text-rose-600 font-bold">{logError}</p>}
                                                  
                                                  <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Status</label>
                                                      <select
                                                        value={logStatus}
                                                        onChange={(e) => setLogStatus(e.target.value)}
                                                        className="w-full h-9 px-3 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                                                      >
                                                        <option value="Done">Done</option>
                                                        <option value="Missed">Missed</option>
                                                      </select>
                                                    </div>
                                                    <div>
                                                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Date</label>
                                                      <input
                                                        type="date"
                                                        required
                                                        value={logDate}
                                                        onChange={(e) => setLogDate(e.target.value)}
                                                        className="w-full h-9 px-3 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                                                      />
                                                    </div>
                                                  </div>

                                                  {logStatus === "Done" ? (
                                                    <div>
                                                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Topics Covered</label>
                                                      <textarea
                                                        rows="2"
                                                        required
                                                        value={logTopics}
                                                        onChange={(e) => setLogTopics(e.target.value)}
                                                        className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                                                      />
                                                    </div>
                                                  ) : (
                                                    <div className="space-y-2">
                                                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Missed Reason</label>
                                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                                        {missedReasons.map((reason) => (
                                                          <button
                                                            key={reason}
                                                            type="button"
                                                            onClick={() => setLogMissedReason(reason)}
                                                            className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold text-center transition-all cursor-pointer ${
                                                              logMissedReason === reason
                                                                ? "border-rose-500 bg-rose-50 text-rose-700"
                                                                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                                            }`}
                                                          >
                                                            {reason}
                                                          </button>
                                                        ))}
                                                      </div>
                                                      {logMissedReason === "Other" && (
                                                        <input
                                                          type="text"
                                                          required
                                                          placeholder="Specify custom reason..."
                                                          value={logCustomReason}
                                                          onChange={(e) => setLogCustomReason(e.target.value)}
                                                          className="w-full h-9 px-3 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                                                        />
                                                      )}
                                                    </div>
                                                  )}

                                                  <div className="flex gap-2 justify-end">
                                                    <button
                                                      type="button"
                                                      onClick={() => setEditingLogId(null)}
                                                      className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                                                    >
                                                      Cancel
                                                    </button>
                                                    <button
                                                      type="submit"
                                                      disabled={logUpdating}
                                                      className="px-3.5 py-1.5 rounded-lg text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer"
                                                    >
                                                      {logUpdating ? "Saving..." : "Save Log"}
                                                    </button>
                                                  </div>
                                                </form>
                                              );
                                            }

                                            return (
                                              <div key={log._id} className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 p-3.5 flex justify-between gap-4 text-xs font-semibold">
                                                <div className="space-y-1">
                                                  <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-extrabold text-slate-800 dark:text-slate-100">Class {logIndex} ({log.date})</span>
                                                    <span className="bg-indigo-50 border border-indigo-150 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded">
                                                      Month {log.packageCycle || 1}
                                                    </span>
                                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                                      log.status === "Done"
                                                        ? "bg-emerald-50 border border-emerald-100 text-emerald-700"
                                                        : "bg-rose-50 border border-rose-100 text-rose-700"
                                                    }`}>
                                                      {log.status === "Done" ? "Done" : "Missed"}
                                                    </span>

                                                    {/* Odoo Community Sync Status Badge */}
                                                    {log.odooSyncStatus === "synced" ? (
                                                      <span
                                                        className="inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                        title={log.odooAttendanceId ? `Synchronized to Odoo (Attendance #${log.odooAttendanceId})` : "Synchronized to Odoo Community"}
                                                      >
                                                        <Check className="h-2.5 w-2.5" />
                                                        Odoo Synced {log.odooAttendanceId ? `#${log.odooAttendanceId}` : ""}
                                                      </span>
                                                    ) : log.odooSyncStatus === "failed" ? (
                                                      <span
                                                        className="inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200"
                                                        title={log.odooSyncError ? `Odoo Sync Error: ${log.odooSyncError}` : "Odoo synchronization failed"}
                                                      >
                                                        <X className="h-2.5 w-2.5" />
                                                        Odoo Sync Failed
                                                      </span>
                                                    ) : (
                                                      <span
                                                        className="inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200"
                                                        title="Odoo synchronization pending or retrying"
                                                      >
                                                        <Clock className="h-2.5 w-2.5" />
                                                        {log.odooSyncStatus === "retrying" ? "Odoo Retrying..." : "Odoo Pending"}
                                                      </span>
                                                    )}
                                                  </div>

                                                  {log.status === "Done" ? (
                                                    <p className="text-slate-600 mt-1">
                                                      <strong className="text-slate-700 font-extrabold">Topics Covered:</strong> {log.topicsCovered}
                                                    </p>
                                                  ) : (
                                                    <p className="text-slate-600 mt-1">
                                                      <strong className="text-slate-700 font-extrabold">Reason:</strong> {log.missedReason === "Other" ? log.customReason : log.missedReason}
                                                    </p>
                                                  )}

                                                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex-wrap">
                                                    <button
                                                      type="button"
                                                      onClick={() => startEditLogInline(log)}
                                                      className="text-[10px] font-black text-indigo-600 hover:underline cursor-pointer"
                                                    >
                                                      Edit Log
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => handleDeleteLog(p._id, log._id)}
                                                      className="text-[10px] font-black text-rose-600 hover:underline cursor-pointer"
                                                    >
                                                      Delete Log
                                                    </button>
                                                    {log.odooSyncStatus !== "synced" && (
                                                      <button
                                                        type="button"
                                                        disabled={retryingLogId === log._id}
                                                        onClick={() => handleRetryLogSync(log._id, p._id)}
                                                        className="text-[10px] font-black text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md cursor-pointer inline-flex items-center gap-1 transition"
                                                        title="Retry synchronizing this attendance record to Odoo Community"
                                                      >
                                                        <RefreshCw className={`h-2.5 w-2.5 ${retryingLogId === log._id ? "animate-spin text-amber-700" : ""}`} />
                                                        {retryingLogId === log._id ? "Retrying..." : "Retry Odoo Sync"}
                                                      </button>
                                                    )}
                                                  </div>
                                                </div>

                                                <div className="text-right text-[10px] font-bold text-slate-400 shrink-0 self-center">
                                                  <span>By {log.tutorName || p.assignedTutor || "Teacher"}</span>
                                                  <span className="block mt-0.5">{new Date(log.timestamp).toLocaleDateString()}</span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* Right Column: Inline Edit Tuition Details */}
                              <div className="border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-700 pt-5 lg:pt-0 lg:pl-6 space-y-4">
                                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2">Edit Tuition Details</h4>
                                
                                <form onSubmit={(e) => handleUpdateTuitionInline(e, p._id)} className="space-y-3.5">
                                  {tuitionError && (
                                    <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-bold">
                                      {tuitionError}
                                    </div>
                                  )}

                                  <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Class Duration</label>
                                    <input
                                      type="text"
                                      required
                                      placeholder="e.g. 1.5 hours"
                                      value={tDuration}
                                      onChange={(e) => setTDuration(e.target.value)}
                                      className="w-full h-10 px-3.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Total Classes</label>
                                      <input
                                        type="number"
                                        required
                                        min="1"
                                        value={tTotalClasses}
                                        onChange={(e) => setTTotalClasses(e.target.value)}
                                        className="w-full h-10 px-3.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Completed</label>
                                      <input
                                        type="number"
                                        required
                                        min="0"
                                        value={tCompletedClasses}
                                        onChange={(e) => setTCompletedClasses(e.target.value)}
                                        className="w-full h-10 px-3.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Class Schedule</label>
                                    <input
                                      type="text"
                                      placeholder="e.g. Mon, Wed, Fri @ 5 PM"
                                      value={tSchedule}
                                      onChange={(e) => setTSchedule(e.target.value)}
                                      className="w-full h-10 px-3.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                                    />
                                  </div>

                                  <div className="flex items-center gap-2 py-1.5 px-3 bg-indigo-50/70 border border-indigo-100 rounded-xl">
                                    <input
                                      type="checkbox"
                                      id={`startNewCycle-${p._id}`}
                                      checked={startNewCycle}
                                      onChange={(e) => setStartNewCycle(e.target.checked)}
                                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300 cursor-pointer"
                                    />
                                    <label htmlFor={`startNewCycle-${p._id}`} className="text-xs font-bold text-indigo-900 cursor-pointer">
                                      Start New Package Cycle #{ (p.currentPackageCycle || 1) + 1 } (Resets counter to 0, keeps history)
                                    </label>
                                  </div>

                                  <button
                                    type="submit"
                                    disabled={tuitionUpdating}
                                    className="w-full h-10 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer shadow-sm disabled:opacity-50"
                                  >
                                    {tuitionUpdating ? "Saving Changes..." : "Save Tuition Config"}
                                  </button>
                                </form>
                              </div>

                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showCustomizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 animate-fadeIn">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[85vh] z-50">
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100">
              <h3 className="text-sm font-black uppercase tracking-wider">Customize Attendance Columns</h3>
              <button 
                type="button"
                onClick={() => setShowCustomizeModal(false)}
                className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-black/5 text-slate-500 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <p className="text-xs font-semibold text-slate-500 mb-2">
                Enable/disable columns and change their order. These settings are saved in your browser.
              </p>
              <div className="space-y-2">
                {attendanceColumns.map((col, idx) => (
                  <div key={col.key} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                    <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={col.enabled}
                        onChange={(e) => {
                          const updated = [...attendanceColumns];
                          updated[idx] = { ...col, enabled: e.target.checked };
                          setAttendanceColumns(updated);
                          localStorage.setItem("attendanceColumnsConfig", JSON.stringify(updated));
                        }}
                        className="rounded border-slate-300 accent-indigo-600"
                      />
                      {col.label}
                    </label>

                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => {
                          const updated = [...attendanceColumns];
                          const temp = updated[idx - 1];
                          updated[idx - 1] = updated[idx];
                          updated[idx] = temp;
                          setAttendanceColumns(updated);
                          localStorage.setItem("attendanceColumnsConfig", JSON.stringify(updated));
                        }}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={idx === attendanceColumns.length - 1}
                        onClick={() => {
                          const updated = [...attendanceColumns];
                          const temp = updated[idx + 1];
                          updated[idx + 1] = updated[idx];
                          updated[idx] = temp;
                          setAttendanceColumns(updated);
                          localStorage.setItem("attendanceColumnsConfig", JSON.stringify(updated));
                        }}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 flex justify-between border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setAttendanceColumns(DEFAULT_ATTENDANCE_COLUMNS);
                  localStorage.removeItem("attendanceColumnsConfig");
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 transition cursor-pointer"
              >
                Reset Default
              </button>
              <button
                type="button"
                onClick={() => setShowCustomizeModal(false)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition cursor-pointer shadow-md"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ title, value, color, icon: Icon }) {
  const colors = {
    yellow: "bg-amber-50 text-amber-700 border-amber-200/60 ring-amber-100",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200/60 ring-emerald-100",
    red: "bg-rose-50 text-rose-700 border-rose-200/60 ring-rose-100",
  };

  return (
    <div className={`rounded-3xl p-5 border flex items-center justify-between shadow-sm transition hover:shadow-md ${colors[color]}`}>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider opacity-85">{title}</p>
        <p className="mt-2 text-3xl font-black tracking-tight">{value}</p>
      </div>
      {Icon && (
        <div className="p-3 bg-white/60 dark:bg-slate-800/60 rounded-xl shadow-sm">
          <Icon className="h-5 w-5 stroke-[2.5]" />
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, subtitle, icon: Icon }) {
  return (
    <div className="mb-6 border-b border-slate-200/80 dark:border-slate-700 pb-4">
      <div className="flex items-center gap-2.5">
        {Icon && <Icon className="h-6 w-6 text-slate-700" />}
        <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          {title}
        </h2>
      </div>
      {subtitle && <p className="mt-1.5 text-sm text-slate-500 pl-8 font-semibold">{subtitle}</p>}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 p-8 text-center text-sm font-bold text-slate-400 dark:text-slate-500">
      {text}
    </div>
  );
}

function InfoRow({ label, value, icon: Icon }) {
  return (
    <div className="flex items-start gap-2 py-1.5 text-xs font-bold text-slate-600">
      {Icon && <Icon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />}
      <div className="min-w-0 flex-1">
        <span className="text-slate-800 dark:text-slate-100">{label}: </span>
        <span className="text-slate-600 font-semibold break-words leading-relaxed">
          {value || value === 0 ? value : <span className="text-slate-400 italic font-medium">Not provided</span>}
        </span>
      </div>
    </div>
  );
}

function Badge({ text, color = "slate" }) {
  const colors = {
    blue: "bg-blue-50 text-blue-700 border-blue-200/50",
    purple: "bg-purple-50 text-purple-700 border-purple-200/50",
    orange: "bg-orange-50 text-orange-700 border-orange-200/50",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200/50",
    red: "bg-rose-50 text-rose-700 border-rose-200/50",
    yellow: "bg-amber-50 text-amber-700 border-amber-200/50",
    slate: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black ${
        colors[color] || colors.slate
      }`}
    >
      {text}
    </span>
  );
}

function DocumentLink({ href, label }) {
  if (!href) {
    return (
      <span className="inline-flex items-center gap-1 rounded-xl bg-rose-50 border border-rose-200/50 px-3 py-1.5 text-xs font-bold text-rose-600">
        <XCircle className="h-3.5 w-3.5" />
        {label} Missing
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-xl bg-blue-50 border border-blue-200/50 px-3 py-1.5 text-xs font-bold text-blue-700 transition duration-200 hover:bg-blue-100 hover:border-blue-300"
    >
      <FileDown className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}

function ProtectedDocumentLink({ href, label, password }) {
  const handleOpen = () => {
    if (!href) return;

    const enteredPassword = window.prompt(
      `Enter password to open ${label} certificate`
    );

    if (enteredPassword !== password) {
      alert("Incorrect password. Access denied.");
      return;
    }

    window.open(href, "_blank", "noopener,noreferrer");
  };

  if (!href) {
    return (
      <span className="inline-flex items-center gap-1 rounded-xl bg-rose-50 border border-rose-200/50 px-3 py-1.5 text-xs font-bold text-rose-600">
        <XCircle className="h-3.5 w-3.5" />
        {label} Missing
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="inline-flex items-center gap-1 rounded-xl bg-purple-50 border border-purple-200/50 px-3 py-1.5 text-xs font-bold text-purple-700 transition duration-200 hover:bg-purple-100 hover:border-purple-300 cursor-pointer"
    >
      <Lock className="h-3.5 w-3.5" />
      🔒 {label}
    </button>
  );
}

function TutorModal({ title, form, setForm, primaryText, onPrimary, onClose }) {
  const GENDER_OPTIONS = ["Male", "Female", "Other"];
  const CITY_OPTIONS = ["Bangalore", "Mumbai"];
  const TRAVEL_OPTIONS = ["5 km", "10 km", "15 km", "20+ km"];
  const AVAILABILITY_OPTIONS = ["Available", "Busy", "Inactive", "Archived"];
  const GRADE_OPTIONS = ["Class 1-5 (Primary)", "Class 6-8 (Middle)", "Class 9-10 (Secondary)", "Class 11-12 (Senior Secondary)"];
  const BOARD_OPTIONS = ["CBSE", "ICSE", "IB", "IGCSE", "State Board"];
  const SUBJECT_OPTIONS = ["Mathematics", "Science", "Physics", "Chemistry", "Biology", "English", "Hindi", "Commerce", "Social Studies"];
  const TIMING_OPTIONS = ["Morning (AM)", "Evening (PM)"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-slideFade">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-700 md:p-8">
        <div className="mb-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Edit className="h-6 w-6 text-slate-800 dark:text-slate-200" />
            {title}
          </h2>

          <button
            onClick={onClose}
            className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200 cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Section 1: Personal & Contact Details */}
        <div className="mb-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 border-b border-slate-100 dark:border-slate-700 pb-1">Personal & Contact Info</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <ModalInput
              placeholder="Name"
              value={form.name}
              onChange={(value) => setForm({ ...form, name: value })}
            />

            <ModalInput
              placeholder="Email"
              value={form.email}
              onChange={(value) => setForm({ ...form, email: value })}
            />

            <ModalInput
              placeholder="Phone Number"
              value={form.phone}
              onChange={(value) => setForm({ ...form, phone: value })}
            />

            <ModalInput
              placeholder="WhatsApp Number"
              value={form.whatsapp}
              onChange={(value) => setForm({ ...form, whatsapp: value })}
            />

            <div className="flex flex-col">
              <label className="text-[10px] font-black uppercase text-slate-400 mb-1 ml-2">Gender</label>
              <ModalSelect
                placeholder="Gender"
                value={form.gender}
                onChange={(value) => setForm({ ...form, gender: value })}
                options={GENDER_OPTIONS}
              />
            </div>

            <div className="flex flex-col">
              <label className="text-[10px] font-black uppercase text-slate-400 mb-1 ml-2">Date of Birth</label>
              <ModalDateInput
                placeholder="Date of Birth"
                value={form.dob}
                onChange={(value) => setForm({ ...form, dob: value })}
              />
            </div>

            <ModalInput
              placeholder="Image URL"
              value={form.photo}
              onChange={(value) => setForm({ ...form, photo: value })}
            />
          </div>
        </div>

        {/* Section 2: Professional & Address Info */}
        <div className="mb-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 border-b border-slate-100 dark:border-slate-700 pb-1">Professional & Address Info</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <ModalInput
              placeholder="Qualification"
              value={form.qualification}
              onChange={(value) => setForm({ ...form, qualification: value })}
            />

            <ModalInput
              placeholder="Experience (Years)"
              value={form.experience}
              onChange={(value) => setForm({ ...form, experience: value })}
            />

            <ModalInput
              placeholder="Price"
              value={form.price}
              onChange={(value) => setForm({ ...form, price: value })}
            />

            <div className="flex flex-col">
              <label className="text-[10px] font-black uppercase text-slate-400 mb-1 ml-2">City</label>
              <ModalSelect
                placeholder="City"
                value={form.city}
                onChange={(value) => setForm({ ...form, city: value })}
                options={CITY_OPTIONS}
              />
            </div>

            <ModalInput
              placeholder="Area"
              value={form.area}
              onChange={(value) => setForm({ ...form, area: value })}
            />

            <ModalInput
              placeholder="Pincode"
              value={form.pincode}
              onChange={(value) => setForm({ ...form, pincode: value })}
            />

            <div className="col-span-2">
              <ModalInput
                placeholder="Full Address"
                value={form.fullAddress}
                onChange={(value) => setForm({ ...form, fullAddress: value })}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Teaching Preferences & Availability */}
        <div className="mb-6">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 border-b border-slate-100 dark:border-slate-700 pb-1">Teaching Preferences & Availability</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col">
              <label className="text-[10px] font-black uppercase text-slate-400 mb-1 ml-2">Max Travel Distance</label>
              <ModalSelect
                placeholder="Max Travel Distance"
                value={form.maxTravelDistance}
                onChange={(value) => setForm({ ...form, maxTravelDistance: value })}
                options={TRAVEL_OPTIONS}
              />
            </div>

            <div className="flex flex-col">
              <label className="text-[10px] font-black uppercase text-slate-400 mb-1 ml-2">Availability Status</label>
              <ModalSelect
                placeholder="Availability Status"
                value={form.availabilityStatus}
                onChange={(value) => setForm({ ...form, availabilityStatus: value })}
                options={AVAILABILITY_OPTIONS}
              />
            </div>

            <CheckboxGroup
              label="Grades Can Teach"
              options={GRADE_OPTIONS}
              selectedValues={form.grades}
              onChange={(values) => setForm({ ...form, grades: values })}
            />

            <CheckboxGroup
              label="Boards Can Teach"
              options={BOARD_OPTIONS}
              selectedValues={form.boards}
              onChange={(values) => setForm({ ...form, boards: values })}
            />

            <CheckboxGroup
              label="Subjects Can Teach"
              options={SUBJECT_OPTIONS}
              selectedValues={form.subjects}
              onChange={(values) => setForm({ ...form, subjects: values })}
            />

            <CheckboxGroup
              label="Preferred Timings"
              options={TIMING_OPTIONS}
              selectedValues={form.timings}
              onChange={(values) => setForm({ ...form, timings: values })}
            />
          </div>
        </div>

        <textarea
          className="mt-4 min-h-[120px] w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 text-sm font-semibold"
          placeholder="About tutor..."
          value={form.about}
          onChange={(e) => setForm({ ...form, about: e.target.value })}
        />

        <div className="mt-6 flex gap-3 border-t border-slate-100 dark:border-slate-700 pt-4">
          <button
            onClick={onPrimary}
            className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-700 cursor-pointer"
          >
            {primaryText}
          </button>

          <button
            onClick={onClose}
            className="rounded-2xl border border-slate-200 dark:border-slate-700 px-6 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalSelect({ placeholder, value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-12 w-full rounded-2xl border border-slate-200 dark:border-slate-700 px-4 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 text-sm font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 cursor-pointer"
    >
      <option value="" disabled>{placeholder}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

function ModalDateInput({ placeholder, value, onChange }) {
  return (
    <input
      type="date"
      className="h-12 w-full rounded-2xl border border-slate-200 dark:border-slate-700 px-4 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 text-sm font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
      placeholder={placeholder}
      value={value ? value.substring(0, 10) : ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function CheckboxGroup({ label, options, selectedValues, onChange }) {
  return (
    <div className="col-span-2 mt-2">
      <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isChecked = selectedValues?.includes(option);
          return (
            <label
              key={option}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer select-none ${
                isChecked
                  ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-extrabold shadow-sm"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => {
                  if (isChecked) {
                    onChange(selectedValues.filter((v) => v !== option));
                  } else {
                    onChange([...(selectedValues || []), option]);
                  }
                }}
                className="hidden"
              />
              {option}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ModalInput({ value, onChange, placeholder }) {
  return (
    <input
      className="h-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-4 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 text-sm font-semibold"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// Premium Analytics & Visitor Insights Component
function AnalyticsConsole({ data, loading, period, setPeriod, refresh }) {
  const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#94a3b8"];

  // 1. Auto-Refresh Logic
  const [autoRefresh, setAutoRefresh] = useState(false);
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      refreshRef.current();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // 2. CSV Export Utility
  const exportToCSV = (dataList, filename, headers, columnNames) => {
    const headerRow = columnNames ? columnNames.join(",") : headers.join(",");
    const csvRows = [headerRow];
    for (const row of dataList) {
      const values = headers.map(header => {
        const val = row[header];
        const escaped = ('' + (val ?? '')).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(","));
    }
    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to format source name
  const formatSourceName = (name) => {
    if (!name || name === "Direct Visit") return "Direct";
    if (name === "Google Search") return "Google";
    if (name === "Other Referral Websites") return "Other";
    return name;
  };

  // Prepare traffic sources data
  const pieData = useMemo(() => {
    if (!data || !Array.isArray(data.trafficSources)) return [];
    return data.trafficSources.map((item) => ({
      name: formatSourceName(item?._id),
      value: item?.count || 0
    }));
  }, [data?.trafficSources]);

  // Normalize actions counts for UI display
  const actionCounts = useMemo(() => {
    const defaultActions = {
      homepage_visit: 0,
      plans_viewed: 0,
      explore_plan: 0,
      choose_plan: 0,
      book_demo: 0,
      become_tutor: 0,
      whatsapp_click: 0,
      call_click: 0,
      form_started: 0,
      form_submitted: 0,
      backend_validation_success: 0,
      database_saved_success: 0,
      thank_you_viewed: 0,
      google_ads_conversion: 0,
      ga_generate_lead: 0,
      lead_recorded: 0
    };

    if (data && Array.isArray(data.actions)) {
      data.actions.forEach((item) => {
        if (item && item._id in defaultActions) {
          defaultActions[item._id] = item.count || 0;
        }
      });
    }

    return defaultActions;
  }, [data?.actions]);

  // Funnel calculations
  const funnelSteps = useMemo(() => {
    const homepage = actionCounts.homepage_visit || data?.summary?.totalVisitors || 0;
    const planViewed = actionCounts.plans_viewed || Math.round(homepage * 0.85);
    const explorePlan = actionCounts.explore_plan || 0;
    const enquiryStarted = actionCounts.enquiry_started || actionCounts.form_started || 0;
    const enquirySubmitted = actionCounts.form_submitted || 0;
    const backendValidation = actionCounts.backend_validation_success || enquirySubmitted;
    const dbSaved = actionCounts.database_saved_success || backendValidation;
    const thankYouPage = actionCounts.thank_you_viewed || dbSaved;
    const googleAdsConversion = actionCounts.google_ads_conversion || thankYouPage;
    const gaGenerateLead = actionCounts.ga_generate_lead || googleAdsConversion;
    const leadRecorded = actionCounts.lead_recorded || gaGenerateLead;

    const stepsRaw = [
      { label: "1. Homepage", count: homepage },
      { label: "2. Plan Viewed", count: planViewed },
      { label: "3. Explore Plan", count: explorePlan },
      { label: "4. Enquiry Started", count: enquiryStarted },
      { label: "5. Enquiry Submitted", count: enquirySubmitted },
      { label: "6. Backend Validation Success", count: backendValidation },
      { label: "7. Database Saved Successfully", count: dbSaved },
      { label: "8. Thank You Page", count: thankYouPage },
      { label: "9. Google Ads Conversion", count: googleAdsConversion },
      { label: "10. Google Analytics generate_lead", count: gaGenerateLead },
      { label: "11. Lead Recorded", count: leadRecorded },
    ];

    return stepsRaw.map((step, idx) => {
      const pct = homepage > 0 ? Math.round((step.count / homepage) * 100) : 0;
      let dropoff = 0;
      if (idx > 0) {
        const prevCount = stepsRaw[idx - 1].count;
        dropoff = prevCount > 0 ? Math.round(((prevCount - step.count) / prevCount) * 100) : 0;
      }

      const colors = [
        "bg-blue-500", "bg-sky-500", "bg-indigo-500", "bg-violet-500",
        "bg-fuchsia-500", "bg-pink-500", "bg-rose-500", "bg-red-500",
        "bg-orange-500", "bg-amber-500", "bg-emerald-500"
      ];

      return {
        label: step.label,
        count: step.count,
        pct: Math.min(100, Math.max(0, pct)),
        dropoff: Math.min(100, Math.max(0, dropoff)),
        color: colors[idx % colors.length]
      };
    });
  }, [data?.summary?.totalVisitors, actionCounts]);  // 3. Interactive sorting and filtering for Page table
  const [pageSearch, setPageSearch] = useState("");
  const [pageSortField, setPageSortField] = useState("views");
  const [pageSortOrder, setPageSortOrder] = useState("desc");

  const togglePageSort = (field) => {
    if (pageSortField === field) {
      setPageSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setPageSortField(field);
      setPageSortOrder("desc");
    }
  };

  const sortedAndFilteredPages = useMemo(() => {
    if (!data || !Array.isArray(data.pages)) return [];

    let filtered = data.pages.filter(p =>
      String(p.page || "").toLowerCase().includes(pageSearch.toLowerCase())
    );

    filtered.sort((a, b) => {
      let valA = a[pageSortField];
      let valB = b[pageSortField];

      if (typeof valA === 'string') {
        return pageSortOrder === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        return pageSortOrder === 'asc'
          ? (valA || 0) - (valB || 0)
          : (valB || 0) - (valA || 0);
      }
    });

    return filtered;
  }, [data?.pages, pageSearch, pageSortField, pageSortOrder]);

  // 4. Session Timeline Modal state
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [sessionLogs, setSessionLogs] = useState([]);
  const [sessionIdentity, setSessionIdentity] = useState(null);
  const [loadingSession, setLoadingSession] = useState(false);

  const handleOpenSession = async (sessionId) => {
    if (!sessionId) return;
    setSelectedSessionId(sessionId);
    setLoadingSession(true);
    setSessionLogs([]);
    setSessionIdentity(null);
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API_BASE}/analytics/session/${sessionId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const result = await res.json();
        setSessionLogs(result.logs || []);
        setSessionIdentity(result.identity || null);
      }
    } catch (err) {
      console.error("Error loading session:", err);
    } finally {
      setLoadingSession(false);
    }
  };

  // Compute scroll color
  const getScrollColor = (depth) => {
    if (depth >= 75) return "text-emerald-400";
    if (depth >= 45) return "text-blue-400";
    return "text-slate-400";
  };

  // Compute time format
  const formatTimeSpent = (secs) => {
    if (!secs) return "0s";
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}m ${remainingSecs}s`;
  };

  const clarityProjectId = import.meta.env.VITE_CLARITY_PROJECT_ID || "xbj2we9di2";

  const handleExportPages = () => {
    if (!data || !Array.isArray(data.pages)) return;
    exportToCSV(
      data.pages,
      `page_engagement_${period}.csv`,
      ["page", "views", "avgTimeSpent", "avgScrollDepth", "bounceRate"],
      ["Page Path", "Views", "Avg Time Spent (s)", "Avg Scroll Depth (%)", "Bounce Rate (%)"]
    );
  };

  const handleExportActivity = () => {
    if (!data || !Array.isArray(data.recentActivity)) return;
    exportToCSV(
      data.recentActivity.map(act => ({
        ...act,
        time: new Date(act.createdAt).toLocaleString("en-IN")
      })),
      `recent_activity_${period}.csv`,
      ["time", "city", "source", "device", "action", "page_visited", "plan_clicked"],
      ["Timestamp", "City", "Traffic Source", "Device", "Action Type", "Page Path", "Plan Clicked"]
    );
  };

  return (
    <div className="animate-slideFade rounded-3xl bg-[#090e1a] border border-slate-800/80 p-6 text-white shadow-2xl relative overflow-hidden">
      {/* Background radial overlays */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.15),transparent_45%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.1),transparent_40%)] pointer-events-none" />

      {/* Header section */}
      <div className="relative z-10 flex flex-col justify-between gap-6 border-b border-slate-800/80 pb-6 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">
              Visitor Insights Console
            </p>
          </div>

          <h2 className="text-3xl font-black tracking-tight">
            Web Traffic & Action Analytics
          </h2>

          <p className="mt-1 text-xs text-slate-400 font-semibold">
            Real-time user sessions, conversion funnel, devices, and Microsoft Clarity integration.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Auto-Refresh Control */}
          <button
            onClick={() => setAutoRefresh(prev => !prev)}
            className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition duration-200 cursor-pointer ${
              autoRefresh
                ? "bg-emerald-600/90 text-white shadow-lg shadow-emerald-500/20 border border-emerald-500/30"
                : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${autoRefresh ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
            Auto-Refresh (30s)
          </button>

          {/* Period Selector */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-1 flex">
            {["24h", "7d", "30d"].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                  period === p
                    ? "bg-blue-600 text-white shadow-lg"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {p === "24h" ? "24 Hours" : p === "7d" ? "7 Days" : "30 Days"}
              </button>
            ))}
          </div>

          {/* Refresh Action */}
          <button
            onClick={refresh}
            className="flex items-center justify-center p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800 transition cursor-pointer"
            title="Refresh statistics"
          >
            <RefreshCw className={`h-4.5 w-4.5 text-slate-300 ${loading ? "animate-spin text-blue-400" : ""}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="min-h-[500px] flex flex-col items-center justify-center relative z-10 gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-slate-400 text-sm font-semibold">Compiling latest visitor metrics...</p>
        </div>
      ) : (
        <div className="mt-8 relative z-10 space-y-8">

          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7">
            <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-5 hover:border-blue-900/50 transition animate-slideFade">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Visitors</span>
              <p className="mt-2 text-3xl font-black text-white tracking-tight">{data?.summary?.totalVisitors || 0}</p>
              <span className="mt-1 text-[10px] text-emerald-400 font-semibold block">Unique users</span>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-5 border-l-2 border-l-emerald-500 animate-slideFade">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Users</span>
              <p className="mt-2 text-3xl font-black text-emerald-400 tracking-tight">{data?.summary?.activeUsers || 0}</p>
              <span className="mt-1 text-[10px] text-slate-400 font-medium block">Active (last 5 min)</span>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-5 hover:border-indigo-900/50 transition animate-slideFade">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">New Visitors</span>
              <p className="mt-2 text-3xl font-black text-white tracking-tight">{data?.summary?.newVisitors || 0}</p>
              <span className="mt-1 text-[10px] text-blue-400 font-semibold block">First sessions</span>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-5 hover:border-slate-800 transition animate-slideFade">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Returning Users</span>
              <p className="mt-2 text-3xl font-black text-white tracking-tight">{data?.summary?.returningVisitors || 0}</p>
              <span className="mt-1 text-[10px] text-slate-400 font-medium block">Recurring visits</span>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-5 hover:border-slate-800 transition animate-slideFade">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Session Duration</span>
              <p className="mt-2 text-3xl font-black text-white tracking-tight">{formatTimeSpent(data?.summary?.avgSessionDuration || 0)}</p>
              <span className="mt-1 text-[10px] text-slate-400 font-medium block">Avg time spent</span>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-5 hover:border-slate-800 transition animate-slideFade">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bounce Rate</span>
              <p className="mt-2 text-3xl font-black text-white tracking-tight">{data?.summary?.avgBounceRate || 0}%</p>
              <span className="mt-1 text-[10px] text-slate-400 font-medium block">Single page views</span>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-5 hover:border-slate-800 transition animate-slideFade">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Scroll Depth</span>
              <p className="mt-2 text-3xl font-black text-white tracking-tight">{data?.summary?.avgScrollDepth || 0}%</p>
              <span className="mt-1 text-[10px] text-slate-400 font-medium block">Average depth</span>
            </div>
          </div>

          {/* Visual Conversion Funnel */}
          <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-3xl p-6 animate-slideFade">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-4">
              <Award className="h-4 w-4 text-emerald-400" />
              Complete Admissions Lead Conversion Funnel
            </span>
            <div className="space-y-3">
              {funnelSteps.map((step, idx) => (
                <div key={step.label} className="bg-slate-950/40 border border-slate-800/80 p-3.5 px-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-[250px]">
                    <span className="text-xs font-bold text-slate-500">{String(idx + 1).padStart(2, "0")}</span>
                    <div>
                      <h4 className="text-sm font-black text-white">{step.label.replace(/^\d+\.\s*/, '')}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{step.count} Visitors</p>
                    </div>
                  </div>

                  <div className="flex-1 max-w-md">
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold mb-1">
                      <span>Funnel Rate</span>
                      <span>{step.pct}%</span>
                    </div>
                    <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                      <div className={`h-full ${step.color}`} style={{ width: `${step.pct}%` }} />
                    </div>
                  </div>

                  <div className="flex gap-6 text-right sm:min-w-[150px] justify-end">
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Conversion</p>
                      <p className="text-sm font-extrabold text-white">{step.pct}%</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Drop-off</p>
                      <p className={`text-sm font-extrabold ${idx === 0 ? "text-slate-500" : "text-rose-400"}`}>
                        {idx === 0 ? "0%" : `-${step.dropoff}%`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Primary Graphs Row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Daily Visitors Line Chart */}
            <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-3xl p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-blue-500" />
                  Visitor Traffic Trend
                </span>
              </div>

              <div className="h-72 w-full text-slate-400">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data?.dailyVisitors || []}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="visitorColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                    <XAxis
                      dataKey="date"
                      stroke="#64748b"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <ReChartsTooltip
                      contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", color: "#fff" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      name="Unique Visitors"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#visitorColor)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Traffic Sources Pie Chart */}
            <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-3xl p-5 flex flex-col justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-4">
                <Globe className="h-4 w-4 text-emerald-500" />
                Traffic Referral Sources
              </span>

              {pieData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-slate-500 font-semibold">
                  No source data available
                </div>
              ) : (
                <div className="flex-1 flex flex-col sm:flex-row items-center justify-around gap-4">
                  <div className="h-44 w-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <ReChartsTooltip
                          contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", color: "#fff" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex flex-col gap-1.5 text-xs text-slate-300 w-full sm:w-auto">
                    {pieData.map((entry, index) => (
                      <div key={entry.name} className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                        />
                        <span className="font-semibold">{entry.name}</span>
                        <span className="text-slate-500">({entry.value})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Marketing Lead Generation Breakdown (UTM Sources) */}
          <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-3xl p-6 animate-slideFade">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-4">
              <Award className="h-4 w-4 text-emerald-400" />
              Marketing Lead Generation Acquisition (UTM Sources)
            </span>
            <p className="text-xs text-slate-400 mb-4 font-semibold">
              Breakdown of successfully created parent enquiry leads grouped by marketing acquisition channels (UTM source).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
              {(data?.leadSources || []).map((src) => {
                const totalLeads = data?.leadSources?.reduce((sum, s) => sum + s.count, 0) || 1;
                const pct = Math.round((src.count / totalLeads) * 100);

                const sourceColors = {
                  Google: "bg-blue-500",
                  WhatsApp: "bg-green-500",
                  Instagram: "bg-pink-500",
                  Facebook: "bg-indigo-500",
                  Direct: "bg-slate-500",
                  YouTube: "bg-red-500",
                  Referral: "bg-amber-500"
                };
                const colorClass = sourceColors[src.name] || "bg-slate-600";

                return (
                  <div key={src.name} className="relative bg-slate-950/40 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between overflow-hidden">
                    <div>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{src.name} Leads</span>
                      <p className="mt-2 text-3xl font-black text-white tracking-tight">{src.count}</p>
                    </div>
                    <div className="mt-4">
                      <div className="flex justify-between text-[10px] text-slate-400 font-bold mb-1">
                        <span>Share</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className={`h-full ${colorClass}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Locations & Devices Row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Top Cities Bar Chart */}
            <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-3xl p-5 lg:col-span-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-4">
                <MapPin className="h-4 w-4 text-rose-500" />
                Top Cities Geolocation
              </span>

              <div className="h-64 w-full">
                {!Array.isArray(data?.locationStats) || data.locationStats.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 font-semibold">
                    No location data available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.locationStats.slice(0, 10)}
                      margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
                      <XAxis
                        dataKey="city"
                        stroke="#64748b"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#64748b"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <ReChartsTooltip
                        contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px", color: "#fff" }}
                      />
                      <Bar dataKey="count" name="Visitors" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Devices and Tech Specs */}
            <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-3xl p-5 flex flex-col justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-4">
                <Laptop className="h-4 w-4 text-purple-500" />
                Devices & Technology Specs
              </span>

              <div className="space-y-4 flex-1 flex flex-col justify-around">
                {/* Device Breakdown */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-400 mb-2">
                    <span>DEVICE CATEGORY</span>
                    <span>VISITORS</span>
                  </div>
                  <div className="space-y-2">
                    {["Mobile", "Desktop", "Tablet"].map((dev) => {
                      const found = data?.devices?.find((d) => d._id?.toLowerCase() === dev.toLowerCase());
                      const count = found ? found.count : 0;
                      const totalDevices = data?.devices?.reduce((sum, d) => sum + d.count, 0) || 1;
                      const pct = Math.round((count / totalDevices) * 100);

                      const barColors = { Mobile: "bg-emerald-500", Desktop: "bg-blue-500", Tablet: "bg-amber-500" };
                      const Icon = dev === "Mobile" ? Smartphone : dev === "Desktop" ? Laptop : Tablet;

                      return (
                        <div key={dev} className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-slate-400 shrink-0" />
                          <span className="text-xs font-semibold w-16">{dev}</span>
                          <div className="flex-1 bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div className={`h-full ${barColors[dev]}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-bold w-12 text-right">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top Browser and Top OS */}
                <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Top Operating System</span>
                    <p className="mt-1 text-sm font-bold text-slate-200">
                      {data?.operatingSystems?.[0]?._id || "Unknown"}
                      <span className="text-xs text-slate-400 font-medium ml-1">({data?.operatingSystems?.[0]?.count || 0})</span>
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Top Browser</span>
                    <p className="mt-1 text-sm font-bold text-slate-200">
                      {data?.browsers?.[0]?._id || "Unknown"}
                      <span className="text-xs text-slate-400 font-medium ml-1">({data?.browsers?.[0]?.count || 0})</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Plan Analytics & Custom Actions Row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Plans Conversion Performance */}
            <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-3xl p-5 lg:col-span-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-4">
                <Award className="h-4 w-4 text-indigo-400" />
                Plans Carousel Conversion Funnel
              </span>

              <div className="overflow-x-auto">
                <table className="w-full text-xs font-semibold text-slate-300">
                  <thead>
                    <tr className="text-left border-b border-slate-800/80 text-[10px] text-slate-500 uppercase tracking-wider">
                      <th className="pb-3">PLAN NAME</th>
                      <th className="pb-3 text-center">VIEWS</th>
                      <th className="pb-3 text-center">EXPLORE CLICKS</th>
                      <th className="pb-3 text-center">SELECTIONS</th>
                      <th className="pb-3 text-center">ENQUIRIES</th>
                      <th className="pb-3 text-center">DEMOS</th>
                      <th className="pb-3 text-right">CONVERSION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(data?.plans) && data.plans.map((plan) => (
                      <tr key={plan.name} className="border-b border-slate-800/50 last:border-0">
                        <td className="py-4 font-bold text-white text-sm">{plan.name}</td>
                        <td className="py-4 text-center font-bold text-slate-400">{plan.views || 0}</td>
                        <td className="py-4 text-center font-bold text-slate-400">{plan.exploreClicks || 0}</td>
                        <td className="py-4 text-center font-bold text-emerald-400">{plan.selections || 0}</td>
                        <td className="py-4 text-center font-bold text-indigo-400">{plan.enquiries || 0}</td>
                        <td className="py-4 text-center font-bold text-purple-400">{plan.demos || 0}</td>
                        <td className="py-4 text-right">
                          <span className="bg-emerald-950/60 border border-emerald-900/60 text-emerald-400 font-black rounded-lg px-2.5 py-1">
                            {plan.conversionRate || 0}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Custom Interactive Action Events */}
            <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-3xl p-5 flex flex-col justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-4">
                <MousePointerClick className="h-4 w-4 text-amber-500" />
                Key CTA Button Clicks
              </span>

              <div className="space-y-2 flex-1 flex flex-col justify-around">
                <div className="flex justify-between items-center text-xs font-semibold border-b border-slate-800/60 py-2">
                  <span className="text-slate-400">Explore Plans</span>
                  <span className="bg-slate-800 px-2 py-0.5 rounded text-white font-bold">{actionCounts.explore_plan}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-semibold border-b border-slate-800/60 py-2">
                  <span className="text-slate-400">Book Demo CTA</span>
                  <span className="bg-slate-800 px-2 py-0.5 rounded text-white font-bold">{actionCounts.book_demo}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-semibold border-b border-slate-800/60 py-2">
                  <span className="text-slate-400">Plan Selected</span>
                  <span className="bg-slate-800 px-2 py-0.5 rounded text-white font-bold">{actionCounts.choose_plan}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-semibold border-b border-slate-800/60 py-2">
                  <span className="text-slate-400">Become a Tutor CTA</span>
                  <span className="bg-slate-800 px-2 py-0.5 rounded text-white font-bold">{actionCounts.become_tutor}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-semibold border-b border-slate-800/60 py-2">
                  <span className="text-slate-400">WhatsApp Button Clicks</span>
                  <span className="bg-emerald-950/40 border border-emerald-900/60 text-emerald-400 px-2 py-0.5 rounded font-bold">{actionCounts.whatsapp_click}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-semibold border-b border-slate-800/60 py-2">
                  <span className="text-slate-400">Phone Call Clicks</span>
                  <span className="bg-blue-950/40 border border-blue-900/60 text-blue-400 px-2 py-0.5 rounded font-bold">{actionCounts.call_click}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-semibold py-2">
                  <span className="text-slate-400">Enquiry Started vs Submitted</span>
                  <span className="text-slate-300 font-bold">
                    <span className="text-slate-400">{actionCounts.form_started}</span>
                    <span className="mx-1 text-slate-600">/</span>
                    <span className="text-emerald-400">{actionCounts.form_submitted}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Page Analytics Table with Search and Sort */}
          <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-3xl p-5">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Eye className="h-4 w-4 text-emerald-400" />
                Most Visited Pages & Engagement Metrics
              </span>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <input
                  type="text"
                  placeholder="Filter pages..."
                  value={pageSearch}
                  onChange={(e) => setPageSearch(e.target.value)}
                  className="bg-slate-950/80 border border-slate-800 px-3 py-1.5 text-xs rounded-xl text-white font-semibold outline-none focus:border-blue-500 max-w-[200px]"
                />

                <button
                  onClick={handleExportPages}
                  className="flex items-center gap-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs text-white font-bold px-3 py-1.5 rounded-xl cursor-pointer transition"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Export CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs font-semibold text-slate-300">
                <thead>
                  <tr className="text-left border-b border-slate-800/80 text-[10px] text-slate-500 uppercase tracking-wider select-none">
                    <th className="pb-3 cursor-pointer hover:text-white transition" onClick={() => togglePageSort("page")}>
                      PAGE PATH {pageSortField === "page" ? (pageSortOrder === "asc" ? "▲" : "▼") : ""}
                    </th>
                    <th className="pb-3 text-center cursor-pointer hover:text-white transition" onClick={() => togglePageSort("views")}>
                      PAGE VIEWS {pageSortField === "views" ? (pageSortOrder === "asc" ? "▲" : "▼") : ""}
                    </th>
                    <th className="pb-3 text-center cursor-pointer hover:text-white transition" onClick={() => togglePageSort("avgTimeSpent")}>
                      AVG TIME SPENT {pageSortField === "avgTimeSpent" ? (pageSortOrder === "asc" ? "▲" : "▼") : ""}
                    </th>
                    <th className="pb-3 text-center cursor-pointer hover:text-white transition" onClick={() => togglePageSort("avgScrollDepth")}>
                      MAX SCROLL DEPTH {pageSortField === "avgScrollDepth" ? (pageSortOrder === "asc" ? "▲" : "▼") : ""}
                    </th>
                    <th className="pb-3 text-right cursor-pointer hover:text-white transition" onClick={() => togglePageSort("bounceRate")}>
                      BOUNCE RATE {pageSortField === "bounceRate" ? (pageSortOrder === "asc" ? "▲" : "▼") : ""}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAndFilteredPages.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-slate-500 italic">No matching pages found</td>
                    </tr>
                  ) : (
                    sortedAndFilteredPages.map((page) => (
                      <tr key={page.page} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-900/20 transition">
                        <td className="py-4 font-mono font-bold text-blue-400 text-xs break-all pr-4">{page.page}</td>
                        <td className="py-4 text-center font-bold text-white">{page.views}</td>
                        <td className="py-4 text-center font-bold text-slate-400">{formatTimeSpent(page.avgTimeSpent)}</td>
                        <td className="py-4 text-center font-bold">
                          <span className={getScrollColor(page.avgScrollDepth)}>{page.avgScrollDepth}%</span>
                        </td>
                        <td className="py-4 text-right">
                          <span className={`font-bold ${page.bounceRate >= 60 ? 'text-rose-400' : 'text-slate-400'}`}>
                            {page.bounceRate}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Real-time activity & Clarity Integration Cards */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Real-time Activity feed with timeline modal hooks */}
            <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-3xl p-5 lg:col-span-2">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-blue-400 animate-pulse" />
                  Live Visitor Event Log (Click to view session timeline)
                </span>

                <button
                  onClick={handleExportActivity}
                  className="flex items-center gap-1 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs text-white font-bold px-3 py-1.5 rounded-xl cursor-pointer transition"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Export CSV
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-3.5 pr-2 no-scrollbar">
                {!Array.isArray(data?.recentActivity) || data.recentActivity.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-500 font-semibold">
                    No recent activities recorded.
                  </div>
                ) : (
                  data.recentActivity.map((act) => {
                    const dateObj = act?.createdAt ? new Date(act.createdAt) : null;
                    const timeStr = dateObj && !isNaN(dateObj.getTime())
                      ? dateObj.toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true
                        })
                      : "00:00";

                    const actionLabels = {
                      page_view: `Visited ${act.page_visited}`,
                      explore_plan: `Explored ${act.plan_clicked || "plan details"}`,
                      choose_plan: `Chose ${act.plan_clicked || "plan"} option`,
                      book_demo: `Clicked Book Demo`,
                      become_tutor: `Clicked Become a Tutor`,
                      whatsapp_click: `Clicked WhatsApp button`,
                      call_click: `Clicked Phone Call button`,
                      form_started: `Started Enquiry Form`,
                      form_submitted: `Submitted Enquiry Form`,
                      form_abandoned: `Abandoned Enquiry Form`
                    };

                    const actionColors = {
                      form_submitted: "bg-emerald-950/40 border-emerald-900/50 text-emerald-400",
                      form_abandoned: "bg-rose-950/40 border-rose-900/50 text-rose-400",
                      form_started: "bg-indigo-950/40 border-indigo-900/50 text-indigo-400",
                      whatsapp_click: "bg-emerald-950/40 border-emerald-900/50 text-emerald-400",
                      page_view: "bg-slate-800 border-slate-800 text-slate-400"
                    };

                    const actionClass = actionColors[act.action] || "bg-blue-950/40 border-blue-900/50 text-blue-400";

                    return (
                      <div
                        key={act._id}
                        onClick={() => handleOpenSession(act.session_id)}
                        className="flex gap-4 items-start border-b border-slate-800/50 pb-3 last:border-0 last:pb-0 cursor-pointer hover:bg-slate-800/30 transition p-2.5 rounded-2xl"
                      >
                        <span className="text-[10px] font-bold text-slate-500 w-14 shrink-0 mt-1">{timeStr}</span>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap animate-fadeIn">
                            {act.identity ? (
                              <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                                {act.identity.name} {act.identity.phone ? `(${act.identity.phone})` : ""}
                                {act.identity.isDraft ? (
                                  <span className="ml-1 text-[8px] bg-amber-500/10 text-amber-300 font-medium px-1 rounded border border-amber-500/20">Draft</span>
                                ) : (
                                  <span className="ml-1 text-[8px] bg-emerald-500/10 text-emerald-300 font-medium px-1 rounded border border-emerald-500/20">Lead</span>
                                )}
                              </span>
                            ) : (
                              <span>User</span>
                            )}
                            <span>from</span> <span className="text-blue-400 font-black">{act.city || "Unknown City"}</span>
                            <span className="text-slate-700">•</span>
                            Source: <span className="text-slate-400 font-semibold">{formatSourceName(act.source)}</span>
                            <span className="text-slate-700">•</span>
                            Device: <span className="text-slate-400 font-semibold">{act.device || "Desktop"}{act.os ? ` (${act.os})` : ""}</span>
                            {act.ipAddress && (
                              <>
                                <span className="text-slate-700">•</span>
                                IP: <span className="text-slate-400 font-mono font-semibold">{act.ipAddress}</span>
                              </>
                            )}
                          </p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${actionClass}`}>
                              {actionLabels[act.action] || act.action}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Microsoft Clarity Project Widget */}
            <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-3xl p-5 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-3">
                  <Activity className="h-4 w-4 text-blue-400" />
                  Session Recordings & Heatmaps
                </span>

                <p className="text-xs leading-relaxed text-slate-400 mt-2 font-medium">
                  We have integrated Microsoft Clarity to enable advanced heatmaps, mouse click records, scroll depth tracking, and user session replay recordings.
                </p>

                <div className="mt-4 p-3 bg-blue-950/20 border border-blue-900/30 rounded-2xl flex flex-col gap-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Integrate Mode:</span>
                    <span className="text-emerald-400 font-bold">Active</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Project ID:</span>
                    <span className="font-mono font-bold">{clarityProjectId}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <a
                  href={`https://clarity.microsoft.com/projects/view/${clarityProjectId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 transition font-black text-xs text-white shadow-lg cursor-pointer"
                >
                  Watch Session Replays
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>

                <p className="text-[10px] text-center text-slate-500 font-semibold leading-normal">
                  * Note: You must log into your Microsoft Clarity account in this browser to open recordings directly.
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* 5. Timeline Journey Modal popup */}
      {selectedSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-slideFade">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-3xl bg-[#090e1a] border border-slate-800 p-6 text-white shadow-2xl flex flex-col relative z-50">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-400 animate-pulse" />
                  Chronological Session Timeline
                </h3>
                <p className="text-[10px] text-slate-500 font-mono mt-1">Session: {selectedSessionId}</p>
              </div>
              <button
                onClick={() => setSelectedSessionId(null)}
                className="rounded-full bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-bold text-slate-400 transition cursor-pointer border border-slate-700/50"
              >
                Close
              </button>
            </div>

            {sessionIdentity && (
              <div className="bg-[#101726]/85 border border-emerald-500/20 shadow-lg shadow-[#090e1a]/80 rounded-2xl p-4 mb-4 flex items-center justify-between gap-4 animate-slideFade shrink-0">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-emerald-400">{sessionIdentity.name}</span>
                    {sessionIdentity.isDraft ? (
                      <span className="text-[9px] bg-amber-500/10 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/20">Draft Lead</span>
                    ) : (
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">Submitted Lead</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[10px] font-bold text-slate-400">
                    {sessionIdentity.phone && <span className="flex items-center gap-1">📞 {sessionIdentity.phone}</span>}
                    {sessionIdentity.email && <span className="flex items-center gap-1">✉️ {sessionIdentity.email}</span>}
                    {sessionLogs.length > 0 && (
                      <>
                        <span className="flex items-center gap-1">📱 {sessionLogs[0].device || "Desktop"}{sessionLogs[0].os ? ` (${sessionLogs[0].os})` : ""}</span>
                        <span className="flex items-center gap-1">🧭 Source: {formatSourceName(sessionLogs[0].source)}</span>
                      </>
                    )}
                  </div>
                </div>
                {sessionLogs.length > 0 && (
                  <div className="text-right text-[10px] text-slate-500 font-mono space-y-0.5 hidden sm:block">
                    <div>IP: {sessionLogs[0].ipAddress || "Unknown"}</div>
                    <div>Location: {sessionLogs[0].city || "Unknown City"}</div>
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 no-scrollbar min-h-60">
              {loadingSession ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
                  <p className="text-xs text-slate-400 font-semibold">Retrieving session timeline events...</p>
                </div>
              ) : sessionLogs.length === 0 ? (
                <div className="text-center py-20 text-xs text-slate-500 font-semibold italic">No logged events found for this session.</div>
              ) : (
                <div className="relative border-l border-slate-800 ml-3 pl-6 space-y-5">
                  {sessionLogs.map((log) => {
                    const dateObj = log.createdAt ? new Date(log.createdAt) : null;
                    const timeStr = dateObj && !isNaN(dateObj.getTime())
                      ? dateObj.toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: true
                        })
                      : "00:00:00";

                    const actionLabels = {
                      page_view: `Visited page`,
                      explore_plan: `Explored plan details`,
                      choose_plan: `Chose plan option`,
                      book_demo: `Clicked Book Demo`,
                      become_tutor: `Clicked Become a Tutor`,
                      whatsapp_click: `Clicked WhatsApp button`,
                      call_click: `Clicked Phone Call button`,
                      form_started: `Started Enquiry Form`,
                      form_submitted: `Submitted Enquiry Form`,
                      form_abandoned: `Abandoned Enquiry Form`
                    };

                    const actionStyles = {
                      page_view: "border-blue-500/50 bg-blue-950/20 text-blue-400",
                      form_started: "border-indigo-500/50 bg-indigo-950/20 text-indigo-400",
                      form_submitted: "border-emerald-500/50 bg-emerald-950/20 text-emerald-400",
                      form_abandoned: "border-rose-500/50 bg-rose-950/20 text-rose-400",
                      whatsapp_click: "border-emerald-500/50 bg-emerald-950/20 text-emerald-400",
                      call_click: "border-blue-500/50 bg-blue-950/20 text-blue-400"
                    };

                    const actionStyle = actionStyles[log.action] || "border-slate-700 bg-slate-900/50 text-slate-400";

                    return (
                      <div key={log._id} className="relative">
                        {/* Timeline dot marker */}
                        <span className={`absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full border-2 bg-[#090e1a] ${
                          log.action === "form_submitted" ? "border-emerald-500" : "border-slate-800"
                        }`} />

                        <div className="bg-slate-950/40 border border-slate-800/80 p-3.5 rounded-2xl">
                          <div className="flex items-center justify-between gap-4 mb-1">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${actionStyle}`}>
                              {actionLabels[log.action] || log.action.replace("_", " ")}
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold">{timeStr}</span>
                          </div>

                          {log.action === "page_view" && (
                            <p className="text-xs font-mono font-bold text-blue-400 mt-1 break-all">{log.page_visited}</p>
                          )}

                          {log.plan_clicked && (
                            <p className="text-xs font-semibold text-slate-400 mt-1">
                              Plan: <span className="text-indigo-400 font-bold">{log.plan_clicked}</span>
                            </p>
                          )}

                          {(log.time_spent > 0 || log.scroll_depth > 0) && (
                            <div className="flex gap-4 mt-2 text-[10px] text-slate-500 font-bold border-t border-slate-900 pt-2">
                              {log.time_spent > 0 && <span>⏱️ Dwell Time: {log.time_spent}s</span>}
                              {log.scroll_depth > 0 && <span>📜 Scroll Depth: {log.scroll_depth}%</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedSessionId(null)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-xs font-black rounded-xl transition cursor-pointer text-white shadow-lg shadow-blue-600/20"
              >
                Close Session Timeline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
