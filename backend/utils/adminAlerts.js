// WhatsApp alerts to the admin's own number (ADMIN_WHATSAPP in .env).
// Sent through the same Odoo WhatsApp account as tutor messages.

import { sendWhatsAppToTutor } from "./whatsappService.js";

const NEW_ENQUIRY_TEMPLATE_NAME = process.env.WHATSAPP_ADMIN_ENQUIRY_TEMPLATE_NAME || "admin_new_enquiry_alert";

// WhatsApp template values can't be empty or contain line breaks/tabs
function templateValue(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || "N/A";
}

// "Aarav (Class 8, CBSE: Maths, Science); Diya (Class 5, ICSE: English)"
function describeStudents(lead) {
  const wards = Array.isArray(lead.wards) && lead.wards.length > 0 ? lead.wards : [lead];
  return wards
    .map((w) => {
      const subjects = Array.isArray(w.subjectsNeeded) ? w.subjectsNeeded.join(", ") : w.subjectsNeeded || "";
      const details = [w.classGrade ? `Class ${w.classGrade}` : "", w.curriculum || ""].filter(Boolean).join(", ");
      const info = [details, subjects].filter(Boolean).join(": ");
      return `${w.studentName || "Student"}${info ? ` (${info})` : ""}`;
    })
    .join("; ");
}

// Template values in order: {{1}} Req ID, {{2}} parent, {{3}} phone, {{4}} students, {{5}} location, {{6}} mode
export function buildNewEnquiryAlert(lead) {
  const location = [lead.area, lead.geoInfo?.city, lead.pincode].filter(Boolean).join(", ");
  const values = {
    requirement_id: templateValue(lead.requirementId),
    parent_name: templateValue(lead.parentName),
    phone: templateValue(lead.phone),
    students: templateValue(describeStudents(lead)),
    location: templateValue(location),
    mode: templateValue(lead.preferredMode),
  };

  const messageBody = `New parent enquiry received on the website.

Requirement ID: ${values.requirement_id}
Parent: ${values.parent_name}
Phone: ${values.phone}
Student: ${values.students}
Location: ${values.location}
Mode: ${values.mode}

Please follow up with the parent at the earliest.

Saraswati Tutorials`;

  return { messageBody, templateVars: values };
}

export async function notifyAdminOfNewEnquiry(lead) {
  const adminNumber = process.env.ADMIN_WHATSAPP || "";
  if (!adminNumber) {
    console.warn(`[Admin Alert] ADMIN_WHATSAPP is not set. Skipping new enquiry alert for ${lead.requirementId}.`);
    return;
  }

  const { messageBody, templateVars } = buildNewEnquiryAlert(lead);
  const result = await sendWhatsAppToTutor({
    phoneNumber: adminNumber,
    messageBody,
    templateName: NEW_ENQUIRY_TEMPLATE_NAME,
    templateVars,
  });

  if (result.success) {
    console.log(`[Admin Alert] New enquiry ${lead.requirementId} sent to admin WhatsApp.`);
  } else {
    console.warn(`[Admin Alert] New enquiry ${lead.requirementId} could not be sent: ${result.failureReason}`);
  }
}
