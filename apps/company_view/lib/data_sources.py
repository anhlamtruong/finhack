# apps/company_view/lib/data_sources.py

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, date
from typing import Any, Iterable, Optional
from urllib.parse import urlencode

import pandas as pd
import requests


# ----------------------------
# HTTP utilities
# ----------------------------

def _build_session(retries: int = 2, backoff: float = 0.3) -> requests.Session:
    """Create a requests Session with basic retry/backoff for transient errors."""
    s = requests.Session()

    try:
        # requests bundles urllib3; this keeps dependencies minimal.
        from urllib3.util.retry import Retry  # type: ignore
        from requests.adapters import HTTPAdapter

        retry = Retry(
            total=retries,
            connect=retries,
            read=retries,
            status=retries,
            backoff_factor=backoff,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"),
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retry)
        s.mount("http://", adapter)
        s.mount("https://", adapter)
    except Exception:
        # If urllib3 retry isn't available for some reason, proceed without it.
        pass

    return s


_SESSION = _build_session()


def _safe_get(url: str, *, headers: dict[str, str] | None = None, timeout: float = 20.0) -> requests.Response:
    r = _SESSION.get(url, headers=headers, timeout=timeout)
    r.raise_for_status()
    return r


# ----------------------------
# Supabase REST client
# ----------------------------


class SupabaseREST:
    """Minimal Supabase REST client (service role) for admin dashboard.

    Uses:
        {SUPABASE_URL}/rest/v1/{table}?select=...

    Notes:
    - Designed to be safe and resilient: timeouts + retries (best-effort).
    - Keep it minimal so the Streamlit app can run without extra services.
    """

    def __init__(self, base_url: str, service_role_key: str):
        self.base = (base_url or "").rstrip("/")
        self.key = (service_role_key or "").strip()

    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }

    def select(self, table: str, params: dict[str, Any], *, timeout: float = 20.0) -> list[dict[str, Any]]:
        url = f"{self.base}/rest/v1/{table}?{urlencode(params, doseq=True)}"
        r = _safe_get(url, headers=self._headers(), timeout=timeout)
        js = r.json()
        return js if isinstance(js, list) else []

    def health(self, *, timeout: float = 8.0) -> bool:
        """Cheap check: hit /rest/v1/ with a HEAD/GET fallback."""
        if not self.base or not self.key:
            return False

        # Supabase REST doesn't always love HEAD, so we do a tiny GET.
        url = f"{self.base}/rest/v1/"
        try:
            r = _SESSION.get(url, headers=self._headers(), timeout=timeout)
            return 200 <= r.status_code < 500
        except Exception:
            return False


def _looks_like_placeholder(s: str) -> bool:
    s = (s or "").strip().lower()
    if not s:
        return True
    bad = ["your_project", "your-project", "example", "changeme", "replace_me", "<", ">"]
    return any(x in s for x in bad)


def _supabase_env_is_real(cfg) -> bool:
    """Return True if cfg has Supabase URL + service role key that look real."""
    url = getattr(cfg, "supabase_url", None)
    key = getattr(cfg, "supabase_service_role_key", None)
    if not url or not key:
        return False

    u = str(url).strip()
    k = str(key).strip()

    if _looks_like_placeholder(u) or _looks_like_placeholder(k):
        return False

    # Accept https://... only.
    if not u.lower().startswith("https://"):
        return False

    return True


# ----------------------------
# Sample data generators
# ----------------------------


def sample_transactions(days: int = 60, *, seed: int | None = None) -> pd.DataFrame:
    """Generate realistic-ish sample transactions for demo / fallback."""
    import numpy as np
    import random

    if seed is not None:
        random.seed(seed)
        np.random.seed(seed)

    now = datetime.utcnow().date()
    dates = pd.date_range(end=pd.Timestamp(now), periods=max(7, int(days)), freq="D")

    accounts = [f"account_{i}" for i in range(1, 41)]
    categories = ["food", "rent", "transport", "shopping", "salary", "side_income"]
    payees = ["Uber", "Woolies", "Rent", "Cafe", "Amazon", "Employer", "Stripe"]

    rows: list[dict[str, Any]] = []
    for d in dates:
        n = random.randint(30, 120)
        for _ in range(n):
            acc = random.choice(accounts)
            cat = random.choice(categories)
            is_income = cat in ["salary", "side_income"] and random.random() < 0.6
            amt = int(np.random.gamma(2.0, 35.0) * (6 if is_income else 1))
            amt = amt if is_income else -amt
            rows.append(
                {
                    "date": d.to_pydatetime(),
                    "amount": amt,
                    "account_id": acc,
                    "category_id": cat,
                    "payee": random.choice(payees),
                    "note": "",
                }
            )

    df = pd.DataFrame(rows)
    if not df.empty:
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
        df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0)
    return df



def _coerce_date(x: Any) -> pd.Series:
    return pd.to_datetime(x, errors="coerce", utc=False)


def _coerce_num(x: Any) -> pd.Series:
    return pd.to_numeric(x, errors="coerce").fillna(0)


def _coerce_date_obj(x: Any) -> date | None:
    """Coerce many date-like inputs to a `datetime.date`.

    Accepts:
    - datetime.date
    - datetime.datetime
    - ISO strings like 'YYYY-MM-DD' (or timestamps starting with it)
    - None

    Returns:
    - date or None if it can't be parsed.
    """
    if x is None:
        return None
    if isinstance(x, date) and not isinstance(x, datetime):
        return x
    if isinstance(x, datetime):
        return x.date()
    if isinstance(x, str):
        s = x.strip()
        if not s:
            return None
        try:
            return date.fromisoformat(s[:10])
        except Exception:
            return None
    return None


# ----------------------------
# Public loaders
# ----------------------------


def load_transactions(cfg, start_date: Any = None, end_date: Any = None) -> pd.DataFrame:
    """Return transactions dataframe.

    Behavior:
    - If Supabase env is missing/placeholder/unreachable → returns sample data.
    - If Supabase is configured, fetches rows from cfg.tx_table with configured columns.

    Date handling (never crash):
    - Accepts date/datetime/ISO strings/None.
    - If either date is missing, defaults to the last 30 days.
    - If start_date > end_date, swaps them.

    Required cfg attributes:
      - supabase_url
      - supabase_service_role_key
      - tx_table
      - col_date, col_amount, col_account, col_category, col_payee, col_note

    Returns:
      DataFrame with those columns (best effort).
    """

    # Coerce + default date range (last 30 days)
    sd = _coerce_date_obj(start_date)
    ed = _coerce_date_obj(end_date)

    if ed is None:
        ed = datetime.utcnow().date()
    if sd is None:
        sd = ed - timedelta(days=29)

    # Guard against inverted ranges
    if sd > ed:
        sd, ed = ed, sd

    days = (ed - sd).days + 1

    # Fast fallback when not configured.
    if not _supabase_env_is_real(cfg):
        return sample_transactions(days=max(7, days))

    try:
        sb = SupabaseREST(cfg.supabase_url, cfg.supabase_service_role_key)

        # If Supabase is configured but down, still don’t crash.
        if not sb.health():
            return sample_transactions(days=max(7, days))

        select_cols = ",".join(
            [
                cfg.col_date,
                cfg.col_amount,
                cfg.col_account,
                cfg.col_category,
                cfg.col_payee,
                cfg.col_note,
            ]
        )

        # Supabase filters: provide two filters for the same column (gte + lt).
        params: dict[str, Any] = {
            "select": select_cols,
            f"{cfg.col_date}": [
                f"gte.{sd.isoformat()}",
                f"lt.{(ed + timedelta(days=1)).isoformat()}",
            ],
            "order": f"{cfg.col_date}.asc",
            "limit": 200000,
        }

        data = sb.select(cfg.tx_table, params)
        df = pd.DataFrame(data)

        # Normalize types.
        if not df.empty:
            if cfg.col_date in df.columns:
                df[cfg.col_date] = _coerce_date(df[cfg.col_date])
            if cfg.col_amount in df.columns:
                df[cfg.col_amount] = _coerce_num(df[cfg.col_amount])

        return df

    except Exception:
        # fallback so the dashboard never hard-crashes
        return sample_transactions(days=max(7, days))


def load_table(cfg, table: str, *, select: Iterable[str] | None = None, filters: dict[str, Any] | None = None,
               order: str | None = None, limit: int = 50000, timeout: float = 20.0) -> pd.DataFrame:
    """Generic Supabase table loader for future pages.

    This is a convenience helper so new pages (Users/Alerts/System) can share the same safe fetch behavior.

    If Supabase is not configured, returns an empty DataFrame.
    """

    if not _supabase_env_is_real(cfg):
        return pd.DataFrame()

    try:
        sb = SupabaseREST(cfg.supabase_url, cfg.supabase_service_role_key)
        if not sb.health():
            return pd.DataFrame()

        params: dict[str, Any] = {
            "select": ",".join(select) if select else "*",
            "limit": int(limit),
        }
        if order:
            params["order"] = order
        if filters:
            for k, v in filters.items():
                params[k] = v

        rows = sb.select(table, params, timeout=timeout)
        return pd.DataFrame(rows)

    except Exception:
        return pd.DataFrame()


__all__ = [
    "SupabaseREST",
    "sample_transactions",
    "load_transactions",
    "load_table",
]