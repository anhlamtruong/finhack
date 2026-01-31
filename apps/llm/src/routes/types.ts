export type SalesSource = "serpapi" | "rakuten" | "amazon";

export type Deal = {
  id: string; // stable-ish (hash)
  title: string;
  brand?: string | null;
  price?: number | null;
  originalPrice?: number | null;
  currency?: string | null;
  discountPercent?: number | null;

  imageUrl?: string | null;
  productUrl: string;

  source: SalesSource;
  categoryHint?: string | null;

  // “women empowerment” hooks (initially heuristic + curated lists)
  womenTags?: string[];
  womenOwnedScore?: number; // 0..1

  lastSeenIso: string;
};

export type SalesSearchRequest = {
  userId: string;
  query: string;
  maxResults: number;
  priceMax?: number;
  sources: SalesSource[];
  womenFocus: boolean;
};

export type SalesSearchResponse = {
  query: string;
  sources: SalesSource[];
  deals: Deal[];
  debug: {
    usedCache: boolean;
    providerCounts: Record<string, number>;
  };
};