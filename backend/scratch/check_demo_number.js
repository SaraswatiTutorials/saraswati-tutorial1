// READ-ONLY: template approval, and whether a number is already a tutor or partial tutor.
//   cd backend && node scratch/check_demo_number.js 9041157689
import dotenv from "dotenv"; dotenv.config();
import mongoose from "mongoose";
const num = String(process.argv[2] || "").replace(/\D/g, "").slice(-10);
await mongoose.connect(String(process.env.MONGO_URI || "").trim().replace(/^['"]|['"]$/g, ""), { autoIndex: false, autoCreate: false });
try {
  const { getOdooUid, callOdooMethod } = await import("../utils/whatsappService.js");
  const uid = await getOdooUid();
  const t = await callOdooMethod(uid, "whatsapp.template", "search_read",
    [[["template_name", "in", ["tutor_full_verification", "tutor_agreement_sign"]]]], { fields: ["template_name", "status"] });
  console.log("templates:", JSON.stringify(t));
  const db = mongoose.connection.db;
  const re = new RegExp(num.split("").join("\\D*") + "$");
  const tutors = await db.collection("tutors").find({ $or: [{ phone: re }, { whatsapp: re }] }, { projection: { name: 1, tutorCode: 1, status: 1, odooAgreement: 1 } }).toArray();
  const partials = await db.collection("partialtutors").find({ whatsapp: re }, { projection: { name: 1, tutorCode: 1, status: 1, registeredTutorId: 1 } }).toArray();
  console.log("tutors:", JSON.stringify(tutors));
  console.log("partials:", JSON.stringify(partials));
} finally { await mongoose.disconnect(); }
