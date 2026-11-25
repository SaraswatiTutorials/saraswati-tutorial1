/**
 * Incoming WhatsApp messages, read straight from Odoo.
 *
 * Replies used to reach MongoDB through n8n: an Odoo automation rule posted
 * each incoming message to an n8n workflow, which saved it in
 * `inbound_messages`. Both n8n instances were shut down (they answer "No
 * instance here"), so since 3 Nov no reply reached Panel 2. This job does
 * n8n's work from the backend instead.
 *
 * Every minute it reads the incoming WhatsApp messages Odoo received since the
 * last one it saw, and saves each in `inbound_messages` in the shape n8n used,
 * so everything that reads that collection works as before. Odoo links a
 * button tap to the exact message it answers (`parent_id`), which says what
 * the reply is about:
 *
 *   • an invitation to a tutor ("I'm available", "Interested", …): saved with
 *     route "tutor" and the invitation's Odoo message id. The tutor reply
 *     sweep (tutorReplyScheduler.js) then marks that invitation.
 *   • the parent's options ("Tutor 1/2/3"): the choice is saved in
 *     `tutor_assignments`, which Panel 2 shows at step 5. Nothing is sent and
 *     nobody is assigned: confirming the tutor stays a button in Panel 2.
 *   • the re-confirmation ("Yes,Correct" / "Change some details"): saved on
 *     the `parent_reconfirmations` row Panel 2 shows at step 1. After
 *     "Change some details", what the parent writes next (within 14 days) is
 *     added to that row's `changeRequests`, so Panel 2 shows what they want
 *     changed.
 *   • anything else: saved with route "tutor", "parent" or "human_support"
 *     depending on who the number belongs to, for a person to read.
 *
 * Nothing here sends a WhatsApp message. Templates and sending are untouched.
 * Each Odoo message is saved once (by its Odoo id and its WhatsApp id), so a
 * re-run, a restart or a revived n8n cannot count a reply twice.
 */
import { odooDate } from "./agreementSync.js";

const SYNC_SECONDS = Number(process.env.ODOO_INBOUND_SYNC_SECONDS || 60);
const CURSOR_KEY = "odoo_inbound_sync";
const BATCH = 200;
/** A choice or re-confirmation typed without tapping the button is matched to
 * the parent's newest such message within this many days. */
const PARENT_MATCH_DAYS = 14;

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

/** Odoo stores the message as HTML ("<p>I’m available</p>"); the words only. */
export function plainText(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      const k = e.toLowerCase();
      if (ENTITIES[k]) return ENTITIES[k];
      if (k.startsWith("#x")) return String.fromCodePoint(parseInt(k.slice(2), 16));
      if (k.startsWith("#")) return String.fromCodePoint(Number(k.slice(1)));
      return m;
    })
    .trim();
}

export const last10 = (v) => String(v || "").replace(/\D/g, "").slice(-10);

/** "Tutor 2", "tutor2", "Option 2", "2" → 2. Anything else → null. */
export function parentChoice(text) {
  const m = String(text || "").trim().match(/^(?:tutor|option)?\s*#?\s*([123])\s*[.!]?$/i);
  return m ? Number(m[1]) : null;
}

/** The re-confirmation template's two buttons, however they arrive. */
export function reconfirmAnswer(text) {
  const t = String(text || "").toLowerCase().replace(/[^a-z]/g, "");
  if (t === "yescorrect") return "Yes,Correct";
  if (t === "changesomedetails") return "Change some details";
  return null;
}

/**
 * Works out what one Odoo message is, and what should be written for it.
 * Pure apart from the lookups in `deps`, so it can be previewed (dryRun).
 */
export async function planMessage(m, deps, now = new Date()) {
  const text = plainText(m.body);
  const phone = String(m.mobile_number || "").trim();
  const num = last10(phone);
  const replyTo = Array.isArray(m.parent_id) ? m.parent_id[0] : (m.parent_id || null);

  const row = {
    msgId: m.msg_uid || "",
    phone,
    last10: num,
    type: text ? "text" : "other",
    text,
    receivedAt: odooDate(m.create_date) || now,
    odooMessageId: m.id,
    source: "odoo_sync",
    status: "processed",
    createdAt: now,
    processedAt: now,
    parentEnquiryId: "",
    requirementId: "",
    route: "human_support",
    senderType: "unknown",
    tutorId: "",
    replyToOdooMessageId: replyTo || null,
  };
  const plan = { row, choice: null, reconfirm: null, changeRequest: null, what: "" };
  const asChangeRequest = (reconf) => {
    plan.changeRequest = { id: reconf._id, text, at: row.receivedAt, inboundOdooMessageId: m.id };
    Object.assign(row, { replyAppliedAt: now, replyIntent: "change_details_text", replyOutcome: "change_request_recorded" });
    plan.what = `details the parent wants changed on ${reconf.requirementId}`;
  };

  // 1. A reply to an invitation: the tutor reply sweep marks it.
  const invite = replyTo ? await deps.findInvite(replyTo) : null;
  if (invite) {
    Object.assign(row, {
      route: "tutor", senderType: "tutor",
      requirementId: invite.requirementId || "",
      tutorId: invite.tutorId ? String(invite.tutorId) : "",
    });
    plan.what = `invite reply for ${invite.requirementId} (${invite.tutorName || "tutor"})`;
    return plan;
  }

  // 2. The parent picking from their options.
  const n = parentChoice(text);
  const top3 = await deps.findTop3({ replyTo, last10: num, choiceTyped: n != null, days: PARENT_MATCH_DAYS });
  if (top3) {
    Object.assign(row, {
      route: "parent", senderType: "parent",
      requirementId: top3.requirementId || "", parentEnquiryId: top3.leadId ? String(top3.leadId) : "",
    });
    const tutors = top3.tutors || [];
    const picked = n == null ? null : (tutors.find((t) => Number(t.choice) === n) || tutors[n - 1] || null);
    if (picked) {
      plan.choice = {
        requirementId: top3.requirementId || "",
        leadId: top3.leadId || null,
        enquiryId: top3.leadId || null,
        offerId: top3._id || null,
        offeredAt: top3.preparedAt || null,
        offeredCount: tutors.length,
        text,
        choice: n,
        outcome: "parent_chose",
        willAssign: false,
        assigned: false,
        dryRun: false,
        parentName: top3.parentName || "",
        parentPhone: top3.parentPhone || phone,
        tutorId: picked.tutorId || null,
        tutorCode: picked.tutorCode || null,
        tutorName: picked.name || null,
        tutorScore: picked.score ?? null,
        tutorDistanceKm: picked.distanceKm ?? null,
        offeredTutors: tutors.map((t) => ({ choice: t.choice, name: t.name, tutorCode: t.tutorCode })),
        inboundOdooMessageId: m.id,
        source: "odoo_sync",
        resolvedAt: row.receivedAt,
      };
      Object.assign(row, { replyAppliedAt: now, replyIntent: `tutor_${n}`, replyOutcome: "parent_chose" });
      plan.what = `parent chose option ${n} (${picked.name}) for ${top3.requirementId}`;
    } else {
      Object.assign(row, { replyAppliedAt: now, replyIntent: "unclear", replyOutcome: n == null ? "left_for_a_person" : "no_such_option" });
      plan.what = `parent message on ${top3.requirementId} options, left for a person`;
    }
    return plan;
  }

  // 3. The parent answering the re-confirmation.
  const answer = reconfirmAnswer(text);
  const reconf = await deps.findReconfirm({ replyTo, last10: num, answerTyped: answer != null, days: PARENT_MATCH_DAYS });
  if (reconf) {
    Object.assign(row, {
      route: "parent", senderType: "parent",
      requirementId: reconf.requirementId || "", parentEnquiryId: reconf.leadId ? String(reconf.leadId) : "",
    });
    if (answer) {
      plan.reconfirm = { id: reconf._id, reply: answer, repliedAt: row.receivedAt, inboundOdooMessageId: m.id };
      Object.assign(row, { replyAppliedAt: now, replyIntent: answer === "Yes,Correct" ? "confirmed" : "change_details", replyOutcome: "reconfirm_recorded" });
      plan.what = `parent re-confirmation "${answer}" for ${reconf.requirementId}`;
    } else if (text) {
      // Written in reply to the re-confirmation itself: what they want changed.
      asChangeRequest(reconf);
    } else {
      Object.assign(row, { replyAppliedAt: now, replyIntent: "unclear", replyOutcome: "left_for_a_person" });
      plan.what = `parent message on ${reconf.requirementId} re-confirmation, left for a person`;
    }
    return plan;
  }

  // 3b. Written after tapping "Change some details": what they want changed.
  if (text && num.length === 10) {
    const pending = deps.findChangePending ? await deps.findChangePending({ last10: num, days: PARENT_MATCH_DAYS }) : null;
    if (pending) {
      Object.assign(row, {
        route: "parent", senderType: "parent",
        requirementId: pending.requirementId || "", parentEnquiryId: pending.leadId ? String(pending.leadId) : "",
      });
      asChangeRequest(pending);
      return plan;
    }
  }

  // 4. Anything else: who is it from?
  const who = num.length === 10 ? await deps.whoIs(num) : null;
  if (who?.senderType === "tutor") {
    Object.assign(row, { route: "tutor", senderType: "tutor", tutorId: who.tutorId || "" });
    plan.what = "message from a tutor";
  } else if (who?.senderType === "parent") {
    Object.assign(row, {
      route: "parent", senderType: "parent",
      parentEnquiryId: who.parentEnquiryId || "", requirementId: who.requirementId || "",
      // Nothing reads loose parent messages automatically; a person does.
      replyAppliedAt: now, replyIntent: "unclear", replyOutcome: "left_for_a_person",
    });
    plan.what = "message from a parent";
  } else {
    plan.what = "unknown number, for human support";
  }
  return plan;
}

/**
 * One pass: new Odoo messages → MongoDB. Stops at the first message that
 * fails, so it is retried next time rather than skipped.
 */
export async function syncInboundMessages(deps, { dryRun = false, limit = BATCH } = {}) {
  const d = deps || (await defaultDeps());
  let cursor = await d.getCursor();
  const startedFrom = cursor;
  if (cursor == null) cursor = await d.startCursor();

  const messages = await d.fetchInbound(cursor || 0, limit);
  const out = { ok: true, dryRun, from: cursor || 0, read: messages.length, saved: 0, skipped: 0, choices: 0, reconfirms: 0, changeRequests: 0, items: [] };
  let lastDone = cursor || 0;

  for (const m of messages) {
    if (await d.alreadySaved(m.id, m.msg_uid)) {
      out.skipped += 1;
      lastDone = m.id;
      continue;
    }
    const plan = await planMessage(m, d);
    out.items.push({ odooMessageId: m.id, text: plan.row.text.slice(0, 60), route: plan.row.route, what: plan.what });
    if (!dryRun) {
      await d.saveInbound(plan.row);
      if (plan.choice) await d.saveChoice(plan.choice);
      if (plan.reconfirm) await d.saveReconfirmReply(plan.reconfirm);
      if (plan.changeRequest) await d.saveChangeRequest(plan.changeRequest);
      await d.setCursor(m.id);
    }
    out.saved += 1;
    if (plan.choice) out.choices += 1;
    if (plan.reconfirm) out.reconfirms += 1;
    if (plan.changeRequest) out.changeRequests += 1;
    lastDone = m.id;
  }
  // A first run with nothing new still records where it starts from.
  if (!dryRun && startedFrom == null && lastDone === (cursor || 0)) await d.setCursor(lastDone);
  out.to = lastDone;
  return out;
}

/** Real Odoo and MongoDB, loaded only when used. */
export async function defaultDeps() {
  const [{ default: mongoose }, { getOdooUid, callOdooMethod }] = await Promise.all([
    import("mongoose"), import("./whatsappService.js"),
  ]);
  const db = mongoose.connection.db;
  if (!db) throw new Error("database not connected");
  const coll = (n) => db.collection(n);
  const idForms = (id) => [Number(id), String(id)];
  const since = (days) => new Date(Date.now() - days * 86400000);
  const endsWith = (num) => ({ $regex: `${num}$` });

  return {
    async getCursor() {
      const s = await coll("syncstates").findOne({ key: CURSOR_KEY });
      return s && Number.isFinite(s.lastOdooMessageId) ? s.lastOdooMessageId : null;
    },
    async setCursor(id) {
      await coll("syncstates").updateOne(
        { key: CURSOR_KEY },
        { $set: { lastOdooMessageId: id, lastSyncAt: new Date(), status: "idle", lastError: "" } },
        { upsert: true },
      );
    },
    // First run: carry on from the newest message n8n saved, or from
    // ODOO_INBOUND_START_ID when set.
    async startCursor() {
      if (process.env.ODOO_INBOUND_START_ID) return Number(process.env.ODOO_INBOUND_START_ID);
      const last = await coll("inbound_messages").find({ odooMessageId: { $type: "number" } })
        .sort({ odooMessageId: -1 }).limit(1).next();
      return last?.odooMessageId || 0;
    },
    async fetchInbound(afterId, limit) {
      const uid = await getOdooUid();
      return callOdooMethod(uid, "whatsapp.message", "search_read",
        [[["message_type", "=", "inbound"], ["id", ">", afterId]]],
        { fields: ["id", "mobile_number", "body", "msg_uid", "parent_id", "create_date"], order: "id asc", limit });
    },
    async alreadySaved(odooId, msgUid) {
      const or = [{ odooMessageId: odooId }];
      if (msgUid) or.push({ msgId: msgUid });
      return !!(await coll("inbound_messages").findOne({ $or: or }, { projection: { _id: 1 } }));
    },
    findInvite: (replyTo) => coll("broadcastlogs").findOne(
      { broadcastType: "requirement", whatsappMessageId: { $in: idForms(replyTo) } },
      { projection: { requirementId: 1, tutorId: 1, tutorName: 1 } },
    ),
    async findTop3({ replyTo, last10: num, choiceTyped, days }) {
      if (replyTo) {
        const exact = await coll("tutor_top3").findOne({ sent: true, messageId: { $in: idForms(replyTo) } });
        if (exact) return exact;
      }
      if (!choiceTyped || num.length !== 10) return null;
      return coll("tutor_top3").find({ sent: true, parentPhone: endsWith(num), preparedAt: { $gte: since(days) } })
        .sort({ preparedAt: -1 }).limit(1).next();
    },
    async findReconfirm({ replyTo, last10: num, answerTyped, days }) {
      if (replyTo) {
        const exact = await coll("parent_reconfirmations").findOne({ sent: true, messageId: { $in: idForms(replyTo) } });
        if (exact) return exact;
      }
      if (!answerTyped || num.length !== 10) return null;
      return coll("parent_reconfirmations").find({ sent: true, phone: endsWith(num), sentAt: { $gte: since(days) } })
        .sort({ sentAt: -1 }).limit(1).next();
    },
    async whoIs(num) {
      const t = await coll("tutors").findOne({ $or: [{ whatsapp: endsWith(num) }, { phone: endsWith(num) }] }, { projection: { _id: 1 } })
        || await coll("partialtutors").findOne({ $or: [{ whatsapp: endsWith(num) }, { phone: endsWith(num) }] }, { projection: { _id: 1 } });
      if (t) return { senderType: "tutor", tutorId: String(t._id) };
      const p = await coll("parentenquiries").find({ phone: endsWith(num) }, { projection: { requirementId: 1 } })
        .sort({ createdAt: -1 }).limit(1).next();
      if (p) return { senderType: "parent", parentEnquiryId: String(p._id), requirementId: p.requirementId || "" };
      return null;
    },
    saveInbound: (row) => coll("inbound_messages").insertOne(row),
    saveChoice: (row) => coll("tutor_assignments").insertOne(row),
    saveReconfirmReply: ({ id, reply, repliedAt, inboundOdooMessageId }) => coll("parent_reconfirmations").updateOne(
      { _id: id }, { $set: { reply, repliedAt, replyOdooMessageId: inboundOdooMessageId } },
    ),
    // The parent's newest re-confirmation answered "Change some details" lately
    findChangePending: ({ last10: num, days }) => coll("parent_reconfirmations")
      .find({ sent: true, reply: "Change some details", phone: endsWith(num), repliedAt: { $gte: since(days) } })
      .sort({ repliedAt: -1 }).limit(1).next(),
    // Added once per Odoo message, however often the sync runs
    saveChangeRequest: ({ id, text, at, inboundOdooMessageId }) => coll("parent_reconfirmations").updateOne(
      { _id: id, "changeRequests.odooMessageId": { $ne: inboundOdooMessageId } },
      { $push: { changeRequests: { text, at, odooMessageId: inboundOdooMessageId } } },
    ),
  };
}

let running = false;

/** Every minute: Odoo → MongoDB, then the tutor reply sweep straight after. */
export function startOdooInboundSync() {
  if (String(process.env.ODOO_INBOUND_SYNC || "").toLowerCase() === "off") {
    console.log("[InboundSync] Off (ODOO_INBOUND_SYNC=off).");
    return;
  }
  console.log(`[InboundSync] Reading incoming WhatsApp messages from Odoo every ${SYNC_SECONDS}s`);
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const r = await syncInboundMessages();
      if (r.saved) {
        console.log(`[InboundSync] Saved ${r.saved} message(s) from Odoo (#${r.from}→#${r.to}); ` +
          `${r.choices} parent choice(s), ${r.reconfirms} re-confirmation(s), ${r.changeRequests} change request(s).`);
        const { sweepTutorReplies } = await import("./tutorReplyScheduler.js");
        await sweepTutorReplies();
      }
    } catch (err) {
      console.error("[InboundSync] error:", err.message);
    } finally {
      running = false;
    }
  };
  setTimeout(tick, 20 * 1000);
  setInterval(tick, SYNC_SECONDS * 1000);
}
