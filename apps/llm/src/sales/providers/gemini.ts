// apps/llm/src/sales/providers/gemini.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

export type GeminiUserContext = {
  goal?: string;
  budgetMax?: number;
  womenFocus?: boolean;
  query?: string;
};

export type ReasonItem = {
  title: string;
  url?: string;
  price: number | null;
  rating: number | null;
  reviews: number | null;
  delivery: string | null;
  source: string | null;
  tag: string | null;
};

export type RerankItem = {
  title: string;
  url: string;
  price: number | null;
  rating: number | null;
  reviews: number | null;
  delivery: string | null;
  source: string | null;
  tag: string | null;
};

export type GeminiRerankResult = {
  url: string;
  score: number; // 0..100
  reasonShort?: string; // <= 18 words
};

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function safeNum(x: any, fallback: number): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function getApiKey(): string | null {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    null
  );
}

function getModelName(): string {
  return process.env.GEMINI_MODEL || "gemini-1.5-flash";
}

function stripFences(s: string): string {
  const t = String(s ?? "").trim();
  // ```json ... ``` or ``` ... ```
  if (t.startsWith("```")) {
    return t
      .replace(/^```[a-zA-Z0-9_-]*\s*/m, "")
      .replace(/\s*```\s*$/m, "")
      .trim();
  }
  return t;
}

function extractFirstJsonObject(text: string): string | null {
  const s = stripFences(text);
  const start = s.indexOf("{");
  if (start < 0) return null;
  // try to find a balanced JSON object end
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    if (depth === 0) {
      const candidate = s.slice(start, i + 1).trim();
      return candidate.length ? candidate : null;
    }
  }
  return null;
}

function parseJsonBestEffort<T = any>(text: string): T | null {
  const raw = stripFences(text);
  try {
    return JSON.parse(raw) as T;
  } catch {
    const candidate = extractFirstJsonObject(raw);
    if (!candidate) return null;
    try {
      return JSON.parse(candidate) as T;
    } catch {
      return null;
    }
  }
}

async function withTimeout<T>(p: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  const ms = clamp(safeNum(timeoutMs, 1200), 200, 60000);
  return await Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`[sales] Gemini ${label} timeout after ${ms}ms`)), ms)
    ),
  ]);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function wordsLen(s: string): number {
  return String(s ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function normalizeReason(s: any): string {
  const t = String(s ?? "").trim();
  if (!t) return "";
  // keep it short and safe
  if (wordsLen(t) <= 18) return t;
  return t.split(/\s+/).slice(0, 18).join(" ");
}

/**
 * Generate 1 short reason per item (same order/length as input).
 * Best-effort: if Gemini is not configured or errors, returns empty strings.
 * Never invents missing info.
 */
export async function geminiReasons(args: {
  items: ReasonItem[];
  userContext?: GeminiUserContext;
  timeoutMs?: number;
  maxItemsPerCall?: number;
}): Promise<string[]> {
  const items = Array.isArray(args.items) ? args.items : [];
  if (items.length === 0) return [];

  const apiKey = getApiKey();
  if (!apiKey) return items.map(() => "");

  const modelName = getModelName();
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  const timeoutMs = clamp(safeNum(args.timeoutMs ?? 1400, 1400), 200, 60000);
  const maxItemsPerCall = clamp(safeNum(args.maxItemsPerCall ?? 8, 8), 1, 20);

  // chunk to reduce latency + keep JSON output small
  const chunks = chunk(items, maxItemsPerCall);
  const allReasons: string[] = [];

  for (const part of chunks) {
    const payload = {
      goal: args.userContext?.goal ?? null,
      budgetMax: args.userContext?.budgetMax ?? null,
      womenFocus: args.userContext?.womenFocus ?? null,
      query: args.userContext?.query ?? null,
      items: part.map((x) => ({
        title: x.title,
        url: x.url ?? null,
        price: x.price,
        rating: x.rating,
        reviews: x.reviews,
        delivery: x.delivery,
        source: x.source,
        tag: x.tag,
      })),
    };

    const prompt = [
      "You write ultra-short shopping recommendation reasons.",
      "Return ONLY JSON.",
      "Schema: { \"reasons\": string[] } where reasons has SAME length and SAME order as items.",
      "Rules:",
      "- Each reason <= 18 words.",
      "- Use ONLY provided fields. If a field is null, do not mention it.",
      "- Do NOT claim 'women-owned' unless SOURCE or TAG explicitly indicates it.",
      "- Prefer concrete value: price, rating, reviews, delivery, reputable store/source.",
      "Input JSON:",
      JSON.stringify(payload),
    ].join("\n");

    try {
      const res = await withTimeout(
        model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 256,
          },
        }),
        timeoutMs,
        "reasons"
      );

      const text = res?.response?.text?.() ?? "";
      const parsed = parseJsonBestEffort<{ reasons?: any[] }>(text);

      let reasons: string[] = [];
      if (parsed && Array.isArray(parsed.reasons)) {
        reasons = parsed.reasons.map(normalizeReason);
      }

      // enforce same length/order
      while (reasons.length < part.length) reasons.push("");
      reasons = reasons.slice(0, part.length);
      allReasons.push(...reasons);
    } catch {
      // best-effort: keep alignment
      allReasons.push(...part.map(() => ""));
    }
  }

  return allReasons.slice(0, items.length);
}

/**
 * LLM reranker: returns a scored subset of input URLs.
 * Best-effort: returns null if Gemini not configured or fails.
 *
 * You can use this to reorder your locally-ranked list without changing provider logic.
 */
export async function geminiRerank(args: {
  items: RerankItem[];
  userContext?: GeminiUserContext;
  timeoutMs?: number;
  maxItemsPerCall?: number;
}): Promise<GeminiRerankResult[] | null> {
  const items = Array.isArray(args.items) ? args.items : [];
  if (items.length === 0) return [];

  const apiKey = getApiKey();
  if (!apiKey) return null;

  const modelName = getModelName();
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  const timeoutMs = clamp(safeNum(args.timeoutMs ?? 1800, 1800), 200, 60000);
  const maxItemsPerCall = clamp(safeNum(args.maxItemsPerCall ?? 20, 20), 2, 40);

  // For rerank we usually want the whole set in one go; chunking is here for safety.
  const parts = chunk(items, maxItemsPerCall);
  const out: GeminiRerankResult[] = [];

  for (const part of parts) {
    const payload = {
      goal: args.userContext?.goal ?? null,
      budgetMax: args.userContext?.budgetMax ?? null,
      womenFocus: args.userContext?.womenFocus ?? null,
      query: args.userContext?.query ?? null,
      items: part.map((x) => ({
        title: x.title,
        url: x.url,
        price: x.price,
        rating: x.rating,
        reviews: x.reviews,
        delivery: x.delivery,
        source: x.source,
        tag: x.tag,
      })),
    };

    const prompt = [
      "You are ranking shopping results for a user.",
      "Return ONLY JSON.",
      "Schema:",
      "{ \"results\": [ { \"url\": string, \"score\": number, \"reasonShort\": string } ] }",
      "Rules:",
      "- score is 0..100 (higher is better).",
      "- Keep reasonShort <= 18 words.",
      "- Use ONLY provided fields; do not invent.",
      "- If womenFocus=true, prefer items likely aligned with women-first intent, but do NOT claim women-owned unless SOURCE or TAG says so.",
      "- Prefer strong value: within budgetMax if provided, higher rating+reviews, good delivery, reputable source.",
      "- Return one entry per item (same count; any missing URLs will be treated as score 0).",
      "Input JSON:",
      JSON.stringify(payload),
    ].join("\n");

    try {
      const res = await withTimeout(
        model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 512,
          },
        }),
        timeoutMs,
        "rerank"
      );

      const text = res?.response?.text?.() ?? "";
      const parsed = parseJsonBestEffort<{ results?: any[] }>(text);
      const resultsRaw = Array.isArray(parsed?.results) ? parsed!.results : [];

      // Normalize and enforce url mapping
      const byUrl = new Map<string, GeminiRerankResult>();
      for (const r of resultsRaw) {
        const url = typeof r?.url === "string" ? r.url : "";
        if (!url) continue;
        const score = clamp(safeNum(r?.score, 0), 0, 100);
        const reasonShort = normalizeReason(r?.reasonShort);
        byUrl.set(url, { url, score, reasonShort: reasonShort || undefined });
      }

      // Ensure every input URL has an entry
      for (const it of part) {
        out.push(byUrl.get(it.url) ?? { url: it.url, score: 0 });
      }
    } catch {
      // if this chunk fails, signal failure by returning null (caller should keep local order)
      return null;
    }
  }

  return out;
}