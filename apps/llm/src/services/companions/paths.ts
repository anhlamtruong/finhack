import path from "node:path";

/**
 * Resolve the public assets root directory for draft files.
 */
export function getPublicAssetsRoot() {
  return path.join(process.cwd(), "public", "assets");
}

/**
 * Resolve the base URL for draft asset hosting.
 */
export function getBaseUrl() {
  const raw = process.env.LLM_PUBLIC_URL || process.env.LLM_URL ||
    "http://localhost:8080";
  return raw.replace(/\/$/, "");
}
