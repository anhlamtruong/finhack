// apps/llm/src/sales/providers/multi.ts
import { normalizeWhitespace } from "../utils.js";
import { factsSearch } from "./facts.js";

/**
 * Multi-provider enrichment + reranking
 * - Fetch Facts (OpenFoodFacts/OpenBeautyFacts/OpenProductsFacts)
 * - Match facts to retail (barcode exact, then title/brand fuzzy)
 * - Enrich retail items with: barcode, categories, factsSource, factsUrl
 * - Dedupe by barcode, then fuzzy title+brand
 * - Re-rank by base order + categoryMatchScore(query, categories)
 *
 * No extra deps: we implement a lightweight token-set similarity.
 */

export type FactsDomain = "food" | "beauty" | "products";

export type EnrichWithFactsInput = {
  query: string;
  items: any[]; // retail items
  domains?: FactsDomain[];
  factsPageSize?: number;
  factsTimeoutMs?: number;

  // fuzzy matching thresholds [0..100]
  matchThreshold?: number; // default 90
  dedupeThreshold?: number; // default 94

  // rerank blend
  categoryWeight?: number; // [0..1], default 0.35
};

export type EnrichWithFactsOutput = {
  items: any[];
  debug?: {
    facts: {
      domains: FactsDomain[];
      pageSize: number;
      fetched: number;
      byDomain: Record<string, number>;
    };
    match: {
      matched: number;
      barcodeMatches: number;
      titleMatches: number;
      brandTitleMatches: number;
      avgBestScore: number;
    };
    dedupe: {
      in: number;
      barcodeDeduped: number;
      fuzzyDeduped: number;
      out: number;
    };
    rerank: {
      categoryWeight: number;
      categoryScoreNonZero: number;
    };
  };
};

const WS = /\s+/g;
const NONALNUM = /[^a-z0-9]+/g;

const DEFAULT_STOP = new Set([
  "the",
  "and",
  "or",
  "with",
  "for",
  "to",
  "of",
  "a",
  "an",
  "kit",
  "set",
  "bundle",
  "pack",
  // keep women terms out of matching keys to reduce noise
  "women",
  "womens",
  "woman",
  "female",
  "women-owned",
  "women-led",
]);

function normKey(s: string): string {
  const x = (s || "").toLowerCase().replace(NONALNUM, " ").replace(WS, " ").trim();
  return x;
}

function tokens(s: string): string[] {
  const t = normKey(s)
    .split(" ")
    .map((x) => x.trim())
    .filter((x) => x && !DEFAULT_STOP.has(x));
  return t.slice(0, 40);
}

function tokenSetSim(a: string, b: string): number {
  // token-set overlap similarity -> [0..100]
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (A.size === 0 || B.size === 0) return 0;

  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;

  // Dice coefficient * 100
  const score = (2 * inter) / (A.size + B.size);
  return Math.round(score * 100);
}

function titleBrandKey(title: string, brand?: string | null): string {
  return `${normKey(brand || "")}|${normKey(title || "")}`;
}

function baseRankScore(idx: number, n: number): number {
  if (n <= 1) return 1;
  return 1 - idx / (n - 1);
}

function categoryMatchScore(query: string, categories?: string[] | null): number {
  // [0..1] based on token overlap between query and categories
  if (!categories || categories.length === 0) return 0;

  const q = new Set(tokens(query));
  if (q.size === 0) return 0;

  const catText = categories.join(" ");
  const c = new Set(tokens(catText));
  if (c.size === 0) return 0;

  let inter = 0;
  for (const x of q) if (c.has(x)) inter++;

  const denom = Math.max(q.size, 1);
  const raw = inter / denom;
  return Math.max(0, Math.min(1, raw));
}

function pickBetter(a: any, b: any): any {
  // mirrors your python heuristic
  const hasPrice = (x: any) => (typeof x?.price === "number" && Number.isFinite(x.price) ? 1 : 0);
  const hasCats = (x: any) => (Array.isArray(x?.categories) && x.categories.length > 0 ? 1 : 0);
  const rating = (x: any) => (typeof x?.rating === "number" && Number.isFinite(x.rating) ? x.rating : 0);
  const reviews = (x: any) => (typeof x?.reviews === "number" && Number.isFinite(x.reviews) ? x.reviews : 0);
  const baseRank = (x: any) =>
    typeof x?.base_rank === "number" && Number.isFinite(x.base_rank) ? -x.base_rank : -10_000;

  const key = (x: any) => [hasPrice(x), hasCats(x), rating(x), reviews(x), baseRank(x)];

  const ka = key(a);
  const kb = key(b);

  for (let i = 0; i < ka.length; i++) {
    if (ka[i] > kb[i]) return a;
    if (ka[i] < kb[i]) return b;
  }
  return a;
}

function inferBrandFromTitle(title: string, brandLex: string[]): string | null {
  const t = normKey(title);
  if (!t) return null;
  for (const b of brandLex) {
    if (b && t.includes(b)) return b;
  }
  return null;
}

export async function enrichWithFacts(input: EnrichWithFactsInput): Promise<EnrichWithFactsOutput> {
  const query = normalizeWhitespace(input.query || "");
  const itemsIn = Array.isArray(input.items) ? input.items.slice() : [];
  const domains: FactsDomain[] = (input.domains?.length ? input.domains : ["food", "beauty", "products"]) as FactsDomain[];
  const factsPageSize = Math.max(1, Math.min(50, Number(input.factsPageSize ?? 12)));
  const matchThreshold = Math.max(50, Math.min(100, Number(input.matchThreshold ?? 90)));
  const dedupeThreshold = Math.max(50, Math.min(100, Number(input.dedupeThreshold ?? 94)));
  const categoryWeight = Math.max(0, Math.min(1, Number(input.categoryWeight ?? 0.35)));

  // attach base ranks if missing
  for (let i = 0; i < itemsIn.length; i++) {
    if (typeof itemsIn[i]?.base_rank !== "number") itemsIn[i].base_rank = i;
  }

  // 1) fetch facts across domains
  const byDomain: Record<string, number> = {};
  const factsAll: any[] = [];

  for (const d of domains) {
    const out = await factsSearch({ domain: d, query, pageSize: factsPageSize } as any);
    const got = Array.isArray(out?.items) ? out.items : [];
    byDomain[d] = got.length;
    factsAll.push(...got);
  }

  // Build lookup tables
  const factsByBarcode = new Map<string, any>();
  const factsTitle = new Array<{ k: string; f: any }>();
  const factsBrandTitle = new Array<{ k: string; f: any }>();
  const brandLexSet = new Set<string>();

  for (const f of factsAll) {
    const barcode = typeof f?.barcode === "string" ? f.barcode : (f?.barcode != null ? String(f.barcode) : "");
    if (barcode) factsByBarcode.set(barcode, f);

    const ft = normKey(f?.title || "");
    if (ft) factsTitle.push({ k: ft, f });

    const bt = titleBrandKey(f?.title || "", f?.brand || null);
    if (bt) factsBrandTitle.push({ k: bt, f });

    const b = normKey(f?.brand || "");
    if (b) brandLexSet.add(b);
  }

  const brandLex = Array.from(brandLexSet);

  // 2) match + enrich
  let matched = 0;
  let barcodeMatches = 0;
  let titleMatches = 0;
  let brandTitleMatches = 0;

  const bestScores: number[] = [];

  for (const r of itemsIn) {
    const rBarcode = typeof r?.barcode === "string" ? r.barcode : (r?.barcode != null ? String(r.barcode) : "");
    if (rBarcode && factsByBarcode.has(rBarcode)) {
      const f = factsByBarcode.get(rBarcode);
      r.categories = r.categories ?? f?.categories ?? null;
      r.factsSource = r.factsSource ?? f?.source ?? null;
      r.factsUrl = r.factsUrl ?? f?.url ?? null;
      matched++;
      barcodeMatches++;
      bestScores.push(100);
      continue;
    }

    // infer brand if missing
    if (!r?.brand) {
      const inferred = inferBrandFromTitle(r?.title || "", brandLex);
      if (inferred) r.brand = inferred;
    }

    // title-only best
    const rt = normKey(r?.title || "");
    let bestTScore = 0;
    let bestTF: any = null;

    if (rt) {
      for (const { k, f } of factsTitle) {
        const s = tokenSetSim(rt, k);
        if (s > bestTScore) {
          bestTScore = s;
          bestTF = f;
        }
      }
    }

    // allow slightly lower threshold for title-only
    const titleThresh = Math.max(80, matchThreshold - 4);
    if (bestTF && bestTScore >= titleThresh) {
      r.barcode = r.barcode ?? bestTF?.barcode ?? null;
      r.categories = r.categories ?? bestTF?.categories ?? null;
      r.factsSource = r.factsSource ?? bestTF?.source ?? null;
      r.factsUrl = r.factsUrl ?? bestTF?.url ?? null;
      matched++;
      titleMatches++;
      bestScores.push(bestTScore);
      continue;
    }

    // brand|title best
    const rk = titleBrandKey(r?.title || "", r?.brand || null);
    let bestBTScore = 0;
    let bestBTF: any = null;

    for (const { k, f } of factsBrandTitle) {
      const s = tokenSetSim(rk, k);
      if (s > bestBTScore) {
        bestBTScore = s;
        bestBTF = f;
      }
    }

    if (bestBTF && bestBTScore >= matchThreshold) {
      r.barcode = r.barcode ?? bestBTF?.barcode ?? null;
      r.categories = r.categories ?? bestBTF?.categories ?? null;
      r.factsSource = r.factsSource ?? bestBTF?.source ?? null;
      r.factsUrl = r.factsUrl ?? bestBTF?.url ?? null;
      matched++;
      brandTitleMatches++;
      bestScores.push(bestBTScore);
      continue;
    }

    bestScores.push(bestTScore || bestBTScore || 0);
  }

  const avgBestScore =
    bestScores.length > 0 ? bestScores.reduce((a, b) => a + b, 0) / bestScores.length : 0;

  // 3) dedupe: barcode first then fuzzy
  const dbgDedupe = { in: itemsIn.length, barcodeDeduped: 0, fuzzyDeduped: 0, out: 0 };

  const byBarcode = new Map<string, any>();
  const noBarcode: any[] = [];

  for (const it of itemsIn) {
    const bc = typeof it?.barcode === "string" ? it.barcode : (it?.barcode != null ? String(it.barcode) : "");
    if (bc) {
      const cur = byBarcode.get(bc);
      if (!cur) byBarcode.set(bc, it);
      else {
        byBarcode.set(bc, pickBetter(cur, it));
        dbgDedupe.barcodeDeduped++;
      }
    } else {
      noBarcode.push(it);
    }
  }

  const collapsed = [...byBarcode.values(), ...noBarcode];

  const out: any[] = [];
  for (const it of collapsed) {
    let placed = false;
    const b = titleBrandKey(it?.title || "", it?.brand || null);

    for (let j = 0; j < out.length; j++) {
      const a = titleBrandKey(out[j]?.title || "", out[j]?.brand || null);
      const s = tokenSetSim(a, b);
      if (s >= dedupeThreshold) {
        out[j] = pickBetter(out[j], it);
        dbgDedupe.fuzzyDeduped++;
        placed = true;
        break;
      }
    }

    if (!placed) out.push(it);
  }

  dbgDedupe.out = out.length;

  // 4) rerank with category score blend
  const n = out.length;
  let categoryScoreNonZero = 0;

  for (let i = 0; i < out.length; i++) {
    const it = out[i];
    const base = baseRankScore(typeof it?.base_rank === "number" ? it.base_rank : i, n);
    const cat = categoryMatchScore(query, it?.categories ?? null);
    if (cat > 0) categoryScoreNonZero++;

    it.category_score = cat;
    it.score = (1 - categoryWeight) * base + categoryWeight * cat;
  }

  out.sort((a, b) => (Number(b?.score ?? 0) - Number(a?.score ?? 0)));

  return {
    items: out,
    debug: {
      facts: {
        domains,
        pageSize: factsPageSize,
        fetched: factsAll.length,
        byDomain,
      },
      match: {
        matched,
        barcodeMatches,
        titleMatches,
        brandTitleMatches,
        avgBestScore,
      },
      dedupe: dbgDedupe,
      rerank: {
        categoryWeight,
        categoryScoreNonZero,
      },
    },
  };
}