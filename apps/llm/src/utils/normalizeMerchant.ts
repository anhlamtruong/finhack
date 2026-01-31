/**
 * Stable merchant key for memory + analytics.
 * - Removes "STORE 1234", "ST 1234"
 * - Removes "#1234"
 * - Strips common domain suffixes like ".com"
 * - Removes punctuation, normalizes whitespace
 */
export function normalizeMerchant(raw: string): string {
  let s = String(raw ?? "").trim();
  if (!s) return "";

  s = s.replace(/\s+/g, " ");

  // Remove store number patterns
  s = s.replace(/\b(store|st)\s*\d+\b/gi, "");
  s = s.replace(/#\s*\d+\b/g, "");

  // Strip common domain suffixes (NETFLIX.COM -> NETFLIX)
  s = s.replace(/\.(com|net|org|io|ai|co|app|me|us|uk|biz)\b/gi, "");

  // Remove punctuation/symbols (keep letters, digits, spaces)
  s = s.replace(/[^a-zA-Z0-9 ]+/g, " ");

  // Cleanup
  s = s.replace(/\s+/g, " ").trim();

  return s.toUpperCase();
}
