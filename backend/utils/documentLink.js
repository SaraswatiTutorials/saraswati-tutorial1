import { v2 as cloudinary } from "cloudinary";

// Cloudinary blocks plain delivery of PDFs on this account (the stored links return 401),
// so tutor PDFs are opened through a short-lived signed download link instead.
// Images are delivered normally and keep their stored link.

const LINK_LIFETIME_SECONDS = 10 * 60;

// Returns { resourceType, publicId } for a PDF in our Cloudinary account, or null
export function parseCloudinaryPdf(url, cloudName = process.env.CLOUDINARY_CLOUD_NAME) {
  if (typeof url !== "string" || !cloudName) return null;
  const prefix = `https://res.cloudinary.com/${cloudName}/`;
  if (!url.startsWith(prefix)) return null;

  const match = url
    .slice(prefix.length)
    .match(/^(image|raw)\/upload\/(?:[^/]+\/)*?(?:v\d+\/)(.+)\.pdf$/i);
  if (!match) return null;

  return { resourceType: match[1], publicId: decodeURIComponent(match[2]) };
}

// The link an admin should open for a stored tutor document
export function getDocumentOpenUrl(url) {
  const pdf = parseCloudinaryPdf(url);
  if (!pdf) return url;

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  return cloudinary.utils.private_download_url(pdf.publicId, "pdf", {
    resource_type: pdf.resourceType,
    type: "upload",
    expires_at: Math.floor(Date.now() / 1000) + LINK_LIFETIME_SECONDS,
  });
}
