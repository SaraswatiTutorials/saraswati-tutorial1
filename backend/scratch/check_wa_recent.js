// READ-ONLY: WhatsApp messages Odoo created or updated in the last N minutes
// (inbound messages, and outbound ones whose delivered/read tick came back).
//   cd backend && node scratch/check_wa_recent.js 30
import dotenv from "dotenv"; dotenv.config({ quiet: true });
const { getOdooUid, callOdooMethod } = await import("../utils/whatsappService.js");
const mins = Number(process.argv[2] || 30);
const since = new Date(Date.now() - mins * 60000).toISOString().replace("T", " ").slice(0, 19);
const uid = await getOdooUid();
const rows = await callOdooMethod(uid, "whatsapp.message", "search_read",
  [[["write_date", ">=", since]]], { fields: ["id", "create_date", "write_date", "message_type", "state", "mobile_number"], order: "write_date desc", limit: 20 });
console.log(`Odoo time now ~${new Date().toISOString()} | changed since ${since} UTC: ${rows.length}`);
for (const r of rows) console.log(` #${r.id} ${r.message_type} ${r.state} created=${r.create_date} updated=${r.write_date} …${String(r.mobile_number || "").slice(-4)}`);
