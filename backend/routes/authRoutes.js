import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import Admin from "../models/Admin.js";
import { verifyToken } from "../middleware/authMiddleware.js";

dotenv.config();

const router = express.Router();

const MIN_PASSWORD_LENGTH = 8;
const normalizeEmail = (email) => (typeof email === "string" ? email.trim().toLowerCase() : "");

// Two admin passwords are accepted:
// 1. ADMIN_EMAIL / ADMIN_PASSWORD from backend/.env (always works; change it by
//    editing .env and redeploying).
// 2. A password the admin set on the dashboard's Change Password page, stored
//    hashed in the Admin collection with passwordChangedAt. Records without
//    passwordChangedAt (left by older code, password unknown) are ignored.
const matchesEnvPassword = (email, password) => {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  return Boolean(ADMIN_EMAIL && ADMIN_PASSWORD && email === ADMIN_EMAIL && password === ADMIN_PASSWORD);
};

const isBcryptHash = (value) => typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);

const matchesDashboardPassword = async (email, password) => {
  const admin = await Admin.findOne({ email: normalizeEmail(email) });
  if (!admin?.passwordChangedAt || !isBcryptHash(admin.password)) return false;
  return bcrypt.compare(password, admin.password);
};

const checkAdminPassword = async (email, password) => {
  if (typeof email !== "string" || !email || typeof password !== "string" || !password) return false;
  return matchesEnvPassword(email, password) || (await matchesDashboardPassword(email, password));
};

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

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

// Sets the dashboard password. The .env password keeps working as well.
router.post("/change-password", verifyToken(["admin"]), async (req, res) => {
  try {
    const email = req.user.email;
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
    await Admin.findOneAndUpdate(
      { email: normalizeEmail(email) },
      { email: normalizeEmail(email), password: hash, passwordChangedAt: new Date() },
      { upsert: true }
    );

    res.json({ message: "Password changed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
