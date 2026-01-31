from __future__ import annotations

import json
from typing import Any, Dict, List, Tuple

from .config import settings
from .gemini_client import gemini_generate
from .schemas import EvidenceItem
from .tools import get_transactions, kb_search


PLANNER_JSON_SCHEMA = """
Return ONLY valid JSON in this exact shape:

{
  "intent": "string",
  "needs_transactions": true/false,
  "needs_kb": true/false,
  "kb_query": "string or empty",
  "tx_filters": {
    "user_id": "string or null",
    "start_date": "YYYY-MM-DD or null",
    "end_date": "YYYY-MM-DD or null",
    "limit": 5000
  },
  "actions": [
    {"type":"tool_call","tool":"get_transactions","reason":"..."},
    {"type":"tool_call","tool":"kb_search","reason":"..."}
  ],
  "response_style": {
    "tone": "string",
    "format": "bullets|steps|email|analysis|chat",
    "must_cite_evidence": true/false
  }
}
"""


# -----------------------------
# Helpers
# -----------------------------

def _strip_code_fences(s: str) -> str:
    t = (s or "").strip()
    if not t:
        return ""
    if t.startswith("```"):
        # ```json ... ``` or ``` ... ```
        t = t.replace("```json", "```")
        t = t.split("```", 1)[-1] if "```" in t else t
        t = t.rsplit("```", 1)[0] if "```" in t else t
    return t.strip()


def _extract_first_json(text: str) -> str:
    """Extract a best-effort balanced JSON object/array from arbitrary text."""
    s = _strip_code_fences(text)
    if not s:
        return ""

    trimmed = s.strip()
    if trimmed[:1] in ("{", "["):
        return trimmed

    # find first '{' or '[' and return balanced slice
    start_obj = trimmed.find("{")
    start_arr = trimmed.find("[")
    if start_obj == -1 and start_arr == -1:
        return ""
    if start_obj == -1:
        start = start_arr
    elif start_arr == -1:
        start = start_obj
    else:
        start = min(start_obj, start_arr)

    sub = trimmed[start:]
    stack: List[str] = []
    for i, ch in enumerate(sub):
        if ch in ("{", "["):
            stack.append(ch)
        elif ch in ("}", "]"):
            if not stack:
                continue
            last = stack.pop()
            if (last == "{" and ch != "}") or (last == "[" and ch != "]"):
                # mismatch; keep scanning
                continue
            if not stack:
                return sub[: i + 1].strip()
    return sub.strip()


def _safe_json(text: str) -> Dict[str, Any]:
    """Parse JSON from model output. Returns {} on failure."""
    raw = (text or "").strip()
    if not raw:
        return {}

    # try direct
    try:
        v = json.loads(raw)
        return v if isinstance(v, dict) else {}
    except Exception:
        pass

    # try extracted first JSON
    candidate = _extract_first_json(raw)
    if not candidate:
        return {}

    try:
        v = json.loads(candidate)
        return v if isinstance(v, dict) else {}
    except Exception:
        return {}


def _clamp_int(v: Any, default: int, lo: int, hi: int) -> int:
    try:
        n = int(v)
    except Exception:
        n = default
    if n < lo:
        return lo
    if n > hi:
        return hi
    return n


def _normalize_history(history: List[Dict[str, str]]) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    for m in history or []:
        role = str(m.get("role", "")).strip()
        content = str(m.get("content", "")).strip()
        if role in ("user", "assistant") and content:
            out.append({"role": role, "content": content})
    return out


def _normalize_plan(
    plan: Dict[str, Any],
    *,
    fallback_user_id: str | None,
    fallback_start: str | None,
    fallback_end: str | None,
) -> Dict[str, Any]:
    """Return a plan dict with safe defaults and validated shapes."""
    p: Dict[str, Any] = dict(plan or {})

    # Core flags
    p["intent"] = str(p.get("intent") or "").strip()
    p["needs_transactions"] = bool(p.get("needs_transactions", False))
    p["needs_kb"] = bool(p.get("needs_kb", False))
    p["kb_query"] = str(p.get("kb_query") or "").strip()

    # tx_filters
    tx = p.get("tx_filters")
    tx = tx if isinstance(tx, dict) else {}

    tx_user = tx.get("user_id")
    tx_start = tx.get("start_date")
    tx_end = tx.get("end_date")

    tx["user_id"] = str(tx_user).strip() if isinstance(tx_user, str) and tx_user.strip() else fallback_user_id
    tx["start_date"] = str(tx_start).strip() if isinstance(tx_start, str) and tx_start.strip() else fallback_start
    tx["end_date"] = str(tx_end).strip() if isinstance(tx_end, str) and tx_end.strip() else fallback_end

    # Limit defaults and clamp
    tx["limit"] = _clamp_int(tx.get("limit", 5000), 5000, 1, 5000)

    p["tx_filters"] = tx

    # actions
    acts = p.get("actions")
    if not isinstance(acts, list):
        acts = []
    norm_acts: List[Dict[str, Any]] = []
    for a in acts:
        if not isinstance(a, dict):
            continue
        t = str(a.get("type") or "").strip()
        tool = str(a.get("tool") or "").strip()
        reason = str(a.get("reason") or "").strip()
        if t == "tool_call" and tool in ("get_transactions", "kb_search"):
            norm_acts.append({"type": "tool_call", "tool": tool, "reason": reason})
    p["actions"] = norm_acts

    # response_style
    rs = p.get("response_style")
    rs = rs if isinstance(rs, dict) else {}
    rs_tone = str(rs.get("tone") or "").strip()
    rs_fmt = str(rs.get("format") or "").strip()
    rs_must = rs.get("must_cite_evidence", True)

    if not rs_tone:
        rs_tone = "supportive + precise"
    if rs_fmt not in ("bullets", "steps", "email", "analysis", "chat"):
        rs_fmt = "steps"

    rs["tone"] = rs_tone
    rs["format"] = rs_fmt
    rs["must_cite_evidence"] = bool(rs_must)
    p["response_style"] = rs

    return p


def _tool_error_ev(tool: str, err: Exception) -> EvidenceItem:
    return EvidenceItem(
        source="tool_error",
        title=f"Tool error: {tool}",
        snippet=f"{type(err).__name__}: {str(err)}",
        url=None,
        meta={"tool": tool},
    )


# -----------------------------
# RAG pipeline
# -----------------------------

def plan_and_fetch_evidence(
    *,
    system: str,
    user_prompt: str,
    history: List[Dict[str, str]],
    user_id: str | None,
    start_date: str | None,
    end_date: str | None,
    domain: str,
) -> Tuple[Dict[str, Any], List[EvidenceItem], Dict[str, Any]]:
    """Returns: (plan, evidence_list, debug)."""

    history = _normalize_history(history)

    planner_system = system + f"\n\nYou are the PLANNER for domain={domain}. Output JSON only."
    planner_user = (
        f"User message:\n{user_prompt}\n\n"
        f"Known context:\nuser_id={user_id}\nstart_date={start_date}\nend_date={end_date}\n\n"
        f"Rules:\n- Prefer evidence.\n- Use tools only if needed.\n- Keep tool calls <= {settings.max_tool_calls}\n\n"
        f"Schema:\n{PLANNER_JSON_SCHEMA}"
    )

    plan_text = gemini_generate(
        system=planner_system,
        user=planner_user,
        extra_messages=history,
        temperature=0.15,
        max_output_tokens=900,
        timeout_s=settings.request_timeout_s,
    )

    parsed = _safe_json(plan_text)
    plan = _normalize_plan(parsed, fallback_user_id=user_id, fallback_start=start_date, fallback_end=end_date)

    evidence: List[EvidenceItem] = []
    debug: Dict[str, Any] = {
        "plan_raw": plan_text,
        "plan_parsed": parsed,
        "plan": plan,
        "domain": domain,
    }

    # Decide tool calls
    needs_tx = bool(plan.get("needs_transactions", False))
    needs_kb = bool(plan.get("needs_kb", False))

    # Enforce tool-call budget deterministically.
    tool_budget = _clamp_int(getattr(settings, "max_tool_calls", 2), 2, 0, 10)

    # Always enforce safe defaults from normalized plan
    tx_filters = plan.get("tx_filters") if isinstance(plan.get("tx_filters"), dict) else {}
    tx_user_id = tx_filters.get("user_id")
    tx_start = tx_filters.get("start_date")
    tx_end = tx_filters.get("end_date")
    tx_limit = _clamp_int(tx_filters.get("limit", 5000), 5000, 1, 5000)

    # If planner failed (empty dict), avoid guessing tool calls.
    planner_ok = bool(parsed)
    debug["planner_ok"] = planner_ok

    # Priority: transactions first (generally more actionable in support), then KB.
    if planner_ok and needs_tx and tool_budget > 0:
        try:
            rows, ev = get_transactions(user_id=tx_user_id, start_date=tx_start, end_date=tx_end, limit=tx_limit)
            evidence.append(ev)
            debug["tx_rows_sample"] = rows[:50]
        except Exception as e:
            evidence.append(_tool_error_ev("get_transactions", e))
            debug["tx_error"] = str(e)
        tool_budget -= 1

    if planner_ok and needs_kb and tool_budget > 0:
        try:
            kbq = (plan.get("kb_query") or user_prompt).strip()
            kb_evs = kb_search(kbq, k=min(5, settings.max_evidence_items))
            evidence.extend(kb_evs)
        except Exception as e:
            evidence.append(_tool_error_ev("kb_search", e))
            debug["kb_error"] = str(e)
        tool_budget -= 1

    # Truncate evidence list
    evidence = evidence[: settings.max_evidence_items]
    debug["evidence_count"] = len(evidence)

    return plan, evidence, debug


def answer_with_citations(
    *,
    system: str,
    user_prompt: str,
    history: List[Dict[str, str]],
    plan: Dict[str, Any],
    evidence: List[EvidenceItem],
    debug: Dict[str, Any],
    domain: str,
) -> str:
    """Ask Gemini to answer grounded in evidence. Uses [E1], [E2] citations."""

    history = _normalize_history(history)

    ev_lines: List[str] = []
    for i, e in enumerate(evidence, start=1):
        ev_lines.append(
            f"[E{i}] source={e.source} title={e.title}\n"
            f"snippet={e.snippet}\n"
            f"url={e.url or ''}\n"
            f"meta={json.dumps(e.meta, ensure_ascii=False)}\n"
        )
    ev_block = "\n\n".join(ev_lines) if ev_lines else "No evidence available."

    rs = plan.get("response_style") if isinstance(plan.get("response_style"), dict) else {}
    tone = str(rs.get("tone") or "").strip() or ("supportive + precise" if domain == "support" else "confident + technical")
    fmt = str(rs.get("format") or "steps").strip() or "steps"
    must_cite = bool(rs.get("must_cite_evidence", True))

    answer_system = system + f"\n\nYou are the ANSWERER for domain={domain}."
    answer_user = f"""
User message:
{user_prompt}

Planner intent:
{plan.get('intent','')}

Evidence:
{ev_block}

Rules:
- Be natural, helpful, and cover edge cases.
- Never invent facts, amounts, merchants, policies, or system state.
- If you make a factual claim based on evidence, cite it as [E#].
- If evidence is missing, say what is missing and ask the minimum necessary follow-up questions.
- Output format: {fmt}
- Tone: {tone}
- {'Citations required.' if must_cite else 'Citations optional.'}
"""

    return gemini_generate(
        system=answer_system,
        user=answer_user,
        extra_messages=history,
        temperature=0.25,
        max_output_tokens=1400,
        timeout_s=settings.request_timeout_s,
    )