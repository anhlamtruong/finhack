// apps/llm/src/sales/cache.ts
import { clamp, safeNum } from "./utils.js";

type CacheEntry<V> = { value: V; expiresAt: number };

export class TtlCache<K, V> {
  private map = new Map<K, CacheEntry<V>>();

  constructor(private defaultTtlMs: number) {}

  get(key: K): V | null {
    const e = this.map.get(key);
    if (!e) return null;
    if (Date.now() > e.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return e.value;
  }

  set(key: K, value: V, ttlMs?: number) {
    const ttl = clamp(safeNum(ttlMs ?? this.defaultTtlMs, this.defaultTtlMs), 500, 10 * 60 * 1000);
    this.map.set(key, { value, expiresAt: Date.now() + ttl });
  }

  size() {
    return this.map.size;
  }

  clear() {
    this.map.clear();
  }
}

// shared cache for sales searches (in-memory)
export const salesSearchCache = new TtlCache<string, any>(60_000);