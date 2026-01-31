# config.py

from dataclasses import dataclass
import os
from dotenv import load_dotenv

load_dotenv()

@dataclass(frozen=True)
class Config:
    dashboard_username: str
    dashboard_password: str
    llm_base_url: str

    supabase_url: str | None
    supabase_service_role_key: str | None

    tx_table: str
    accounts_table: str
    users_table: str

    col_date: str
    col_amount: str
    col_account: str
    col_category: str
    col_payee: str
    col_note: str

    veo_ref_gcs: str | None

def get_config() -> Config:
    return Config(
        dashboard_username=os.getenv("DASHBOARD_USERNAME", "admin"),
        dashboard_password=os.getenv("DASHBOARD_PASSWORD", "change-me"),
        llm_base_url=os.getenv("LLM_BASE_URL", "http://127.0.0.1:8080").rstrip("/"),

        supabase_url=os.getenv("SUPABASE_URL"),
        supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY"),

        tx_table=os.getenv("TX_TABLE", "transactions"),
        accounts_table=os.getenv("ACCOUNTS_TABLE", "accounts"),
        users_table=os.getenv("USERS_TABLE", "users"),

        col_date=os.getenv("TX_COL_DATE", "date"),
        col_amount=os.getenv("TX_COL_AMOUNT", "amount"),
        col_account=os.getenv("TX_COL_ACCOUNT", "account_id"),
        col_category=os.getenv("TX_COL_CATEGORY", "category_id"),
        col_payee=os.getenv("TX_COL_PAYEE", "payee"),
        col_note=os.getenv("TX_COL_NOTE", "note"),

        veo_ref_gcs=os.getenv("VEO_REF_GCS"),
    )