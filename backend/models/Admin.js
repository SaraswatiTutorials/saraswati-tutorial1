import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    // Set when the admin changes their password in the dashboard. Records
    // without it (left over from older code) are ignored at login.
    passwordChangedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("Admin", adminSchema);