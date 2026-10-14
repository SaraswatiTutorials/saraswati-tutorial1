// Local safe mode — for running the backend on a developer machine against the live
// database just to look at the app. Off unless LOCAL_SAFE_MODE=true is set in the shell
// environment (not in .env, which loads too late); the deployed server never sets it.
//
// When on:
//   • every database write is refused (Mongoose middleware), so nothing is changed
//   • API requests other than reads and logins are rejected before reaching any route
//   • server.js skips the startup log recovery and all background jobs
//     (WhatsApp reminders, broadcast retries, Odoo sync)

import mongoose from "mongoose";

export const LOCAL_SAFE_MODE = process.env.LOCAL_SAFE_MODE === "true";

const WRITE_BLOCKED = "Local safe mode: database changes are disabled on this local test server.";

if (LOCAL_SAFE_MODE) {
  const block = function (next) {
    next(new Error(WRITE_BLOCKED));
  };
  // Registered before any model is compiled (this module is imported ahead of the routes)
  mongoose.plugin((schema) => {
    schema.pre(["save", "updateOne", "deleteOne"], { document: true, query: true }, block);
    schema.pre(["updateMany", "deleteMany", "replaceOne", "findOneAndUpdate", "findOneAndDelete", "findOneAndReplace"], block);
    schema.pre("insertMany", block);
    schema.pre("bulkWrite", block);
  });
  console.warn("⚠ LOCAL SAFE MODE: read-only — database writes, change requests and background jobs are disabled.");
}

// Reads and logins only. Logins just check credentials and issue a token.
const ALLOWED_POSTS = new Set(["/api/auth/login", "/api/attendance/tutor-login", "/api/attendance/parent-login"]);

export function safeModeRequestGuard(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  // baseUrl + path = full path even when mounted under "/api"
  if (req.method === "POST" && ALLOWED_POSTS.has(`${req.baseUrl || ""}${req.path}`)) return next();
  return res.status(403).json({ success: false, message: WRITE_BLOCKED });
}
