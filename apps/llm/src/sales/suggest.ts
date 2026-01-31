// apps/llm/src/sales/suggest.ts
import { uniq, normalizeWhitespace, clamp, safeNum } from "./utils.js";

/**
 * High-level intent buckets for suggestions.
 * Keep this small + stable so UI & analytics don’t churn.
 */
export type SalesGoal =
  | "save"
  | "health"
  | "career"
  | "selfcare"
  | "home"
  | "fitness"
  | "period"
  | "beauty"
  | "pregnancy"
  | "education"
  | "travel"
  | "unknown";

/**
 * Normalize arbitrary input into a stable `SalesGoal`.
 */
export function asGoal(x: unknown): SalesGoal {
  const g = String(x ?? "").trim().toLowerCase();

  // budget / saving
  if (g === "save" || g === "saving" || g === "budget" || g === "deal" || g === "deals") return "save";

  // wellbeing
  if (g === "health" || g === "wellness" || g === "mind" || g === "mental" || g === "sleep") return "health";

  // work
  if (g === "career" || g === "work" || g === "office" || g === "professional") return "career";

  // self care
  if (g === "selfcare" || g === "self-care" || g === "self_care" || g === "pamper") return "selfcare";

  // home
  if (g === "home" || g === "house" || g === "apartment" || g === "kitchen") return "home";

  // fitness
  if (g === "fitness" || g === "gym" || g === "sport" || g === "sports" || g === "running") return "fitness";

  // women-first feature-specific goals
  if (g === "period" || g === "menstrual" || g === "menstruation" || g === "pms" || g === "cramps") return "period";
  if (g === "beauty" || g === "skincare" || g === "makeup" || g === "hair") return "beauty";
  if (g === "pregnancy" || g === "postpartum" || g === "maternity" || g === "baby" || g === "newborn") return "pregnancy";
  if (g === "education" || g === "study" || g === "school" || g === "college") return "education";
  if (g === "travel" || g === "trip" || g === "vacation" || g === "flight") return "travel";

  return "unknown";
}

function moneyPretty(n: number): string {
  // Whole dollars when possible; otherwise 2 decimals.
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function budgetSuffix(budgetMax?: number): string {
  if (typeof budgetMax !== "number" || !Number.isFinite(budgetMax)) return "";
  if (budgetMax <= 0) return "";

  // Guard against absurd values, but don't be strict.
  const capped = clamp(budgetMax, 1, 100000);
  return ` under $${moneyPretty(capped)}`;
}

function shouldAddWomenBrandHint(goal: SalesGoal): boolean {
  // We add the women-owned hint where it tends to help discovery.
  // For very literal product searches (e.g., basic period items), we keep it optional.
  return goal === "career" || goal === "selfcare" || goal === "beauty" || goal === "education" || goal === "travel";
}

function normalizeCats(xs: unknown): string[] {
  if (!Array.isArray(xs)) return [];
  return xs
    .map((s) => normalizeWhitespace(String(s)))
    .filter(Boolean)
    .slice(0, 3);
}

/**
 * Women-first, budget-aware suggestion builder.
 *
 * Router expects this function name.
 *
 * Optional `recentCategories` can come from FE (future hook):
 * - bias suggestions to the user's recent purchase / browse categories
 */
export function buildWomenFirstSuggestions(args?: {
  goal?: SalesGoal | string;
  budgetMax?: number;
  recentCategories?: string[];
  // optional: how many suggestions to return
  limit?: number;
}): string[] {
  const goal = asGoal(args?.goal);

  const budgetMax = safeNum(args?.budgetMax, undefined);
  const b = budgetSuffix(budgetMax);

  const limit = clamp(safeNum(args?.limit ?? 12, 12), 1, 24);

  const recent = normalizeCats(args?.recentCategories);
  const womenBrandHint = "women-owned women-led";
  const maybeWomen = shouldAddWomenBrandHint(goal) ? ` ${womenBrandHint}` : "";

  // Core women-first + savings-friendly defaults.
  // Keep these broad so they work across providers.
  const base: string[] = [
    `period essentials kit${b}`,
    `organic cotton pads fragrance free${b}`,
    `menstrual cup beginner friendly${b}`,
    `heating pad for cramps${b}`,
    `comfortable wireless bra supportive${b}`,
    `everyday skincare gentle cleanser${maybeWomen}${b}`,
    `work tote bag${maybeWomen}${b}`,
    `blue light glasses${maybeWomen}${b}`,
  ];

  const add: Record<SalesGoal, string[]> = {
    save: [
      `bundle deals personal care${b}`,
      `value pack pads liners${b}`,
      `travel size essentials set${b}`,
    ],
    health: [
      `sleep mask blackout${b}`,
      `heat patches cramps${b}`,
      `foam roller back pain${b}`,
    ],
    career: [
      `interview outfit${maybeWomen}${b}`,
      `professional flats comfortable${b}`,
      `laptop bag${maybeWomen}${b}`,
    ],
    selfcare: [
      `journaling kit${maybeWomen}${b}`,
      `hair mask deep conditioning${b}`,
      `aromatherapy shower steamers${b}`,
    ],
    home: [
      `home organization bins${b}`,
      `ergonomic chair cushion${b}`,
      `meal prep containers BPA free${b}`,
    ],
    fitness: [
      `sports bra high impact supportive${b}`,
      `walking shoes women${b}`,
      `yoga mat non slip${b}`,
    ],
    period: [
      `period day bag mini pouch${b}`,
      `period underwear pack${b}`,
      `portable heating pad${b}`,
    ],
    beauty: [
      `tinted moisturizer${maybeWomen}${b}`,
      `mineral sunscreen SPF 50${b}`,
      `lip balm set${maybeWomen}${b}`,
    ],
    pregnancy: [
      `postpartum essentials gift set${b}`,
      `maternity leggings supportive${b}`,
      `nursing bra comfortable${b}`,
    ],
    education: [
      `study planner${maybeWomen}${b}`,
      `noise cancelling earbuds budget${b}`,
      `desk lamp eye care${b}`,
    ],
    travel: [
      `travel toiletry bag${b}`,
      `packing cubes carry-on organizers${b}`,
      `mini first aid kit${b}`,
    ],
    unknown: [],
  };

  // Sprinkle recent categories as gentle nudges.
  // Example: "running shoes under $80".
  const recentHints = recent.map((c) => `${c}${b}`);

  return uniq([...
    base,
    ...(add[goal] ?? []),
    ...recentHints,
  ])
    .map(normalizeWhitespace)
    .filter(Boolean)
    .slice(0, limit);
}

/**
 * Backward-compatible alias.
 * Some earlier code referenced `buildSuggestions`.
 */
export function buildSuggestions(args?: {
  goal?: SalesGoal | string;
  budgetMax?: number;
  recentCategories?: string[];
  limit?: number;
}): string[] {
  return buildWomenFirstSuggestions(args);
}

/**
 * Light query enhancer for the women-first search mode.
 * Avoid adding too many tokens so results don’t get worse.
 */
export function womenFocusQuery(q: string): string {
  const cleaned = normalizeWhitespace(q);
  if (!cleaned) return cleaned;

  const lc = cleaned.toLowerCase();
  const already =
    lc.includes("women-owned") ||
    lc.includes("women owned") ||
    lc.includes("women-led") ||
    lc.includes("female-founded") ||
    lc.includes("female founded") ||
    lc.includes("for women") ||
    lc.includes("women entrepreneurs");

  if (already) return cleaned;

  // Add only 1–2 value terms to keep relevance.
  return `${cleaned} women-owned women-led`.trim();
}

/**
 * Helper used by `search.ts` (Gemini reasons) to keep prompts consistent.
 *
 * IMPORTANT: This function DOES NOT call Gemini.
 * It only builds a compact instruction string.
 */
export function buildReasoningStyleGuide(args?: { tone?: "short" | "friendly"; maxReasons?: number }): string {
  const tone = args?.tone ?? "short";
  const maxReasons = clamp(safeNum(args?.maxReasons ?? 6, 6), 1, 10);

  if (tone === "friendly") {
    return `Write up to ${maxReasons} brief, friendly reasons (1 sentence each). Be specific, avoid hype. If info is missing, say what you can infer from title/source/price and leave unknowns blank.`;
  }

  return `Write up to ${maxReasons} brief reasons (max 1 sentence each). Be specific, no hype, no medical claims. If info is missing, base it on title/source/price and omit unknowns.`;
}

export default {
  asGoal,
  buildWomenFirstSuggestions,
  buildSuggestions,
  womenFocusQuery,
  buildReasoningStyleGuide,
};