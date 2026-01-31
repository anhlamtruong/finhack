// apps/llm/src/sales/rank.ts
import { type SaleItem } from "./utils.js";

type RankOpts = {
  priceMax?: number;
  preferDiscount?: boolean;
  preferWomenBrands?: boolean; // placeholder for future (when we have brand metadata)
};

function discountPct(item: SaleItem): number {
  if (item.price != null && item.originalPrice != null && item.originalPrice > 0) {
    const pct = (item.originalPrice - item.price) / item.originalPrice;
    return Math.max(0, Math.min(1, pct));
  }
  return 0;
}

function score(item: SaleItem, opts: RankOpts) {
  let s = 0;

  // Price known is better than unknown
  if (item.price != null) s += 2;

  // Prefer within budget
  if (opts.priceMax != null && item.price != null) {
    if (item.price <= opts.priceMax) s += 3;
    else s -= 3;
  }

  // Prefer higher discount when available
  const d = discountPct(item);
  if (opts.preferDiscount ?? true) s += d * 4;

  // Social proof (soft)
  const rating = item.rating ?? 0;
  const reviews = item.reviews ?? 0;
  s += Math.max(0, rating - 3) * 0.6;
  s += Math.log10(reviews + 1) * 0.4;

  // Small boost if merchant exists
  if (item.source) s += 0.2;

  return s;
}

export function rankItems(items: SaleItem[], opts: RankOpts): SaleItem[] {
  return [...items].sort((a, b) => score(b, opts) - score(a, opts));
}