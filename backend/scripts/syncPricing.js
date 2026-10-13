// Copies the shared pricing files from backend/utils/pricing to frontend/src/pricing.
// Usage: npm run sync:pricing (from backend/)
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SHARED_PRICING_FILES = ["feeConfig.js", "feeEngine.js"];

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "..", "utils", "pricing");
const target = join(here, "..", "..", "frontend", "src", "pricing");

mkdirSync(target, { recursive: true });
for (const file of SHARED_PRICING_FILES) {
  copyFileSync(join(source, file), join(target, file));
  console.log(`Synced ${file} -> frontend/src/pricing/${file}`);
}
