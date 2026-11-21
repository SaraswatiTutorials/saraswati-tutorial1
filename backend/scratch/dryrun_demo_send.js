// READ-ONLY preview of Panel 2's "Demo send" for one number. Creates and sends nothing.
//   cd backend && node scratch/dryrun_demo_send.js 9041157689 "Demo Tutor"
import dotenv from "dotenv"; dotenv.config();
import mongoose from "mongoose";
await mongoose.connect(String(process.env.MONGO_URI || "").trim().replace(/^['"]|['"]$/g, ""), { autoIndex: false, autoCreate: false });
try {
  const { demoVerification, demoOverview } = await import("../utils/demoVerification.js");
  const o = await demoOverview();
  console.log("overview:", JSON.stringify({ templates: o.templates, recent: o.recent.length }));
  const r = await demoVerification({ phone: process.argv[2], name: process.argv[3], dryRun: true });
  console.log(JSON.stringify({ ok: r.ok, reason: r.reason, phone: r.phone, name: r.name, willCreate: r.willCreate, person: r.person, loginLink: r.loginLink }, null, 1));
  if (r.messages) console.log("\n--- 1 ---\n" + r.messages.profile + "\n\n--- 2 ---\n" + r.messages.agreement);
} finally { await mongoose.disconnect(); }
