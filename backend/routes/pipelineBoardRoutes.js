/**
 * Panel 2 — the tutor pipeline, read side.
 *
 * Shows, for each parent enquiry: who was shortlisted, who was invited, who
 * answered Interested, which three went to the parent, and who the parent
 * chose. It polls, so a tutor replying an hour from now appears on its own.
 * The buttons that act on an enquiry are in panelActionRoutes.js.
 *
 * Deliberately self-contained:
 *   - mounted at /panel2, nothing under /api is touched
 *   - every query is a read; this file never writes to the database
 *   - its own login, so it does not depend on the admin JWT
 *
 * Credentials come from PANEL2_USER / PANEL2_PASSWORD when set, otherwise the
 * defaults below. Set them in the environment to change the login.
 */

import express from "express";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { WAIT_HOURS, rankInterested } from "../utils/topThreeScheduler.js";
import { getOdooUid, callOdooMethod } from "../utils/whatsappService.js";
import { panelSendingEnabled } from "../utils/pipelineStages.js";
import { LOCAL_SAFE_MODE } from "../utils/localSafeMode.js";

// What WhatsApp actually did with each message, read from Odoo. Our own logs
// only record that a message was handed to Odoo; Meta can still refuse it,
// and the board must not call that "sent". Cached briefly because the page
// polls.
const DELIVERY_TTL_MS = 60 * 1000;
const deliveryCache = new Map();
const optionsCache = new Map();

// Everything the board reads off a broadcast log. Left out: `message`, which
// holds the whole WhatsApp body and is never rendered — on a normal window it
// is more than a third of what this endpoint would otherwise pull out of Mongo.
const BROADCAST_FIELDS = {
  requirementId: 1, tutorId: 1, tutorName: 1, tutorCode: 1, tutorPhone: 1,
  status: 1, responseStatus: 1, respondedAt: 1, time: 1, createdAt: 1,
  failureReason: 1, whatsappMessageId: 1, distanceKm: 1, broadcastType: 1,
};

// Set when Odoo could not be asked, so the page can say delivery is unknown
// rather than let every row look as if it went through.
let deliveryLookupFailed = false;

async function readDeliveryStates(ids) {
  const now = Date.now();
  const stale = ids.filter((id) => {
    const hit = deliveryCache.get(id);
    return !hit || now - hit.at > DELIVERY_TTL_MS;
  });
  if (stale.length) {
    try {
      const uid = await getOdooUid();
      // search_read rather than read: read fails the whole batch if a single
      // message has since been deleted in Odoo.
      const rows = await callOdooMethod(uid, "whatsapp.message", "search_read",
        [[["id", "in", stale]]], { fields: ["state", "failure_reason"] });
      for (const r of rows) {
        deliveryCache.set(r.id, { state: r.state || "", reason: r.failure_reason || "", at: now });
      }
    } catch (err) {
      deliveryLookupFailed = true;
      console.error("Panel 2 delivery lookup failed:", err.message);
    }
  }
  return new Map(ids.map((id) => [id, deliveryCache.get(id) || null]));
}

// The top-three record may not hold the Odoo message id, so find the options
// message sent to that parent at about the time it was prepared.
async function findOptionsDelivery(phone, preparedAt, messageId) {
  if (messageId) return (await readDeliveryStates([Number(messageId)])).get(Number(messageId));
  const last10 = String(phone || "").replace(/\D/g, "").slice(-10);
  if (last10.length !== 10 || !preparedAt) return null;

  const key = `${last10}|${new Date(preparedAt).getTime()}`;
  const held = optionsCache.get(key);
  if (held && Date.now() - held.at < DELIVERY_TTL_MS) return held.value;

  try {
    const from = new Date(new Date(preparedAt).getTime() - 5 * 60000)
      .toISOString().slice(0, 19).replace("T", " ");
    const uid = await getOdooUid();
    const rows = await callOdooMethod(uid, "whatsapp.message", "search_read",
      [[["mobile_number", "like", last10], ["message_type", "!=", "inbound"], ["create_date", ">=", from]]],
      { fields: ["state", "failure_reason", "wa_template_id"], order: "id asc", limit: 10 });
    const hit = rows.find((r) => String(r.wa_template_id?.[1] || "").startsWith("Tutor Options"));
    const value = hit ? { state: hit.state || "", reason: hit.failure_reason || "" } : null;
    optionsCache.set(key, { value, at: Date.now() });
    return value;
  } catch (err) {
    deliveryLookupFailed = true;
    console.error("Panel 2 options lookup failed:", err.message);
    return null;
  }
}

const router = express.Router();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(HERE, "..", "views", "panel2.html");

const PANEL_USER = process.env.PANEL2_USER || "admin2";
const PANEL_PASSWORD = process.env.PANEL2_PASSWORD || "saraswati2026";
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

// Tokens are signed rather than stored, so a restart does not log anyone out.
const SIGNING_KEY = process.env.PANEL2_SECRET || PANEL_PASSWORD + "|panel2";

function makeToken(user) {
  const expires = Date.now() + TOKEN_TTL_MS;
  const body = `${user}.${expires}`;
  const sig = crypto.createHmac("sha256", SIGNING_KEY).update(body).digest("hex");
  return Buffer.from(`${body}.${sig}`).toString("base64");
}

function validToken(token) {
  try {
    const [user, expires, sig] = Buffer.from(String(token), "base64")
      .toString("utf8")
      .split(".");
    if (!user || !expires || !sig) return false;
    if (Number(expires) < Date.now()) return false;
    const expected = crypto
      .createHmac("sha256", SIGNING_KEY)
      .update(`${user}.${expires}`)
      .digest("hex");
    // Length check first: timingSafeEqual throws on a mismatch.
    return sig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function requireLogin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!validToken(token)) return res.status(401).json({ message: "Please sign in." });
  next();
}

// The page itself. It asks for the login before it fetches anything.
router.get("/", (req, res) => res.sendFile(PAGE));

// The login photo and logo. The frontend's copies live on another host, so the page carries its own.
router.use("/assets", express.static(path.join(HERE, "..", "views", "panel2-assets"), { maxAge: "7d" }));

router.post("/api/login", (req, res) => {
  const { user, password } = req.body || {};
  if (user !== PANEL_USER || password !== PANEL_PASSWORD) {
    return res.status(401).json({ message: "Wrong id or password." });
  }
  res.json({ token: makeToken(user), user });
});

/**
 * One enquiry's whole journey, assembled from the collections the live
 * workflows already write to. Nothing here is computed or guessed.
 */
router.get("/api/board", requireLogin, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    if (!db) return res.status(503).json({ message: "Database not connected yet." });

    const limit = Math.min(Number(req.query.limit) || 25, 100);

    // Default view: real enquiries only. The test records exist to rehearse
    // the flow and would otherwise crowd out what is actually happening.
    const scope = req.query.scope || "real";
    const match =
      scope === "test" ? { isDemoRecord: true }
      : scope === "all" ? {}
      : { isDemoRecord: { $ne: true } };

    // Default window: from 8pm today, which is where the live run began.
    // "hours=N" looks back N hours instead; "all" drops the window.
    const since = req.query.since || "today20";
    if (since !== "all") {
      let from;
      if (since.startsWith("hours:")) {
        from = new Date(Date.now() - Number(since.slice(6)) * 60 * 60 * 1000);
      } else {
        from = new Date();
        from.setHours(20, 0, 0, 0);
        if (from > new Date()) from.setDate(from.getDate() - 1); // before 8pm: use last night
      }
      match.createdAt = { $gte: from };
    }

    const leads = await db
      .collection("parentenquiries")
      .find(match, {
        projection: {
          requirementId: 1, parentName: 1, phone: 1, area: 1, city: 1,
          status: 1, createdAt: 1, assignedTutor: 1, assignedTutorId: 1, tutorUnassignedAt: 1,
          latitude: 1, longitude: 1, pincode: 1,
          wards: 1, isDemoRecord: 1, odooLeadId: 1,
        },
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    const ids = leads.map((l) => l.requirementId).filter(Boolean);

    const [logs, shortlists, top3s, assignments, reconfirmations] = await Promise.all([
      db.collection("broadcastlogs")
        .find({ requirementId: { $in: ids } }, { projection: BROADCAST_FIELDS }).toArray(),

      // Only the newest shortlist per requirement is ever read (see `last`
      // below), but the matching workflow wrote a fresh row every half hour
      // for weeks: 320,000 of them, all for these same few requirements.
      // Reading them all took half a minute and was the whole of this page's
      // load time. The newest per requirement is picked in the database
      // instead, which the requirementId + matchedAt index already serves.
      db.collection("tutor_shortlists").aggregate([
        // A run that found nobody must not hide the real list it came after.
        { $match: { requirementId: { $in: ids }, "tutors.0": { $exists: true } } },
        { $sort: { requirementId: 1, matchedAt: 1 } },
        { $group: { _id: "$requirementId", doc: { $last: "$$ROOT" } } },
      ], { allowDiskUse: true }).toArray().then((rows) => rows.map((r) => r.doc)),

      // These two stay whole: the board counts the failed top-three attempts,
      // so it needs every row, and there are only a handful of each.
      db.collection("tutor_top3").find({ requirementId: { $in: ids } }).sort({ preparedAt: 1 }).toArray(),
      db.collection("tutor_assignments").find({ requirementId: { $in: ids } }).sort({ resolvedAt: 1 }).toArray(),
      db.collection("parent_reconfirmations").find({ requirementId: { $in: ids } }).sort({ sentAt: 1 }).toArray(),
    ]);

    deliveryLookupFailed = false;
    const delivery = await readDeliveryStates([...new Set([
      ...logs.map((l) => Number(l.whatsappMessageId)),
      ...reconfirmations.map((r) => Number(r.messageId)),
    ].filter(Boolean))]);

    // Broadcast logs record who was messaged, not what they are like, so the
    // tutors' own records supply experience and occupation for the table.
    const codes = [...new Set(logs.map((l) => l.tutorCode).filter(Boolean))];
    const tutorDocs = codes.length
      ? await db.collection("tutors")
          .find({ tutorCode: { $in: codes } },
            { projection: { tutorCode: 1, experience: 1, occupation: 1, area: 1, city: 1 } })
          .toArray()
      : [];
    const tutorByCode = new Map(tutorDocs.map((t) => [t.tutorCode, t]));

    const byReq = (rows) => {
      const m = new Map();
      for (const r of rows) {
        if (!m.has(r.requirementId)) m.set(r.requirementId, []);
        m.get(r.requirementId).push(r);
      }
      return m;
    };
    const logsBy = byReq(logs);
    const shortBy = byReq(shortlists);
    const topBy = byReq(top3s);
    const assignBy = byReq(assignments);
    const reconfirmBy = byReq(reconfirmations);
    const last = (arr) => (arr && arr.length ? arr[arr.length - 1] : null);
    // A failed attempt is recorded too, so prefer the attempt that went out.
    const sentTop3 = (id) => [...(topBy.get(id) || [])].reverse().find((r) => r.sent) || last(topBy.get(id));

    const top3Delivery = new Map();
    for (const lead of leads) {
      const t3 = sentTop3(lead.requirementId);
      if (t3?.sent) {
        top3Delivery.set(lead.requirementId,
          await findOptionsDelivery(lead.phone, t3.preparedAt, t3.messageId));
      }
    }

    const board = leads.map((lead) => {
      const ward = lead.wards?.[0] || {};
      const myLogs = (logsBy.get(lead.requirementId) || [])
        .filter((l) => l.broadcastType !== "onboarding");
      const shortlist = last(shortBy.get(lead.requirementId));
      const top3 = sentTop3(lead.requirementId);
      const assignment = last(assignBy.get(lead.requirementId));
      const reconfirmRows = reconfirmBy.get(lead.requirementId) || [];
      const reconfirm = [...reconfirmRows].reverse().find((r) => r.sent) || last(reconfirmRows);

      // A tutor invited more than once has a log row per attempt. Keep only
      // the most recent, so the board counts tutors rather than attempts.
      const latestPerTutor = new Map();
      for (const l of myLogs) {
        const key = l.tutorCode || l.tutorId?.toString() || `${l.tutorName}|${l.tutorPhone}`;
        const when = new Date(l.respondedAt || l.time || l.createdAt || 0).getTime();
        const held = latestPerTutor.get(key);
        if (!held || when >= held.when) latestPerTutor.set(key, { when, log: l });
      }

      const invited = [...latestPerTutor.values()].map(({ log: l }) => {
        const t = tutorByCode.get(l.tutorCode) || {};
        return {
          name: l.tutorName || "",
          code: l.tutorCode || "",
          phone: l.tutorPhone || "",
          experience: t.experience || "",
          occupation: t.occupation || "",
          area: [t.area, t.city].filter(Boolean).join(", "),
          distanceKm: l.distanceKm ?? null,
          sendStatus: l.status || "",
          reply: l.responseStatus || "No Response",
          repliedAt: l.respondedAt || null,
          sentAt: l.time || l.createdAt || null,
          failureReason: l.failureReason || "",
          delivery: delivery.get(Number(l.whatsappMessageId))?.state || "",
          deliveryError: delivery.get(Number(l.whatsappMessageId))?.reason || "",
        };
      }).sort((a, b) => {
        // Interested first, so the useful ones are at the top.
        const rank = (r) => (r === "Interested" ? 0 : r === "Assigned" ? 1 : r === "Not Interested" ? 3 : 2);
        return rank(a.reply) - rank(b.reply) || a.name.localeCompare(b.name);
      });

      const interested = invited.filter((t) => t.reply === "Interested" || t.reply === "Assigned");

      // Timings, so the board can say what is happening rather than leave
      // the reader to infer it from counts alone.
      const inviteTimes = invited.map((t) => t.sentAt).filter(Boolean).map((d) => new Date(d));
      const firstInviteAt = inviteTimes.length ? new Date(Math.min(...inviteTimes)) : null;
      const windowClosesAt = firstInviteAt
        ? new Date(firstInviteAt.getTime() + WAIT_HOURS * 3600000) : null;
      const minutesLeft = windowClosesAt
        ? Math.round((windowClosesAt - Date.now()) / 60000) : null;

      // The shortlist and the invitations can come from different runs, so
      // say so rather than letting the two counts look contradictory.
      const shortlistAfterInvites = shortlist?.matchedAt && firstInviteAt
        && new Date(shortlist.matchedAt) > firstInviteAt;

      // Refused by WhatsApp, or failed before it ever reached Odoo.
      const notDelivered = (t) => t.delivery === "error" || t.delivery === "bounced"
        || (!t.delivery && t.sendStatus === "Failed");

      // The top three are ranked off the newest shortlist, so a tutor who said
      // yes but is not on it cannot be offered. Worked out here so the page
      // never offers a button that is bound to be refused.
      const canSendTop3 = rankInterested(shortlist?.tutors || [],
        myLogs.filter((l) => l.broadcastType === "requirement")).length > 0;

      // Nothing moves on its own: each stage names what staff can press next.
      const stage =
        lead.assignedTutor ? "chosen"
        : top3?.sent ? "top3_sent"
        : !invited.length ? (shortlist ? "shortlisted" : "new")
        : invited.every(notDelivered) ? "undelivered"
        : minutesLeft > 0 ? "waiting"
        : interested.length ? (canSendTop3 ? "due" : "manual")
        : "no_replies";

      return {
        requirementId: lead.requirementId || "",
        stage,
        canSendTop3,
        hasOdooLead: !!lead.odooLeadId,
        assignedTutor: lead.assignedTutor || "",
        reconfirm: reconfirm
          ? {
              at: reconfirm.sentAt || null,
              sent: reconfirm.sent === true,
              failureReason: reconfirm.failureReason || "",
              delivery: delivery.get(Number(reconfirm.messageId))?.state || "",
              deliveryError: delivery.get(Number(reconfirm.messageId))?.reason || "",
            }
          : null,
        // Distance needs both ends. When the enquiry carries no location at
        // all, every distance on this card is blank for that reason alone.
        parentLocation: {
          hasCoordinates: lead.latitude != null && lead.latitude !== ""
            && lead.longitude != null && lead.longitude !== "",
          hasArea: !!(lead.area || "").trim(),
          hasPincode: !!(lead.pincode || "").trim(),
        },
        firstInviteAt,
        windowClosesAt,
        minutesLeft,
        waitHours: WAIT_HOURS,
        shortlistAfterInvites: !!shortlistAfterInvites,
        parentName: lead.parentName || "",
        phone: lead.phone || "",
        area: [lead.area, lead.city].filter(Boolean).join(", "),
        grade: ward.classGrade ? `Grade ${ward.classGrade}` : "",
        subjects: Array.isArray(ward.subjectsNeeded)
          ? ward.subjectsNeeded.join(", ")
          : (ward.subjectsNeeded || ""),
        status: lead.status || "",
        createdAt: lead.createdAt || null,
        isDemo: lead.isDemoRecord === true,

        shortlisted: shortlist
          ? {
              count: shortlist.tutorCount ?? (shortlist.tutors || []).length,
              consideredCount: shortlist.candidatesConsidered ?? null,
              radiusKm: shortlist.radiusKm ?? null,
              at: shortlist.matchedAt || null,
              tutors: (shortlist.tutors || []).map((t) => ({
                rank: t.rank, name: t.name, code: t.tutorCode, score: t.score,
                distanceKm: t.distanceKm, experience: t.experience || "",
                occupation: t.occupation || "", reason: t.reason || "",
              })),
            }
          : null,

        invited,
        counts: {
          invited: invited.length,
          interested: interested.length,
          notInterested: invited.filter((t) => t.reply === "Not Interested").length,
          waiting: invited.filter((t) => t.reply === "No Response").length,
          delivered: invited.filter((t) => ["delivered", "read", "replied"].includes(t.delivery)).length,
          undelivered: invited.filter(notDelivered).length,
        },

        top3: top3
          ? {
              at: top3.preparedAt || null,
              sent: top3.sent === true,
              outcome: top3.outcome || "",
              failureReason: top3.failureReason || "",
              templateName: top3.templateName || "",
              delivery: top3Delivery.get(lead.requirementId)?.state || "",
              deliveryError: top3Delivery.get(lead.requirementId)?.reason || "",
              tutors: (top3.tutors || []).map((t) => ({
                choice: t.choice, name: t.name, code: t.tutorCode, score: t.score,
                distanceKm: t.distanceKm, experience: t.experience || "",
                occupation: t.occupation || "", area: [t.area, t.city].filter(Boolean).join(", "),
              })),
            }
          : null,

        chosen: lead.assignedTutor
          ? { name: lead.assignedTutor, code: assignment?.tutorCode || "", at: assignment?.resolvedAt || null, choice: assignment?.choice ?? null }
          : (assignment?.tutorName ? { name: assignment.tutorName, code: assignment.tutorCode || "", at: assignment.resolvedAt, choice: assignment.choice } : null),
      };
    });

    // Every enquiry is shown, including ones nobody has been invited for: with
    // the pipeline run by hand, those are the ones waiting for someone to press
    // the first button. ?onlyActive=true narrows it to enquiries already invited.
    const onlyActive = req.query.onlyActive === "true";
    const shown = onlyActive ? board.filter((b) => b.counts.invited > 0) : board;

    // The most common refusal, so the page can name a systemic problem once
    // instead of leaving it scattered across every row.
    const refusals = {};
    for (const b of shown) {
      for (const t of b.invited) if (t.deliveryError) refusals[t.deliveryError] = (refusals[t.deliveryError] || 0) + 1;
      if (b.top3?.deliveryError) refusals[b.top3.deliveryError] = (refusals[b.top3.deliveryError] || 0) + 1;
    }
    const worst = Object.entries(refusals).sort((a, b) => b[1] - a[1])[0];

    res.json({
      deliveryProblem: worst ? { reason: worst[0], count: worst[1] } : null,
      deliveryUnavailable: deliveryLookupFailed,
      generatedAt: new Date().toISOString(),
      count: shown.length,
      hidden: board.length - shown.length,
      // The newest `limit` are shown, so the page can say when there are more.
      capped: leads.length === limit,
      limit,
      sendingEnabled: panelSendingEnabled() && !LOCAL_SAFE_MODE,
      // The two automatic triggers, read from the same settings the server acts
      // on, so the page reports the mode this server is really in.
      automatic: {
        invites: String(process.env.PIPELINE_AUTO_BROADCAST || "").toLowerCase() === "true",
        topThree: String(process.env.TOP3_AUTO_SEND || "").toLowerCase() === "true",
      },
      board: shown,
    });
  } catch (error) {
    console.error("Panel 2 board error:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
