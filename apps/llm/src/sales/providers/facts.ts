// apps/llm/src/sales/providers/facts.ts
// Unified client for:
// - Open Food Facts:     https://world.openfoodfacts.org
// - Open Beauty Facts:   https://world.openbeautyfacts.org
// - Open Products Facts: https://world.openproductsfacts.org
//
// Uses API v2 search. Keep requests LOW: OFF-style search is rate-limited.  [oai_citation:2‡Open Food Facts](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/)

export type FactsDomain = "food" | "beauty" | "products";

export type FactsSearchInput = {
  domain: FactsDomain;
  query: string;
  pageSize?: number;      // default 10
  timeoutMs?: number;     // default 6000
};

export type FactsItem = {
  title: string;
  brand?: string | null;
  image?: string | null;
  url?: string | null;         // canonical product page (not retail link)
  source: string;              // e.g. "OpenFoodFacts"
  // Optional enrichment:
  barcode?: string | null;
  categories?: string[] | null;
};

export type FactsSearchOutput = {
  ok: true;
  items: FactsItem[];
  meta: {
    domain: FactsDomain;
    host: string;
    api: "product-opener-v2";
    count: number;
  };
};

// --- hosts ---
const HOSTS: Record<FactsDomain, { host: string; source: string }> = {
  food: { host: "https://world.openfoodfacts.org", source: "OpenFoodFacts" },
  beauty: { host: "https://world.openbeautyfacts.org", source: "OpenBeautyFacts" },
  products: { host: "https://world.openproductsfacts.org", source: "OpenProductsFacts" },
};

// --- tiny in-memory cache (keeps you safe on rate limits) ---
type CacheEntry<T> = { expiresAt: number; value: T };
const cache = new Map<string, CacheEntry<FactsSearchOutput>>();
const DEFAULT_TTL_MS = 60_000; // 1 min: enough to avoid spam while iterating

function nowMs() {
  return Date.now();
}

function norm(s: string) {
  return String(s ?? "").trim().replace(/\s+/g, " ");
}

function cacheKey(inp: FactsSearchInput) {
  return `facts:v1:${inp.domain}:${norm(inp.query).toLowerCase()}:${inp.pageSize ?? 10}`;
}

function getCached(key: string) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= nowMs()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function setCached(key: string, value: FactsSearchOutput, ttlMs = DEFAULT_TTL_MS) {
  cache.set(key, { expiresAt: nowMs() + ttlMs, value });
  // small cap
  if (cache.size > 200) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
}

// --- fetch helper with timeout ---
async function fetchJson(url: string, timeoutMs: number): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  // OFF asks for identifiable user-agent.  [oai_citation:3‡Open Food Facts](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/)
  const ua =
    process.env.FACTS_USER_AGENT ||
    process.env.SERPAPI_USER_AGENT ||
    "ChuchubeFinance/0.1 (dev@local)";

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": ua,
        "Accept": "application/json",
      },
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`[facts] HTTP ${res.status} ${res.statusText} ${text}`.slice(0, 500));
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// --- mapping ---
function pickBestImage(p: any): string | null {
  // OFF payloads vary; try common keys
  const candidates = [
    p?.image_url,
    p?.image_front_url,
    p?.image_small_url,
    p?.image_front_small_url,
  ].filter((x: any) => typeof x === "string" && x.startsWith("http"));
  return candidates[0] ?? null;
}

function toFactsItem(p: any, source: string, host: string): FactsItem | null {
  const title =
    typeof p?.product_name === "string"
      ? p.product_name
      : typeof p?.product_name_en === "string"
        ? p.product_name_en
        : typeof p?.generic_name === "string"
          ? p.generic_name
          : "";

  const cleanTitle = norm(title);
  if (!cleanTitle) return null;

  const code = typeof p?.code === "string" ? p.code : null;

  // canonical product page
  const url = code ? `${host}/product/${encodeURIComponent(code)}` : null;

  const brand =
    typeof p?.brands === "string" ? norm(p.brands) :
    typeof p?.brand_owner === "string" ? norm(p.brand_owner) :
    null;

  const categories =
    typeof p?.categories_tags === "object" && Array.isArray(p.categories_tags)
      ? p.categories_tags.slice(0, 8).map((x: any) => String(x))
      : null;

  return {
    title: cleanTitle,
    brand,
    image: pickBestImage(p),
    url,
    source,
    barcode: code,
    categories,
  };
}

/**
 * Search across one Facts domain.
 * Uses /api/v2/search which is rate-limited, so we cache aggressively.  [oai_citation:4‡Open Food Facts](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/)
 */
export async function factsSearch(input: FactsSearchInput): Promise<FactsSearchOutput> {
  const domain = input.domain;
  const query = norm(input.query);
  if (!query) throw new Error("[facts] Missing query");

  const pageSize = Math.min(Math.max(Number(input.pageSize ?? 10), 1), 24);
  const timeoutMs = Math.min(Math.max(Number(input.timeoutMs ?? 6000), 500), 20_000);

  const { host, source } = HOSTS[domain];
  const key = cacheKey({ domain, query, pageSize });

  const cached = getCached(key);
  if (cached) return cached;

  // Keep it simple and robust: text search.
  // OFF supports many parameters; we can expand later (facets, categories, etc.).
  const url =
    `${host}/api/v2/search?` +
    new URLSearchParams({
      search_terms: query,
      page_size: String(pageSize),
      // Keep fields small to reduce latency
      fields: [
        "code",
        "product_name",
        "product_name_en",
        "generic_name",
        "brands",
        "brand_owner",
        "image_url",
        "image_front_url",
        "image_small_url",
        "image_front_small_url",
        "categories_tags",
      ].join(","),
    }).toString();

  const json = await fetchJson(url, timeoutMs);

  const products: any[] = Array.isArray(json?.products) ? json.products : [];
  const items: FactsItem[] = [];

  for (const p of products) {
    const it = toFactsItem(p, source, host);
    if (it) items.push(it);
  }

  const out: FactsSearchOutput = {
    ok: true,
    items,
    meta: {
      domain,
      host,
      api: "product-opener-v2",
      count: items.length,
    },
  };

  setCached(key, out);
  return out;
}