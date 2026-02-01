# apps/company_view/lib/config.py

from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path
from typing import Optional


# -----------------------------
# .env loading (best-effort)
# -----------------------------
# We keep this resilient so the dashboard can run even if python-dotenv
# isn't installed (e.g., in a minimal environment).
try:
    from dotenv import load_dotenv, find_dotenv  # type: ignore

    # Load .env reliably no matter where Streamlit is launched from.
    # Priority:
    #  1) nearest .env discovered by find_dotenv(usecwd=True)
    #  2) apps/company_view/.env (repo-relative best effort)
    env_path = find_dotenv(usecwd=True)
    if env_path:
        load_dotenv(env_path)
    else:
        here = Path(__file__).resolve()
        fallback = here.parents[1] / ".env"  # .../apps/company_view/.env
        if fallback.exists():
            load_dotenv(fallback)
except Exception:
    # If dotenv isn't present or something weird happens, just continue.
    pass


@dataclass(frozen=True)
class AppConfig:
    """Configuration for the Company View dashboard.

    This is loaded from environment variables (optionally via .env).
    """

    # Dashboard basic auth (optional)
    dashboard_username: str
    dashboard_password: str

    # LLM/Backend base URL (apps/llm)
    llm_base_url: str

    # Supabase (optional; dashboard can fall back to mock/demo data)
    supabase_url: Optional[str]
    supabase_service_role_key: Optional[str]

    # Table names (for Supabase PostgREST)
    tx_table: str
    accounts_table: str
    users_table: str

    # Column mapping for transactions
    col_date: str
    col_amount: str
    col_account: str
    col_category: str
    col_payee: str
    col_note: str

    # Veo reference image (optional)
    veo_ref_gcs: Optional[str]

    @staticmethod
    def _strip_trailing_slash(v: str) -> str:
        return v.rstrip("/")

    @classmethod
    def from_env(cls) -> "AppConfig":
        return cls(
            dashboard_username=os.getenv("DASHBOARD_USERNAME", "admin"),
            dashboard_password=os.getenv("DASHBOARD_PASSWORD", "change-me"),
            llm_base_url=cls._strip_trailing_slash(
                os.getenv("LLM_BASE_URL", "http://127.0.0.1:8080")
            ),
            supabase_url=os.getenv("SUPABASE_URL") or None,
            supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY") or None,
            tx_table=os.getenv("TX_TABLE", "transactions"),
            accounts_table=os.getenv("ACCOUNTS_TABLE", "accounts"),
            users_table=os.getenv("USERS_TABLE", "users"),
            col_date=os.getenv("TX_COL_DATE", "date"),
            col_amount=os.getenv("TX_COL_AMOUNT", "amount"),
            col_account=os.getenv("TX_COL_ACCOUNT", "account_id"),
            col_category=os.getenv("TX_COL_CATEGORY", "category_id"),
            col_payee=os.getenv("TX_COL_PAYEE", "payee"),
            col_note=os.getenv("TX_COL_NOTE", "note"),
            veo_ref_gcs=os.getenv("VEO_REF_GCS") or None,
        )


# -----------------------------
# Backwards compatibility
# -----------------------------
# Some modules may import Config/get_config, others import AppConfig.
Config = AppConfig


def get_config() -> AppConfig:
    """Return a loaded config object (env-driven)."""
    return AppConfig.from_env()


__all__ = ["AppConfig", "Config", "get_config"]