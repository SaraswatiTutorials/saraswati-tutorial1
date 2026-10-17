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

// Once an admin sets their own password it is stored (hashed) in the Admin
// collection and replaces ADMIN_PASSWORD from .env for that email. Until then,
// the .env credentials are used. A stored value that is not a bcrypt hash is
// ignored, so a stray old record cannot lock the admin out.
const isBcryptHash = (value) => typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);

const checkAdminPassword = async (email, password) => {
  if (!email || typeof password !== "string" || !password) return false;
  const admin = await Admin.findOne({ email });
  if (admin && isBcryptHash(admin.password)) return bcrypt.compare(password, admin.password);

  const envEmail = normalizeEmail(process.env.ADMIN_EMAIL);
  const envPassword = process.env.ADMIN_PASSWORD;
  return Boolean(envEmail && envPassword && email === envEmail && password === envPassword);
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
    await Admin.findOneAndUpdate({ email }, { email, password: hash }, { upsert: true });

    res.json({ message: "Password changed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
