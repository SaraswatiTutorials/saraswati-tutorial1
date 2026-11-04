/**
 * WhatsApp Service — Saraswati Tutorials
 *
 * Sends WhatsApp messages to tutors via the existing Odoo WhatsApp Business Account.
 * Uses Odoo's JSON-RPC API to dispatch messages.
 *
 * Logic:
 *   - If the tutor has an active WhatsApp conversation within 24 hours → free-form text
 *   - If outside 24-hour window → approved template message
 *   - Retry up to MAX_RETRIES times for temporary failures
 *   - Permanent failures are NOT retried (invalid number, template missing, policy)
 *
 * Environment variables required:
 *   ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD
 *   WHATSAPP_TEMPLATE_NAME  (approved Meta template name, e.g. "tutor_broadcast_v1")
 *   WHATSAPP_TEMPLATE_LANG  (e.g. "en")
 */

import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const ODOO_URL = process.env.ODOO_URL;
const DB = process.env.ODOO_DB;
const USERNAME = process.env.ODOO_USERNAME;
const PASSWORD = process.env.ODOO_PASSWORD;
const TEMPLATE_NAME = process.env.WHATSAPP_TEMPLATE_NAME || "tutor_broadcast_v1";
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || "en";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// Errors that should NOT be retried
const PERMANENT_FAILURE_PATTERNS = [
  "invalid number",
  "invalid phone",
  "number does not exist",
  "template missing",
  "template not found",
  "template not approved",
  "policy rejection",
  "policy_enforcement",
  "meta policy",
  "body missing",
  "message body missing",
  "authentication failed",
  "access denied",
  "permission denied",
  "account disabled",
  "number blocked",
];

/**
 * Determine if an error message indicates a permanent (non-retryable) failure
 */
export function isPermanentFailure(errorMessage) {
  if (!errorMessage) return false;
  const msg = String(errorMessage).toLowerCase();
  return PERMANENT_FAILURE_PATTERNS.some(pattern => msg.includes(pattern));
}

/**
 * Classify a failure reason into a human-readable label
 */
export function classifyFailureReason(errorMessage) {
  if (!errorMessage) return "Unknown Error";
  const msg = String(errorMessage).toLowerCase();
  
  if (msg.includes("invalid number") || msg.includes("invalid phone") || msg.includes("number does not exist")) {
    return "Invalid Number";
  }
  if (msg.includes("template missing") || msg.includes("template not found") || msg.includes("template not approved") || msg.includes("template deleted or inactive")) {
    return "Template Missing";
  }
  if (msg.includes("policy") || msg.includes("enforcement")) {
    return "Meta Policy Rejection";
  }
  if (msg.includes("body missing") || msg.includes("message body")) {
    return "Message Body Missing";
  }
  if (msg.includes("authentication") || msg.includes("access denied") || msg.includes("permission denied")) {
    return "Authentication Failed";
  }
  if (msg.includes("rate limit") || msg.includes("too many")) {
    return "Rate Limited";
  }
  if (msg.includes("timeout") || msg.includes("timed out")) {
    return "Timeout";
  }
  if (msg.includes("network") || msg.includes("connection") || msg.includes("econnrefused")) {
    return "Network Error";
  }
  if (msg.includes("500") || msg.includes("server error") || msg.includes("internal error")) {
    return "Server Error";
  }
  if (msg.includes("blocked")) {
    return "Number Blocked";
  }
  return "Unknown Error";
}

function getSanitizedOdooEnv() {
  const sanitize = (val) => (val || "").trim().replace(/^['"]|['"]$/g, "");
  const baseUrl = sanitize(process.env.ODOO_URL).replace(/\/+$/, "");
  const db = sanitize(process.env.ODOO_DB);
  const username = sanitize(process.env.ODOO_USERNAME);
  const password = sanitize(process.env.ODOO_PASSWORD);
  return { baseUrl, db, username, password, jsonrpcUrl: `${baseUrl}/jsonrpc` };
}

/**
 * Execute a JSON-RPC request to Odoo with full diagnostic logging on non-JSON / HTML / redirect responses.
 */
async function executeOdooJsonRpc(service, method, args) {
  const { jsonrpcUrl } = getSanitizedOdooEnv();

  const payload = {
    jsonrpc: "2.0",
    method: "call",
    params: { service, method, args },
    id: Math.floor(Math.random() * 10000),
  };

  let res;
  try {
    res = await fetch(jsonrpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (netErr) {
    console.error(`[OdooRPC Network Error] Failed to connect to "${jsonrpcUrl}":`, netErr.message);
    throw new Error(`Odoo connection failed (${jsonrpcUrl}): ${netErr.message}`);
  }

  const responseText = await res.text();
  let data;

  try {
    data = JSON.parse(responseText);
  } catch (parseErr) {
    const statusCode = res.status;
    const finalUrl = res.url;
    const contentType = res.headers.get("content-type") || "unknown";
    const bodySnippet = responseText.substring(0, 300);

    console.error(`[OdooRPC Error] Non-JSON response received from Odoo:`);
    console.error(`  - Target JSON-RPC URL: ${jsonrpcUrl}`);
    console.error(`  - HTTP Status Code: ${statusCode}`);
    console.error(`  - Final Response URL (after redirects): ${finalUrl}`);
    console.error(`  - Content-Type: ${contentType}`);
    console.error(`  - First 300 chars of response body:\n${bodySnippet}`);

    throw new Error(
      `Odoo JSON-RPC endpoint returned invalid JSON (HTTP ${statusCode} at ${finalUrl}): ${bodySnippet.replace(/\s+/g, " ").trim()}`
    );
  }

  if (data.error) {
    const errMsg = data.error?.data?.message || data.error?.message || "Odoo Error";
    console.error(`[OdooRPC Error] Odoo error response (HTTP ${res.status}, URL ${res.url}): ${errMsg}`);
    throw new Error(errMsg);
  }

  return data.result;
}

/**
 * Authenticate with Odoo and return the UID
 */
export async function getOdooUid() {
  const { db, username, password } = getSanitizedOdooEnv();

  const uid = await executeOdooJsonRpc("common", "authenticate", [
    db,
    username,
    password,
    {},
  ]);

  if (typeof uid !== "number" || uid <= 0) {
    console.error(`[OdooRPC Auth Failed] Authentication returned non-positive UID (${uid}) for user "${username}" on DB "${db}". Check credentials.`);
    throw new Error("Odoo authentication failed — check ODOO_USERNAME / ODOO_PASSWORD credentials");
  }

  return uid;
}

/**
 * Execute an Odoo model method via JSON-RPC
 */
export async function callOdooMethod(uid, model, method, args, kwargs = {}) {
  const { db, password } = getSanitizedOdooEnv();

  return await executeOdooJsonRpc("object", "execute_kw", [
    db,
    uid,
    password,
    model,
    method,
    args,
    kwargs,
  ]);
}

/**
 * Check if a tutor's WhatsApp number has an active conversation within 24 hours.
 * Returns the discuss channel ID if found, null otherwise.
 */
// Odoo datetime fields take UTC as "YYYY-MM-DD HH:MM:SS" (no "T", no timezone)
export function toOdooDatetime(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

async function findActiveConversation(uid, phoneNumber) {
  try {
    const cleanPhone = String(phoneNumber || "").replace(/\D/g, "").slice(-10);
    if (!cleanPhone) return null;

    const cutoffDate = toOdooDatetime(new Date(Date.now() - 24 * 60 * 60 * 1000));

    // Search for WhatsApp discuss channels linked to this phone number
    const channels = await callOdooMethod(
      uid,
      "discuss.channel",
      "search_read",
      [[
        ["channel_type", "=", "whatsapp"],
        ["write_date", ">=", cutoffDate],
        "|",
        ["whatsapp_number", "like", cleanPhone],
        ["name", "like", cleanPhone],
      ]],
      { fields: ["id", "name", "whatsapp_number", "write_date"], limit: 1 }
    );

    if (!channels || channels.length === 0) return null;

    // A channel counts as active when WE last touched it, and our own
    // outbound messages update it. Meta only opens the free-text window when
    // the CUSTOMER writes to us, so ask that question directly. Without this,
    // every send after the first picks free text and Meta rejects it.
    const inbound = await callOdooMethod(
      uid,
      "whatsapp.message",
      "search_count",
      [[
        ["mobile_number", "like", cleanPhone],
        ["message_type", "=", "inbound"],
        ["create_date", ">=", cutoffDate],
      ]]
    );
    if (!inbound) {
      console.log(`[WhatsApp] No inbound message from ${cleanPhone} in 24h - using a template`);
      return null;
    }

    return channels[0].id;
  } catch (err) {
    console.warn("[WhatsApp] Could not check active conversation:", err.message);
    return null;
  }
}

/**
 * Verify template existence and approval status in Odoo.
 * Returns true if template exists and is approved, false otherwise.
 */
/**
 * A value for one {{n}} of a template. Never empty: when a value is empty,
 * Odoo silently sends the template's SAMPLE value in its place — that is how
 * a tutor was told of a demo on "Sat, 1 Nov 2026 at 5:00 PM", a date nobody
 * chose. A dash says plainly that the value is missing.
 */
export const EMPTY_TEMPLATE_VALUE = "—";
export function templateValue(val) {
  const s = val == null ? "" : String(val).trim();
  return s || EMPTY_TEMPLATE_VALUE;
}

export async function validateTemplate(uid, templateIdentifier) {
  try {
    let domain;
    if (typeof templateIdentifier === "number") {
      domain = [["id", "=", templateIdentifier]];
    } else {
      domain = [["name", "=", templateIdentifier]];
    }
    const templates = await callOdooMethod(
      uid,
      "whatsapp.template",
      "search_read",
      [domain],
      { fields: ["id", "status"], limit: 1 }
    );
    if (!templates || templates.length === 0) {
      console.warn(`[WhatsApp Validation] Template "${templateIdentifier}" does not exist in Odoo.`);
      return false;
    }
    const status = templates[0].status;
    if (status !== "approved") {
      console.warn(`[WhatsApp Validation] Template "${templateIdentifier}" status is "${status}", not approved.`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[WhatsApp Validation] Error validating template "${templateIdentifier}":`, err.message);
    return false;
  }
}

/**
 * Send a free-form WhatsApp message via an existing Odoo conversation channel.
 * Only valid within the 24-hour service window.
 */
async function sendFreeformMessage(uid, channelId, messageBody) {
  const result = await callOdooMethod(
    uid,
    "discuss.channel",
    "message_post",
    [[channelId]],
    {
      body: messageBody,
      message_type: "whatsapp_message",
    }
  );
  return result;
}

/**
 * Register a picture with Odoo so a template whose header is an image can send it.
 * Returns the ir.attachment id that the WhatsApp composer expects.
 */
async function createHeaderAttachment(uid, imageUrl) {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`header image unreachable: ${imageUrl} returned ${res.status}`);
  }
  const mimetype = (res.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
  if (!mimetype.startsWith("image/")) {
    throw new Error(`header image is not a picture: ${imageUrl} is ${mimetype}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const name = `wa-header-${Date.now()}.${mimetype.split("/")[1]}`;

  const attachmentId = await callOdooMethod(uid, "ir.attachment", "create", [
    {
      name,
      datas: buffer.toString("base64"),
      mimetype,
    },
  ]);

  console.log(`[WhatsApp] Header image stored as attachment ${attachmentId} (${name})`);
  return attachmentId;
}

/**
 * Send a WhatsApp template message via Odoo.
 * Used when outside the 24-hour service window.
 * @param {number} uid - Authenticated Odoo UID
 * @param {string} phoneNumber - Tutor WhatsApp number
 * @param {string} templateName - Odoo WhatsApp template name
 * @param {string} templateLang - Template language code
 * @param {Object} templateVars - Variables for template (button_dynamic_url_1, free_text_N)
 * @param {number|null} resId - Specific record ID to use for res_model (e.g. sign.request ID)
 * @param {string|null} headerImageUrl - Picture for templates whose header is an image
 */
async function sendTemplateMessage(uid, phoneNumber, templateName, templateLang, templateVars, resId = null, overrideTemplateId = null, headerImageUrl = null) {
  // Look up the approved WhatsApp template in Odoo (with model info)
  let templateId, templateModel;

  if (overrideTemplateId) {
    // Direct lookup by ID — the admin explicitly chose this template
    const templates = await callOdooMethod(
      uid,
      "whatsapp.template",
      "read",
      [[overrideTemplateId]],
      { fields: ["id", "name", "body", "model"] }
    );
    if (!templates || templates.length === 0) {
      throw new Error(`template missing: WhatsApp template ID "${overrideTemplateId}" not found in Odoo`);
    }
    templateId = templates[0].id;
    templateModel = templates[0].model || "res.partner";
  } else {
    const templates = await callOdooMethod(
      uid,
      "whatsapp.template",
      "search_read",
      [[["name", "=", templateName], ["status", "=", "approved"]]],
      { fields: ["id", "name", "body", "model"], limit: 1 }
    );

    if (!templates || templates.length === 0) {
      throw new Error(`template missing: WhatsApp template "${templateName}" not found or not approved in Odoo`);
    }
    templateId = templates[0].id;
    templateModel = templates[0].model || "res.partner";
  }

  // Determine the res_model and res_ids to use
  let composerResModel = templateModel;
  let composerResId = resId;

  if (!composerResId) {
    // If no specific record ID given, get any valid record ID for the model
    try {
      const recordIds = await callOdooMethod(uid, composerResModel, "search", [[]], { limit: 1 });
      composerResId = recordIds?.[0] || 1;
    } catch (err) {
      // Fallback to res.partner if model lookup fails
      composerResModel = "res.partner";
      const partnerIds = await callOdooMethod(uid, "res.partner", "search", [[]], { limit: 1 });
      composerResId = partnerIds?.[0] || 1;
    }
  }

  console.log(`[WhatsApp] Template model: "${composerResModel}", resId: ${composerResId}`);

  // Map template variables to free_text_1, free_text_2, etc.
  const composerPayload = {
    res_model: composerResModel,
    res_ids: JSON.stringify([composerResId]),
    wa_template_id: templateId,
    phone: phoneNumber,
    batch_mode: false,
  };

  if (templateVars) {
    if (templateVars.button_dynamic_url_1) {
      composerPayload.button_dynamic_url_1 = String(templateVars.button_dynamic_url_1);
    }
    if (templateVars.button_dynamic_url_2) {
      composerPayload.button_dynamic_url_2 = String(templateVars.button_dynamic_url_2);
    }

    const standardValues = Object.entries(templateVars)
      .filter(([key]) => key !== "button_dynamic_url_1" && key !== "button_dynamic_url_2")
      .map(([_, val]) => val);

    standardValues.forEach((val, idx) => {
      if (idx < 10) {
        composerPayload[`free_text_${idx + 1}`] = templateValue(val);
      }
    });
  }

  // A template declaring an image header must be given one on every send.
  // The picture is registered with Odoo first; the composer takes its id.
  if (headerImageUrl) {
    composerPayload.attachment_id = await createHeaderAttachment(uid, headerImageUrl);
  }

  console.log(`[WhatsApp] Creating composer for template "${templateName}"`);
  const composerId = await callOdooMethod(
    uid,
    "whatsapp.composer",
    "create",
    [composerPayload]
  );

  console.log(`[WhatsApp] Sending composer message ID: ${composerId}`);
  const msgIds = await callOdooMethod(
    uid,
    "whatsapp.composer",
    "action_send_whatsapp_template",
    [[composerId]]
  );

  return msgIds?.[0] || composerId;
}

/**
 * Send a direct outbound free-form WhatsApp message using Odoo outbox.
 * Fallback when approved templates are not configured in Odoo.
 */
async function sendDirectOutboundMessage(uid, phoneNumber, messageBody) {
  const payload = {
    mobile_number: phoneNumber,
    body: messageBody,
    message_type: "outbound",
    state: "outgoing",
    wa_account_id: 2, // Saraswati Tutorials Account ID
  };

  console.log(`[WhatsApp] Creating direct outbound message for ${phoneNumber}`);
  const recordId = await callOdooMethod(
    uid,
    "whatsapp.message",
    "create",
    [payload]
  );
  
  // In Odoo 18/19, we rely on Odoo's internal cron to process and send outgoing messages automatically.
  console.log(`[WhatsApp] Direct message created in Odoo outbox. Odoo cron will process and deliver it.`);
  return recordId;
}

/**
 * Main function: Send a WhatsApp message to a tutor.
 *
 * @param {Object} options
 * @param {string} options.phoneNumber - Tutor's WhatsApp number
 * @param {string} options.messageBody - The full message text to send
 * @param {Object} [options.templateVars] - Key-value pairs for template variables (if template used)
 * @param {boolean} [options.forceTemplate] - Force template even if within 24h window
 *
 * @returns {Promise<{
 *   success: boolean,
 *   messageId: string|null,
 *   usedTemplate: boolean,
 *   channelId: number|null,
 *   failureReason: string,
 *   retryCount: number,
 * }>}
 */
export async function sendWhatsAppToTutor(options) {
  const {
    phoneNumber,
    messageBody,
    templateVars = {},
    forceTemplate = false,
    templateName = TEMPLATE_NAME,
    templateLang = TEMPLATE_LANG,
    resId = null, // Optional: specific record ID for the template model (e.g. sign.request ID)
    templateId = null, // Optional: direct Odoo template ID override (admin picker)
    headerImageUrl = null, // Optional: picture for a template whose header is an image
  } = options;

  let lastError = null;
  let retryCount = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      retryCount = attempt;
      console.log(`[WhatsApp] Retry attempt ${attempt}/${MAX_RETRIES} for ${phoneNumber}`);
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
    }

    try {
      const uid = await getOdooUid();

      // Check if within 24-hour active conversation window
      let channelId = null;
      let usedTemplate = false;
      let messageId = null;

      if (!forceTemplate) {
        channelId = await findActiveConversation(uid, phoneNumber);
      }

      if (channelId && !forceTemplate) {
        // Within 24h window — send free-form message
        console.log(`[WhatsApp] Sending free-form message to channel ${channelId} for ${phoneNumber}`);
        messageId = await sendFreeformMessage(uid, channelId, messageBody);
        usedTemplate = false;
      } else {
        // Outside 24h window — use approved template
        const targetTemplate = templateId || templateName;
        const isApproved = await validateTemplate(uid, targetTemplate);
        if (!isApproved) {
          const reason = "Template Deleted or Inactive";
          console.error(`[WhatsApp] Validation failed for template "${targetTemplate}". Reason: ${reason}`);
          return {
            success: false,
            messageId: null,
            usedTemplate: false,
            channelId: null,
            failureReason: reason,
            retryCount,
          };
        }

        console.log(`[WhatsApp] Sending template "${templateName}" to ${phoneNumber}`);
        messageId = await sendTemplateMessage(uid, phoneNumber, templateName, templateLang, templateVars, resId, templateId || null, headerImageUrl);
        usedTemplate = true;
      }

      console.log(`[WhatsApp] Message sent successfully to ${phoneNumber}. Message ID: ${messageId}`);
      
      // Trigger the queue processing immediately so it delivers to WhatsApp instantly!
      await triggerWhatsAppQueue();

      return {
        success: true,
        messageId: String(messageId),
        usedTemplate,
        channelId,
        failureReason: "",
        retryCount,
      };

    } catch (err) {
      lastError = err;
      const reason = classifyFailureReason(err.message);
      console.error(`[WhatsApp] Attempt ${attempt + 1} failed for ${phoneNumber}: ${reason} — ${err.message}`);

      // Do not retry permanent failures
      if (isPermanentFailure(err.message)) {
        console.warn(`[WhatsApp] Permanent failure detected. Not retrying.`);
        break;
      }
    }
  }

  // All attempts exhausted
  const failureReason = classifyFailureReason(lastError?.message || "");
  console.error(`[WhatsApp] All attempts failed for ${phoneNumber}. Reason: ${failureReason}`);
  return {
    success: false,
    messageId: null,
    usedTemplate: false,
    channelId: null,
    failureReason,
    retryCount,
  };
}

/**
 * Build a privacy-safe broadcast message for a tutor.
 *
 * NEVER includes: Parent Name, Phone, Email, Exact Address, Map Link
 * ALWAYS includes: Grade, Board, Subjects, Mode, Timing, Area, City, Pincode, Budget, Req ID
 */
export function buildBroadcastMessage(tutorName, lead, ward, distanceTier) {
  const grade = ward?.classGrade ? `Class ${ward.classGrade}` : "N/A";
  const board = ward?.curriculum || "N/A";
  const subjects = Array.isArray(ward?.subjectsNeeded)
    ? ward.subjectsNeeded.join(", ")
    : (ward?.subjectsNeeded || "N/A");
  const timing = lead.preferredTime || "N/A";
  const sessionsPerWeek = lead.sessionsPerWeek || lead.frequency || "N/A";
  const area = lead.area || "N/A";
  const city = lead.city || lead.geoInfo?.city || "N/A";
  const pincode = lead.pincode || "";
  const locationStr = [area, city, pincode].filter(Boolean).join(", ");
  const distance = distanceTier && distanceTier !== "Unknown" ? ` (${distanceTier})` : "";
  const budget = lead.monthlyFees ? `₹${lead.monthlyFees}/month` : "Negotiable";
  const reqId = lead.requirementId || "N/A";

  return `Hello *${tutorName}* 👋

A parent in your nearby area is looking for a home tutor. Based on your profile, you are one of our *best matches* for this requirement!

📋 *Requirement Details:*
• Grade: *${grade}*
• Board: *${board}*
• Subjects: *${subjects}*
• Location: *${locationStr}${distance}*
• Preferred Timing: *${timing}*
• Sessions/Week: *${sessionsPerWeek}*
• Expected Fees: *${budget}*
• Req ID: *${reqId}*

⚠️ _Parent contact details will be shared only after you are selected and assigned._

Are you *available* for this tuition assignment?

👉 Reply *AVAILABLE* to accept
👉 Reply *NOT AVAILABLE* if you cannot take it`;
}

/**
 * Template variables for the tutor invite, template `tutor_requirement_v4`.
 * Numbered in the order they appear in the message:
 *
 *   {{1}} = Tutor name
 *   {{2}} = Monthly fee
 *   {{3}} = Grade with board, "Class 8 (CBSE)"
 *   {{4}} = Subjects
 *   {{5}} = Location (area, city, pincode)
 *   {{6}} = Preferred time
 *   {{7}} = Classes per week
 *   {{8}} = Reference (requirement) ID
 *   {{9}} = Parent name
 *
 * ("Shortlisting closes by EOD" is fixed text in the template.)
 * Odoo's sender has only ten free-text slots (free_text_1..10), so a
 * template can never take more than ten of these.
 *
 * v3 also had nine variables, but in a different order: senders get the
 * right template and builder together from chooseRequirementTemplate().
 */
export function buildRequirementTemplateVars(tutorName, lead, ward) {
  const grade = ward?.classGrade ? `Class ${ward.classGrade}` : "N/A";
  const board = ward?.curriculum || "";
  const subjects = Array.isArray(ward?.subjectsNeeded)
    ? ward.subjectsNeeded.join(", ")
    : (ward?.subjectsNeeded || "N/A");
  const timing = lead.preferredTime || "N/A";
  const sessionsPerWeek = lead.sessionsPerWeek || lead.frequency || "N/A";
  const area = lead.area || "";
  const city = lead.city || lead.geoInfo?.city || "";
  const pincode = lead.pincode || "";
  const locationStr = [area, city, pincode].filter(Boolean).join(", ") || "N/A";
  const budget = lead.monthlyFees ? `₹${lead.monthlyFees}/month` : "Negotiable";
  const reqId = lead.requirementId || "N/A";

  return {
    free_text_1: tutorName || "Tutor",
    free_text_2: budget,
    free_text_3: board ? `${grade} (${board})` : grade,
    free_text_4: subjects,
    free_text_5: locationStr,
    free_text_6: timing,
    free_text_7: String(sessionsPerWeek),
    free_text_8: reqId,
    free_text_9: lead.parentName || "N/A",
  };
}

/**
 * Template variables for the previous invite template, `tutor_requirement_v3`:
 *   {{1}} tutor name, {{2}} grade, {{3}} board, {{4}} subjects,
 *   {{5}} location, {{6}} timing, {{7}} sessions/week, {{8}} fees, {{9}} req ID
 * Kept so invites keep going out on v3 while v4 waits for Meta's approval.
 */
export function buildRequirementTemplateVarsV3(tutorName, lead, ward) {
  const grade = ward?.classGrade ? `Class ${ward.classGrade}` : "N/A";
  const board = ward?.curriculum || "N/A";
  const subjects = Array.isArray(ward?.subjectsNeeded)
    ? ward.subjectsNeeded.join(", ")
    : (ward?.subjectsNeeded || "N/A");
  const timing = lead.preferredTime || "N/A";
  const sessionsPerWeek = lead.sessionsPerWeek || lead.frequency || "N/A";
  const area = lead.area || "";
  const city = lead.city || lead.geoInfo?.city || "";
  const pincode = lead.pincode || "";
  const locationStr = [area, city, pincode].filter(Boolean).join(", ") || "N/A";
  const budget = lead.monthlyFees ? `₹${lead.monthlyFees}/month` : "Negotiable";
  const reqId = lead.requirementId || "N/A";

  return {
    free_text_1: tutorName,
    free_text_2: grade,
    free_text_3: board,
    free_text_4: subjects,
    free_text_5: locationStr,
    free_text_6: timing,
    free_text_7: String(sessionsPerWeek),
    free_text_8: budget,
    free_text_9: reqId,
  };
}

export const REQUIREMENT_TEMPLATE_LEGACY = "tutor_requirement_v3";
const TEMPLATE_CHECK_TTL_MS = 5 * 60 * 1000;
let requirementChoice = null; // { at, value }

/**
 * Which invite template to send, and the matching variable builder.
 *
 * The new template (WHATSAPP_REQUIREMENT_TEMPLATE_NAME, default
 * "tutor_requirement_v4") is used only once Odoo shows it approved. Until
 * then invites keep going out on v3 with v3's variable order, so deploying
 * this before Meta approves v4 does not stop a single invite — and the
 * switch to v4 happens by itself, within five minutes of approval.
 *
 * `isApproved` is injectable so the choice can be tested without Odoo.
 */
export async function chooseRequirementTemplate({ isApproved, now = Date.now() } = {}) {
  const preferred = process.env.WHATSAPP_REQUIREMENT_TEMPLATE_NAME || "tutor_requirement_v4";
  const legacy = { templateName: REQUIREMENT_TEMPLATE_LEGACY, buildVars: buildRequirementTemplateVarsV3 };
  if (preferred === REQUIREMENT_TEMPLATE_LEGACY) return legacy;

  if (!isApproved && requirementChoice && requirementChoice.name === preferred &&
      now - requirementChoice.at < TEMPLATE_CHECK_TTL_MS) {
    return requirementChoice.value;
  }

  let approved = false;
  try {
    approved = isApproved
      ? await isApproved(preferred)
      : await validateTemplate(await getOdooUid(), preferred);
  } catch (err) {
    console.error(`[WhatsApp] Could not check template "${preferred}":`, err.message);
  }

  const value = approved
    ? { templateName: preferred, buildVars: buildRequirementTemplateVars }
    : legacy;
  if (!isApproved) requirementChoice = { name: preferred, at: now, value };
  if (!approved) {
    console.warn(`[WhatsApp] "${preferred}" is not approved yet; sending invites with "${REQUIREMENT_TEMPLATE_LEGACY}".`);
  }
  return value;
}

/**
 * Build a fixed onboarding message for new tutors.
 * This is a one-time authorization/onboarding message matching Odoo Template ID 72.
 */
export function buildOnboardingMessage(tutorName) {
  return `Thank you for showing interest in a Saraswati Tutorials assignment.

To maintain verified and professional tutor allocation, all demo/class requests are processed through our *One-Time Tutor Authorisation System.*

✅ After authorisation, you will receive:
• Parent contact details;
• Exact Parent’s location (Society,Wing&Flat No.);
• Demo timings updates
For present & future interested opportunities from Us.

_____

Our verification team will review and proceed accordingly.`;
}

/**
 * Build a parent-details message sent to tutor after assignment.
 * Contains the full parent contact info — only sent post-assignment.
 */
export function buildAssignmentMessage(tutorName, lead, ward, demoDate, demoTime) {
  const grade = ward?.classGrade ? `Class ${ward.classGrade}` : "N/A";
  const board = ward?.curriculum || "N/A";
  const subjects = Array.isArray(ward?.subjectsNeeded)
    ? ward.subjectsNeeded.join(", ")
    : (ward?.subjectsNeeded || "N/A");
  const reqId = lead.requirementId || "N/A";
  const studentName = ward?.studentName || "N/A";
  const parentName = lead.parentName || "N/A";
  const parentPhone = lead.phone || "N/A";
  const fullAddress = lead.address || "N/A";
  const area = lead.area || "";
  const city = lead.city || lead.geoInfo?.city || "";
  const pincode = lead.pincode || "";
  const demoInfo = demoDate
    ? `\n📅 *Demo Date:* ${demoDate}${demoTime ? ` at ${demoTime}` : ""}`
    : "";

  let locationStr = [fullAddress, area, city, pincode].filter(Boolean).join(", ");

  return `🎉 *Congratulations ${tutorName}!*

You have been assigned a new student. Here are the complete parent details:

*📋 Requirement ID:* ${reqId}

*Student Details:*
• Student Name: ${studentName}
• Grade: ${grade}
• Board: ${board}
• Subjects: ${subjects}

*Parent Details:*
• Name: ${parentName}
• Phone: ${parentPhone}
• Address: ${locationStr}${demoInfo}

Please contact the parent at the earliest to schedule the demo class.

_Please maintain professionalism at all times._

— Saraswati Tutorials`;
}

/**
 * Force Odoo to run the WhatsApp queue cron job immediately.
 * This ensures messages are sent to tutors' phones instantly instead of waiting up to 1 hour.
 */
export async function triggerWhatsAppQueue() {
  try {
    const uid = await getOdooUid();
    // Cron job ID for WhatsApp queue is 19
    const cronId = 19;
    console.log(`[WhatsApp] Triggering Odoo cron ID ${cronId} to process queue immediately...`);
    const success = await callOdooMethod(uid, "ir.cron", "method_direct_trigger", [[cronId]]);
    console.log(`[WhatsApp] Odoo cron run result: ${success}`);
    return success;
  } catch (err) {
    console.warn(`[WhatsApp] Failed to trigger Odoo queue cron: ${err.message}`);
    return false;
  }
}

