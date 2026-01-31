#!/usr/bin/env python3
"""\
merge_multi.py

Merge + dedupe + re-rank:
- Retail items from TS endpoint (/v1/sales/search) (SerpAPI-backed)
- Facts items from Open Food/Beauty/Products Facts (Product Opener v2)

Great libraries:
- httpx: fast HTTP client
- rapidfuzz: fuzzy matching (very fast)
- diskcache: simple persistent cache (saves rate limits)
- rich: nice CLI output
- (optional) scikit-learn: TF-IDF cosine similarity for category matching

Notes:
- Open*Facts endpoints are public; please send a valid User-Agent (no trailing spaces)
  with contact info when possible.
"""

from __future__ import annotations

import asyncio
import json
import math
import re
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import httpx
import typer
from pydantic import BaseModel, Field
from rapidfuzz import fuzz
from rapidfuzz import process as rf_process
from rich.console import Console
from rich.table import Table

try:
    from diskcache import Cache
except Exception:
    Cache = None  # type: ignore

# Optional: better category similarity
try:
    from sklearn.feature_extraction.text import TfidfVectorizer  # type: ignore
    from sklearn.metrics.pairwise import cosine_similarity  # type: ignore

    SKLEARN_OK = True
except Exception:
    SKLEARN_OK = False


app = typer.Typer(add_completion=False)
console = Console()


# -----------------------------
# Config for Product Opener v2
# -----------------------------
FACTS_HOSTS: Dict[str, Tuple[str, str]] = {
    "food": ("https://world.openfoodfacts.org", "OpenFoodFacts"),
    "beauty": ("https://world.openbeautyfacts.org", "OpenBeautyFacts"),
    "products": ("https://world.openproductsfacts.org", "OpenProductsFacts"),
}


# -----------------------------
# Models
# -----------------------------
class RetailItem(BaseModel):
    title: str = ""
    url: Optional[str] = None
    source: Optional[str] = None
    brand: Optional[str] = None
    image: Optional[str] = None
    price: Optional[float] = None
    priceText: Optional[str] = None
    rating: Optional[float] = None
    reviews: Optional[int] = None
    delivery: Optional[str] = None
    tag: Optional[str] = None
    reason: Optional[str] = None  # from TS / Gemini/local

    # Enrichment fields we’ll add:
    barcode: Optional[str] = None
    categories: Optional[List[str]] = None
    factsSource: Optional[str] = None
    factsUrl: Optional[str] = None

    # internal scoring
    base_rank: Optional[int] = None
    score: Optional[float] = None
    category_score: Optional[float] = None


class FactsItem(BaseModel):
    title: str
    brand: Optional[str] = None
    image: Optional[str] = None
    url: Optional[str] = None
    source: str
    barcode: Optional[str] = None
    categories: Optional[List[str]] = None


class MergeOutput(BaseModel):
    ok: bool = True
    query: str
    merged_count: int
    merged: List[RetailItem]
    debug: Dict[str, Any] = Field(default_factory=dict)


# -----------------------------
# Helpers: normalization & scoring
# -----------------------------
_WS = re.compile(r"\s+")
_NONALNUM = re.compile(r"[^a-z0-9]+")

STOPWORDS = {
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
    "first",
    "period",
    "menstrual",
    "care",
    "essentials",
}


def norm_ws(s: str) -> str:
    return _WS.sub(" ", (s or "").strip())


def norm_key(s: str) -> str:
    s = (s or "").lower()
    s = _NONALNUM.sub(" ", s)
    s = norm_ws(s)
    return s


def token_set(s: str) -> List[str]:
    toks = [t for t in norm_key(s).split(" ") if t and t not in STOPWORDS]
    return toks[:40]


def title_brand_key(title: str, brand: Optional[str]) -> str:
    return f"{norm_key(brand or '')}|{norm_key(title)}"


def safe_float(x: Any) -> Optional[float]:
    try:
        if x is None:
            return None
        n = float(x)
        if math.isfinite(n):
            return n
        return None
    except Exception:
        return None


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def base_rank_score(idx: int, n: int) -> float:
    """Keep TS ranking as baseline; earlier items get higher score."""
    if n <= 1:
        return 1.0
    return 1.0 - (idx / (n - 1))


def category_match_score(query: str, categories: Optional[List[str]]) -> float:
    """Category score in [0,1]."""
    if not categories:
        return 0.0

    cat_text = " ".join(categories)
    q = norm_ws(query)

    if SKLEARN_OK:
        try:
            vec = TfidfVectorizer(ngram_range=(1, 2), min_df=1)
            X = vec.fit_transform([q, cat_text])
            sim = float(cosine_similarity(X[0], X[1])[0][0])
            return clamp(sim, 0.0, 1.0)
        except Exception:
            pass

    # fallback: token overlap
    qt = set(token_set(q))
    ct = set(token_set(cat_text))
    if not qt or not ct:
        return 0.0
    overlap = len(qt & ct)
    denom = max(len(qt), 1)
    return clamp(overlap / denom, 0.0, 1.0)


# -----------------------------
# Caching (avoid OFF rate limits)
# -----------------------------
@dataclass
class Cacher:
    cache: Any = None

    def get(self, k: str):
        if self.cache is None:
            return None
        try:
            return self.cache.get(k)
        except Exception:
            return None

    def set(self, k: str, v: Any, ttl: int = 60):
        if self.cache is None:
            return
        try:
            self.cache.set(k, v, expire=ttl)
        except Exception:
            pass


# -----------------------------
# HTTP helpers (retries)
# -----------------------------
async def _request_with_retries(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    *,
    headers: Optional[Dict[str, str]] = None,
    params: Optional[Dict[str, Any]] = None,
    json_body: Optional[Dict[str, Any]] = None,
    timeout: float = 20.0,
    max_retries: int = 3,
    backoff_base: float = 0.6,
) -> httpx.Response:
    """Retry on 429 + transient 5xx + network errors."""
    last_err: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        try:
            resp = await client.request(
                method,
                url,
                headers=headers,
                params=params,
                json=json_body,
                timeout=timeout,
                follow_redirects=True,
            )

            if resp.status_code in (429, 500, 502, 503, 504):
                # let it retry
                if attempt < max_retries:
                    await asyncio.sleep(backoff_base * (2**attempt))
                    continue
            resp.raise_for_status()
            return resp
        except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError) as e:
            last_err = e
            # HTTPStatusError already includes status; we only retry for transient above
            if isinstance(e, httpx.HTTPStatusError):
                # if not transient, stop
                status = e.response.status_code
                if status not in (429, 500, 502, 503, 504):
                    raise
            if attempt < max_retries:
                await asyncio.sleep(backoff_base * (2**attempt))
                continue
            raise

    # should never get here
    if last_err:
        raise last_err
    raise RuntimeError("request failed")


def _safe_user_agent(ua: str) -> str:
    # HTTP headers cannot end with whitespace; httpx/h11 rejects trailing spaces.
    ua = (ua or "").strip()
    if not ua:
        ua = "ChuchubeFinance/0.1"
    # also avoid newlines
    ua = ua.replace("\r", " ").replace("\n", " ")
    return ua.strip()


# -----------------------------
# Fetchers
# -----------------------------
async def fetch_retail(
    client: httpx.AsyncClient,
    base_url: str,
    query: str,
    women_focus: bool,
    max_results: int,
    price_max: Optional[float],
    with_reasons: bool,
    reasons_max: int,
    retail_timeout_s: float = 25.0,
) -> List[RetailItem]:
    url = f"{base_url.rstrip('/')}/v1/sales/search"
    payload: Dict[str, Any] = {
        "query": query,
        "womenFocus": women_focus,
        "maxResults": max_results,
        "gl": "us",
        "hl": "en",
    }
    if price_max is not None:
        payload["priceMax"] = price_max
    if with_reasons:
        payload["withReasons"] = True
        payload["reasonsMax"] = reasons_max

    r = await _request_with_retries(
        client,
        "POST",
        url,
        json_body=payload,
        timeout=retail_timeout_s,
        max_retries=2,
        backoff_base=0.4,
    )
    js = r.json()
    items = js.get("items") or []
    out: List[RetailItem] = []
    for i, it in enumerate(items):
        ri = RetailItem(**it)
        ri.base_rank = i
        out.append(ri)
    return out


async def fetch_facts_domain(
    client: httpx.AsyncClient,
    domain: str,
    query: str,
    page_size: int,
    ua: str,
    cacher: Cacher,
    cache_ttl_s: int = 300,
    facts_timeout_s: float = 20.0,
) -> List[FactsItem]:
    host, source = FACTS_HOSTS[domain]
    q = norm_ws(query)
    cache_key = f"facts:v2:{domain}:{q.lower()}:{page_size}"

    cached = cacher.get(cache_key)
    if cached:
        try:
            return [FactsItem(**x) for x in cached]
        except Exception:
            # corrupted cache entry
            pass

    params = {
        "search_terms": q,
        "page_size": str(page_size),
        "fields": ",".join(
            [
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
            ]
        ),
    }

    url = f"{host}/api/v2/search"
    headers = {"User-Agent": _safe_user_agent(ua), "Accept": "application/json"}

    r = await _request_with_retries(
        client,
        "GET",
        url,
        params=params,
        headers=headers,
        timeout=facts_timeout_s,
        max_retries=3,
        backoff_base=0.6,
    )

    js = r.json()
    products = js.get("products") or []

    def pick_title(p: Dict[str, Any]) -> str:
        return norm_ws(p.get("product_name") or p.get("product_name_en") or p.get("generic_name") or "")

    def pick_brand(p: Dict[str, Any]) -> Optional[str]:
        b = p.get("brands") or p.get("brand_owner")
        b = norm_ws(b or "")
        return b or None

    def pick_img(p: Dict[str, Any]) -> Optional[str]:
        for k in ("image_url", "image_front_url", "image_small_url", "image_front_small_url"):
            v = p.get(k)
            if isinstance(v, str) and v.startswith("http"):
                return v
        return None

    out: List[FactsItem] = []
    for p in products:
        title = pick_title(p)
        if not title:
            continue
        code = p.get("code")
        code = str(code) if code is not None else None
        facts_url = f"{host}/product/{code}" if code else None
        cats = p.get("categories_tags")
        cats = cats[:8] if isinstance(cats, list) else None
        out.append(
            FactsItem(
                title=title,
                brand=pick_brand(p),
                image=pick_img(p),
                url=facts_url,
                source=source,
                barcode=code,
                categories=cats,
            )
        )

    cacher.set(cache_key, [x.model_dump() for x in out], ttl=cache_ttl_s)
    return out


async def fetch_facts_all_domains(
    query: str,
    domains: List[str],
    page_size: int,
    ua: str,
    cacher: Cacher,
    cache_ttl_s: int = 300,
    facts_timeout_s: float = 20.0,
    concurrency: int = 3,
) -> List[FactsItem]:
    """Fetch facts from domains concurrently (bounded)."""

    sem = asyncio.Semaphore(max(1, concurrency))

    async def _one(d: str, client: httpx.AsyncClient) -> List[FactsItem]:
        async with sem:
            return await fetch_facts_domain(
                client,
                d,
                query,
                page_size,
                ua,
                cacher,
                cache_ttl_s=cache_ttl_s,
                facts_timeout_s=facts_timeout_s,
            )

    async with httpx.AsyncClient() as client:
        tasks = [_one(d, client) for d in domains]
        chunks = await asyncio.gather(*tasks)

    items: List[FactsItem] = []
    for ch in chunks:
        items.extend(ch)
    return items


# -----------------------------
# Merge logic
# -----------------------------
def match_facts_to_retail(
    retail: List[RetailItem],
    facts: List[FactsItem],
    fuzz_threshold: int = 92,
) -> Tuple[List[RetailItem], Dict[str, Any]]:
    """
    Enrich retail items with facts data.

    Matching:
    1) barcode exact (if retail has barcode)
    2) title-only fuzzy match (strong for brands embedded in title)
    3) brand|title fuzzy match (if brand is available/inferred)
    """
    dbg = {
        "facts_total": len(facts),
        "matched": 0,
        "barcode_matches": 0,
        "title_matches": 0,
        "brand_title_matches": 0,
        "avg_best_score": 0.0,
    }

    # Index facts by barcode
    facts_by_barcode: Dict[str, FactsItem] = {}
    for f in facts:
        if f.barcode:
            facts_by_barcode[str(f.barcode)] = f

    # Build facts search tables
    facts_title: List[Tuple[str, FactsItem]] = []
    facts_brand_title: List[Tuple[str, FactsItem]] = []
    brand_lex = set()

    for f in facts:
        ft = norm_key(f.title)
        if not ft:
            continue
        facts_title.append((ft, f))

        bt = title_brand_key(f.title, f.brand)
        facts_brand_title.append((bt, f))

        if f.brand:
            brand_lex.add(norm_key(f.brand))

    def infer_brand_from_title(title: str) -> Optional[str]:
        # very light inference: if any facts brand appears as substring in title, use it
        t = norm_key(title)
        if not t:
            return None
        for b in brand_lex:
            if b and b in t:
                return b
        return None

    best_scores: List[int] = []

    for r in retail:
        # 1) barcode match
        if r.barcode and str(r.barcode) in facts_by_barcode:
            f = facts_by_barcode[str(r.barcode)]
            r.categories = f.categories
            r.factsSource = f.source
            r.factsUrl = f.url
            dbg["matched"] += 1
            dbg["barcode_matches"] += 1
            best_scores.append(100)
            continue

        # infer brand if missing
        if not r.brand:
            b = infer_brand_from_title(r.title)
            if b:
                r.brand = b  # store normalized-ish brand string

        # 2) title-only fuzzy
        rt = norm_key(r.title)
        best_t: Optional[Tuple[int, FactsItem]] = None
        if rt:
            for ft, f in facts_title:
                score = fuzz.token_set_ratio(rt, ft)
                if best_t is None or score > best_t[0]:
                    best_t = (score, f)

        # title-only threshold slightly lower because it’s less constrained
        if best_t and best_t[0] >= max(88, fuzz_threshold - 4):
            f = best_t[1]
            r.barcode = r.barcode or f.barcode
            r.categories = r.categories or f.categories
            r.factsSource = f.source
            r.factsUrl = f.url
            dbg["matched"] += 1
            dbg["title_matches"] += 1
            best_scores.append(best_t[0])
            continue

        # 3) brand|title fuzzy
        rk = title_brand_key(r.title, r.brand)
        best_bt: Optional[Tuple[int, FactsItem]] = None
        for fk, f in facts_brand_title:
            score = fuzz.token_set_ratio(rk, fk)
            if best_bt is None or score > best_bt[0]:
                best_bt = (score, f)

        if best_bt and best_bt[0] >= fuzz_threshold:
            f = best_bt[1]
            r.barcode = r.barcode or f.barcode
            r.categories = r.categories or f.categories
            r.factsSource = f.source
            r.factsUrl = f.url
            dbg["matched"] += 1
            dbg["brand_title_matches"] += 1
            best_scores.append(best_bt[0])
            continue

        best_scores.append(best_t[0] if best_t else 0)

    if best_scores:
        dbg["avg_best_score"] = sum(best_scores) / len(best_scores)

    return retail, dbg

def pick_better(a: RetailItem, b: RetailItem) -> RetailItem:
    """Choose “better” item between duplicates."""

    def key(x: RetailItem):
        has_price = 1 if (x.price is not None) else 0
        has_cat = 1 if (x.categories and len(x.categories) > 0) else 0
        rating = x.rating or 0.0
        reviews = x.reviews or 0
        base_rank = -(x.base_rank if x.base_rank is not None else 10_000)  # earlier is better
        return (has_price, has_cat, rating, reviews, base_rank)

    return a if key(a) >= key(b) else b


def dedupe_merged(
    items: List[RetailItem],
    fuzz_threshold: int = 94,
) -> Tuple[List[RetailItem], Dict[str, Any]]:
    """\
    Remove duplicates in merged retail list:
    - Prefer items with price known, higher rating, more reviews, has categories.
    - Dedup by (barcode) if present, else fuzzy title+brand.
    """

    dbg = {"in": len(items), "barcode_deduped": 0, "fuzzy_deduped": 0, "out": 0}

    # 1) barcode dedupe
    by_barcode: Dict[str, RetailItem] = {}
    no_barcode: List[RetailItem] = []
    for it in items:
        if it.barcode:
            cur = by_barcode.get(it.barcode)
            if cur is None:
                by_barcode[it.barcode] = it
            else:
                by_barcode[it.barcode] = pick_better(cur, it)
                dbg["barcode_deduped"] += 1
        else:
            no_barcode.append(it)

    collapsed = list(by_barcode.values()) + no_barcode

    # 2) fuzzy dedupe on remaining no-barcode items
    out: List[RetailItem] = []
    out_keys: List[str] = []

    for it in collapsed:
        k = title_brand_key(it.title, it.brand)
        if not out:
            out.append(it)
            out_keys.append(k)
            continue

        hit = rf_process.extractOne(k, out_keys, scorer=fuzz.token_set_ratio)
        if hit and hit[1] >= fuzz_threshold:
            idx = int(hit[2])
            out[idx] = pick_better(out[idx], it)
            dbg["fuzzy_deduped"] += 1
        else:
            out.append(it)
            out_keys.append(k)

    dbg["out"] = len(out)
    return out, dbg


def rerank(
    items: List[RetailItem],
    query: str,
    category_weight: float = 0.35,
) -> List[RetailItem]:
    """
    Keep TS ranking as base score, adjust with category match.
    Final score = (1-category_weight)*base + category_weight*catScore
    """
    n = len(items)
    for i, it in enumerate(items):
        # base_rank might be larger than n-1 after dedupe -> clamp it
        idx = it.base_rank if it.base_rank is not None else i
        if n > 0:
            idx = int(max(0, min(idx, n - 1)))

        base = base_rank_score(idx, n)
        cat = category_match_score(query, it.categories)
        it.category_score = cat
        it.score = (1.0 - category_weight) * base + category_weight * cat

    items.sort(key=lambda x: (x.score or 0.0), reverse=True)
    return items

# -----------------------------
# CLI
# -----------------------------
@app.command()
def run(
    query: str = typer.Option(..., "--query", "-q"),
    base_url: str = typer.Option("http://127.0.0.1:8080", "--base-url"),
    women_focus: bool = typer.Option(True, "--women-focus/--no-women-focus"),
    max_results: int = typer.Option(12, "--max-results"),
    price_max: Optional[float] = typer.Option(None, "--price-max"),
    with_reasons: bool = typer.Option(True, "--with-reasons/--no-with-reasons"),
    reasons_max: int = typer.Option(6, "--reasons-max"),
    facts_page_size: int = typer.Option(12, "--facts-page-size"),
    category_weight: float = typer.Option(0.35, "--category-weight"),
    fuzz_threshold_match: int = typer.Option(92, "--fuzz-match"),
    fuzz_threshold_dedupe: int = typer.Option(94, "--fuzz-dedupe"),
    out: str = typer.Option("merged_sales.json", "--out"),
    use_cache: bool = typer.Option(True, "--cache/--no-cache"),
    facts_cache_ttl: int = typer.Option(300, "--facts-cache-ttl", help="Facts cache TTL seconds"),
    facts_timeout_s: float = typer.Option(20.0, "--facts-timeout", help="Facts request timeout seconds"),
    retail_timeout_s: float = typer.Option(25.0, "--retail-timeout", help="Retail endpoint timeout seconds"),
    domains: str = typer.Option("food,beauty,products", "--domains", help="Comma-separated: food,beauty,products"),
    ua: str = typer.Option(
        "ChuchubeFinance/0.1 (dev@local; contact=dev@local)",
        "--ua",
        help="User-Agent for Open*Facts (no trailing spaces).",
    ),
):
    """Merge TS retail + Facts enrichment, dedupe, rerank, output JSON + print table."""

    t0 = time.time()

    # diskcache (optional but very useful for OFF rate limits)
    cacher = Cacher()
    if use_cache and Cache is not None:
        cacher.cache = Cache(".facts_cache")

    ua = _safe_user_agent(ua)

    doms = [d.strip() for d in (domains or "").split(",") if d.strip()]
    doms = [d for d in doms if d in FACTS_HOSTS]
    if not doms:
        doms = ["food", "beauty", "products"]

    async def _main() -> None:
        async with httpx.AsyncClient() as client:
            retail = await fetch_retail(
                client=client,
                base_url=base_url,
                query=query,
                women_focus=women_focus,
                max_results=max_results,
                price_max=price_max,
                with_reasons=with_reasons,
                reasons_max=reasons_max,
                retail_timeout_s=retail_timeout_s,
            )

        facts = await fetch_facts_all_domains(
            query=query,
            domains=doms,
            page_size=facts_page_size,
            ua=ua,
            cacher=cacher,
            cache_ttl_s=facts_cache_ttl,
            facts_timeout_s=facts_timeout_s,
            concurrency=min(3, len(doms)),
        )

        enriched, dbg_match = match_facts_to_retail(retail, facts, fuzz_threshold=fuzz_threshold_match)
        deduped, dbg_dedup = dedupe_merged(enriched, fuzz_threshold=fuzz_threshold_dedupe)
        ranked = rerank(deduped, query=query, category_weight=category_weight)

        out_obj = MergeOutput(
            query=query,
            merged_count=len(ranked),
            merged=ranked,
            debug={
                "retail_in": len(retail),
                "facts_in": len(facts),
                "domains": doms,
                "match": dbg_match,
                "dedupe": dbg_dedup,
                "category_weight": category_weight,
                "sklearn_ok": SKLEARN_OK,
                "ua": ua,
            },
        )

        with open(out, "w", encoding="utf-8") as f:
            json.dump(out_obj.model_dump(), f, ensure_ascii=False, indent=2)

        # Pretty print top results
        table = Table(title=f"Merged Results (top 10) — query={query!r}")
        table.add_column("#", justify="right")
        table.add_column("Title", overflow="ellipsis")
        table.add_column("Price", justify="right")
        table.add_column("Rating", justify="right")
        table.add_column("CatScore", justify="right")
        table.add_column("Score", justify="right")
        table.add_column("Facts", overflow="ellipsis")

        for i, it in enumerate(ranked[:10]):
            price = f"${it.price:.2f}" if it.price is not None else "-"
            rating = f"{it.rating:.1f}" if it.rating is not None else "-"
            cat = f"{(it.category_score or 0.0):.2f}"
            score = f"{(it.score or 0.0):.2f}"
            facts_src = it.factsSource or "-"
            table.add_row(
                str(i + 1),
                it.title or "-",
                price,
                rating,
                cat,
                score,
                facts_src,
            )

        console.print(table)
        console.print(f"[green]Wrote[/green] {out} in {time.time() - t0:.2f}s")

    asyncio.run(_main())


if __name__ == "__main__":
    app()