// apps/llm/src/sales/search.ts
import { salesSearchCache } from "./cache.js";
import { rankItems } from "./rank.js";
import { womenFocusQuery } from "./suggest.js";
import { serpapiShoppingSearch } from "./providers/serpapi.js";
import { factsSearch } from "./providers/facts.js";

import {
  clamp,
  safeNum,
  makeCacheKey,
  normalizeWhitespace,
  type SalesSearchInput,
  type SalesSearchOutput,
} from "./utils.js";

import { buildLocalReason as buildLocalReasonFromUtils } from "./utils.js";

// Gemini reasons (best-effort). We alias to keep search.ts stable even if provider uses a different name.
import { geminiReasons as tryGeminiReasons } from "./providers/gemini.js";

type TriedAttempt = {
  q: string;
  ms: number;
  count: number;
  err?: string;
};

type FactsDomain = "food" | "beauty" | "products";

type FactsDebug = {
  domains: FactsDomain[];
  pageSize: number;
  fetched: number;
  byDomain: Record<string, number>;
  matched: number;
  barcodeMatches: number;
  titleMatches: number;
  fuzzyDeduped: number;
  barcodeDeduped: number;
  categoryWeight: number;
  categoryScoreNonZero: number;
  ms: number;
};

function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  const s = Number.isInteger(n)
    ? String(n)
    : n
        .toFixed(2)
        .replace(/\.0+$/, "")
        .replace(/(\.\d*[1-9])0+$/, "$1");
  return `$${s}`;
}

function buildBudgetHint(priceMin?: number, priceMax?: number): string {
  const hasMin = typeof priceMin === "number" && Number.isFinite(priceMin);
  const hasMax = typeof priceMax === "number" && Number.isFinite(priceMax);

  if (hasMin && hasMax) {
    const lo = Math.min(priceMin!, priceMax!);
    const hi = Math.max(priceMin!, priceMax!);
    return ` between ${formatMoney(lo)} and ${formatMoney(hi)}`;
  }
  if (hasMax) return ` under ${formatMoney(priceMax!)}`;
  if (hasMin) return ` over ${formatMoney(priceMin!)}`;
  return "";
}

function asFiniteNumber(x: any): number | undefined {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : undefined;
}

function uniqueStrings(xs: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    const k = normalizeWhitespace(x);
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function safeStr(x: any): string {
  return typeof x === "string" ? x : "";
}

function localReasonFallback(
  it: any,
  ctx: {
    womenFocus: boolean;
    priceMin?: number;
    priceMax?: number;
  }
): string {
  const price = typeof it?.price === "number" && Number.isFinite(it.price) ? it.price : undefined;
  const rating = typeof it?.rating === "number" && Number.isFinite(it.rating) ? it.rating : undefined;
  const reviews = typeof it?.reviews === "number" && Number.isFinite(it.reviews) ? it.reviews : undefined;
  const delivery = safeStr(it?.delivery);
  const tag = safeStr(it?.tag);

  const bits: string[] = [];

  // Subtle prefix so it reads well
  bits.push(ctx.womenFocus ? "Women-first pick:" : "Good match:");

  // Budget relevance / price
  if (price != null) bits.push(formatMoney(price));
  if (price != null && ctx.priceMax != null && price <= ctx.priceMax) bits.push(`under ${formatMoney(ctx.priceMax)}`);
  if (price != null && ctx.priceMin != null && price >= ctx.priceMin) bits.push(`meets ${formatMoney(ctx.priceMin)}+`);

  // Social proof
  if (rating != null && reviews != null && reviews > 0) {
    bits.push(`${rating.toFixed(1)}★ (${reviews.toLocaleString()} reviews)`);
  } else if (rating != null) {
    bits.push(`${rating.toFixed(1)}★`);
  }

  // Fulfillment + tag
  if (delivery) bits.push(delivery);
  if (tag) bits.push(tag);

  const reason = normalizeWhitespace(bits.filter(Boolean).join(" · "));
  if (reason) return reason;

  const source = safeStr(it?.source);
  if (source) return `Relevant match from ${source}`;
  return "Relevant match";
}

function buildLocalReason(
  it: any,
  ctx: {
    query: string;
    queryUsed: string;
    womenFocus: boolean;
    priceMin?: number;
    priceMax?: number;
  }
): string {
  try {
    const maybe = (buildLocalReasonFromUtils as any)?.(it, ctx);
    if (typeof maybe === "string" && normalizeWhitespace(maybe)) return normalizeWhitespace(maybe);
  } catch {
    // ignore
  }
  return localReasonFallback(it, {
    womenFocus: ctx.womenFocus,
    priceMin: ctx.priceMin,
    priceMax: ctx.priceMax,
  });
}

function toReasonItem(it: any) {
  return {
    title: safeStr(it?.title),
    price: typeof it?.price === "number" && Number.isFinite(it.price) ? it.price : null,
    rating: typeof it?.rating === "number" && Number.isFinite(it.rating) ? it.rating : null,
    reviews: typeof it?.reviews === "number" && Number.isFinite(it.reviews) ? it.reviews : null,
    delivery: safeStr(it?.delivery) || null,
    source: safeStr(it?.source) || null,
    tag: safeStr(it?.tag) || null,
  };
}

// ------------------------
// Facts enrichment helpers
// ------------------------

const WS = /\s+/g;
const NONALNUM = /[^a-z0-9]+/g;

const STOP = new Set([
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
  "women",
  "womens",
  "woman",
  "female",
  "women-owned",
  "women-led",
]);

function normKey(s: string): string {
  return (s || "").toLowerCase().replace(NONALNUM, " ").replace(WS, " ").trim();
}

function tokenList(s: string): string[] {
  return normKey(s)
    .split(" ")
    .map((x) => x.trim())
    .filter((x) => x && !STOP.has(x))
    .slice(0, 40);
}

function tokenSetSim(a: string, b: string): number {
  // Dice coefficient on token sets, mapped to [0..100]
  const A = new Set(tokenList(a));
  const B = new Set(tokenList(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return Math.round(((2 * inter) / (A.size + B.size)) * 100);
}

function titleBrandKey(title: string, brand?: string | null): string {
  return `${normKey(brand || "")}|${normKey(title || "")}`;
}

function baseRankScore(idx: number, n: number): number {
  if (n <= 1) return 1;
  return 1 - idx / (n - 1);
}

function categoryMatchScore(query: string, categories?: string[] | null): number {
  if (!categories || categories.length === 0) return 0;
  const q = new Set(tokenList(query));
  if (q.size === 0) return 0;
  const c = new Set(tokenList(categories.join(" ")));
  if (c.size === 0) return 0;
  let inter = 0;
  for (const x of q) if (c.has(x)) inter++;
  return Math.max(0, Math.min(1, inter / Math.max(1, q.size)));
}

function pickBetter(a: any, b: any): any {
  const hasPrice = (x: any) => (typeof x?.price === "number" && Number.isFinite(x.price) ? 1 : 0);
  const hasCats = (x: any) => (Array.isArray(x?.categories) && x.categories.length > 0 ? 1 : 0);
  const rating = (x: any) => (typeof x?.rating === "number" && Number.isFinite(x.rating) ? x.rating : 0);
  const reviews = (x: any) => (typeof x?.reviews === "number" && Number.isFinite(x.reviews) ? x.reviews : 0);
  const baseRank = (x: any) => (typeof x?.base_rank === "number" && Number.isFinite(x.base_rank) ? -x.base_rank : -10_000);
  const A = [hasPrice(a), hasCats(a), rating(a), reviews(a), baseRank(a)];
  const B = [hasPrice(b), hasCats(b), rating(b), reviews(b), baseRank(b)];
  for (let i = 0; i < A.length; i++) {
    if (A[i] > B[i]) return a;
    if (A[i] < B[i]) return b;
  }
  return a;
}

async function enrichWithFactsInline(args: {
  query: string;
  items: any[];
  domains: FactsDomain[];
  pageSize: number;
  timeoutMs: number;
  matchThreshold: number;
  dedupeThreshold: number;
  categoryWeight: number;
}): Promise<{ items: any[]; debug: FactsDebug } | null> {
  const t0 = Date.now();

  const domains = args.domains;
  const pageSize = args.pageSize;
  const byDomain: Record<string, number> = {};

  // Fetch facts across domains (best-effort). If it fails, return null (no change).
  let factsAll: any[] = [];
  try {
    const outs = await Promise.all(
      domains.map(async (d) => {
        const out = await (factsSearch as any)({ domain: d, query: args.query, pageSize }, { timeoutMs: args.timeoutMs });
        const items = Array.isArray(out?.items) ? out.items : [];
        return { d, items };
      })
    );
    for (const o of outs) {
      byDomain[o.d] = o.items.length;
      factsAll.push(...o.items);
    }
  } catch {
    return null;
  }

  // Index facts
  const factsByBarcode = new Map<string, any>();
  const factsTitle: Array<{ k: string; f: any }> = [];

  for (const f of factsAll) {
    const bc = typeof f?.barcode === "string" ? f.barcode : f?.barcode != null ? String(f.barcode) : "";
    if (bc) factsByBarcode.set(bc, f);
    const k = normKey(f?.title || "");
    if (k) factsTitle.push({ k, f });
  }

  let matched = 0;
  let barcodeMatches = 0;
  let titleMatches = 0;

  // Attach base_rank if missing (used later in scoring and dedupe tie-break)
  for (let i = 0; i < args.items.length; i++) {
    if (typeof args.items[i]?.base_rank !== "number") args.items[i].base_rank = i;
  }

  for (const r of args.items) {
    const rBc = typeof r?.barcode === "string" ? r.barcode : r?.barcode != null ? String(r.barcode) : "";
    if (rBc && factsByBarcode.has(rBc)) {
      const f = factsByBarcode.get(rBc);
      r.categories = r.categories ?? f?.categories ?? null;
      r.factsSource = r.factsSource ?? f?.source ?? null;
      r.factsUrl = r.factsUrl ?? f?.url ?? null;
      matched++;
      barcodeMatches++;
      continue;
    }

    const rt = normKey(r?.title || "");
    if (!rt) continue;

    let bestScore = 0;
    let bestF: any = null;

    for (const { k, f } of factsTitle) {
      const s = tokenSetSim(rt, k);
      if (s > bestScore) {
        bestScore = s;
        bestF = f;
      }
    }

    const titleThresh = Math.max(80, args.matchThreshold - 4);
    if (bestF && bestScore >= titleThresh) {
      r.barcode = r.barcode ?? bestF?.barcode ?? null;
      r.categories = r.categories ?? bestF?.categories ?? null;
      r.factsSource = r.factsSource ?? bestF?.source ?? null;
      r.factsUrl = r.factsUrl ?? bestF?.url ?? null;
      matched++;
      titleMatches++;
    }
  }

  // Dedupe: barcode first
  const byBarcode = new Map<string, any>();
  const noBarcode: any[] = [];
  let barcodeDeduped = 0;

  for (const it of args.items) {
    const bc = typeof it?.barcode === "string" ? it.barcode : it?.barcode != null ? String(it.barcode) : "";
    if (bc) {
      const cur = byBarcode.get(bc);
      if (!cur) byBarcode.set(bc, it);
      else {
        byBarcode.set(bc, pickBetter(cur, it));
        barcodeDeduped++;
      }
    } else {
      noBarcode.push(it);
    }
  }

  const collapsed = [...byBarcode.values(), ...noBarcode];

  // Fuzzy dedupe on title+brand
  const out: any[] = [];
  let fuzzyDeduped = 0;

  for (const it of collapsed) {
    const b = titleBrandKey(it?.title || "", it?.brand || null);
    let placed = false;

    for (let j = 0; j < out.length; j++) {
      const a = titleBrandKey(out[j]?.title || "", out[j]?.brand || null);
      const s = tokenSetSim(a, b);
      if (s >= args.dedupeThreshold) {
        out[j] = pickBetter(out[j], it);
        fuzzyDeduped++;
        placed = true;
        break;
      }
    }

    if (!placed) out.push(it);
  }

  // Rerank blend: base_rank position + category score
  const n = out.length;
  let categoryScoreNonZero = 0;
  for (let i = 0; i < out.length; i++) {
    const it = out[i];
    const base = baseRankScore(typeof it?.base_rank === "number" ? it.base_rank : i, n);
    const cat = categoryMatchScore(args.query, it?.categories ?? null);
    if (cat > 0) categoryScoreNonZero++;

    it.category_score = cat;
    it.score = (1 - args.categoryWeight) * base + args.categoryWeight * cat;
  }
  out.sort((a, b) => Number(b?.score ?? 0) - Number(a?.score ?? 0));

  const ms = Date.now() - t0;

  return {
    items: out,
    debug: {
      domains,
      pageSize,
      fetched: factsAll.length,
      byDomain,
      matched,
      barcodeMatches,
      titleMatches,
      fuzzyDeduped,
      barcodeDeduped,
      categoryWeight: args.categoryWeight,
      categoryScoreNonZero,
      ms,
    },
  };
}

export async function searchSales(input: SalesSearchInput): Promise<SalesSearchOutput> {
  const womenFocus = Boolean((input as any).womenFocus ?? true);

  const gl = typeof (input as any).gl === "string" ? (input as any).gl : process.env.SERPAPI_DEFAULT_GL ?? "us";
  const hl = typeof (input as any).hl === "string" ? (input as any).hl : process.env.SERPAPI_DEFAULT_HL ?? "en";

  const maxResults = clamp(safeNum((input as any).maxResults ?? 12, 12), 1, 30);
  const timeoutMs = clamp(safeNum((input as any).timeoutMs ?? 12_000, 12_000), 2_000, 60_000);
  const cacheTtlMs = clamp(safeNum((input as any).cacheTtlMs ?? 60_000, 60_000), 500, 10 * 60 * 1000);

  const withReasons = Boolean((input as any).withReasons ?? false);
  const reasonsMax = clamp(safeNum((input as any).reasonsMax ?? 6, 6), 0, maxResults);
  const reasonsTimeoutMs = clamp(safeNum((input as any).reasonsTimeoutMs ?? 2500, 2500), 500, 10_000);

  const debugOn = Boolean((input as any).debug ?? false);

  const q0 = normalizeWhitespace((input as any).query ?? "");
  if (!q0) throw new Error("[sales] Missing query");

  const queryUsed = womenFocus ? womenFocusQuery(q0) : q0;

  // IMPORTANT: do not pass price caps directly to provider (can yield 0 results).
  // We hint in query string + post-filter.
  const priceMin = asFiniteNumber((input as any).priceMin);
  const priceMax = asFiniteNumber((input as any).priceMax);
  const budgetHint = buildBudgetHint(priceMin, priceMax);

  const qWomenWithHint = normalizeWhitespace(`${queryUsed}${budgetHint}`);
  const qRawWithHint = normalizeWhitespace(`${q0}${budgetHint}`);

  // Facts enrichment flags (inline for now; later we can extract to providers/multi.ts)
  const withFacts = Boolean((input as any).withFacts ?? false);
  const factsPageSize = clamp(safeNum((input as any).factsPageSize ?? 12, 12), 1, 50);
  const factsTimeoutMs = clamp(safeNum((input as any).factsTimeoutMs ?? 8_000, 8_000), 1_000, 20_000);
  const categoryWeight = clamp(safeNum((input as any).categoryWeight ?? 0.35, 0.35), 0, 1);
  const factsMatchThreshold = clamp(safeNum((input as any).factsMatchThreshold ?? 90, 90), 50, 100);
  const factsDedupeThreshold = clamp(safeNum((input as any).factsDedupeThreshold ?? 94, 94), 50, 100);

  const factsDomainsRaw = (input as any).factsDomains;
  const factsDomains: FactsDomain[] = Array.isArray(factsDomainsRaw)
    ? (factsDomainsRaw.filter((x: any) => x === "food" || x === "beauty" || x === "products") as FactsDomain[])
    : (["food", "beauty", "products"] as FactsDomain[]);

  const cacheKey = makeCacheKey({
    q0,
    queryUsed,
    womenFocus,
    gl,
    hl,
    maxResults,
    priceMin: priceMin ?? null,
    priceMax: priceMax ?? null,
    withReasons,
    reasonsMax,
    withFacts,
    factsDomains: factsDomains.join(","),
    factsPageSize,
    categoryWeight,
    factsMatchThreshold,
    factsDedupeThreshold,
  });

  const cached = salesSearchCache.get(cacheKey);
  if (cached) {
    return {
      ok: true,
      queryUsed,
      womenFocus,
      count: cached.items.length,
      items: cached.items,
      debug: debugOn
        ? {
            cache: "hit",
            qRaw: q0,
            queryUsed,
            providerQuery: (cached as any)?.providerQuery ?? null,
            gl,
            hl,
            maxResults,
            priceMin: priceMin ?? null,
            priceMax: priceMax ?? null,
            withReasons,
            reasonsMax,
            withFacts,
            factsDomains,
            factsPageSize,
            categoryWeight,
            factsMatchThreshold,
            factsDedupeThreshold,
            tried: [] as TriedAttempt[],
            factsDebug: (cached as any)?.factsDebug ?? null,
          }
        : undefined,
    } as any;
  }

  const tried: TriedAttempt[] = [];
  let providerQuery: string | null = null;
  let meta: any = undefined;

  async function runOnce(q: string): Promise<any[]> {
    const t0 = Date.now();
    try {
      const { items, meta: m } = await serpapiShoppingSearch({ q, gl, hl, num: maxResults } as any, {
        timeoutMs,
      });
      const ms = Date.now() - t0;
      const arr = Array.isArray(items) ? items : [];
      tried.push({ q, ms, count: arr.length });
      meta = m ?? meta;
      return arr;
    } catch (e: any) {
      const ms = Date.now() - t0;
      const msg = String(e?.message ?? e);
      tried.push({ q, ms, count: 0, err: msg });

      if (/hasn't returned any results/i.test(msg) || /no results/i.test(msg)) return [];
      throw e;
    }
  }

  // Query ladder (deduped)
  const queries = uniqueStrings([
    womenFocus ? qWomenWithHint : qRawWithHint,
    womenFocus ? queryUsed : q0,
    qRawWithHint,
    q0,
  ]);

  let items: any[] = [];
  for (const q of queries) {
    const out = await runOnce(q);
    if (out.length > 0) {
      providerQuery = q;
      items = out;
      break;
    }
  }

  // Post-filter by price (keep items with unknown price)
  let filtered = Array.isArray(items) ? items.slice() : [];
  if (priceMin != null) filtered = filtered.filter((x) => x?.price == null || x.price >= priceMin);
  if (priceMax != null) filtered = filtered.filter((x) => x?.price == null || x.price <= priceMax);

  const rankedAll = rankItems(filtered as any, {
    priceMax,
    preferDiscount: true,
    preferWomenBrands: true,
  });
  const ranked = rankedAll.slice(0, maxResults);

  // Ensure stable base_rank for downstream facts/dedupe/rerank
  const rankedWithBase = ranked.map((it: any, idx: number) => {
    if (typeof it?.base_rank === "number") return it;
    return { ...it, base_rank: idx };
  });

  // Optional facts enrichment + dedupe + category rerank (best-effort)
  let factsDebug: FactsDebug | null = null;
  let afterFacts: any[] = rankedWithBase;

  if (withFacts) {
    try {
      const enriched = await enrichWithFactsInline({
        query: q0,
        items: rankedWithBase,
        domains: factsDomains.length ? factsDomains : (["food", "beauty", "products"] as FactsDomain[]),
        pageSize: factsPageSize,
        timeoutMs: factsTimeoutMs,
        matchThreshold: factsMatchThreshold,
        dedupeThreshold: factsDedupeThreshold,
        categoryWeight,
      });

      if (enriched) {
        factsDebug = enriched.debug;
        afterFacts = enriched.items.slice(0, maxResults);
      }
    } catch {
      // keep base results
    }
  }

  // Reasons (best-effort):
  // - attach deterministic local reason to all
  // - optionally upgrade top N with Gemini
  let finalItems: any[] = afterFacts;

  if (withReasons) {
    const locallyReasoned = afterFacts.map((it: any) => {
      const reason = buildLocalReason(it, {
        query: q0,
        queryUsed,
        womenFocus,
        priceMin,
        priceMax,
      });
      return reason ? { ...it, reason } : it;
    });

    if (reasonsMax > 0) {
      try {
        const top = locallyReasoned.slice(0, reasonsMax);

        // The provider may return an array of strings (parallel to the provided items)
        const gemini = await (tryGeminiReasons as any)({
          items: top.map(toReasonItem),
          userContext: {
            query: q0,
            womenFocus,
            budgetMax: priceMax ?? undefined,
          },
          timeoutMs: reasonsTimeoutMs,
        });

        if (Array.isArray(gemini) && gemini.length > 0) {
          finalItems = locallyReasoned.map((it: any, idx: number) => {
            if (idx >= reasonsMax) return it;
            const r = normalizeWhitespace(gemini[idx] ?? "");
            return r ? { ...it, reason: r } : it;
          });
        } else {
          finalItems = locallyReasoned;
        }
      } catch {
        finalItems = locallyReasoned;
      }
    } else {
      finalItems = locallyReasoned;
    }
  }

  salesSearchCache.set(cacheKey, { items: finalItems, providerQuery, factsDebug } as any, cacheTtlMs);

  return {
    ok: true,
    queryUsed,
    womenFocus,
    count: finalItems.length,
    items: finalItems as any,
    debug: debugOn
      ? {
          cache: "miss",
          qRaw: q0,
          queryUsed,
          providerQuery,
          providerQueryHinted: womenFocus ? qWomenWithHint : qRawWithHint,
          gl,
          hl,
          maxResults,
          priceMin: priceMin ?? null,
          priceMax: priceMax ?? null,
          withReasons,
          reasonsMax,
          withFacts,
          factsDomains,
          factsPageSize,
          categoryWeight,
          factsMatchThreshold,
          factsDedupeThreshold,
          factsDebug,
          tried,
          meta,
          providerDebug: meta?.providerDebug ?? meta?.debug ?? undefined,
        }
      : undefined,
  } as any;
}


