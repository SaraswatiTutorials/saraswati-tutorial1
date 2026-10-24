import mongoose from "mongoose";

// Named sequences that only ever go up (e.g. "requirementId"), so a number
// handed out once is never reused, even after the record is archived or deleted
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);

export default mongoose.model("Counter", counterSchema);
