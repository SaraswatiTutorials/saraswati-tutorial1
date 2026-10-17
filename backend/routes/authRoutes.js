import express from "express";
import fs from "fs";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import Admin from "../models/Admin.js";
import { verifyToken } from "../middleware/authMiddleware.js";

dotenv.config();

const router = express.Router();

const MIN_PASSWORD_LENGTH = 8;
const normalizeEmail = (email) => (typeof email === "string" ? email.trim().toLowerCase() : "");

// The admin email and password are read from backend/.env itself, so they win
// over ADMIN_EMAIL / ADMIN_PASSWORD set in the host's environment (dotenv never
// overrides those). Falls back to process.env when the file has no value.
// ADMIN_ENV_FILE points the tests at their own file.
const ADMIN_ENV_FILE = process.env.ADMIN_ENV_FILE || new URL("../.env", import.meta.url);
const adminEnvCredentials = () => {
  let file = {};
  try {
    file = dotenv.parse(fs.readFileSync(ADMIN_ENV_FILE));
  } catch {}
  return {
    email: normalizeEmail(file.ADMIN_EMAIL || process.env.ADMIN_EMAIL),
    password: file.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD,
  };
};

// Once an admin sets their own password in the dashboard it is stored (hashed)
// in the Admin collection with passwordChangedAt, and replaces ADMIN_PASSWORD
// from .env for that email. Until then, the .env credentials are used. Records
// without passwordChangedAt (left by older code, password unknown) or without a
// bcrypt hash are ignored, so they cannot lock the admin out.
const isBcryptHash = (value) => typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);

const checkAdminPassword = async (email, password) => {
  if (!email || typeof password !== "string" || !password) return false;
  const admin = await Admin.findOne({ email });
  if (admin?.passwordChangedAt && isBcryptHash(admin.password)) return bcrypt.compare(password, admin.password);

  const env = adminEnvCredentials();
  return Boolean(env.email && env.password && email === env.email && password === env.password);
};

router.post("/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!(await checkAdminPassword(email, password))) {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    const token = jwt.sign(
      { email, role: "admin" },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "1d" }
    );

    res.json({
      token,
      email,
      role: "admin",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/change-password", verifyToken(["admin"]), async (req, res) => {
  try {
    const email = normalizeEmail(req.user.email);
    const { currentPassword, newPassword } = req.body;

    if (typeof newPassword !== "string" || newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }
    if (!(await checkAdminPassword(email, currentPassword))) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ message: "New password must be different from the current password" });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await Admin.findOneAndUpdate({ email }, { email, password: hash, passwordChangedAt: new Date() }, { upsert: true });

    res.json({ message: "Password changed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
