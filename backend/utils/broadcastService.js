/**
 * broadcastService.js — Saraswati Tutorials
 *
 * BroadcastService — the single owner of all broadcast operations.
 *
 * Responsibilities:
 *   ✅ In-memory queue with rate limiting (20/sec, configurable)
 *   ✅ Deduplication: skip already-sent (requirementId + tutorId + broadcastType)
 *   ✅ Retry logic: re-queues transient failures, skips permanent failures
 *   ✅ Logging: creates and updates BroadcastLog entries
 *   ✅ Monitoring: exposes getStatus() for dashboard
 *
 * Architecture note:
 *   This class is designed for easy upgrade to Bull + Redis for production scale.
 *   Replace `this.queue = []` + setInterval processing with Bull queue calls.
 *   All external callers remain unchanged.
 *
 * Rate limiting:
 *   Meta API allows ~20 messages/second via Odoo.
 *   Processing 500 tutors at 20/sec ≈ 25 seconds total.
 *   BROADCAST_RATE_PER_SECOND and BROADCAST_BATCH_DELAY_MS are env-configurable.
 */

import dotenv from "dotenv";
dotenv.config();

import BroadcastLog from "../models/BroadcastLog.js";
import Tutor from "../models/Tutor.js";
import ParentEnquiry from "../models/ParentEnquiry.js";
import {
  sendWhatsAppToTutor,
  buildBroadcastMessage,
  buildOnboardingMessage,
  buildRequirementTemplateVars,
  isPermanentFailure,
  getOdooUid,
  callOdooMethod,
} from "./whatsappService.js";

const RATE_PER_SECOND  = Number(process.env.BROADCAST_RATE_PER_SECOND || 20);
const BATCH_DELAY_MS   = Number(process.env.BROADCAST_BATCH_DELAY_MS  || 1000);
const MAX_RETRY_COUNT  = Number(process.env.RETRY_COUNT               || 3);

// Transient failures that should be retried by the scheduler
const RETRYABLE_FAILURE_REASONS = [
  "Timeout",
  "Network Error",
  "Server Error",
  "Rate Limited",
  "Unknown Error",
];

// Permanent failures that must NEVER be retried
const PERMANENT_FAILURE_REASONS = [
  "Invalid Number",
  "Number Blocked",
  "Template Missing",
  "Authentication Failed",
  "Meta Policy Rejection",
  "Message Body Missing",
];

/**
 * BroadcastService — singleton that owns all tutor broadcast operations.
 */
class BroadcastService {
  constructor() {
    /** @type {Array<{lead: Object, tutor: Object, options: Object}>} */
    this.queue = [];
    this.isProcessing = false;
    this._sentInCurrentSecond = 0;
    this._secondWindowStart = Date.now();
  }

  // ── PUBLIC API ─────────────────────────────────────────────────────────────

  /**
   * Add a batch of tutors to the broadcast queue for a given lead.
   *
   * @param {Object}   lead    - ParentEnquiry document (lean or Mongoose)
   * @param {Array}    tutors  - Array of scored tutor objects from recommendationEngine
   * @param {Object}   [options]
   * @param {boolean}  [options.force=false]      - Skip deduplication check
   * @param {string}   [options.adminName=""]
   * @param {string}   [options.adminEmail=""]
   * @param {string}   [options.source="system"]  - "system"|"manual"|"odoo"
   * @returns {Promise<{queued: number, alreadyQueued: number}>}
   */
  async enqueue(lead, tutors, options = {}) {
    const { force = false, adminName = "", adminEmail = "", source = "system" } = options;
    let queued = 0;
    let alreadyQueued = 0;

    for (const tutor of tutors) {
      // Skip if already in current queue (same session)
      const alreadyInQueue = this.queue.some(
        (j) => String(j.tutor._id) === String(tutor._id) &&
                String(j.lead._id) === String(lead._id)
      );
      if (alreadyInQueue) {
        alreadyQueued++;
        continue;
      }

      this.queue.push({ lead, tutor, options: { force, adminName, adminEmail, source } });
      queued++;
    }

    console.log(`[BroadcastService] Enqueued ${queued} jobs. Queue depth: ${this.queue.length}`);

    // Start processing if not already running
    if (!this.isProcessing) {
      this._processQueue().catch((err) =>
        console.error("[BroadcastService] Queue processor error:", err.message)
      );
    }

    return { queued, alreadyQueued };
  }

  /**
   * Retry a specific failed BroadcastLog entry.
   * Called by the retry scheduler every 5 minutes.
   *
   * @param {Object} log - BroadcastLog document
   */
  async retryLog(log) {
    try {
      // Double-check it's still retryable
      if (log.status !== "Failed") return;
      if (log.retryCount >= MAX_RETRY_COUNT) return;
      if (PERMANENT_FAILURE_REASONS.includes(log.failureReason)) return;

      const tutor = await Tutor.findById(log.tutorId);
      if (!tutor) {
        console.warn(`[BroadcastService] Retry: tutor not found for log ${log._id}`);
        return;
      }

      const lead = await ParentEnquiry.findById(log.leadId);
      if (!lead) {
        console.warn(`[BroadcastService] Retry: lead not found for log ${log._id}`);
        return;
      }

      await BroadcastLog.findByIdAndUpdate(log._id, {
        status: "Sending",
        lastRetryAt: new Date(),
      });

      const whatsappNumber = tutor.whatsapp || tutor.phone || "";
      if (!whatsappNumber) {
        await BroadcastLog.findByIdAndUpdate(log._id, {
          status: "Failed",
          failureReason: "No WhatsApp number available",
          retryCount: log.retryCount + 1,
        });
        return;
      }

      const sendResult = await sendWhatsAppToTutor({
        phoneNumber: whatsappNumber,
        messageBody: log.message,
        templateName: log.templateName || undefined,
        forceTemplate: log.usedTemplate || false,
      });

      await BroadcastLog.findByIdAndUpdate(log._id, {
        status: sendResult.success ? "Sent" : "Failed",
        failureReason: sendResult.failureReason || "",
        retryCount: log.retryCount + 1 + (sendResult.retryCount || 0),
        whatsappMessageId: sendResult.messageId || log.whatsappMessageId,
        lastRetryAt: new Date(),
      });

      console.log(
        `[BroadcastService] Retry ${sendResult.success ? "✅ succeeded" : "❌ failed"} ` +
        `for ${tutor.name} — log ${log._id}`
      );

    } catch (err) {
      console.error(`[BroadcastService] Retry error for log ${log._id}:`, err.message);
      await BroadcastLog.findByIdAndUpdate(log._id, {
        status: "Failed",
        failureReason: "Server Error",
        retryCount: (log.retryCount || 0) + 1,
      }).catch(() => {});
    }
  }

  /**
   * Get current queue status for monitoring dashboard.
   * @returns {{ queued: number, isProcessing: boolean }}
   */
  getStatus() {
    return {
      queued: this.queue.length,
      isProcessing: this.isProcessing,
    };
  }

  // ── INTERNAL ───────────────────────────────────────────────────────────────

  /**
   * Process the queue with rate limiting.
   * Runs until the queue is empty, then stops.
   */
  async _processQueue() {
    this.isProcessing = true;
    console.log(`[BroadcastService] Queue processor started. Jobs: ${this.queue.length}`);

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      try {
        await this._rateLimit();
        await this._sendOne(job.lead, job.tutor, job.options);
      } catch (err) {
        console.error(
          `[BroadcastService] Job error for tutor ${job.tutor?.name}: ${err.message}`
        );
      }
    }

    this.isProcessing = false;
    console.log("[BroadcastService] Queue processor finished — queue empty.");
  }

  /**
   * Rate limiter: enforces RATE_PER_SECOND maximum.
   * After every RATE_PER_SECOND messages, sleeps for BATCH_DELAY_MS.
   */
  async _rateLimit() {
    const now = Date.now();
    // Reset counter each second
    if (now - this._secondWindowStart >= 1000) {
      this._sentInCurrentSecond = 0;
      this._secondWindowStart = now;
    }

    this._sentInCurrentSecond++;

    if (this._sentInCurrentSecond >= RATE_PER_SECOND) {
      console.log(`[BroadcastService] Rate limit reached (${RATE_PER_SECOND}/sec) — sleeping ${BATCH_DELAY_MS}ms`);
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      this._sentInCurrentSecond = 0;
      this._secondWindowStart = Date.now();
    }
  }

  /**
   * Send one broadcast message with full dedup + logging pipeline.
   *
   * Workflow detection:
   *   - Tutor NOT approved+onboarded → Onboarding (once only)
   *   - Tutor approved+onboarded     → Requirement notification
   */
  async _sendOne(lead, tutor, options = {}) {
    const { force = false, adminName = "System", adminEmail = "system@saraswatitutorial.com" } = options;
    const reqId = lead.requirementId || "REQ-XXXXX";
    const firstWard = lead.wards?.[0] || {};

    const isApproved    = tutor.status === "approved";
    const isOnboarded   = tutor.onboardingCompleted === true;
    const isRequirement = isApproved && isOnboarded;
    const broadcastType = isRequirement ? "requirement" : "onboarding";

    // ── Blocked tutors: never broadcast ─────────────────────────────────────
    if (tutor.availabilityStatus === "Blocked") {
      console.log(`[BroadcastService] Skipping blocked tutor: ${tutor.name}`);
      return;
    }

    // ── Deduplication check (skipped if force=true) ──────────────────────────
    if (!force) {
      const isDuplicate = await this._isDuplicate(reqId, tutor._id, broadcastType);
      if (isDuplicate) {
        console.log(`[BroadcastService] Duplicate — skipping ${tutor.name} for ${reqId}`);
        // Log as Suppressed for audit trail
        await new BroadcastLog({
          tutorId:       tutor._id,
          tutorName:     tutor.name,
          tutorPhone:    tutor.whatsapp || tutor.phone || "",
          tutorCode:     tutor.tutorCode || "",
          requirementId: reqId,
          leadId:        lead._id,
          type:          "whatsapp",
          message:       "",
          status:        "Suppressed",
          failureReason: "Already broadcast",
          adminName,
          adminEmail,
          broadcastType,
          matchPercentage: tutor.matchPercentage || null,
          distanceKm:    tutor.distanceKm || null,
        }).save().catch(() => {}); // non-blocking
        return;
      }
    }

    // ── Onboarding workflow (once per tutor) ─────────────────────────────────
    if (!isRequirement) {
      await this._sendOnboarding(lead, tutor, reqId, adminName, adminEmail);
      return;
    }

    // ── Requirement notification workflow ────────────────────────────────────
    await this._sendRequirement(lead, tutor, reqId, firstWard, adminName, adminEmail);
  }

  /**
   * Send onboarding (Tutor Agreement) message — once per tutor lifetime.
   */
  async _sendOnboarding(lead, tutor, reqId, adminName, adminEmail) {
    // Skip if already sent
    if (tutor.onboardingMessageSentAt) {
      console.log(`[BroadcastService] Onboarding already sent for ${tutor.name}`);
      return;
    }

    const whatsappNumber = tutor.whatsapp || tutor.phone || "";
    if (!whatsappNumber) {
      console.warn(`[BroadcastService] No WhatsApp number for tutor ${tutor.name}`);
      return;
    }

    const messageBody = buildOnboardingMessage(tutor.name);

    const log = await new BroadcastLog({
      tutorId:       tutor._id,
      tutorName:     tutor.name,
      tutorPhone:    whatsappNumber,
      tutorCode:     tutor.tutorCode || "",
      requirementId: reqId,
      leadId:        lead._id,
      type:          "whatsapp",
      message:       messageBody,
      status:        "Sending",
      adminName,
      adminEmail,
      broadcastType: "onboarding",
    }).save();

    // Fetch Odoo sign link for onboarding template
    const odooBaseUrl = (process.env.ODOO_URL || "https://odoo.saraswatitutorial.com").replace(/\/+$/, "");
    let tutorSignLink = `${odooBaseUrl}/sign`;
    let tutorSignRequestId = null;
    try {
      const uid = await getOdooUid();
      const searchDomains = [];
      if (tutor.email) searchDomains.push([[["signer_email", "=", tutor.email.trim()]]]);
      const cleanPhone = String(whatsappNumber).replace(/\D/g, "").slice(-10);
      if (cleanPhone) searchDomains.push([[["sms_number", "like", cleanPhone]]]);

      for (const domain of searchDomains) {
        const signItems = await callOdooMethod(uid, "sign.request.item", "search_read", domain, {
          fields: ["id", "sign_request_id", "document_link", "state"],
          limit: 1,
          order: "id desc",
        });
        if (signItems?.[0]?.document_link) {
          tutorSignLink = signItems[0].document_link;
          tutorSignRequestId = signItems[0].sign_request_id?.[0] || null;
          break;
        }
      }
    } catch (signErr) {
      console.warn(`[BroadcastService] Could not fetch sign link for ${tutor.name}: ${signErr.message}`);
    }

    const templateName = process.env.WHATSAPP_ONBOARDING_TEMPLATE_NAME || "Tutor Agreement";
    const sendResult = await sendWhatsAppToTutor({
      phoneNumber:  whatsappNumber,
      messageBody,
      templateName,
      templateLang: "en",
      templateVars: { button_dynamic_url_1: tutorSignLink },
      resId:        tutorSignRequestId,
    });

    await BroadcastLog.findByIdAndUpdate(log._id, {
      status:           sendResult.success ? "Sent" : "Failed",
      failureReason:    sendResult.failureReason || "",
      retryCount:       sendResult.retryCount || 0,
      whatsappMessageId: sendResult.messageId || "",
      usedTemplate:     sendResult.usedTemplate || false,
      templateName:     sendResult.usedTemplate ? templateName : "",
    });

    if (sendResult.success) {
      // Mark onboarding as sent on the live Tutor document
      await Tutor.findByIdAndUpdate(tutor._id, { onboardingMessageSentAt: new Date() });
    }

    console.log(
      `[BroadcastService] Onboarding ${sendResult.success ? "✅" : "❌"} → ${tutor.name}`
    );
  }

  /**
   * Send requirement notification to an approved + onboarded tutor.
   */
  async _sendRequirement(lead, tutor, reqId, firstWard, adminName, adminEmail) {
    const whatsappNumber = tutor.whatsapp || tutor.phone || "";
    if (!whatsappNumber) {
      console.warn(`[BroadcastService] No WhatsApp number for tutor ${tutor.name}`);
      return;
    }

    const messageBody = buildBroadcastMessage(tutor.name, lead, firstWard, tutor.distanceTier);

    const log = await new BroadcastLog({
      tutorId:        tutor._id,
      tutorName:      tutor.name,
      tutorPhone:     whatsappNumber,
      tutorCode:      tutor.tutorCode || "",
      requirementId:  reqId,
      leadId:         lead._id,
      type:           "whatsapp",
      message:        messageBody,
      status:         "Sending",
      adminName,
      adminEmail,
      broadcastType:  "requirement",
      distanceKm:     tutor.distanceKm || null,
      matchPercentage: tutor.matchPercentage || null,
    }).save();

    const templateName = process.env.WHATSAPP_REQUIREMENT_TEMPLATE_NAME || "tutor_requirement_v3";

    const sendResult = await sendWhatsAppToTutor({
      phoneNumber:  whatsappNumber,
      messageBody,
      templateName,
      templateLang: "en",
      templateVars: buildRequirementTemplateVars(tutor.name, lead, firstWard),
    });

    await BroadcastLog.findByIdAndUpdate(log._id, {
      status:            sendResult.success ? "Sent" : "Failed",
      failureReason:     sendResult.failureReason || "",
      retryCount:        sendResult.retryCount || 0,
      whatsappMessageId: sendResult.messageId || "",
      usedTemplate:      sendResult.usedTemplate || false,
      templateName:      sendResult.usedTemplate ? templateName : "",
    });

    console.log(
      `[BroadcastService] Requirement ${sendResult.success ? "✅" : "❌"} → ${tutor.name} ` +
      `(${tutor.matchPercentage || 0}% match, ${tutor.distanceKm ?? "?"}km)`
    );
  }

  /**
   * Check if this (requirementId, tutorId, broadcastType) was already broadcast successfully.
   * A "Failed" previous attempt is NOT a duplicate — it will be retried.
   */
  async _isDuplicate(requirementId, tutorId, broadcastType) {
    const existing = await BroadcastLog.findOne({
      requirementId,
      tutorId,
      broadcastType,
      status: { $in: ["Sent", "Delivered", "Read", "Replied", "Sending"] },
    });
    return !!existing;
  }
}

// Export singleton — used across routes and schedulers
export const broadcastService = new BroadcastService();

// Export class for testing
export { BroadcastService, RETRYABLE_FAILURE_REASONS, PERMANENT_FAILURE_REASONS };
