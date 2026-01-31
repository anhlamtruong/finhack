from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

# -----------------------------
# Core chat schema primitives
# -----------------------------

Role = Literal["user", "assistant", "system", "tool"]


class Attachment(BaseModel):
    """Optional attachment metadata (for future uploads: images/files)."""

    kind: Literal["image", "file", "link", "other"] = "other"
    name: Optional[str] = None
    mime_type: Optional[str] = None
    url: Optional[str] = None
    size_bytes: Optional[int] = None
    meta: Dict[str, Any] = Field(default_factory=dict)


class ChatMessage(BaseModel):
    """Single message in the conversation history."""

    role: Role
    content: str = Field(..., min_length=1)

    # Optional metadata to help UI/UX (safe defaults)
    id: Optional[str] = None
    ts: Optional[str] = None  # ISO timestamp string if you already store it
    created_at: Optional[datetime] = None
    name: Optional[str] = None  # e.g. tool name / assistant name

    attachments: List[Attachment] = Field(default_factory=list)
    meta: Dict[str, Any] = Field(default_factory=dict)


# -----------------------------
# Evidence + tool calls
# -----------------------------

class EvidenceItem(BaseModel):
    """Structured citation object so the UI can show "actual evidence"."""

    title: str = Field(..., min_length=1)
    source: str = Field(..., min_length=1)  # e.g. "Transactions API", "Supabase", "KB"
    snippet: str = Field(..., min_length=1)

    # Optional deep-links
    url: Optional[str] = None

    # Structured metadata for rendering / drill-down
    meta: Dict[str, Any] = Field(default_factory=dict)


class ToolCall(BaseModel):
    """A single tool call that the assistant attempted/executed."""

    name: str
    args: Dict[str, Any] = Field(default_factory=dict)

    ok: bool = True
    result_preview: Optional[str] = None
    latency_ms: Optional[int] = None
    error: Optional[str] = None


# -----------------------------
# Requests / Responses
# -----------------------------

Persona = Literal["employee", "support"]


class ChatRequest(BaseModel):
    """Shared request shape for both employee + customer support assistants."""

    # identity / routing
    persona: Optional[Persona] = None  # "employee" or "support"
    user_id: Optional[str] = None
    session_id: Optional[str] = None

    # input
    message: str = Field(..., min_length=1)

    # conversation context
    history: List[ChatMessage] = Field(default_factory=list)

    # optional controls
    language: Optional[str] = None
    timezone: Optional[str] = None

    # client flags
    stream: bool = False
    max_output_tokens: Optional[int] = None

    # generic bag for app-specific info (safe)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class Usage(BaseModel):
    """Lightweight token/latency accounting (optional)."""

    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    latency_ms: Optional[int] = None


class ChatResponse(BaseModel):
    """What the Streamlit frontend should consume."""

    reply: str

    # provenance
    evidence: List[EvidenceItem] = Field(default_factory=list)
    tool_calls: List[ToolCall] = Field(default_factory=list)

    # UX helpers
    quick_replies: List[str] = Field(default_factory=list)
    follow_ups: List[str] = Field(default_factory=list)

    # safety / ops
    safety_notes: List[str] = Field(default_factory=list)
    model: Optional[str] = None
    usage: Optional[Usage] = None

    # debug (keep empty in prod unless DEBUG is enabled)
    debug: Dict[str, Any] = Field(default_factory=dict)