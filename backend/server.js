import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { LOCAL_SAFE_MODE, safeModeRequestGuard } from "./utils/localSafeMode.js";
// Records MongoDB errors for the Panel 2 health check. Must load before any model is compiled.
import "./utils/mongoErrorLog.js";
import dns from "dns";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {}

import tutorRoutes from "./routes/tutorRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import enquiryRoutes from "./routes/enquiryRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import parentEnquiryRoutes from "./routes/parentEnquiryRoutes.js";
import blogRoutes from "./routes/blogRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import blogAuthRoutes from "./routes/blogAuthRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import broadcastDashboardRoutes from "./routes/broadcastDashboardRoutes.js";
import broadcastOdooRoutes from "./routes/broadcastOdooRoutes.js";
import tncRoutes from "./routes/tncRoutes.js";
import pricingRoutes, { pricingErrorHandler } from "./routes/pricingRoutes.js";
import geoRoutes from "./routes/geoRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";
import tutorFeedbackRoutes from "./routes/tutorFeedbackRoutes.js";
import portalRoutes from "./routes/portalRoutes.js";
import pipelineBoardRoutes from "./routes/pipelineBoardRoutes.js";
import panelActionRoutes from "./routes/panelActionRoutes.js";
import partialTutorRoutes from "./routes/partialTutorRoutes.js";
import agreementRoutes from "./routes/agreementRoutes.js";

import { startReminderScheduler, startRetryScheduler, startSyncScheduler } from "./utils/reminderScheduler.js";
import { startTopThreeScheduler } from "./utils/topThreeScheduler.js";
import { startTutorReplyScheduler } from "./utils/tutorReplyScheduler.js";
import { sendTutorOptions } from "./utils/tutorOptionsMessage.js";
import { backfillPartialTutorCodes } from "./utils/tutorCodes.js";
import { startTutorOdooRetryScheduler } from "./utils/tutorOdooRetry.js";
import { startAgreementSyncScheduler } from "./utils/agreementSync.js";
import { listOdooTutorCodes } from "./utils/odooService.js";
import BroadcastLog from "./models/BroadcastLog.js";
import compression from "compression";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://saraswatitutorial.com",
      "https://mumbai.saraswatitutorial.com",
      "https://tnc.saraswatitutorials.com",
      "https://tnc.saraswatitutorial.com",
      "https://odoo.saraswatitutorial.com",
    ],
    credentials: true,
    // Let the browser cache the preflight instead of sending an OPTIONS before every API call
    maxAge: 86400,
  })
);
app.use(express.json());
app.use(compression());

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
    uptime: process.uptime(),
    timestamp: new Date(),
  });
});

// ── Short URL redirect ────────────────────────────────────────────────────────
app.get("/s/:shortId", (req, res) => {
  const { shortId } = req.params;

  // Hardcoded mapping (test)
  const links = {
    abc123: "https://odoo.saraswatitutorial.com/sign/document/mail/2/0d0ea973-17e1-4b9d-ba88-d45a7ad21f3",
  };

  const fullUrl = links[shortId];
  if (!fullUrl) return res.status(404).send("Link not found");
  return res.redirect(fullUrl);
});

app.get("/", (req, res) => {
  res.json({ message: "Saraswati Tutorial backend is running" });
});

// Local safe mode: only reads and logins reach the routes
if (LOCAL_SAFE_MODE) app.use("/api", safeModeRequestGuard);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/tutors",           tutorRoutes);
app.use("/api/bookings",         bookingRoutes);
app.use("/api/enquiries",        enquiryRoutes);
app.use("/api/auth",             authRoutes);
app.use("/api/parent-enquiries", parentEnquiryRoutes);
app.use("/api/blogs",            blogRoutes);
app.use("/api/upload",           uploadRoutes);
app.use("/api/blog-auth",        blogAuthRoutes);
app.use("/api/analytics",        analyticsRoutes);
app.use("/api/attendance",       attendanceRoutes);
app.use("/api/tnc",              tncRoutes);
app.use("/api/pricing",          pricingRoutes);
app.use("/api/geo",              geoRoutes);
app.use("/api/feedback",         feedbackRoutes);
app.use("/api/tutor-feedback",   tutorFeedbackRoutes);
app.use("/api/portal",           portalRoutes);
app.use("/api/partial-tutors",   partialTutorRoutes);
app.use("/api/agreements",       agreementRoutes);

// Panel 2: the tutor pipeline, with its own login. Mounted outside /api on
// purpose, so it shares no middleware with the existing routes.
// Its buttons live in panelActionRoutes, mounted first so the view stays a
// view: everything that writes or sends is in that one file. That file makes
// its own local-safe-mode check, because the guard above only covers /api.
app.use("/panel2",               panelActionRoutes);
app.use("/panel2",               pipelineBoardRoutes);
app.use("/api/pricing",          pricingErrorHandler); // generic errors, no stack traces

// ── Broadcast Dashboard APIs ──────────────────────────────────────────────────
app.use("/api", broadcastDashboardRoutes);

// ── Odoo Integration APIs ─────────────────────────────────────────────────────
app.use("/api", broadcastOdooRoutes);

// ── Webhook endpoint (reuses parentEnquiry routes — mounted at /api) ──────────
app.use("/api", parentEnquiryRoutes);

// ── Error recovery: reset stale "Sending" logs from a potential server crash ──
async function recoverStaleSendingLogs() {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const result = await BroadcastLog.updateMany(
      {
        status: "Sending",
        updatedAt: { $lt: tenMinutesAgo },
      },
      {
        $set: {
          status: "Failed",
          failureReason: "Server restart recovery",
        },
      }
    );
    if (result.modifiedCount > 0) {
      console.log(
        `[Startup Recovery] Reset ${result.modifiedCount} stale "Sending" broadcast logs to "Failed". ` +
        `Retry scheduler will pick them up within 5 minutes.`
      );
    }
  } catch (err) {
    console.error("[Startup Recovery] Failed to reset stale logs:", err.message);
  }
}

// ── MongoDB Connection + Server Start ─────────────────────────────────────────
if (
  process.env.MONGO_URI &&
  process.env.MONGO_URI !== "your_mongodb_connection_string"
) {
  mongoose
    .connect(process.env.MONGO_URI, {
      bufferCommands: false,
      // Lets utils/mongoErrorLog.js see commands the database refuses, for the Panel 2 health check.
      monitorCommands: true,
    })
    .then(async () => {
      console.log("MongoDB connected");

      // Error recovery: reset stale Sending logs before starting schedulers
      // (skipped in local safe mode: it changes records the live server is using)
      if (!LOCAL_SAFE_MODE) await recoverStaleSendingLogs();

      app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);

        if (LOCAL_SAFE_MODE) {
          console.log("Local safe mode: background jobs (reminders, broadcast retries, Odoo sync) not started.");
          return;
        }

        // ── Start background schedulers ────────────────────────────────────
        startReminderScheduler();  // Attendance reminders (every 60 sec)
        startRetryScheduler();     // Retry failed broadcasts (every 5 min)
        startSyncScheduler();      // Odoo → MongoDB tutor sync (every 15 min)
        // Once tutors have had their window to answer, send the parent the
        // best of whoever said yes — up to three, fewer if fewer replied.
        // Record what tutors answered, from the rows the n8n router writes.
        startTutorReplyScheduler();
        // Every partial tutor without a tutor ID gets one, oldest first. New
        // sign-ups get theirs when the form is sent; this catches the rest.
        backfillPartialTutorCodes({ readOdooCodes: () => listOdooTutorCodes({ timeoutMs: 15000 }) })
          .then((r) => { if (r.assigned) console.log(`[TutorCode] Gave ${r.assigned} partial tutor(s) a tutor ID.`); })
          .catch((err) => console.error("[TutorCode] Start-up pass failed:", err.message));
        // Registered tutors whose Odoo record failed at sign-up get it (and a
        // unique tutor ID) here, every 30 min.
        startTutorOdooRetryScheduler();
        // Who has signed their agreement in Odoo Sign → Tutor.odooAgreement
        startAgreementSyncScheduler();
        // The top three go to the parent when staff press the button in
        // Panel 2, not on a timer. TOP3_AUTO_SEND=true restores the sweep.
        if (String(process.env.TOP3_AUTO_SEND || "").toLowerCase() === "true") {
          startTopThreeScheduler(sendTutorOptions);
        } else {
          console.log("[Top3] Automatic sweep off — the parent's options are sent from Panel 2.");
        }
      });
    })
    .catch((error) => {
      console.error("MongoDB connection error:", error.message);
      app.listen(PORT, () => {
        console.log(`Server running without DB on http://localhost:${PORT}`);
      });
    });
} else {
  app.listen(PORT, () => {
    console.log(`Server running without DB on http://localhost:${PORT}`);
  });
}