import { API_BASE } from "../config";

const MAX_SIDE = 800;

// Phone photos are often 5-10 MB; send a JPEG at most 800px wide or tall instead
async function shrinkPhoto(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob || file;
  } catch {
    // Browsers that can't decode the format: send the original and let the server check it
    return file;
  }
}

// Uploads a profile photo to a /portal photo route; resolves to the stored photo URL
export async function uploadPortalPhoto(path, token, file) {
  if (!file.type.startsWith("image/")) throw new Error("Choose a photo (JPG or PNG).");
  const photo = await shrinkPhoto(file);
  const body = new FormData();
  body.append("photo", photo, photo === file ? file.name : "photo.jpg");

  const res = await fetch(`${API_BASE}/portal/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || "Couldn't upload the photo. Please try again.");
    error.status = res.status;
    throw error;
  }
  return data.photo;
}
