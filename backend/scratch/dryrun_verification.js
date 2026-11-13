// READ-ONLY dry run of Panel 2's "Verification & agreement" step on the most
// recent enquiry with invited tutors. Sends nothing, writes nothing.
//   cd backend && node scratch/dryrun_verification.js [REQUIREMENT_ID]
import dotenv from "dotenv"; dotenv.config();
import mongoose from "mongoose";
const uri = String(process.env.MONGO_URI || "").trim().replace(/^['"]|['"]$/g, "");
await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
try {
  const { sendVerificationLinks } = await import("../utils/verificationLinks.js");
  const db = mongoose.connection.db;
  let reqId = process.argv[2];
  if (!reqId) {
    const last = await db.collection("broadcastlogs").find({ broadcastType: "requirement", requirementId: { $ne: null } }).sort({ createdAt: -1 }).limit(1).next();
    reqId = last?.requirementId;
  }
  const lead = await db.collection("parentenquiries").findOne({ requirementId: reqId }, { projection: { requirementId: 1 } });
  console.log("Requirement:", reqId);
  for (const group of ["top3", "invited"]) {
    const r = await sendVerificationLinks(lead, { group, dryRun: true });
    console.log(`\n== ${group}: ${r.ok ? `${r.willSend} message(s) would go (${r.profileCount} login, ${r.agreementCount} agreement)` : r.reason}`);
    if (r.templates) console.log("   templates:", JSON.stringify(r.templates));
    for (const t of r.tutors || []) console.log(`   ${t.name} ${t.tutorCode} [${t.source}] verified=${t.fullyVerified} agreement=${t.agreementStatus} → ${t.gets}${!t.profile.willSend && t.profile.needed ? ` (login: ${t.profile.reason})` : ""}${!t.agreement.willSend && t.agreement.needed ? ` (agreement: ${t.agreement.reason})` : ""}`);
  }
} finally { await mongoose.disconnect(); }
