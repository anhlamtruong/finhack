# apps/company_view/common/gemini_client.py
from __future__ import annotations

import json
import time
from typing import Any, Dict, List, Literal, Optional

import requests
from pydantic import BaseModel, Field

from .config import settings

Role = Literal["user", "assistant"]


class GeminiError(RuntimeError):
    def __init__(self, message: str, *, status: int = 502, body: Any = None):
        super().__init__(message)
        self.status = status
        self.body = body


class ChatMessage(BaseModel):
    role: Role
    content: str


class EvidenceItem(BaseModel):
    source: str
    title: str
    snippet: str
    url: Optional[str] = None
    meta: Dict[str, Any] = Field(default_factory=dict)


class ChatRequest(BaseModel):
    session_id: str = Field(..., description="Conversation session/thread id")
    user_id: Optional[str] = Field(None, description="Known internal user/customer id")
    message: str
    history: List[ChatMessage] = Field(default_factory=list)

    # Domain-specific optional context
    start_date: Optional[str] = None  # YYYY-MM-DD
    end_date: Optional[str] = None
    ticket: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ChatResponse(BaseModel):
    ok: bool = True
    answer: str
    evidence: List[EvidenceItem] = Field(default_factory=list)
    debug: Dict[str, Any] = Field(default_factory=dict)


# -------------------------
# Low-level Gemini helpers
# -------------------------

_GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"


def _now_ms() -> int:
    return int(time.time() * 1000)


def _sleep_ms(ms: int) -> None:
    time.sleep(max(0, int(ms)) / 1000.0)


def _as_gemini_role(role: Role) -> str:
    # Gemini v1beta uses: "user" and "model"
    return "user" if role == "user" else "model"


def _extract_text(raw: Dict[str, Any]) -> str:
    """Extract concatenated visible text from the first candidate.

    Expected shape:
      {"candidates":[{"content":{"parts":[{"text":"..."}]}}]}

    Some failure modes we have observed:
    - candidates[0].content exists but has no parts
    - finishReason=MAX_TOKENS with only thoughts (no visible parts)
    """
    candidates = raw.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        return ""

    c0 = candidates[0] or {}
    content = c0.get("content") or {}
    parts = content.get("parts")

    if not isinstance(parts, list) or not parts:
        return ""

    chunks: List[str] = []
    for p in parts:
        if isinstance(p, dict) and isinstance(p.get("text"), str):
            chunks.append(p["text"])
    return "".join(chunks).strip()


def _finish_reason(raw: Dict[str, Any]) -> str:
    try:
        c0 = (raw.get("candidates") or [None])[0] or {}
        return str(c0.get("finishReason") or "")
    except Exception:
        return ""


def _usage(raw: Dict[str, Any]) -> Dict[str, Any]:
    u = raw.get("usageMetadata")
    return u if isinstance(u, dict) else {}


def _error_message_from_body(body: Any) -> str:
    if not isinstance(body, dict):
        return ""
    err = body.get("error")
    if isinstance(err, dict):
        return str(err.get("message") or "")
    return ""


def _is_thinking_only_error(status: int, body: Any) -> bool:
    # Observed from API:
    #   HTTP 400: "Budget 0 is invalid. This model only works in thinking mode."
    if status != 400:
        return False
    msg = _error_message_from_body(body).lower()
    return "only works in thinking mode" in msg


def _build_payload(
    *,
    system: Optional[str],
    user: str,
    extra_messages: List[Dict[str, str]],
    temperature: float,
    max_output_tokens: int,
    response_mime_type: Optional[str],
    thinking_budget: Optional[int],
) -> Dict[str, Any]:
    contents: List[Dict[str, Any]] = []

    # History: expects [{role:"user|assistant", content:"..."}]
    for m in extra_messages or []:
        r = m.get("role")
        t = m.get("content")
        if r not in ("user", "assistant"):
            continue
        if not isinstance(t, str) or not t.strip():
            continue
        contents.append(
            {
                "role": _as_gemini_role("user" if r == "user" else "assistant"),
                "parts": [{"text": t}],
            }
        )

    # Current user message
    contents.append({"role": "user", "parts": [{"text": user}]})

    gen_cfg: Dict[str, Any] = {
        "temperature": float(temperature),
        "maxOutputTokens": int(max_output_tokens),
    }

    # IMPORTANT:
    # - Do NOT send thinkingConfig by default.
    # - Some models reject thinkingBudget=0 and require thinking mode.
    # - When explicitly requested, includeThoughts should be false.
    if thinking_budget is not None:
        gen_cfg["thinkingConfig"] = {
            "thinkingBudget": int(thinking_budget),
            "includeThoughts": False,
        }

    if response_mime_type:
        gen_cfg["responseMimeType"] = response_mime_type

    payload: Dict[str, Any] = {"contents": contents, "generationConfig": gen_cfg}

    if system and str(system).strip():
        payload["systemInstruction"] = {"parts": [{"text": system}]}

    return payload


def _post_generate(*, model: str, payload: Dict[str, Any], timeout_s: int) -> Dict[str, Any]:
    if not settings.gemini_api_key:
        raise GeminiError("GEMINI_API_KEY is missing", status=500)

    url = f"{_GEMINI_BASE}/models/{model}:generateContent"
    params = {"key": settings.gemini_api_key}

    r = requests.post(
        url,
        params=params,
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=int(timeout_s),
    )

    # Try decode JSON even on errors (Gemini returns JSON error bodies)
    try:
        raw = r.json()
    except Exception:
        raw = {"_non_json_body": r.text}

    if not (200 <= r.status_code < 300):
        msg = _error_message_from_body(raw)
        if msg:
            raise GeminiError(f"Gemini HTTP {r.status_code}: {msg}", status=r.status_code, body=raw)
        raise GeminiError(f"Gemini HTTP {r.status_code}", status=r.status_code, body=raw)

    return raw


# -------------------------
# Public API
# -------------------------

def gemini_generate(
    *,
    system: Optional[str] = None,
    user: str,
    extra_messages: Optional[List[Dict[str, str]]] = None,
    temperature: float = 0.2,
    max_output_tokens: int = 800,
    timeout_s: int = 25,
    response_mime_type: Optional[str] = None,
    thinking_budget: Optional[int] = None,
    model: Optional[str] = None,
) -> str:
    """Generate text from Gemini.

    Key behavior (based on *observed* failures in this repo):
    - By default, we OMIT thinkingConfig entirely (some models reject thinkingBudget=0).
    - If the model responds with "only works in thinking mode", we retry with a small thinking budget.
    - If Gemini returns empty visible text (no content.parts.text), we include finishReason/usage in errors.
    - Retries transient errors (429, 5xx) with small backoff.

    Raises GeminiError on failure (includes .status and .body for debugging).
    """
    msg_user = (user or "").strip()
    if not msg_user:
        raise GeminiError("User prompt is empty", status=400)

    extra_messages = extra_messages or []

    # Model priority:
    # 1) explicit arg
    # 2) settings.gemini_model
    # 3) safe default
    preferred = (model or settings.gemini_model or "gemini-2.5-flash").strip()

    # If preferred model 404s, we fallback to a small fixed list (no extra guessing).
    fallback_models = [preferred, "gemini-2.5-flash", "gemini-2.5-pro"]

    # de-dupe while preserving order
    seen = set()
    models: List[str] = []
    for m in fallback_models:
        m = (m or "").strip()
        if m and m not in seen:
            seen.add(m)
            models.append(m)

    overall_deadline_ms = _now_ms() + max(1, int(timeout_s)) * 1000
    last_err: Optional[GeminiError] = None

    # Local mutable knobs for retries
    local_thinking_budget: Optional[int] = thinking_budget
    local_max_tokens: int = int(max_output_tokens)

    for model_name in models:
        attempt = 0
        while True:
            attempt += 1

            remaining_ms = overall_deadline_ms - _now_ms()
            if remaining_ms <= 0:
                raise GeminiError(
                    "Gemini request timed out (overall deadline exceeded)",
                    status=504,
                    body={"last_error": getattr(last_err, "body", None)},
                )

            # Give the HTTP request a sane per-attempt timeout.
            per_attempt_timeout_s = max(1, min(int(timeout_s), int(remaining_ms / 1000)))

            payload = _build_payload(
                system=system,
                user=msg_user,
                extra_messages=extra_messages,
                temperature=temperature,
                max_output_tokens=local_max_tokens,
                response_mime_type=response_mime_type,
                thinking_budget=local_thinking_budget,
            )

            try:
                raw = _post_generate(model=model_name, payload=payload, timeout_s=per_attempt_timeout_s)
                text = _extract_text(raw)

                if text:
                    return text

                fin = _finish_reason(raw)
                usage = _usage(raw)

                raise GeminiError(
                    "Gemini returned empty content",
                    status=502,
                    body={
                        "model": model_name,
                        "finishReason": fin,
                        "usageMetadata": usage,
                        "raw": raw,
                    },
                )

            except GeminiError as e:
                last_err = e

                # Model not found -> try next model in list.
                err_msg = _error_message_from_body(e.body)
                if e.status == 404 and ("not found" in err_msg.lower() or "not_found" in err_msg.lower()):
                    break

                # If model requires thinking mode, retry with a small budget and more output.
                if _is_thinking_only_error(e.status, e.body):
                    if local_thinking_budget is None or local_thinking_budget <= 0:
                        local_thinking_budget = 128
                    local_max_tokens = max(local_max_tokens, 256)
                    if attempt < 3:
                        _sleep_ms(150 * attempt)
                        continue

                # If empty output likely due to token cap, increase max tokens and retry.
                if (
                    e.status == 502
                    and isinstance(e.body, dict)
                    and str(e.body.get("finishReason") or "") == "MAX_TOKENS"
                    and attempt < 3
                ):
                    local_max_tokens = min(max(local_max_tokens * 2, 256), 2048)
                    _sleep_ms(150 * attempt)
                    continue

                # Retry transient status codes with backoff.
                if e.status in (429, 500, 502, 503, 504) and attempt < 3:
                    _sleep_ms(250 * attempt)
                    continue

                raise

    raise last_err or GeminiError("Gemini failed (unknown)", status=502)