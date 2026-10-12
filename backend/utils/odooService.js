import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

/* ============================================================================
   ENVIRONMENT CONFIGURATION
============================================================================ */

function sanitizeEnv(val) {
  return (val || "").trim().replace(/^['"]|['"]$/g, "");
}

const _ODOO_URL = sanitizeEnv(
  process.env.ODOO_COMMUNITY_URL || process.env.ODOO_URL || "https://odoo.saraswatitutorial.com"
).replace(/\/+$/, "");
const _DB = sanitizeEnv(process.env.ODOO_DB || "saraswati-tutorial");
const _USERNAME = sanitizeEnv(process.env.ODOO_USERNAME || "admin");
const _PASSWORD = sanitizeEnv(process.env.ODOO_PASSWORD || "");

const _ATTENDANCE_API_TOKEN = sanitizeEnv(
  process.env.ODOO_COMMUNITY_API_TOKEN || process.env.ODOO_ATTENDANCE_API_TOKEN || ""
);

const _JSONRPC_URL = process.env.ODOO_JSONRPC_URL || `${_ODOO_URL}/jsonrpc`;

const _ATTENDANCE_API_URL =
  process.env.ODOO_ATTENDANCE_API_URL || `${_ODOO_URL}/tuition/api/v1/attendance`;


/* ============================================================================
   STARTUP DIAGNOSTICS
============================================================================ */

console.log(`[OdooService] Odoo base URL          : ${_ODOO_URL}`);
console.log(`[OdooService] Odoo JSON-RPC endpoint : ${_JSONRPC_URL}`);
console.log(`[OdooService] Attendance API         : ${_ATTENDANCE_API_URL}`);
console.log(`[OdooService] Odoo DB                : ${_DB}`);
console.log(`[OdooService] Odoo username          : ${_USERNAME}`);

console.log(
  `[OdooService] Attendance API token  : ${
    _ATTENDANCE_API_TOKEN ? "Configured ✅" : "Missing ❌"
  }`
);


/* ============================================================================
   GENERIC ODOO JSON-RPC CALL
============================================================================ */

export async function callOdoo(service, method, args) {

  const payload = {
    jsonrpc: "2.0",
    method: "call",

    params: {
      service,
      method,
      args,
    },

    id: Math.floor(Math.random() * 1000000),
  };


  let res;

  try {

    res = await fetch(_JSONRPC_URL, {

      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },

      body: JSON.stringify(payload),

    });

  } catch (netErr) {

    console.error(
      `[OdooService] Network error connecting to "${_JSONRPC_URL}":`,
      netErr.message
    );

    throw new Error(
      `Odoo connection failed: ${netErr.message}`
    );
  }


  const responseText = await res.text();

  let data;


  try {

    data = JSON.parse(responseText);

  } catch (parseErr) {

    const statusCode = res.status;
    const finalUrl = res.url;

    const contentType =
      res.headers.get("content-type") || "unknown";

    const bodySnippet =
      responseText.substring(0, 300);


    console.error(
      `[OdooService] ❌ Non-JSON response from Odoo`
    );

    console.error(`Target URL    : ${_JSONRPC_URL}`);
    console.error(`HTTP Status   : ${statusCode}`);
    console.error(`Final URL     : ${finalUrl}`);
    console.error(`Content-Type  : ${contentType}`);
    console.error(`Response      : ${bodySnippet}`);


    throw new Error(
      `Odoo returned non-JSON (HTTP ${statusCode}): ` +
      bodySnippet
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 120)
    );
  }


  if (data.error) {

    const errMsg =
      data.error?.data?.message ||
      data.error?.message ||
      "Odoo Error";

    throw new Error(errMsg);
  }


  return data.result;
}


/* ============================================================================
   ATTENDANCE HELPERS
============================================================================ */

/**
 * Convert website attendance values into values accepted by
 * the dedicated Odoo Tuition Attendance API.
 *
 * Odoo accepts ONLY:
 *
 * completed
 * absent
 * cancelled
 */
function mapAttendanceStatus(status) {

  const value = String(status || "")
    .trim()
    .toLowerCase();


  switch (value) {

    case "done":
    case "complete":
    case "completed":
    case "present":
      return "completed";


    case "missed":
    case "absent":
    case "absence":
      return "absent";


    case "cancelled":
    case "canceled":
    case "cancel":
      return "cancelled";


    default:
      throw new Error(
        `Unsupported attendance status "${status}". ` +
        `Allowed values are completed, absent, cancelled.`
      );
  }
}


/**
 * Create/normalize class_datetime.
 *
 * Odoo API expects something such as:
 *
 * 2026-09-10T10:00:00+05:30
 */
function normalizeClassDatetime(value, fallbackTime = "10:00:00") {

  if (!value) {
    return null;
  }

  const raw = String(value).trim();


  // Already contains time + timezone
  if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw) &&
    (raw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(raw))
  ) {
    return raw;
  }


  // YYYY-MM-DD only
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {

    return `${raw}T${fallbackTime}+05:30`;
  }


  // JS-compatible date
  const parsed = new Date(raw);

  if (!Number.isNaN(parsed.getTime())) {

    return parsed.toISOString();
  }


  throw new Error(
    `Invalid class datetime: ${value}`
  );
}


/**
 * Try to obtain a stable student ID.
 *
 * IMPORTANT:
 * website_student_id must represent the same student every time.
 */
function resolveWebsiteStudentId(log, lead) {

  const firstWard =
    Array.isArray(lead?.wards) && lead.wards.length
      ? lead.wards[0]
      : {};


  return (

    log?.websiteStudentId ||

    log?.website_student_id ||

    log?.studentExternalId ||

    firstWard?.websiteStudentId ||

    firstWard?.studentId ||

    firstWard?.externalStudentId ||

    lead?.websiteStudentId ||

    null

  );
}


/**
 * Permanent unique attendance ID.
 *
 * The same attendance record must always send the SAME
 * external_attendance_id to prevent duplicates in Odoo.
 */
function resolveExternalAttendanceId(log) {

  if (log?.externalAttendanceId) {
    return String(log.externalAttendanceId);
  }

  if (log?.external_attendance_id) {
    return String(log.external_attendance_id);
  }

  if (log?._id) {
    return `ATT-${String(log._id)}`;
  }

  if (log?.id) {
    return `ATT-${String(log.id)}`;
  }

  throw new Error(
    "Unable to generate external attendance ID because attendance record has no ID."
  );
}


/* ============================================================================
   NEW DEDICATED ODOO ATTENDANCE API
============================================================================ */

/**
 * Send attendance to:
 *
 * POST /tuition/api/v1/attendance
 *
 * Authorization:
 * Bearer <TOKEN>
 *
 * Odoo itself handles:
 *
 * - attendance calculation
 * - completed class counting
 * - tuition progress
 * - 90% threshold
 * - payment flow
 * - notifications
 */
export async function syncAttendanceToOdooApi({

  websiteStudentId,
  externalAttendanceId,

  tutorExternalId,
  tutorName,

  classDatetime,

  status,

  notes = "",

}) {

  try {

    if (!_ATTENDANCE_API_TOKEN) {

      throw new Error(
        "ODOO_ATTENDANCE_API_TOKEN is not configured"
      );
    }


    if (!websiteStudentId) {

      throw new Error(
        "website_student_id is required by Odoo Attendance API"
      );
    }


    if (!externalAttendanceId) {

      throw new Error(
        "external_attendance_id is required by Odoo Attendance API"
      );
    }


    const normalizedStatus =
      mapAttendanceStatus(status);


    if (!classDatetime) {

      throw new Error(
        "class_datetime is required for attendance synchronization"
      );
    }


    const normalizedDatetime =
      normalizeClassDatetime(classDatetime);


    const payload = {

      jsonrpc: "2.0",

      method: "call",

      params: {

        website_student_id:
          String(websiteStudentId),

        external_attendance_id:
          String(externalAttendanceId),

        tutor_external_id:
          tutorExternalId
            ? String(tutorExternalId)
            : "",

        tutor_name:
          tutorName || "",

        class_datetime:
          normalizedDatetime,

        status:
          normalizedStatus,

        notes:
          notes || "",

      },

      id: Date.now(),

    };


    console.log(
      `[Odoo Attendance API] Sending attendance ${externalAttendanceId}`
    );

    console.log(
      `[Odoo Attendance API] Student=${websiteStudentId}, ` +
      `Status=${normalizedStatus}, ` +
      `Class=${normalizedDatetime}`
    );


    let response;


    try {

      response = await fetch(
        _ATTENDANCE_API_URL,
        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            Accept:
              "application/json",

            Authorization:
              `Bearer ${_ATTENDANCE_API_TOKEN}`,

          },

          body:
            JSON.stringify(payload),

        }
      );

    } catch (networkError) {

      throw new Error(
        `Attendance API connection failed: ${networkError.message}`
      );
    }


    const responseText =
      await response.text();


    let result;


    try {

      result =
        JSON.parse(responseText);

    } catch (parseError) {

      console.error(
        "[Odoo Attendance API] ❌ Non-JSON response"
      );

      console.error(
        "Status:",
        response.status
      );

      console.error(
        "URL:",
        response.url
      );

      console.error(
        "Response:",
        responseText.substring(0, 500)
      );


      throw new Error(
        `Odoo Attendance API returned non-JSON ` +
        `(HTTP ${response.status})`
      );
    }


    if (!response.ok) {

      const errorMessage =

        result?.error?.data?.message ||

        result?.error?.message ||

        result?.message ||

        `HTTP ${response.status}`;


      throw new Error(
        errorMessage
      );
    }


    if (result?.error) {

      const errorMessage =

        result.error?.data?.message ||

        result.error?.message ||

        "Odoo Attendance API Error";


      throw new Error(
        errorMessage
      );
    }


    console.log(
      `[Odoo Attendance API] ✅ Successfully synced ${externalAttendanceId}`
    );


    return {

      success: true,

      externalAttendanceId,

      data:
        result?.result ?? result,

    };


  } catch (err) {

    console.error(
      `[Odoo Attendance API] ❌ Sync failed for ${externalAttendanceId || "unknown"}:`,
      err.message
    );


    return {

      success: false,

      externalAttendanceId,

      error:
        err.message,

    };
  }
}


/* ============================================================================
   CREATE CRM LEAD (ODOO COMMUNITY COMPATIBLE)
============================================================================ */

export async function createLead(data) {
  try {
    const uid = await callOdoo("common", "authenticate", [
      _DB,
      _USERNAME,
      _PASSWORD,
      {},
    ]);

    if (!uid) {
      throw new Error("Odoo login failed: invalid credentials or database");
    }

    let leadPayload = {};

    /* ------------------------------------------------------------------------
       TUTOR LEAD
    ------------------------------------------------------------------------ */
    if (data.userType === "tutor") {
      leadPayload = {
        name: data.name || "New Tutor",
        contact_name: data.name || "",
        phone: data.phone || "",
        email_from: data.email || false,
        lead_category: "Tutor",
        x_user_type: "tutor",
        description: [
          `--- WEBSITE TUTOR REGISTRATION ---`,
          `Name: ${data.name || "N/A"}`,
          `Phone: ${data.phone || "N/A"}`,
          `Email: ${data.email || "N/A"}`,
          `Qualification: ${data.qualification || "N/A"}`,
          `Experience: ${data.experience || "N/A"}`,
          `Occupation: ${data.occupation || "N/A"}`,
          `Has Vehicle: ${data.hasVehicle ? "Yes" : "No"} (${data.vehicleNumber || "N/A"})`,
          `Locations: ${Array.isArray(data.locations) ? data.locations.join(", ") : (data.area || data.location || "N/A")}`,
          `Subjects: ${Array.isArray(data.subjects) ? data.subjects.join(", ") : (data.subject || "N/A")}`,
        ].join("\n"),
      };
    }

    /* ------------------------------------------------------------------------
       PARENT LEAD (ODOO COMMUNITY CRM FIELD MAPPING)
    ------------------------------------------------------------------------ */
    if (data.userType === "parent" || !data.userType) {
      const ward =
        Array.isArray(data.wards) && data.wards.length > 0 ? data.wards[0] : {};
      const studentName = ward.studentName || data.studentName || "";
      const studentClass = ward.classGrade || data.studentClass || data.classGrade || "";
      const subjects =
        Array.isArray(ward.subjectsNeeded) && ward.subjectsNeeded.length > 0
          ? ward.subjectsNeeded.join(", ")
          : (Array.isArray(data.subjects) ? data.subjects.join(", ") : (data.subjects || ""));

      // Curriculum / Board selection mapping:
      // Available in Odoo Community: ['CBSE', 'ICSE', 'NIOS', 'IB', 'STATE', 'IGCSE']
      let curriculumVal = false;
      const rawCurr = String(ward.curriculum || data.curriculum || "").toUpperCase().trim();
      if (rawCurr.includes("STATE")) {
        curriculumVal = "STATE";
      } else if (["CBSE", "ICSE", "NIOS", "IB", "IGCSE"].includes(rawCurr)) {
        curriculumVal = rawCurr;
      }

      // Days/Week selection mapping:
      // Available in Odoo Community: ['2 Days', '3 Days', '4 Days', '5 Days', '6 Days']
      let daysWeekVal = false;
      let daysCount = data.daysPerWeek
        ? Number(data.daysPerWeek)
        : (Array.isArray(data.preferredDays) ? data.preferredDays.length : null);
      if (daysCount) {
        if (daysCount <= 2) daysWeekVal = "2 Days";
        else if (daysCount === 3) daysWeekVal = "3 Days";
        else if (daysCount === 4) daysWeekVal = "4 Days";
        else if (daysCount === 5) daysWeekVal = "5 Days";
        else if (daysCount >= 6) daysWeekVal = "6 Days";
      }

      // Hours/Days selection mapping:
      // Available in Odoo Community: ['1 Hr', '1.5 Hr', '2 Hrs', '3 Hrs', '4 Hrs', '6 Hrs']
      let hoursDaysVal = false;
      if (data.hoursPerDay) {
        const h = Number(data.hoursPerDay);
        if (h === 1) hoursDaysVal = "1 Hr";
        else if (h === 1.5) hoursDaysVal = "1.5 Hr";
        else if (h === 2) hoursDaysVal = "2 Hrs";
        else if (h === 3) hoursDaysVal = "3 Hrs";
        else if (h === 4) hoursDaysVal = "4 Hrs";
        else if (h >= 6) hoursDaysVal = "6 Hrs";
      } else if (data.classDuration) {
        const dStr = String(data.classDuration).toLowerCase();
        if (dStr.includes("1.5")) hoursDaysVal = "1.5 Hr";
        else if (dStr.includes("1")) hoursDaysVal = "1 Hr";
        else if (dStr.includes("2")) hoursDaysVal = "2 Hrs";
      }

      // Preferred tutor gender:
      // tutor_gender selection in Odoo Community: ['Male', 'Female', 'Both']
      let tutorGenderVal = false;
      const prefGen = String(data.preferredGender || "").trim();
      if (prefGen.toLowerCase() === "male") tutorGenderVal = "Male";
      else if (prefGen.toLowerCase() === "female") tutorGenderVal = "Female";
      else if (["flexible", "both", "no preference"].includes(prefGen.toLowerCase())) tutorGenderVal = "Both";

      const preferredTutorGenderText =
        prefGen.toLowerCase() === "flexible" || !prefGen ? "No Preference" : prefGen;

      // Fee & package calculations
      const totalClasses = Number(
        data.totalClasses ||
        (data.daysPerWeek ? Number(data.daysPerWeek) * 4 : 12)
      );
      const tuitionFee = Number(data.finalPrice || data.monthlyFees || 0);

      const wardsInfo = (data.wards || [])
        .map((w, idx) =>
          `Student ${idx + 1}: ${w.studentName || "N/A"} (Class: ${w.classGrade || "N/A"}, Board: ${w.curriculum || "N/A"}, Subjects: ${(w.subjectsNeeded || []).join(", ") || "N/A"})`
        )
        .join("\n");

      const descriptionText = [
        `--- WEBSITE PARENT ENQUIRY ---`,
        `Parent Name: ${data.parentName || "N/A"}`,
        `Phone: ${data.phone || "N/A"}`,
        `Email: ${data.email || "N/A"}`,
        `Tuition Mode: ${data.preferredMode || "Not Specified"}`,
        `Plan Type: ${data.planType ? String(data.planType).toUpperCase() : "Not Specified"}`,
        `Days / Week: ${daysWeekVal || (data.daysPerWeek ? `${data.daysPerWeek} Days` : "Not Specified")}`,
        `Hours / Day: ${hoursDaysVal || (data.hoursPerDay ? `${data.hoursPerDay} Hr` : "Not Specified")}`,
        `Preferred Days: ${Array.isArray(data.preferredDays) && data.preferredDays.length > 0 ? data.preferredDays.join(", ") : "Not Specified"}`,
        `Class Timing Slot: ${data.classTimingSlot || data.preferredTime || "Not Specified"}`,
        `Monthly Fees: ${data.monthlyFees ? `₹${data.monthlyFees}` : "N/A"}`,
        `Final Price: ${data.finalPrice ? `₹${data.finalPrice}` : "N/A"}`,
        `Pricing Consent: ${data.pricingConsent ? "Yes (Accepted)" : "No"}`,
        `Address: ${data.address || data.area || "N/A"}`,
        `------------------------------`,
        wardsInfo ? `STUDENTS:\n${wardsInfo}` : `Student Name: ${studentName || "N/A"}`,
        `------------------------------`,
        `UTM Source: ${data.utm_source || "Direct"}`,
        `UTM Medium: ${data.utm_medium || "none"}`,
        `UTM Campaign: ${data.utm_campaign || "none"}`,
      ].filter(Boolean).join("\n");

      const opportunityName = `${data.parentName || "Parent"} - ${studentName || "Student"}${data.requirementId ? ` (${data.requirementId})` : ""}`;

      leadPayload = {
        name: opportunityName,
        contact_name: data.parentName || "",
        parent_name: data.parentName || "",
        student_name: studentName,
        student_class: studentClass,
        ward_name: studentName,
        phone: data.phone || "",
        tuition_parent_whatsapp: data.phone || "",
        email_from: data.email || false,
        locality: data.address || data.area || "",
        subjects_intrested: subjects,
        preferred_timings: data.preferredTime || data.classTimingSlot || "",
        preferred_tutor_gender: preferredTutorGenderText,
        description: descriptionText,

        // Stable identifiers
        requirement_id: data.requirementId || "",
        x_studio_requirement_id: data.requirementId || "",
        website_student_id: data.websiteStudentId || "",

        // Community classifications
        lead_category: "Parent",
        x_user_type: "parent",
        tuition_total_classes: totalClasses,
        tuition_fee_amount: tuitionFee,
      };

      if (curriculumVal) leadPayload.curriculumboard = curriculumVal;
      if (daysWeekVal) leadPayload.daysweek = daysWeekVal;
      if (hoursDaysVal) leadPayload.hoursdays = hoursDaysVal;
      if (tutorGenderVal) leadPayload.tutor_gender = tutorGenderVal;
    }

    /* ------------------------------------------------------------------------
       IDEMPOTENCY CHECK (Duplicate Prevention for Leads)
       Search before creating:
       1. odooLeadId if provided
       2. requirement_id
       3. website_student_id
       4. phone with lead_category = Parent
    ------------------------------------------------------------------------ */
    let existingLeadId = null;

    if (data.odooLeadId && !Number.isNaN(Number(data.odooLeadId))) {
      try {
        const found = await callOdoo("object", "execute_kw", [
          _DB, uid, _PASSWORD, "crm.lead", "search_read",
          [[["id", "=", Number(data.odooLeadId)]]],
          { fields: ["id"], limit: 1 }
        ]);
        if (found && found.length > 0) {
          existingLeadId = found[0].id;
          console.log(`[Odoo] Idempotency — found existing lead #${existingLeadId} via odooLeadId`);
        }
      } catch (err) {
        console.warn(`[Odoo] Search by odooLeadId failed:`, err.message);
      }
    }

    if (!existingLeadId && leadPayload.requirement_id) {
      try {
        const found = await callOdoo("object", "execute_kw", [
          _DB, uid, _PASSWORD, "crm.lead", "search_read",
          [[["requirement_id", "=", leadPayload.requirement_id]]],
          { fields: ["id"], limit: 1 }
        ]);
        if (found && found.length > 0) {
          existingLeadId = found[0].id;
          console.log(`[Odoo] Idempotency — found existing lead #${existingLeadId} via requirement_id`);
        }
      } catch (err) {
        console.warn(`[Odoo] Search by requirement_id failed:`, err.message);
      }
    }

    if (!existingLeadId && leadPayload.website_student_id) {
      try {
        const found = await callOdoo("object", "execute_kw", [
          _DB, uid, _PASSWORD, "crm.lead", "search_read",
          [[["website_student_id", "=", leadPayload.website_student_id]]],
          { fields: ["id"], limit: 1 }
        ]);
        if (found && found.length > 0) {
          existingLeadId = found[0].id;
          console.log(`[Odoo] Idempotency — found existing lead #${existingLeadId} via website_student_id`);
        }
      } catch (err) {
        console.warn(`[Odoo] Search by website_student_id failed:`, err.message);
      }
    }

    if (!existingLeadId && leadPayload.phone && data.userType !== "tutor") {
      const phoneDigits = String(leadPayload.phone).replace(/\D/g, "").slice(-10);
      if (phoneDigits.length >= 8) {
        try {
          const found = await callOdoo("object", "execute_kw", [
            _DB, uid, _PASSWORD, "crm.lead", "search_read",
            [[["phone", "like", phoneDigits], ["lead_category", "=", "Parent"]]],
            { fields: ["id"], limit: 1 }
          ]);
          if (found && found.length > 0) {
            existingLeadId = found[0].id;
            console.log(`[Odoo] Idempotency — found existing lead #${existingLeadId} via phone matching`);
          }
        } catch (err) {
          console.warn(`[Odoo] Search by phone failed:`, err.message);
        }
      }
    }

    /* ------------------------------------------------------------------------
       WRITE (Update) or CREATE
    ------------------------------------------------------------------------ */
    let leadId;

    if (existingLeadId) {
      console.log(`[Odoo] Updating existing lead #${existingLeadId} (idempotent, no duplicate)`);
      await callOdoo("object", "execute_kw", [
        _DB, uid, _PASSWORD, "crm.lead", "write",
        [[existingLeadId], leadPayload]
      ]);
      leadId = existingLeadId;
    } else {
      console.log(`[Odoo] Creating new lead in Odoo Community for ${data.userType || "parent"}...`);
      leadId = await callOdoo("object", "execute_kw", [
        _DB, uid, _PASSWORD, "crm.lead", "create",
        [leadPayload]
      ]);
      console.log(`[Odoo] Lead created with ID: #${leadId}`);
    }

    return {
      id: leadId,
      requirementId: leadPayload.requirement_id || data.requirementId || "",
      websiteStudentId: leadPayload.website_student_id || data.websiteStudentId || "",
    };
  } catch (err) {
    console.error("[Odoo] createLead error:", err.message);
    throw err;
  }
}

/* ============================================================================
   UPDATE CRM LEAD
============================================================================ */

export async function updateLead(leadId, values) {
  try {
    if (!leadId) throw new Error("Lead ID is required to update lead");

    const uid = await callOdoo("common", "authenticate", [
      _DB,
      _USERNAME,
      _PASSWORD,
      {},
    ]);
    if (!uid) throw new Error("Odoo login failed");

    // Sanitize values to only include valid Odoo Community fields
    const sanitized = {};
    const stageMap = {
      "New Lead": 1,
      "Lead posted": 1,
      "Demo Scheduled": 3,
      "Feedback Pending": 8,
      "Feedback": 8,
      "Fees Finalized": 7,
      "Fee Confirmation": 7,
      "Enrolled": 4,
      "Won": 4,
      "Lost": 9,
      "Rejected": 9,
      "Demo Cancelled": 9,
    };

    for (const [key, val] of Object.entries(values || {})) {
      if (key === "x_studio_lead_status" || key === "status") {
        if (stageMap[val]) {
          sanitized.stage_id = stageMap[val];
        }
      } else if (key === "x_studio_response_status") {
        sanitized.response_status = val;
      } else if (key.startsWith("x_studio_") && key !== "x_studio_requirement_id" && key !== "x_studio_regular_class_scheduled") {
        // Skip obsolete studio fields that don't exist in Odoo Community
        continue;
      } else {
        sanitized[key] = val;
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return true;
    }

    await callOdoo("object", "execute_kw", [
      _DB, uid, _PASSWORD, "crm.lead", "write",
      [[parseInt(leadId)], sanitized]
    ]);

    return true;
  } catch (err) {
    console.error("[Odoo] updateLead error:", err.message);
    throw err;
  }
}

export async function upsertMasterTutor(data) {

  try {

    const uid =
      await callOdoo(
        "common",
        "authenticate",
        [
          _DB,
          _USERNAME,
          _PASSWORD,
          {},
        ]
      );


    if (!uid) {

      throw new Error(
        "Odoo login failed"
      );
    }


    let photoBase64 =
      false;


    if (
      data.photo &&
      data.photo.startsWith("http")
    ) {

      try {

        const response =
          await fetch(data.photo);


        const arrayBuffer =
          await response.arrayBuffer();


        photoBase64 =
          Buffer
            .from(arrayBuffer)
            .toString("base64");


      } catch (err) {

        console.error(
          "[Odoo] Failed to convert tutor photo:",
          err.message
        );
      }
    }


    let genderMapped = "";


    if (data.gender) {

      const g =
        data.gender
          .trim()
          .toLowerCase();


      if (g === "male") {

        genderMapped =
          "Male";

      } else if (
        g === "female"
      ) {

        genderMapped =
          "Female";

      } else if (
        g === "other" ||
        g === "both"
      ) {

        genderMapped =
          "Other";
      }
    }


    let dobFormatted =
      false;


    if (data.dob) {

      try {

        const d =
          new Date(data.dob);


        if (
          !Number.isNaN(
            d.getTime()
          )
        ) {

          dobFormatted =
            d
              .toISOString()
              .split("T")[0];
        }


      } catch (e) {

        console.error(
          "[Odoo] Failed parsing DOB:",
          data.dob
        );
      }
    }


    const payload = {

      name:
        data.name || "",

      gender:
        genderMapped || "Male",

      mobile:
        data.phone || "",

      whatsapp:
        data.whatsapp ||
        data.phone ||
        "",

      email:
        data.email || "",

      city:
        data.city || "",

      area:
        data.area || "",

      full_address:
        data.fullAddress || "",

      pincode:
        data.pincode || "",


      grades:
        Array.isArray(data.grades)
          ? data.grades.join(", ")
          : data.grades || "",


      boards:
        Array.isArray(data.boards)
          ? data.boards.join(", ")
          : data.boards || "",


      subjects:
        Array.isArray(data.subjects)
          ? data.subjects.join(", ")
          : data.subjects || "",


      preferred_timings:
        Array.isArray(data.timings)
          ? data.timings.join(", ")
          : data.timings || "",


      max_travel_distance:
        data.maxTravelDistance || "",

      experience:
        data.experience || "",

      qualification:
        data.qualification || "",

      availability:
        data.availabilityStatus ||
        "Available",


      locations_can_teach:
        Array.isArray(data.locations)
          ? data.locations.join(", ")
          : data.locations || "",

    };


    if (photoBase64) {

      payload.profile_photo =
        photoBase64;
    }


    if (dobFormatted) {

      payload.dob =
        dobFormatted;
    }


    console.log(
      "[Odoo] Searching existing tutor:",
      data.phone
    );


    const existing =
      await callOdoo(
        "object",
        "execute_kw",
        [
          _DB,
          uid,
          _PASSWORD,

          "master_tutors",

          "search_read",

          [
            [
              [
                "mobile",
                "=",
                data.phone,
              ],
            ],
          ],

          {
            fields: [
              "id",
              "tutor_id",
            ],
          },
        ]
      );


    if (
      existing &&
      existing.length > 0
    ) {

      const recordId =
        existing[0].id;


      const tutorCode =
        existing[0].tutor_id;


      console.log(
        "[Odoo] Updating tutor:",
        recordId,
        tutorCode
      );


      await callOdoo(
        "object",
        "execute_kw",
        [
          _DB,
          uid,
          _PASSWORD,

          "master_tutors",

          "write",

          [
            [recordId],
            payload,
          ],
        ]
      );


      return {

        id:
          recordId,

        tutorCode,

      };


    } else {

      console.log(
        "[Odoo] Creating new tutor"
      );


      const count =
        await callOdoo(
          "object",
          "execute_kw",
          [
            _DB,
            uid,
            _PASSWORD,

            "master_tutors",

            "search_count",

            [[]],
          ]
        );


      // Skip codes that are already in use — otherwise a deleted Odoo tutor
      // lowers the count and the next tutor reuses an existing code.
      const codeFor = (n) =>
        `TUT${String(n).padStart(4, "0")}`;

      let nextNumber =
        count + 1;

      try {

        const existingCodes =
          await callOdoo(
            "object",
            "execute_kw",
            [
              _DB,
              uid,
              _PASSWORD,

              "master_tutors",

              "search_read",

              [[["tutor_id", "=like", "TUT%"]]],

              {
                fields: ["tutor_id"],
              },
            ]
          );

        const usedCodes =
          new Set(
            (existingCodes || []).map(
              (record) => record.tutor_id
            )
          );

        while (usedCodes.has(codeFor(nextNumber))) {
          nextNumber += 1;
        }

      } catch (codeErr) {

        console.warn(
          "[Odoo] Could not read existing tutor codes, using count:",
          codeErr.message
        );
      }


      const tutorCode =
        codeFor(nextNumber);


      payload.tutor_id =
        tutorCode;


      const recordId =
        await callOdoo(
          "object",
          "execute_kw",
          [
            _DB,
            uid,
            _PASSWORD,

            "master_tutors",

            "create",

            [payload],
          ]
        );


      console.log(
        "[Odoo] Tutor created:",
        tutorCode
      );


      return {

        id:
          recordId,

        tutorCode,

      };
    }


  } catch (err) {

    console.error(
      "[Odoo] upsertMasterTutor error:",
      err
    );

    throw err;
  }
}


/* ============================================================================
   TUTOR PERFORMANCE STATS
============================================================================ */

export async function syncTutorStats(
  odooRecordId,
  stats
) {

  try {

    const uid =
      await callOdoo(
        "common",
        "authenticate",
        [
          _DB,
          _USERNAME,
          _PASSWORD,
          {},
        ]
      );


    if (!uid) {

      throw new Error(
        "Odoo login failed"
      );
    }


    const payload = {};


    if (
      stats.assignmentsCompleted != null
    ) {

      payload.x_assignments_completed =
        stats.assignmentsCompleted;
    }


    if (
      stats.assignmentsActive != null
    ) {

      payload.x_assignments_active =
        stats.assignmentsActive;
    }


    if (
      stats.demoTaken != null
    ) {

      payload.x_demo_taken =
        stats.demoTaken;
    }


    if (
      stats.demoCancelled != null
    ) {

      payload.x_demo_cancelled =
        stats.demoCancelled;
    }


    if (
      stats.successfulEnrollments != null
    ) {

      payload.x_successful_enrollments =
        stats.successfulEnrollments;
    }


    if (
      stats.successRate != null
    ) {

      payload.x_success_rate =
        stats.successRate;
    }


    if (
      stats.averageRating != null
    ) {

      payload.x_average_rating =
        stats.averageRating;
    }


    await callOdoo(
      "object",
      "execute_kw",
      [
        _DB,
        uid,
        _PASSWORD,

        "master_tutors",

        "write",

        [
          [
            parseInt(
              odooRecordId
            ),
          ],

          payload,
        ],
      ]
    );


    console.log(
      "[Odoo] Tutor stats synced:",
      odooRecordId
    );


    return true;


  } catch (err) {

    console.error(
      "[Odoo] syncTutorStats:",
      err.message
    );

    return false;
  }
}


/* ============================================================================
   TUTOR ASSIGNMENT → CRM LEAD
============================================================================ */

export async function updateLeadAssignment(
  leadId,
  assignmentDetails
) {

  try {

    const uid =
      await callOdoo(
        "common",
        "authenticate",
        [
          _DB,
          _USERNAME,
          _PASSWORD,
          {},
        ]
      );


    if (!uid) {

      throw new Error(
        "Odoo login failed"
      );
    }


    const payload = {};


    if (
      assignmentDetails.tutorName
    ) {

      payload.x_studio_assigned_tutor =
        assignmentDetails.tutorName;
    }


    if (
      assignmentDetails.tutorCode
    ) {

      payload.x_studio_tutor_code =
        assignmentDetails.tutorCode;
    }


    if (
      assignmentDetails.tutorPhone
    ) {

      payload.x_studio_assigned_tutor_phone =
        assignmentDetails.tutorPhone;
    }


    if (
      assignmentDetails.demoDate
    ) {

      payload.x_studio_demo_date =
        assignmentDetails.demoDate;
    }


    if (
      assignmentDetails.demoTime
    ) {

      payload.x_studio_demo_time =
        assignmentDetails.demoTime;
    }


    payload.x_studio_lead_status =
      "Demo Scheduled";


    await callOdoo(
      "object",
      "execute_kw",
      [
        _DB,
        uid,
        _PASSWORD,

        "crm.lead",

        "write",

        [
          [
            parseInt(
              leadId
            ),
          ],

          payload,
        ],
      ]
    );


    console.log(
      "[Odoo] Lead assignment synced:",
      leadId
    );


    return true;


  } catch (err) {

    console.error(
      "[Odoo] updateLeadAssignment:",
      err.message
    );

    return false;
  }
}


/* ============================================================================
   ODOO CHATTER
============================================================================ */

export async function addOdooChatterMessage(
  leadId,
  message,
  messageType = "comment"
) {

  try {

    const uid =
      await callOdoo(
        "common",
        "authenticate",
        [
          _DB,
          _USERNAME,
          _PASSWORD,
          {},
        ]
      );


    if (!uid) {

      throw new Error(
        "Odoo login failed"
      );
    }


    await callOdoo(
      "object",
      "execute_kw",
      [
        _DB,
        uid,
        _PASSWORD,

        "crm.lead",

        "message_post",

        [
          [
            parseInt(
              leadId
            ),
          ],
        ],

        {
          body:
            message,

          message_type:
            messageType,

          subtype_xmlid:
            "mail.mt_note",
        },
      ]
    );


    console.log(
      `[Odoo] Chatter posted to lead ${leadId}`
    );


    return true;


  } catch (err) {

    console.error(
      "[Odoo] Chatter error:",
      err.message
    );

    return false;
  }
}


/* ============================================================================
   LOOK UP MASTER TUTOR IDS
============================================================================ */

export async function lookupOdooMasterTutorIds(
  tutors
) {

  const odooIds = [];

  const odooModel =
    "master_tutors";


  if (
    !Array.isArray(tutors) ||
    tutors.length === 0
  ) {

    return {
      odooIds,
      odooModel,
    };
  }


  try {

    const uid =
      await callOdoo(
        "common",
        "authenticate",
        [
          _DB,
          _USERNAME,
          _PASSWORD,
          {},
        ]
      );


    if (!uid) {

      console.warn(
        "[OdooService] Tutor lookup authentication failed"
      );

      return {
        odooIds,
        odooModel,
      };
    }


    const normPhone = (
      raw
    ) => {

      const digits =
        String(raw || "")
          .replace(/\D/g, "");


      return digits.length >= 10
        ? digits.slice(-10)
        : digits;
    };


    const codes =
      [
        ...new Set(

          tutors
            .map(
              (t) =>
                (
                  t.tutorCode ||
                  ""
                ).trim()
            )
            .filter(Boolean)

        ),
      ];


    const phones =
      [
        ...new Set(

          tutors
            .flatMap(
              (t) => [
                t.phone,
                t.whatsapp,
              ]
            )
            .filter(Boolean)
            .map(normPhone)
            .filter(
              (p) =>
                p.length >= 6
            )

        ),
      ];


    if (
      codes.length > 0
    ) {

      const byCode =
        await callOdoo(
          "object",
          "execute_kw",
          [
            _DB,
            uid,
            _PASSWORD,

            "master_tutors",

            "search_read",

            [
              [
                [
                  "tutor_id",
                  "in",
                  codes,
                ],
              ],
            ],

            {
              fields: ["id"],
              limit: 200,
            },
          ]
        );


      byCode.forEach(
        (r) => {

          odooIds.push(
            r.id
          );
        }
      );
    }


    if (
      phones.length > 0
    ) {

      const leaves = [];


      phones.forEach(
        (p) => {

          leaves.push(
            [
              "mobile",
              "like",
              p,
            ]
          );

          leaves.push(
            [
              "whatsapp",
              "like",
              p,
            ]
          );
        }
      );


      const phoneDomain = [];


      for (
        let i = 0;
        i < leaves.length - 1;
        i++
      ) {

        phoneDomain.push("|");
      }


      leaves.forEach(
        (leaf) =>
          phoneDomain.push(
            leaf
          )
      );


      const byPhone =
        await callOdoo(
          "object",
          "execute_kw",
          [
            _DB,
            uid,
            _PASSWORD,

            "master_tutors",

            "search_read",

            [phoneDomain],

            {
              fields: ["id"],
              limit: 200,
            },
          ]
        );


      byPhone.forEach(
        (r) => {

          if (
            !odooIds.includes(
              r.id
            )
          ) {

            odooIds.push(
              r.id
            );
          }
        }
      );
    }


    console.log(
      `[OdooService] Tutor lookup: ` +
      `codes=${codes.length}, ` +
      `phones=${phones.length}, ` +
      `matched=${odooIds.length}`
    );


  } catch (err) {

    console.error(
      "[OdooService] Tutor lookup error:",
      err.message
    );
  }


  return {
    odooIds,
    odooModel,
  };
}


/* ============================================================================
   RECOMMENDED TUTORS → CRM
============================================================================ */

export async function updateLeadRecommendedTutors(
  odooLeadId,
  odooIds = []
) {

  if (!odooLeadId) {
    return;
  }


  try {

    const uid =
      await callOdoo(
        "common",
        "authenticate",
        [
          _DB,
          _USERNAME,
          _PASSWORD,
          {},
        ]
      );


    if (!uid) {

      console.warn(
        "[OdooService] Recommended tutor update auth failed"
      );

      return;
    }


    const cleanLeadId =
      Number(
        odooLeadId
      );


    const cleanIds =
      (odooIds || [])
        .map(Number)
        .filter(
          (id) =>
            !Number.isNaN(id)
        );


    await callOdoo(
      "object",
      "execute_kw",
      [
        _DB,
        uid,
        _PASSWORD,

        "crm.lead",

        "write",

        [
          [
            cleanLeadId,
          ],

          {
            x_recommended_tutor_ids: [
              [
                6,
                0,
                cleanIds,
              ],
            ],
          },
        ],
      ]
    );


    console.log(
      `[OdooService] ✅ Lead ${cleanLeadId} recommended tutors updated: ${cleanIds.length}`
    );


  } catch (err) {

    console.error(
      `[OdooService] Recommended tutors update failed for ${odooLeadId}:`,
      err.message
    );
  }
}


/* ============================================================================
   FIND / LINK MONGODB PARENT ENQUIRY TO ODOO CRM LEAD
============================================================================ */

export async function findOrLinkOdooLead(lead) {
  if (!lead) return null;

  if (lead.odooLeadId && !Number.isNaN(Number(lead.odooLeadId))) {
    return Number(lead.odooLeadId);
  }

  try {
    const uid = await callOdoo("common", "authenticate", [
      _DB,
      _USERNAME,
      _PASSWORD,
      {},
    ]);
    if (!uid) return null;

    // PASS 1: Native requirement_id
    if (lead.requirementId && lead.requirementId.trim()) {
      const byReq = await callOdoo("object", "execute_kw", [
        _DB, uid, _PASSWORD, "crm.lead", "search_read",
        [[["requirement_id", "=", lead.requirementId.trim()]]],
        { fields: ["id"], limit: 1 }
      ]);
      if (byReq && byReq.length > 0) {
        const foundId = byReq[0].id;
        lead.odooLeadId = foundId;
        await lead.save({ validateBeforeSave: false }).catch(() => {});
        console.log(`[OdooService] Linked Mongo lead ${lead._id} → Odoo #${foundId} via requirement_id`);
        return foundId;
      }
    }

    // PASS 2: website_student_id
    if (lead.websiteStudentId && lead.websiteStudentId.trim()) {
      const byWsId = await callOdoo("object", "execute_kw", [
        _DB, uid, _PASSWORD, "crm.lead", "search_read",
        [[["website_student_id", "=", lead.websiteStudentId.trim()]]],
        { fields: ["id"], limit: 1 }
      ]);
      if (byWsId && byWsId.length > 0) {
        const foundId = byWsId[0].id;
        lead.odooLeadId = foundId;
        await lead.save({ validateBeforeSave: false }).catch(() => {});
        console.log(`[OdooService] Linked Mongo lead ${lead._id} → Odoo #${foundId} via website_student_id`);
        return foundId;
      }
    }

    // PASS 3: Phone (last 10 digits)
    if (lead.phone) {
      const digits = String(lead.phone).replace(/\D/g, "").slice(-10);
      if (digits.length >= 8) {
        const byPhone = await callOdoo("object", "execute_kw", [
          _DB, uid, _PASSWORD, "crm.lead", "search_read",
          [[["phone", "like", digits], ["lead_category", "=", "Parent"]]],
          { fields: ["id"], limit: 1 }
        ]);
        if (byPhone && byPhone.length > 0) {
          const foundId = byPhone[0].id;
          lead.odooLeadId = foundId;
          await lead.save({ validateBeforeSave: false }).catch(() => {});
          console.log(`[OdooService] Linked Mongo lead ${lead._id} → Odoo #${foundId} via phone`);
          return foundId;
        }
      }
    }
  } catch (err) {
    console.error("[OdooService] findOrLinkOdooLead error:", err.message);
  }

  return null;
}

export async function syncAttendanceLogToOdoo({
  log,
  lead,
  tutor,
  postChatter = false,
}) {
  try {
    if (!log) throw new Error("Attendance log is required");

    // Fetch lead if missing
    let parentLead = lead;
    if (!parentLead && log.parentEnquiryId) {
      const ParentEnquiry = (await import("../models/ParentEnquiry.js")).default;
      parentLead = await ParentEnquiry.findById(log.parentEnquiryId);
    }

    // 1. Resolve and ensure stable websiteStudentId
    let websiteStudentId = resolveWebsiteStudentId(log, parentLead);
    if (!websiteStudentId && parentLead) {
      const reqSeq = (parentLead.requirementId || "").replace(/\D/g, "");
      websiteStudentId = reqSeq
        ? `STU-${reqSeq.padStart(5, "0")}`
        : `STU-${String(parentLead._id).slice(-5).toUpperCase()}`;
      parentLead.websiteStudentId = websiteStudentId;
      await parentLead.save({ validateBeforeSave: false }).catch(() => {});
    }
    if (!websiteStudentId) {
      throw new Error(
        "No website_student_id found or resolvable. Cannot sync attendance to Odoo without stable student identity."
      );
    }
    if (!log.websiteStudentId) {
      log.websiteStudentId = websiteStudentId;
    }

    // 2. Resolve and ensure stable externalAttendanceId
    const externalAttendanceId = resolveExternalAttendanceId(log);
    if (!log.externalAttendanceId) {
      log.externalAttendanceId = externalAttendanceId;
      await log.save({ validateBeforeSave: false }).catch(() => {});
    }

    // 3. Ensure student exists in Odoo Community CRM before sending attendance
    // (Odoo Community /tuition/api/v1/attendance requires a crm.lead with matching website_student_id)
    if (parentLead) {
      try {
        console.log(`[Odoo Attendance] Ensuring CRM lead exists in Odoo Community for student ${websiteStudentId}...`);
        const leadData = parentLead.toObject ? parentLead.toObject() : parentLead;
        const leadRes = await createLead({
          ...leadData,
          websiteStudentId,
          requirementId: parentLead.requirementId,
          userType: "parent",
        });
        if (leadRes?.id) {
          parentLead.odooLeadId = leadRes.id;
          parentLead.odooSyncStatus = "synced";
          parentLead.odooLastSyncAt = new Date();
          await parentLead.save({ validateBeforeSave: false }).catch(() => {});
        }
      } catch (leadSyncErr) {
        console.warn(`[Odoo Attendance] Pre-attendance lead sync note: ${leadSyncErr.message}`);
      }
    }

    // 4. Resolve tutor information
    let tutorExternalId = tutor?.tutorCode || tutor?.externalId || "";
    let tutorName = tutor?.name || log?.tutorName || "";
    if (!tutorExternalId && log.tutorId) {
      try {
        const Tutor = (await import("../models/Tutor.js")).default;
        const tutorDoc = await Tutor.findById(log.tutorId);
        if (tutorDoc) {
          tutorExternalId = tutorDoc.tutorCode || `TUT-${tutorDoc._id}`;
          tutorName = tutorDoc.name;
        }
      } catch (e) {}
    }

    // 5. Datetime, Status, Notes
    const classDatetime = normalizeClassDatetime(log.classDatetime || log.date);
    const status = mapAttendanceStatus(log.status);

    let notes = "";
    if (status === "completed") {
      notes = log.topicsCovered || "Class completed successfully";
    } else if (status === "absent") {
      notes = log.customReason || log.missedReason || "Student absent";
    } else if (status === "cancelled") {
      notes = log.customReason || log.missedReason || "Class cancelled";
    }

    // 6. Call Attendance API
    if (log.odooSyncStatus === "failed" || log.odooSyncStatus === "pending") {
      log.odooSyncStatus = "retrying";
      await log.save({ validateBeforeSave: false }).catch(() => {});
    }

    const result = await syncAttendanceToOdooApi({
      websiteStudentId,
      externalAttendanceId,
      tutorExternalId,
      tutorName,
      classDatetime,
      status,
      notes,
    });

    if (result.success) {
      log.externalAttendanceId = externalAttendanceId;
      log.websiteStudentId = websiteStudentId;
      log.odooAttendanceId = result.data?.attendance_id || log.odooAttendanceId || null;
      log.odooSyncStatus = "synced";
      log.odooSyncedAt = new Date();
      log.odooLastSyncAt = new Date();
      log.odooSyncError = "";
      await log.save({ validateBeforeSave: false }).catch(() => {});

      console.log(`[Odoo Attendance API] ✅ Attendance ${externalAttendanceId} synced (Attendance ID #${log.odooAttendanceId})`);
      return {
        success: true,
        externalAttendanceId,
        websiteStudentId,
        data: result.data,
      };
    } else {
      const sanitizedError = (result.error || "Unknown Attendance API error")
        .replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, "Bearer [MASKED]");
      log.externalAttendanceId = externalAttendanceId;
      log.odooSyncStatus = "failed";
      log.odooSyncError = sanitizedError;
      log.odooLastSyncAt = new Date();
      await log.save({ validateBeforeSave: false }).catch(() => {});

      return {
        success: false,
        externalAttendanceId,
        websiteStudentId,
        error: sanitizedError,
      };
    }
  } catch (err) {
    const sanitizedError = err.message.replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, "Bearer [MASKED]");
    console.error(`[Odoo Attendance Sync] ❌ Error:`, sanitizedError);

    if (log) {
      log.odooSyncStatus = "failed";
      log.odooSyncError = sanitizedError;
      log.odooLastSyncAt = new Date();
      await log.save({ validateBeforeSave: false }).catch(() => {});
    }

    return {
      success: false,
      externalAttendanceId: log?.externalAttendanceId || "",
      error: sanitizedError,
    };
  }
}

export async function syncLeadAttendanceSummaryToOdoo(lead, activeCycleData = null) {
  if (!lead) return false;
  try {
    const odooLeadId = await findOrLinkOdooLead(lead);
    if (!odooLeadId) return false;

    const uid = await callOdoo("common", "authenticate", [_DB, _USERNAME, _PASSWORD, {}]);
    if (!uid) return false;

    // In Odoo Community, tuition_completed_classes and tuition_remaining_classes
    // are readonly computed fields managed by the tuition module.
    // We only update tuition_total_classes or fee amount if needed.
    const payload = {};
    if (lead.totalClasses) {
      payload.tuition_total_classes = Number(lead.totalClasses);
    }
    if (lead.finalPrice || lead.monthlyFees) {
      payload.tuition_fee_amount = Number(lead.finalPrice || lead.monthlyFees);
    }

    if (Object.keys(payload).length > 0) {
      await callOdoo("object", "execute_kw", [
        _DB, uid, _PASSWORD, "crm.lead", "write",
        [[odooLeadId], payload]
      ]);
      console.log(`[OdooService] ✅ Tuition configuration updated on CRM lead #${odooLeadId}`);
    }
    return true;
  } catch (err) {
    console.warn("[OdooService] syncLeadAttendanceSummaryToOdoo note:", err.message);
    return false;
  }
}

export async function deleteOdooAttendanceLog(
  odooAttendanceId
) {

  console.warn(
    "[OdooService] deleteOdooAttendanceLog called, " +
    "but direct Odoo attendance deletion is disabled because attendance " +
    "is now controlled through /tuition/api/v1/attendance."
  );


  return false;
}