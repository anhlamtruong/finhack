# apps/company_view/lib/data_sources.py
import requests
import pandas as pd
from datetime import datetime, timedelta
from urllib.parse import urlencode

class SupabaseREST:
    """
    Minimal Supabase REST client (service role) for admin dashboard.
    Uses: {SUPABASE_URL}/rest/v1/{table}?select=...
    """
    def __init__(self, base_url: str, service_role_key: str):
        self.base = base_url.rstrip("/")
        self.key = service_role_key

    def _headers(self):
        return {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }

    def select(self, table: str, params: dict) -> list[dict]:
        url = f"{self.base}/rest/v1/{table}?{urlencode(params, doseq=True)}"
        r = requests.get(url, headers=self._headers(), timeout=20)
        r.raise_for_status()
        return r.json()

def _supabase_env_is_real(cfg) -> bool:
    if not cfg.supabase_url or not cfg.supabase_service_role_key:
        return False
    u = cfg.supabase_url.strip().lower()
    # common placeholders → treat as not configured
    if "your_project" in u or "your-project" in u or "example" in u:
        return False
    if not u.startswith("https://"):
        return False
    return True

def sample_transactions(days: int = 60) -> pd.DataFrame:
    import numpy as np
    import random
    now = datetime.utcnow().date()
    dates = pd.date_range(end=pd.Timestamp(now), periods=days, freq="D")

    accounts = [f"account_{i}" for i in range(1, 41)]
    categories = ["food", "rent", "transport", "shopping", "salary", "side_income"]
    payees = ["Uber", "Woolies", "Rent", "Cafe", "Amazon", "Employer", "Stripe"]

    rows = []
    for d in dates:
        n = random.randint(30, 120)
        for _ in range(n):
            acc = random.choice(accounts)
            cat = random.choice(categories)
            is_income = cat in ["salary", "side_income"] and random.random() < 0.6
            amt = int(np.random.gamma(2.0, 35.0) * (6 if is_income else 1))
            amt = amt if is_income else -amt
            rows.append({
                "date": d.to_pydatetime(),
                "amount": amt,
                "account_id": acc,
                "category_id": cat,
                "payee": random.choice(payees),
                "note": ""
            })
    return pd.DataFrame(rows)

def load_transactions(cfg, start_date, end_date) -> pd.DataFrame:
    """
    Returns transactions dataframe.
    - If Supabase env is missing/placeholder/unreachable, returns sample data.
    """
    days = (end_date - start_date).days + 1

    if not _supabase_env_is_real(cfg):
        return sample_transactions(days=max(7, days))

    try:
        sb = SupabaseREST(cfg.supabase_url, cfg.supabase_service_role_key)

        select_cols = ",".join([
            cfg.col_date, cfg.col_amount, cfg.col_account, cfg.col_category, cfg.col_payee, cfg.col_note
        ])

        params = {
            "select": select_cols,
            f"{cfg.col_date}": [
                f"gte.{start_date.isoformat()}",
                f"lt.{(end_date + timedelta(days=1)).isoformat()}",
            ],
            "order": f"{cfg.col_date}.asc",
            "limit": 200000,
        }

        data = sb.select(cfg.tx_table, params)
        df = pd.DataFrame(data)

        if not df.empty:
            df[cfg.col_date] = pd.to_datetime(df[cfg.col_date], errors="coerce")
            df[cfg.col_amount] = pd.to_numeric(df[cfg.col_amount], errors="coerce").fillna(0)

        return df

    except Exception:
        # fallback so the dashboard never hard-crashes
        return sample_transactions(days=max(7, days))