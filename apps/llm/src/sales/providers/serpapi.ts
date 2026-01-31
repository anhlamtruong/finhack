// apps/llm/src/sales/providers/serpapi.ts
import { mustEnv, clamp, safeNum, type SaleItem } from "../utils.js";

type SerpApiArgs = {
  q: string;
  gl: string;
  hl: string;
  num: number;
  minPrice?: number;
  maxPrice?: number;
};

type SerpApiResponse = {
  shopping_results?: any[];
  inline_shopping_results?: any[];
  search_metadata?: any;
  error?: string;
};

function pickNum(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function pickString(...vals: any[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function pickUrl(x: any): string | null {
  // SerpAPI shopping results can have different URL fields depending on layout/engine
  const url =
    pickString(
      x?.link,
      x?.product_link,
      x?.productLink,
      x?.serpapi_product_api,
      x?.serpapi_link
    ) ?? null;

  if (!url) return null;
  // Keep as-is; can be Google redirect or direct merchant link
  return url;
}

function mapItem(x: any): SaleItem | null {
  const title =
    pickString(x?.title, x?.product_title, x?.name, x?.product_name) ?? null;
  const url = pickUrl(x);

  if (!title || !url) return null;

  // SerpAPI commonly provides both text + extracted numerics
  const price = pickNum(x?.extracted_price);
  const originalPrice = pickNum(x?.extracted_original_price);

  return {
    title,
    url,
    source: pickString(x?.source, x?.seller, x?.merchant, x?.store_name),
    brand: pickString(x?.brand),
    image: pickString(x?.thumbnail, x?.image, x?.image_url),

    priceText: pickString(x?.price),
    price,

    originalPriceText: pickString(x?.original_price),
    originalPrice,

    discountText: pickString(x?.discount),
    rating: pickNum(x?.rating),
    reviews: pickNum(x?.reviews),

    delivery: pickString(x?.delivery),
    tag: pickString(x?.tag),
  };
}

export async function serpapiShoppingSearch(
  args: SerpApiArgs,
  opts?: { timeoutMs?: number }
): Promise<{ items: SaleItem[]; meta?: any; debug?: any }> {
  const apiKey = mustEnv("SERPAPI_API_KEY");
  const engine = process.env.SERPAPI_DEFAULT_ENGINE || "google_shopping";

  const u = new URL("https://serpapi.com/search.json");
  u.searchParams.set("api_key", apiKey);
  u.searchParams.set("engine", engine);
  u.searchParams.set("q", args.q);
  u.searchParams.set("gl", args.gl);
  u.searchParams.set("hl", args.hl);
  u.searchParams.set("num", String(args.num));

  // best-effort min/max
  if (Number.isFinite(args.minPrice as any)) u.searchParams.set("min_price", String(args.minPrice));
  if (Number.isFinite(args.maxPrice as any)) u.searchParams.set("max_price", String(args.maxPrice));

  const timeoutMs = clamp(safeNum(opts?.timeoutMs ?? 12000, 12000), 2000, 60000);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(u.toString(), { method: "GET", signal: controller.signal });
    const json = (await resp.json().catch(() => ({}))) as SerpApiResponse;

    if (!resp.ok) {
      const msg =
        (json as any)?.error ||
        (json as any)?.search_metadata?.error ||
        `SerpAPI error ${resp.status}`;
      throw new Error(`[sales] ${msg}`);
    }

    if ((json as any)?.error) {
      throw new Error(`[sales] SerpAPI error: ${(json as any).error}`);
    }

    const rawA = Array.isArray((json as any).shopping_results) ? (json as any).shopping_results : [];
    const rawB = Array.isArray((json as any).inline_shopping_results) ? (json as any).inline_shopping_results : [];
    const raw = rawA.length ? rawA : rawB;

    const mapped = raw.map(mapItem);
    const items = mapped.filter(Boolean) as SaleItem[];

    return {
      items,
      meta: json.search_metadata,
      debug: {
        engine,
        rawCount: raw.length,
        mappedCount: items.length,
        droppedCount: raw.length - items.length,
        usedField: rawA.length ? "shopping_results" : "inline_shopping_results",
      },
    };
  } catch (e: any) {
    const msg = String(e?.message ?? "SerpAPI request failed");
    if (/aborted|abort/i.test(msg)) throw new Error(`[sales] SerpAPI timeout after ${timeoutMs}ms`);
    throw e;
  } finally {
    clearTimeout(t);
  }
}