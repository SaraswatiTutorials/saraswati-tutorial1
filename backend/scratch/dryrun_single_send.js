// READ-ONLY: what "Send agreement again" / "Send login link" would do for one
// tutor, and the Signed Agreements summary. Sends nothing, writes nothing.
//   cd backend && node scratch/dryrun_single_send.js TUT0582 TUT0007
import dotenv from "dotenv"; dotenv.config();
import mongoose from "mongoose";
await mongoose.connect(String(process.env.MONGO_URI || "").trim().replace(/^['"]|['"]$/g, ""), { autoIndex: false, autoCreate: false });
try {
  const { sendVerificationLinks } = await import("../utils/verificationLinks.js");
  const { agreementSummary } = await import("../utils/agreementSync.js");
  const s = await agreementSummary();
  console.log("Summary:", JSON.stringify({ tutors: s.tutors, partials: s.partials, lastSyncAt: s.lastSyncAt }));
  for (const id of process.argv.slice(2)) {
    for (const kind of ["agreement", "profile"]) {
      const r = await sendVerificationLinks(null, { tutorId: id, kind, dryRun: true });
      const t = r.tutors?.[0];
      console.log(`${id} ${kind}: ${r.ok ? `${t.name} [${t.source}] verified=${t.fullyVerified} agreement=${t.agreementStatus} → ${r.willSend ? "would send" : (kind === "profile" ? t.profile.reason : t.agreement.reason)}` : r.reason}`);
    }
  }
} finally { await mongoose.disconnect(); }
