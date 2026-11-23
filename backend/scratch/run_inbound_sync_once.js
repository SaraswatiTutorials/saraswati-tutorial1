// WRITES: runs the Odoo inbound sync once for real (saves new incoming WhatsApp
// messages to inbound_messages, parent choices, re-confirmation replies), then
// the tutor reply sweep, which marks the invitations. Same code the server runs
// every minute.   cd backend && node scratch/run_inbound_sync_once.js
import dotenv from "dotenv"; dotenv.config({ quiet: true });
import mongoose from "mongoose";
import { syncInboundMessages } from "../utils/odooInboundSync.js";
import { sweepTutorReplies } from "../utils/tutorReplyScheduler.js";
await mongoose.connect(String(process.env.MONGO_URI || "").trim().replace(/^['"]|['"]$/g, ""), { autoIndex: false, autoCreate: false });
try {
  const r = await syncInboundMessages();
  console.log(`saved ${r.saved}, skipped ${r.skipped} (#${r.from} → #${r.to}); choices ${r.choices}, re-confirmations ${r.reconfirms}`);
  let total = 0;
  for (;;) { const s = await sweepTutorReplies(); total += s.marked || 0; if (!s.seen) break; }
  console.log("invitations marked:", total);
} finally { await mongoose.disconnect(); }
