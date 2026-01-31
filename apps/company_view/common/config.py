from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

from dotenv import load_dotenv


# Load environment from a local .env if present.
# IMPORTANT: Streamlit may change CWD; python-dotenv searches relative to CWD.
# We keep default behavior, but we also support explicit paths via ENV if needed.
load_dotenv()


def _clean(s: Optional[str]) -> str:
    return (s or "").strip()


def _env(*names: str, default: str = "") -> str:
    """Return the first non-empty env var among names, else default."""
    for n in names:
        v = _clean(os.getenv(n))
        if v:
            return v
    return _clean(default)


def _env_bool(name: str, default: bool = False) -> bool:
    v = _clean(os.getenv(name))
    if not v:
        return default
    return v.lower() in {"1", "true", "t", "yes", "y", "on"}


def _env_int(name: str, default: int) -> int:
    raw = _clean(os.getenv(name))
    if not raw:
        return default
    try:
        return int(raw)
    except Exception:
        return default


@dataclass(frozen=True)
class Settings:
    """Company View configuration.

    Goals:
    - Keep env names stable and explicit.
    - Support backwards-compatible aliases (older .env keys).
    - Avoid silent misconfiguration by exposing the final resolved values.
    """

    # Gemini
    gemini_api_key: str = _env("GEMINI_API_KEY")
    gemini_model: str = _env("GEMINI_MODEL", default="gemini-3-pro-preview")

    # Transactions evidence source (preferred): internal Node/Express LLM service
    # Expected base URL: http://localhost:8080 (no trailing slash)
    # Tooling will call: {tx_api_base}/v1/transactions/history
    tx_api_base: str = _env("TX_API_BASE", "COMPANY_VIEW_API_BASE")
    tx_api_key: str = _env("TX_API_KEY")  # optional bearer token

    # Supabase REST direct (fallback option)
    # Note: Company View uses REST only when tx_api_base is not configured.
    supabase_url: str = _env("SUPABASE_URL")
    supabase_anon_key: str = _env("SUPABASE_ANON_KEY")

    # Local knowledge base (optional)
    kb_dir: str = _env("KB_DIR")

    # Safety / limits
    max_tool_calls: int = _env_int("MAX_TOOL_CALLS", 4)
    max_evidence_items: int = _env_int("MAX_EVIDENCE_ITEMS", 8)
    request_timeout_s: int = _env_int("REQUEST_TIMEOUT_S", 20)

    # Observability
    enable_debug: bool = _env_bool("DEBUG", default=False)


settings = Settings()


def describe_settings() -> dict:
    """Return a JSON-serializable view of settings with secrets redacted."""

    def redacted(v: str) -> str:
        if not v:
            return ""
        # keep only last 4 chars to help confirm which key is loaded
        if len(v) <= 4:
            return "****"
        return "****" + v[-4:]

    return {
        "gemini_model": settings.gemini_model,
        "gemini_api_key": bool(settings.gemini_api_key),
        "tx_api_base": settings.tx_api_base,
        "tx_api_key": bool(settings.tx_api_key),
        "supabase_url": bool(settings.supabase_url),
        "supabase_anon_key": bool(settings.supabase_anon_key),
        "kb_dir": settings.kb_dir,
        "max_tool_calls": settings.max_tool_calls,
        "max_evidence_items": settings.max_evidence_items,
        "request_timeout_s": settings.request_timeout_s,
        "enable_debug": settings.enable_debug,
    }