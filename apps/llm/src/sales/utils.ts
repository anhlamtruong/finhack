// apps/llm/src/sales/utils.ts
// Shared types + tiny helpers used across the sales feature.

export type Money = number;

export type SaleItem = {
  title: string;
  url: string;
  source?: string | null; // store / merchant
  brand?: string | null;
  image?: string | null;

  priceText?: string | null;
  price?: Money | null;

  originalPriceText?: string | null;
  originalPrice?: Money | null;

  discountText?: string | null;
  rating?: number | null;
  reviews?: number | null;

  delivery?: string | null;
  tag?: string | null;

  // Optional: enriched UX (Gemini/local reasons)
  reason?: string | null;
};

export type SalesSearchInput = {
  query: string;

  // women-first biasing
  womenFocus?: boolean;

  // region / language (SerpAPI params)
  gl?: string;
  hl?: string;

  // limits
  maxResults?: number;

  // budgets
  priceMin?: number;
  priceMax?: number;

  // cache + timeout
  cacheTtlMs?: number;
  timeoutMs?: number;

  // optional: attach short reasons to items
  withReasons?: boolean;
  reasonsMax?: number; // number of items to enrich
  reasonsTimeoutMs?: number;

  // debugging
  debug?: boolean;
};

export type SalesSearchOutput = {
  ok: true;
  queryUsed: string;
  womenFocus: boolean;
  count: number;
  items: SaleItem[];

  // Optional debug blob. Route may include providerDebug, contentType, tried queries, etc.
  debug?: any;
};

export type FeedbackEvent = {
  userId: string;

  // “context” from the UI
  query?: string;
  itemUrl?: string;
  itemTitle?: string;

  // what they did
  action: "like" | "dislike" | "click" | "hide" | "save" | "report";
  reason?: string;
  createdAtIso?: string;

  // optional: tie into finance app
  budgetMax?: number;
  categoryHint?: string;
};

export type SalesSuggestInput = {
  goal: string; // e.g., selfcare | career | wedding | etc.
  budgetMax?: number;
  womenFocus?: boolean;
  maxSuggestions?: number;
};

export type SalesSuggestOutput = {
  ok: true;
  suggestions: string[];
};

export function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function isFiniteNum(v: any): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

// Overloads so callers can either require a number fallback or allow `undefined`.
export function safeNum(v: any, fallback: number): number;
export function safeNum(v: any, fallback?: number): number | undefined;
export function safeNum(v: any, fallback?: number): number | undefined {
  const n = Number(v);
  if (Number.isFinite(n)) return n;
  return fallback;
}

export function toMoney(v: any): Money | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function nowIso() {
  return new Date().toISOString();
}

export function env(name: string) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : null;
}

export function mustEnv(name: string) {
  const v = env(name);
  if (!v) throw new Error(`[sales] Missing ${name}`);
  return v;
}

export function safeStr(v: any): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function parseBool(v: any, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v !== "string") return fallback;
  const s = v.trim().toLowerCase();
  if (["1", "true", "t", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "f", "no", "n", "off"].includes(s)) return false;
  return fallback;
}

export function normalizeWhitespace(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

export function cap(s: string, maxLen: number) {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen);
}

export function makeCacheKey(obj: any) {
  // stable-ish: sort keys recursively
  const stable = (x: any): any => {
    if (x == null) return x;
    if (Array.isArray(x)) return x.map(stable);
    if (typeof x === "object") {
      const out: any = {};
      for (const k of Object.keys(x).sort()) out[k] = stable(x[k]);
      return out;
    }
    return x;
  };
  return JSON.stringify(stable(obj));
}

export function uniq(xs: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    const k = x.trim().toLowerCase();
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

// Local, deterministic reason string (no LLM needed).
// Keep it short: used as fallback if Gemini is disabled or times out.
export function buildLocalReason(x: {
  price?: number | null;
  rating?: number | null;
  reviews?: number | null;
  delivery?: string | null;
  source?: string | null;
  tag?: string | null;
}): string {
  const parts: string[] = [];

  if (typeof x.price === "number" && Number.isFinite(x.price)) parts.push(`$${x.price}`);
  if (typeof x.rating === "number" && Number.isFinite(x.rating)) parts.push(`${x.rating}★`);
  if (typeof x.reviews === "number" && Number.isFinite(x.reviews)) parts.push(`${x.reviews} reviews`);
  if (x.delivery) parts.push(x.delivery.toLowerCase());
  if (x.tag) parts.push(x.tag.toLowerCase());
  if (x.source) parts.push(`from ${x.source}`);

  if (parts.length === 0) return "Worth a look.";
  return parts.slice(0, 3).join(" • ");
}

// Convenience helper: build a local reason directly from a SaleItem.
export function localReasonFromItem(it: SaleItem): string {
  return buildLocalReason({
    price: it.price ?? null,
    rating: it.rating ?? null,
    reviews: it.reviews ?? null,
    delivery: it.delivery ?? null,
    source: it.source ?? null,
    tag: it.tag ?? null,
  });
}
