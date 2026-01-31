from __future__ import annotations

import json
import os
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests
from cachetools import TTLCache

from .config import settings
from .schemas import EvidenceItem

# Small in-memory caches to keep Streamlit responsive
_tx_cache = TTLCache(maxsize=128, ttl=60)
_kb_cache = TTLCache(maxsize=64, ttl=120)


def _safe_date(s: Optional[str]) -> Optional[str]:
    if not s:
        return None
    s = s.strip()
    try:
        datetime.strptime(s, "%Y-%m-%d")
        return s
    except Exception:
        return None


def _join_url(base: str, path: str) -> str:
    base = (base or "").strip()
    path = (path or "").strip()
    if not base:
        return path
    if not path:
        return base
    return base.rstrip("/") + "/" + path.lstrip("/")


def _candidate_tx_endpoints(tx_api_base: str) -> List[str]:
    """Deterministic candidate endpoints for the Node transactions history API.

    The backend contract we support is:
      GET /v1/transactions/history
        - query params: userId, days?, todayIso?, limit?
        - response: { ok: true, ..., transactions: [...] }

    TX_API_BASE is allowed to be:
      - http://127.0.0.1:8080
      - http://127.0.0.1:8080/v1
      - http://127.0.0.1:8080/v1/transactions
      - http://127.0.0.1:8080/v1/transactions/history

    We DO NOT invent other routes.
    """
    base = (tx_api_base or "").strip().rstrip("/")
    if not base:
        return []

    if base.endswith("/v1/transactions/history"):
        return [base]
    if base.endswith("/v1/transactions"):
        return [base + "/history"]
    if base.endswith("/v1"):
        return [base + "/transactions/history"]

    # Most common: a service base URL (e.g., http://127.0.0.1:8080)
    return [
        base + "/v1/transactions/history",
        base,
    ]


def _parse_node_history_response(data: Any) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """Parse Node history response.

    Returns (rows, error_message).
    """
    # Strict contract: { ok: true, transactions: [...] }
    if isinstance(data, dict):
        if data.get("ok") is False:
            err = data.get("error")
            return [], str(err) if err else "Backend returned ok=false"
        txs = data.get("transactions")
        if isinstance(txs, list):
            return txs, None
        return [], None

    # Some internal tools might return a list directly; accept but don't assume shape.
    if isinstance(data, list):
        return data, None

    return [], None


def _date_range_to_node_params(sd: Optional[str], ed: Optional[str]) -> Dict[str, Any]:
    """Map (start_date,end_date) to Node params (todayIso,days) where expressible.

    Node supports: todayIso (YYYY-MM-DD) + days.
    - If only end_date exists -> todayIso=end_date.
    - If both exist -> todayIso=end_date and days=(end-start) days (min 1).
    - If only start_date exists -> cannot express safely without assumptions, so omit.
    """
    params: Dict[str, Any] = {}
    if ed:
        params["todayIso"] = ed
    if sd and ed:
        d0 = date.fromisoformat(sd)
        d1 = date.fromisoformat(ed)
        params["days"] = max(1, (d1 - d0).days)
    return params


def _truncate(s: str, n: int = 600) -> str:
    s = str(s or "")
    return s if len(s) <= n else (s[:n] + "…")


def _clamp_int(x: Any, lo: int, hi: int, default: int) -> int:
    try:
        v = int(x)
    except Exception:
        v = default
    return max(lo, min(hi, v))


def get_transactions(
    *,
    user_id: Optional[str],
    start_date: Optional[str],
    end_date: Optional[str],
    limit: int = 5000,
) -> Tuple[List[Dict[str, Any]], EvidenceItem]:
    """Fetch transactions rows for evidence.

    Priority:
      A) Node/Express Transactions History API (TX_API_BASE)
      B) Supabase REST fallback (SUPABASE_URL + SUPABASE_ANON_KEY)

    Never throws for network/HTTP errors (returns empty rows + EvidenceItem describing failure)
    so the Streamlit app can still render.
    """

    sd = _safe_date(start_date)
    ed = _safe_date(end_date)
    lim = _clamp_int(limit, 1, 2000, 5000)  # Node route clamps; keep reasonable

    cache_key = json.dumps({"u": user_id, "s": sd, "e": ed, "l": lim}, sort_keys=True)
    if cache_key in _tx_cache:
        rows = _tx_cache[cache_key]
        ev = EvidenceItem(
            source="transactions_cache",
            title="Transactions (cached)",
            snippet=f"Loaded {len(rows)} rows from cache for range {sd}..{ed}.",
            meta={"count": len(rows), "start_date": sd, "end_date": ed},
        )
        return rows, ev

    # A) Node transactions API
    if settings.tx_api_base:
        base = settings.tx_api_base.strip()
        endpoints = _candidate_tx_endpoints(base)

        params: Dict[str, Any] = {"limit": lim}
        if user_id:
            params["userId"] = user_id
        params.update(_date_range_to_node_params(sd, ed))

        headers: Dict[str, str] = {}
        if settings.tx_api_key:
            headers["Authorization"] = f"Bearer {settings.tx_api_key}"

        last_meta: Dict[str, Any] = {
            "attempted_endpoints": endpoints,
            "request_params": params,
        }

        for url in endpoints:
            if not url:
                continue
            try:
                r = requests.get(url, params=params, headers=headers, timeout=settings.request_timeout_s)
                last_meta["last_url"] = r.url
                last_meta["last_status"] = r.status_code

                # If route not mounted at that candidate URL, try next candidate
                if r.status_code == 404 and len(endpoints) > 1:
                    last_meta["last_body"] = _truncate(r.text)
                    continue

                if not (200 <= r.status_code < 300):
                    ev = EvidenceItem(
                        source="transactions_api_error",
                        title="Transactions API error",
                        snippet=f"Transactions API returned HTTP {r.status_code}.",
                        url=url,
                        meta={**last_meta, "last_body": _truncate(r.text)},
                    )
                    return [], ev

                try:
                    data = r.json()
                except Exception as e:
                    ev = EvidenceItem(
                        source="transactions_api_error",
                        title="Transactions API error",
                        snippet=f"Transactions API returned non-JSON: {type(e).__name__}.",
                        url=url,
                        meta={**last_meta, "last_body": _truncate(r.text)},
                    )
                    return [], ev

                rows, backend_err = _parse_node_history_response(data)
                if backend_err:
                    ev = EvidenceItem(
                        source="transactions_api_error",
                        title="Transactions API error",
                        snippet=f"Transactions API ok=false: {backend_err}",
                        url=url,
                        meta={**last_meta, "response": data if isinstance(data, dict) else None},
                    )
                    return [], ev

                # Cache successful responses (even if empty)
                _tx_cache[cache_key] = rows

                ev = EvidenceItem(
                    source="transactions_api",
                    title="Transactions API evidence",
                    snippet=f"Fetched {len(rows)} rows from /v1/transactions/history for range {sd}..{ed}.",
                    url=url,
                    meta={
                        "count": len(rows),
                        "start_date": sd,
                        "end_date": ed,
                        "request": {"url": url, "params": params},
                    },
                )
                return rows, ev

            except requests.RequestException as e:
                # Try next candidate if available; otherwise return a descriptive evidence error.
                last_meta["last_error"] = f"{type(e).__name__}: {e}"
                last_meta["last_url"] = url
                last_meta["last_status"] = None
                continue

        ev = EvidenceItem(
            source="transactions_api_error",
            title="Transactions API error",
            snippet=(
                "TX_API_BASE is set but the transactions API request failed. "
                "Check that the Node service is running and that TX_API_BASE is a base URL like "
                "http://127.0.0.1:8080 (or includes /v1)."
            ),
            url=base,
            meta=last_meta,
        )
        return [], ev

    # B) Supabase REST fallback
    if settings.supabase_url and settings.supabase_anon_key:
        table = os.getenv("TX_TABLE", "transactions")
        date_col = os.getenv("TX_DATE_COL", "date")

        # Do not assume user_id == account_id. Default to user_id unless overridden.
        user_col = os.getenv("TX_USER_COL", "user_id")

        sel = os.getenv("TX_SELECT", "date,amount,account_id,category_id,payee,note")
        url = f"{settings.supabase_url}/rest/v1/{table}"

        params: Dict[str, str] = {
            "select": sel,
            "order": f"{date_col}.asc",
            "limit": str(lim),
        }
        if sd:
            params[date_col] = f"gte.{sd}"
        if ed:
            params[date_col] = f"lt.{ed}"
        if user_id:
            params[user_col] = f"eq.{user_id}"

        headers = {
            "apikey": settings.supabase_anon_key,
            "Authorization": f"Bearer {settings.supabase_anon_key}",
        }

        try:
            r = requests.get(url, params=params, headers=headers, timeout=settings.request_timeout_s)
            if not (200 <= r.status_code < 300):
                ev = EvidenceItem(
                    source="supabase_rest_error",
                    title="Supabase REST error",
                    snippet=f"Supabase REST returned HTTP {r.status_code}.",
                    url=url,
                    meta={"status": r.status_code, "body": _truncate(r.text), "params": params},
                )
                return [], ev

            payload = r.json()
            rows = payload if isinstance(payload, list) else []

            _tx_cache[cache_key] = rows
            ev = EvidenceItem(
                source="supabase_rest",
                title="Supabase REST evidence",
                snippet=f"Fetched {len(rows)} rows from Supabase REST for range {sd}..{ed}.",
                url=url,
                meta={"count": len(rows), "start_date": sd, "end_date": ed, "params": params},
            )
            return rows, ev

        except requests.RequestException as e:
            ev = EvidenceItem(
                source="supabase_rest_error",
                title="Supabase REST error",
                snippet=f"Supabase REST request failed: {type(e).__name__}: {e}",
                url=url,
                meta={"params": params},
            )
            return [], ev

    # No source configured
    return [], EvidenceItem(
        source="none",
        title="No transactions source configured",
        snippet="Set TX_API_BASE (recommended) or SUPABASE_URL + SUPABASE_ANON_KEY to enable evidence-based answers.",
        meta={},
    )


def _read_kb_files() -> List[Tuple[str, str]]:
    """Load KB files (md/txt/json) as (name, text). Cached."""
    key = settings.kb_dir or ""
    if key in _kb_cache:
        return _kb_cache[key]

    out: List[Tuple[str, str]] = []
    if not settings.kb_dir:
        _kb_cache[key] = out
        return out

    root = Path(settings.kb_dir)
    if not root.exists():
        _kb_cache[key] = out
        return out

    for p in root.rglob("*"):
        if p.is_dir():
            continue
        if p.suffix.lower() not in {".md", ".txt", ".json"}:
            continue
        try:
            text = p.read_text(encoding="utf-8")
            if p.suffix.lower() == ".json":
                text = json.dumps(json.loads(text), indent=2, ensure_ascii=False)
            out.append((p.name, text))
        except Exception:
            continue

    _kb_cache[key] = out
    return out


def kb_search(query: str, k: int = 5) -> List[EvidenceItem]:
    """Lightweight lexical search over KB docs."""
    query = (query or "").strip()
    if not query:
        return []

    docs = _read_kb_files()
    if not docs:
        return []

    q = query.lower()
    scored: List[Tuple[int, str, str]] = []
    for name, text in docs:
        t = text.lower()
        score = t.count(q)
        if score == 0:
            toks = set(re.findall(r"[a-z0-9]{3,}", q))
            score = sum(1 for tok in toks if tok in t)
        if score > 0:
            scored.append((score, name, text))

    scored.sort(reverse=True, key=lambda x: x[0])
    out: List[EvidenceItem] = []
    for score, name, text in scored[:k]:
        idx = text.lower().find(q)
        if idx < 0:
            idx = 0
        lo = max(0, idx - 220)
        hi = min(len(text), idx + 340)
        snippet = text[lo:hi].strip()

        out.append(
            EvidenceItem(
                source="kb",
                title=name,
                snippet=snippet,
                meta={"score": score},
            )
        )
    return out
