import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const PHOTO_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

// One profile photo in memory, at most 5 MB
export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("photo");

// Runs the multer step and turns its errors into a 400 the portals can show
export function receivePhoto(req, res, next) {
  photoUpload(req, res, (err) => {
    if (err) {
      const tooBig = err.code === "LIMIT_FILE_SIZE";
      return res.status(400).json({ message: tooBig ? "The photo must be under 5 MB." : "Couldn't read the photo." });
    }
    if (!req.file) return res.status(400).json({ message: "Choose a photo to upload." });
    if (!PHOTO_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ message: "Use a JPG, PNG or WEBP photo." });
    }
    next();
  });
}

// Stores the photo on Cloudinary, scaled down to at most 800px, and returns its URL
export async function storePhoto(file, folder) {
  const base64 = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
  const result = await cloudinary.uploader.upload(base64, {
    folder,
    resource_type: "image",
    transformation: [{ width: 800, height: 800, crop: "limit" }],
  });
  return result.secure_url;
}
