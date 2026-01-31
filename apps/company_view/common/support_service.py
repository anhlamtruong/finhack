from __future__ import annotations

import os
import time
import uuid
from typing import List

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from common.config import settings
from common.rag import answer_with_citations, plan_and_fetch_evidence
from common.schemas import ChatRequest, ChatResponse
from common.tools import kb_search

app = FastAPI(title="Company View - Customer Support", version="1.1")


def _parse_cors_origins() -> List[str]:
    """Comma-separated origins. Use '*' for local/dev by default."""
    raw = (
        os.getenv("COMPANY_VIEW_CORS_ORIGINS")
        or os.getenv("CORS_ORIGINS")
        or "*"
    )
    raw = raw.strip()
    if not raw or raw == "*":
        return ["*"]
    return [x.strip() for x in raw.split(",") if x.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


SUPPORT_SYSTEM = """
You are Chuchube Customer Support Assistant.
Goals:
- resolve issues fast
- be empathetic, confident, and clear
- ask for only the minimum required info
- follow policies and avoid overpromising
Evidence-first:
- use transaction evidence when user mentions charges, disputes, refunds, missing payments
- use KB/policy evidence when quoting rules/steps
Output:
- short summary
- next steps (bullet list)
- customer-ready reply draft (if asked)
Never fabricate policy or account details.
""".strip()


@app.middleware("http")
async def _request_meta(request: Request, call_next):
    rid = request.headers.get("x-request-id") or str(uuid.uuid4())
    start = time.time()
    try:
        resp = await call_next(request)
    except Exception:
        # Let our exception handler produce the response.
        raise
    finally:
        dur_ms = int((time.time() - start) * 1000)
        # Lightweight structured-ish log
        try:
            print(
                f"[company_view][support] rid={rid} {request.method} {request.url.path} {dur_ms}ms"
            )
        except Exception:
            pass

    try:
        resp.headers["X-Request-Id"] = rid
    except Exception:
        pass
    return resp


@app.exception_handler(Exception)
async def _unhandled_exception(_request: Request, exc: Exception):
    # Don’t leak secrets; keep message generic.
    # If debug is enabled, include the exception string.
    payload = {
        "ok": False,
        "error": str(exc) if settings.enable_debug else "Internal server error",
    }
    return JSONResponse(status_code=500, content=payload)


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "company_view_support",
        "model": settings.gemini_model,
        "tx_api_base_set": bool(settings.tx_api_base and str(settings.tx_api_base).strip()),
        "kb_dir_set": bool(settings.kb_dir and str(settings.kb_dir).strip()),
        "debug": bool(settings.enable_debug),
    }


def _merge_ticket_context(message: str, ticket: dict | None) -> str:
    ticket = ticket or {}
    if not ticket:
        return message
    return f"{message}\n\n[TICKET CONTEXT]\n{ticket}"


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    # Keep only a small rolling window.
    history = [{"role": m.role, "content": m.content} for m in req.history][-12:]

    req_msg = _merge_ticket_context(req.message, req.ticket)

    plan, evidence, debug = plan_and_fetch_evidence(
        system=SUPPORT_SYSTEM,
        user_prompt=req_msg,
        history=history,
        user_id=req.user_id,
        start_date=req.start_date,
        end_date=req.end_date,
        domain="support",
    )

    # Always try KB search for policy keywords (even if planner forgets).
    # This increases coverage without hallucinating.
    policy_boost = kb_search(
        "refund dispute chargeback cancellation privacy security account verification",
        k=3,
    )
    for ev in policy_boost:
        if len(evidence) >= settings.max_evidence_items:
            break
        evidence.append(ev)

    answer = answer_with_citations(
        system=SUPPORT_SYSTEM,
        user_prompt=req_msg,
        history=history,
        plan=plan,
        evidence=evidence,
        debug=debug,
        domain="support",
    )

    out_debug = debug if settings.enable_debug else {}
    return ChatResponse(ok=True, answer=answer, evidence=evidence, debug=out_debug)


# Compatibility alias for a stable “v1” path used by Streamlit / teammates.
@app.post("/v1/chat/support", response_model=ChatResponse)
def chat_v1(req: ChatRequest) -> ChatResponse:
    return chat(req)