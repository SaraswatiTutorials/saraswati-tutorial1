// REQ-/STU- IDs for parent enquiries. Numbers come from a counter that only goes up,
// so an ID is never handed out twice, even after its enquiry is archived or deleted.
import ParentEnquiry from "../models/ParentEnquiry.js";
import Counter from "../models/Counter.js";

const COUNTER_ID = "requirementId";

export function enquiryIdsFor(n) {
  const padded = String(n).padStart(5, "0");
  return { requirementId: `REQ-${padded}`, websiteStudentId: `STU-${padded}` };
}

// Highest REQ number on any enquiry, archived ones included
async function highestIssuedNumber() {
  const latest = await ParentEnquiry.findOne({ requirementId: /^REQ-\d{5}$/ })
    .setOptions({ includeArchived: true })
    .sort({ requirementId: -1 })
    .select("requirementId")
    .lean();
  return latest ? Number(latest.requirementId.slice(4)) : 0;
}

export async function nextEnquiryIds() {
  // Catch the counter up with IDs already on record (first run, or records added another way)
  await Counter.updateOne(
    { _id: COUNTER_ID },
    { $max: { seq: await highestIssuedNumber() } },
    { upsert: true }
  );

  // Skip any number still taken (e.g. a STU- ID used on its own)
  for (;;) {
    const { seq } = await Counter.findOneAndUpdate(
      { _id: COUNTER_ID },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const ids = enquiryIdsFor(seq);
    const taken = await ParentEnquiry.exists({
      $or: [{ requirementId: ids.requirementId }, { websiteStudentId: ids.websiteStudentId }],
    }).setOptions({ includeArchived: true });
    if (!taken) return ids;
  }
}
