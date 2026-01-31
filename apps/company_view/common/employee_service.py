from __future__ import annotations

import os
import time
import uuid
from typing import Dict, List

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from common.config import settings
from common.schemas import ChatRequest, ChatResponse
from common.rag import plan_and_fetch_evidence, answer_with_citations

# -----------------------------------------------------------------------------
# App
# -----------------------------------------------------------------------------

app = FastAPI(title="Company View - Employee Assistant", version="1.1")


def _parse_cors_origins() -> List[str]:
    """Read allowed CORS origins from env.

    - COMPANY_VIEW_CORS_ORIGINS can be a comma-separated list.
    - If unset/blank, default to "*" for local dev.
    """
    raw = (os.getenv("COMPANY_VIEW_CORS_ORIGINS") or "").strip()
    if not raw:
        return ["*"]
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    return parts or ["*"]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# -----------------------------------------------------------------------------
# Prompt
# -----------------------------------------------------------------------------

EMPLOYEE_SYSTEM = """
You are Chuchube Employee Assistant.
You help internal teams: engineering, finance ops, data analytics, product.
You prefer evidence. You can:
- summarize transaction patterns
- draft runbooks, postmortems, PRDs
- propose fixes with checklists
- explain anomalies with concrete next steps

Rules:
- Do not fabricate data.
- If evidence is insufficient, ask targeted questions.
- Be structured and actionable.
- When you use evidence, cite it with [E1], [E2], ...
""".strip()


# -----------------------------------------------------------------------------
# Middleware
# -----------------------------------------------------------------------------

@app.middleware("http")
async def add_request_id_and_timing(request: Request, call_next):
    req_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    t0 = time.time()
    try:
        resp = await call_next(request)
    finally:
        dt_ms = int((time.time() - t0) * 1000)
        # lightweight server-side log
        try:
            print(f"[employee_service] {request.method} {request.url.path} req_id={req_id} {dt_ms}ms")
        except Exception:
            pass
    resp.headers["x-request-id"] = req_id
    return resp


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Keep this minimal and safe. Detailed errors go to server logs.
    try:
        print(f"[employee_service] ERROR {request.method} {request.url.path}: {exc}")
    except Exception:
        pass
    return JSONResponse(
        status_code=500,
        content={"ok": False, "error": "Internal server error"},
    )


# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------

@app.get("/health")
def health():
    """Lightweight health endpoint for local dev + deployment checks."""
    return {
        "ok": True,
        "service": "employee_service",
        "model": settings.gemini_model,
        "tx_api_base_configured": bool(getattr(settings, "tx_api_base", "") or ""),
        "kb_dir": getattr(settings, "kb_dir", None),
        "debug": bool(getattr(settings, "enable_debug", False)),
    }


def _trim_history(history: List[Dict[str, str]], n: int = 12) -> List[Dict[str, str]]:
    """Keep a short recent chat window."""
    if not history:
        return []
    return history[-max(0, int(n)) :]


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    """Primary chat endpoint used by Company View pages."""

    history = _trim_history([{"role": m.role, "content": m.content} for m in req.history], 12)

    # Planner + evidence
    plan, evidence, debug = plan_and_fetch_evidence(
        system=EMPLOYEE_SYSTEM,
        user_prompt=req.message,
        history=history,
        user_id=req.user_id,
        start_date=req.start_date,
        end_date=req.end_date,
        domain="employee",
    )

    # Answer
    answer = answer_with_citations(
        system=EMPLOYEE_SYSTEM,
        user_prompt=req.message,
        history=history,
        plan=plan,
        evidence=evidence,
        debug=debug,
        domain="employee",
    )

    out_debug = debug if getattr(settings, "enable_debug", False) else {}
    return ChatResponse(ok=True, answer=answer, evidence=evidence, debug=out_debug)


# Backwards/compat alias (so Streamlit or teammates can call a stable path)
@app.post("/v1/chat/employee", response_model=ChatResponse)
def chat_v1(req: ChatRequest) -> ChatResponse:
    return chat(req)