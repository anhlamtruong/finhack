# apps/company_view/lib/llm_api.py
"""Thin client for the LLM/FastAPI backend used by the Streamlit Company View app.

Design goals:
- Keep it dependency-light (requests only)
- Provide a single place for all backend calls
- Be explicit about payload shapes and timeouts
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import requests


# -------------------------
# Internals
# -------------------------

def _base(url: str) -> str:
    return (url or "").rstrip("/")


def _get(url: str, *, timeout: int = 10) -> Dict[str, Any]:
    r = requests.get(url, timeout=timeout)
    r.raise_for_status()
    return r.json()


def _post(url: str, payload: Dict[str, Any], *, timeout: int = 30) -> Dict[str, Any]:
    r = requests.post(url, json=payload, timeout=timeout)
    r.raise_for_status()
    return r.json()


# -------------------------
# Health / pings
# -------------------------

def llm_health(llm_base_url: str) -> Dict[str, Any]:
    """Generic backend health."""
    return _get(f"{_base(llm_base_url)}/v1/health", timeout=10)


def llm_tx_ping(llm_base_url: str) -> Dict[str, Any]:
    """Transactions router ping."""
    return _get(f"{_base(llm_base_url)}/v1/transactions/ping", timeout=10)


def llm_sales_ping(llm_base_url: str) -> Dict[str, Any]:
    """Sales router ping."""
    return _get(f"{_base(llm_base_url)}/v1/sales/ping", timeout=10)


# -------------------------
# Mascot
# -------------------------

def generate_mascot_video(
    llm_base_url: str,
    preset: Optional[str],
    tx_summary: Optional[Dict[str, Any]],
    ref_gcs: Optional[str],
    out_name: str,
    extra: Optional[str] = None,
) -> Dict[str, Any]:
    """Generate a mascot video via backend."""

    payload: Dict[str, Any] = {"outName": out_name}
    if preset:
        payload["preset"] = preset
    if tx_summary:
        payload["txSummary"] = tx_summary
    if ref_gcs:
        payload["refGcs"] = ref_gcs
    if extra:
        payload["extra"] = extra

    return _post(f"{_base(llm_base_url)}/v1/mascot/video", payload, timeout=180)


# -------------------------
# Sales
# -------------------------


def sales_search(
    llm_base_url: str,
    *,
    query: str,
    women_focus: bool = True,
    max_results: int = 10,
    gl: str = "us",
    hl: str = "en",
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    with_reasons: bool = True,
    reasons_max: int = 3,
    with_facts: bool = False,
    facts_domains: Optional[List[str]] = None,
    facts_page_size: int = 12,
    category_weight: float = 0.35,
    facts_match_threshold: int = 90,
    facts_dedupe_threshold: int = 94,
    debug: bool = False,
    timeout_s: int = 25,
) -> Dict[str, Any]:
    """Call /v1/sales/search.

    Mirrors backend request fields and keeps defaults aligned with your curl tests.
    Returns the raw JSON response from the backend.
    """

    payload: Dict[str, Any] = {
        "query": query,
        "womenFocus": bool(women_focus),
        "maxResults": int(max_results),
        "gl": gl,
        "hl": hl,
        "withReasons": bool(with_reasons),
        "reasonsMax": int(reasons_max),
        "withFacts": bool(with_facts),
        "factsPageSize": int(facts_page_size),
        "categoryWeight": float(category_weight),
        "factsMatchThreshold": int(facts_match_threshold),
        "factsDedupeThreshold": int(facts_dedupe_threshold),
        "debug": bool(debug),
    }

    # optional filters
    if price_min is not None:
        payload["priceMin"] = float(price_min)
    if price_max is not None:
        payload["priceMax"] = float(price_max)

    # facts domains: only include if explicitly provided (backend has defaults)
    if facts_domains is not None:
        payload["factsDomains"] = list(facts_domains)

    return _post(f"{_base(llm_base_url)}/v1/sales/search", payload, timeout=timeout_s)


# Convenience helpers for UI pages

def sales_items_only(llm_base_url: str, **kwargs: Any) -> List[Dict[str, Any]]:
    """Return only the items list from sales_search; never raises KeyError."""
    out = sales_search(llm_base_url, **kwargs)
    items = out.get("items")
    return items if isinstance(items, list) else []


def sales_company_debug(llm_base_url: str, **kwargs: Any) -> Dict[str, Any]:
    """Return a small subset useful for UI debug panels."""
    out = sales_search(llm_base_url, **kwargs)
    return {
        "ok": out.get("ok"),
        "queryUsed": out.get("queryUsed"),
        "count": out.get("count"),
        "routerVersion": out.get("routerVersion"),
        "requestId": out.get("requestId"),
        "debug": out.get("debug"),
    }