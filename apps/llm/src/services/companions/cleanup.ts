import path from "node:path";
import { promises as fs } from "node:fs";

/**
 * Remove a draft assets folder safely.
 * Ensures the resolved path stays within /public/assets.
 */
export async function cleanupDraftAssets(rawPath: string) {
  const baseDir = path.join(process.cwd(), "public", "assets");
  const normalized = rawPath.replace(/^\/+/, "").replace(/^assets\//, "");
  const target = path.resolve(baseDir, normalized);

  if (!target.startsWith(baseDir)) {
    throw new Error("invalid path");
  }

  await fs.rm(target, { recursive: true, force: true });
  return normalized;
}
