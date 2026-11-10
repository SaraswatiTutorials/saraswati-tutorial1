/**
 * The Terms & Conditions message an admin sends to a parent from the main
 * admin dashboard, once a tutor is assigned. It is an Odoo WhatsApp template
 * ("terms_conditions", the PDF is its header), so the wording and the PDF are
 * changed in Odoo, not here. WHATSAPP_TERMS_TEMPLATE_NAME overrides the name.
 */
export const TERMS_TEMPLATE = "terms_conditions";

export function termsTemplateName(env = process.env) {
  return String(env.WHATSAPP_TERMS_TEMPLATE_NAME || "").trim() || TERMS_TEMPLATE;
}
