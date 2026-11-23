// READ-ONLY preview of the Odoo inbound sync: what it would save for the
// messages Odoo has that MongoDB does not, and which invitations the tutor
// replies would mark. Nothing is written.
//   cd backend && node scratch/dryrun_inbound_sync.js
import dotenv from "dotenv"; dotenv.config({ quiet: true });
import mongoose from "mongoose";
import { syncInboundMessages, defaultDeps } from "../utils/odooInboundSync.js";
import { classifyReply } from "../utils/tutorReplyScheduler.js";
await mongoose.connect(String(process.env.MONGO_URI || "").trim().replace(/^['"]|['"]$/g, ""), { autoIndex: false, autoCreate: false });
try {
  const deps = await defaultDeps();
  const cursor = await deps.getCursor();
  console.log("saved cursor:", cursor, "| first-run start:", cursor == null ? await deps.startCursor() : "(n/a)");
  const r = await syncInboundMessages(deps, { dryRun: true, limit: 200 });
  console.log(`would read ${r.read} Odoo message(s) after #${r.from}; save ${r.saved}, skip ${r.skipped}; parent choices ${r.choices}, re-confirmations ${r.reconfirms}\n`);
  for (const i of r.items) {
    const tutorTap = i.what.startsWith("invite reply") ? `  -> sweep: ${classifyReply(i.text)}` : "";
    console.log(` #${i.odooMessageId} [${i.route}] "${i.text}" — ${i.what}${tutorTap}`);
  }
} finally { await mongoose.disconnect(); }
