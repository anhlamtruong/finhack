from __future__ import annotations

import json
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, cast

import streamlit as st

from common.config import settings
from common.rag import answer_with_citations, plan_and_fetch_evidence
from common.schemas import EvidenceItem


# -----------------------------
# Page config
# -----------------------------
st.set_page_config(
    page_title="Company View • Employee Assistant",
    page_icon="🧑‍💼",
    layout="wide",
    initial_sidebar_state="expanded",
)


# -----------------------------
# Theme helpers
# -----------------------------
def _app_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _read_css() -> str:
    css_path = _app_root() / "assets" / "styles.css"
    if not css_path.exists():
        return ""
    return css_path.read_text(encoding="utf-8").replace("<style>", "").replace("</style>", "")


def load_css() -> None:
    if st.session_state.get("_css_injected__company_view"):
        return

    base_css = _read_css()
    if base_css:
        st.markdown(f"<style>{base_css}</style>", unsafe_allow_html=True)

    # Chat-specific polish (dark, pink×navy, glassmorphism, bubbles, typing dots)
    st.markdown(
        """
<style>
/* --- Chat layout containers --- */
.cv-chat-shell{
  border-radius:22px;
  border:1px solid rgba(255,61,154,.18);
  background:rgba(8,13,38,.40);
  box-shadow:0 18px 55px rgba(0,0,0,.35);
  backdrop-filter: blur(16px);
  overflow:hidden;
}
.cv-chat-header{
  padding:14px 16px;
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  border-bottom:1px solid rgba(255,255,255,.08);
  background:linear-gradient(135deg, rgba(255,61,154,.10), rgba(10,18,64,.10));
}
.cv-chat-title{font-weight:950;font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.86);}
.cv-chat-sub{font-weight:800;font-size:12px;color:rgba(255,255,255,.70);margin-top:2px;}

.cv-chiprow{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 2px;}

/* --- Message bubbles (override Streamlit chat) --- */
div[data-testid="stChatMessage"]{
  border-radius:18px !important;
  border:1px solid rgba(255,255,255,.06);
  background:rgba(8,13,38,.40);
  box-shadow:0 10px 28px rgba(0,0,0,.25);
  backdrop-filter: blur(14px);
  padding:10px 12px !important;
  margin:10px 0 !important;
}

div[data-testid="stChatMessage"] *{
  color:rgba(255,255,255,.90);
}

/* user bubble */
div[data-testid="stChatMessage"][data-message-author="user"]{
  background:linear-gradient(135deg, rgba(10,18,64,.60), rgba(8,13,38,.55));
  border:1px solid rgba(255,255,255,.10);
}

/* assistant bubble */
div[data-testid="stChatMessage"][data-message-author="assistant"]{
  background:linear-gradient(135deg, rgba(255,61,154,.18), rgba(10,18,64,.55));
  border:1px solid rgba(255,61,154,.20);
}

/* timestamps: appear on hover */
.cv-ts{opacity:.0;font-size:11px;font-weight:800;color:rgba(255,255,255,.65);margin-top:6px;transition:opacity .2s ease;}
div[data-testid="stChatMessage"]:hover .cv-ts{opacity:1;}

/* typing indicator dots */
.cv-typing{display:inline-flex;align-items:center;gap:6px;padding:10px 12px;border-radius:16px;
  background:rgba(255,61,154,.14);border:1px solid rgba(255,61,154,.22);}
.cv-dot{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.85);opacity:.65;animation:cvb 1.1s infinite;}
.cv-dot:nth-child(2){animation-delay:.15s}
.cv-dot:nth-child(3){animation-delay:.30s}
@keyframes cvb{0%,100%{transform:translateY(0);opacity:.45}50%{transform:translateY(-4px);opacity:1}}

.cv-card{
  border-radius:18px;
  border:1px solid rgba(255,255,255,.08);
  background:rgba(8,13,38,.35);
  box-shadow:0 14px 40px rgba(0,0,0,.25);
  backdrop-filter: blur(14px);
  padding:12px 12px;
}

.cv-kbitem{padding:10px 10px;border-radius:14px;border:1px solid rgba(255,61,154,.14);background:rgba(255,61,154,.07);margin:8px 0;}

/* Draft box */
.cv-draft{
  border-radius:16px;
  border:1px solid rgba(255,61,154,.18);
  background:rgba(8,13,38,.28);
  padding:12px;
  margin-top:10px;
}
</style>
""",
        unsafe_allow_html=True,
    )

    st.session_state["_css_injected__company_view"] = True


# -----------------------------
# Shared nav (8 tabs)
# -----------------------------
def top_nav() -> None:
    st.markdown('<div class="navbar">', unsafe_allow_html=True)
    cols = st.columns(8)
    pages = [
        ("🏁 Overview", "pages/01_Overview.py"),
        ("👥 Users", "pages/02_Users.py"),
        ("💳 Transactions", "pages/03_Transactions.py"),
        ("🚨 Alerts", "pages/04_Alerts.py"),
        ("🎬 Content AI", "pages/05_Content_AI.py"),
        ("🛠️ System", "pages/06_System.py"),
        ("🧑‍💼 Employee", "pages/07_Employee_Assistant.py"),
        ("🎧 Support", "pages/08_Customer_Support.py"),
    ]
    for (label, p), c in zip(pages, cols):
        with c:
            try:
                st.page_link(p, label=label)
            except Exception:
                st.markdown(f"<span class='navpill'>{label}</span>", unsafe_allow_html=True)
    st.markdown("</div>", unsafe_allow_html=True)


def header(title: str, subtitle: str) -> None:
    st.markdown(
        f"""
<div class="company-header">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
    <div>
      <div style="font-size:30px;font-weight:950;letter-spacing:-0.02em;">{title}</div>
      <div style="opacity:.86;margin-top:6px;font-size:13px;font-weight:800;">{subtitle}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:12px;opacity:.70;">Session</div>
      <div style="font-weight:950;">{datetime.now().strftime('%Y-%m-%d %H:%M')}</div>
    </div>
  </div>
</div>
""",
        unsafe_allow_html=True,
    )


# -----------------------------
# Chat state
# -----------------------------
@dataclass
class ChatMsg:
    role: str  # "user" | "assistant"
    content: str
    ts: str
    evidence: Optional[List[Dict[str, Any]]] = None
    debug: Optional[Dict[str, Any]] = None


def _now_ts() -> str:
    return datetime.now().strftime("%H:%M")


def _ensure_chat_state(key: str) -> None:
    if key not in st.session_state:
        st.session_state[key] = []
    if f"{key}__threads" not in st.session_state:
        st.session_state[f"{key}__threads"] = [{"id": "default", "title": "Main"}]
    if f"{key}__active" not in st.session_state:
        st.session_state[f"{key}__active"] = "default"


def _get_thread_key(base: str) -> str:
    active = st.session_state.get(f"{base}__active", "default")
    return f"{base}__thread__{active}"


def _append(
    base: str,
    role: str,
    content: str,
    evidence: Optional[List[Dict[str, Any]]] = None,
    debug: Optional[Dict[str, Any]] = None,
) -> None:
    k = _get_thread_key(base)
    if k not in st.session_state:
        st.session_state[k] = []
    st.session_state[k].append(ChatMsg(role=role, content=content, ts=_now_ts(), evidence=evidence, debug=debug).__dict__)


def _messages(base: str) -> List[Dict[str, Any]]:
    k = _get_thread_key(base)
    return cast(List[Dict[str, Any]], st.session_state.get(k, []))


# -----------------------------
# Real assistant (Gemini + light RAG)
# -----------------------------
def _clip(s: str, n: int = 280) -> str:
    s = (s or "").strip()
    if len(s) <= n:
        return s
    return s[: n - 1].rstrip() + "…"


def _make_local_note_evidence(query: str, kb_items: List[Dict[str, str]], max_items: int = 3) -> List[EvidenceItem]:
    """Turn uploaded local notes into EvidenceItem entries (simple substring match)."""
    q = (query or "").strip().lower()
    if not q:
        return []

    out: List[EvidenceItem] = []
    for it in kb_items:
        if len(out) >= max_items:
            break
        name = str(it.get("name") or "note")
        text = str(it.get("text") or "")
        hay = text.lower()
        idx = hay.find(q)
        if idx < 0:
            continue

        lo = max(0, idx - 120)
        hi = min(len(text), idx + 220)
        snippet = text[lo:hi].replace("\n", " ").strip()

        out.append(
            EvidenceItem(
                source="local_note",
                title=f"Local note: {name}",
                snippet=_clip(snippet, 320),
                url=None,
                meta={"name": name, "match": q},
            )
        )

    return out


def _to_history_for_rag(msgs: List[Dict[str, Any]], max_turns: int = 12) -> List[Dict[str, str]]:
    """Convert messages into {role, content} for the RAG helper."""
    out: List[Dict[str, str]] = []
    for m in msgs[-max_turns:]:
        role = str(m.get("role") or "").strip()
        content = str(m.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            out.append({"role": role, "content": content})
    return out


def _employee_assistant_generate(
    *,
    user_text: str,
    history_msgs: List[Dict[str, Any]],
    persona: str,
    kb_items: List[Dict[str, str]],
    user_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Tuple[str, List[Dict[str, Any]], Dict[str, Any]]:
    """Return (answer_markdown, evidence_dicts, debug)."""

    persona_rules = {
        "Professional": "Be concise, structured, and action-oriented.",
        "Technical": "Be precise, include commands/checklists, and call out edge cases.",
        "Casual": "Be friendly and straightforward, but still correct.",
    }
    persona_rule = persona_rules.get(persona, persona_rules["Professional"])

    system = (
        "You are Chuchube Finance's internal employee assistant. "
        "Help with ops runbooks, incident summaries, metrics questions, and internal drafting. "
        "Prefer evidence when available. "
        + persona_rule
    )

    rag_history = _to_history_for_rag(history_msgs)

    # Local notes as extra evidence
    local_evs = _make_local_note_evidence(user_text, kb_items, max_items=3)

    plan, evidence, debug = plan_and_fetch_evidence(
        system=system,
        user_prompt=user_text,
        history=rag_history,
        user_id=user_id,
        start_date=start_date,
        end_date=end_date,
        domain="employee",
    )

    if local_evs:
        evidence = (cast(List[EvidenceItem], evidence) + local_evs)[: settings.max_evidence_items]

    answer = answer_with_citations(
        system=system,
        user_prompt=user_text,
        history=rag_history,
        plan=plan,
        evidence=evidence,
        debug=debug,
        domain="employee",
    )

    evidence_dicts: List[Dict[str, Any]] = [e.model_dump() for e in evidence]
    return answer, evidence_dicts, debug


# -----------------------------
# Page
# -----------------------------
def main() -> None:
    load_css()
    _ensure_chat_state("empchat")

    header("🧑‍💼 Employee Assistant", "Internal helper: runbooks, metrics questions, incident notes, and drafting.")
    top_nav()

    # ---------- Sidebar controls ----------
    with st.sidebar:
        st.markdown("### 🧑‍💼 Employee Assistant")
        st.caption("Uses Gemini + evidence tools (transactions + KB + local notes).")

        st.markdown("---")
        st.markdown("#### ✅ Runtime config")
        st.write(f"**Gemini model:** `{settings.gemini_model}`")
        st.write(f"**GEMINI_API_KEY present?** `{bool(settings.gemini_api_key)}`")
        st.write(f"**TX_API_BASE:** `{settings.tx_api_base or '(not set)'}`")
        if not settings.gemini_api_key:
            st.warning("GEMINI_API_KEY is missing. Chat will fail until it's set.")

        st.markdown("---")
        st.markdown("#### 📅 Optional date range (tools)")
        sd = st.text_input("Start date (YYYY-MM-DD)", value="", placeholder="2026-01-01")
        ed = st.text_input("End date (YYYY-MM-DD)", value="", placeholder="2026-01-31")
        user_id = st.text_input("User ID (optional)", value="", placeholder="user_...")
        show_debug = st.toggle("Show debug (plan/tool info)", value=bool(settings.enable_debug))

        sd = sd.strip() or None
        ed = ed.strip() or None
        user_id = user_id.strip() or None

        persona = st.selectbox("AI Persona", ["Professional", "Technical", "Casual"], index=0)

        st.markdown("---")
        st.markdown("#### 🧠 Internal Notes (local)")
        up = st.file_uploader("Upload .txt / .md notes", type=["txt", "md"], accept_multiple_files=True)
        if "empchat_kb" not in st.session_state:
            st.session_state["empchat_kb"] = []

        if up:
            for f in up:
                try:
                    txt = f.read().decode("utf-8", errors="ignore")
                    st.session_state["empchat_kb"].append({"name": f.name, "text": txt[:50_000]})
                except Exception:
                    pass

        q = st.text_input("Search notes", value="", placeholder="e.g. outage, SLA, refund policy…")
        if q.strip():
            hits = 0
            for it in st.session_state.get("empchat_kb", []):
                if q.lower() in str(it.get("text") or "").lower():
                    hits += 1
            if hits:
                st.success(f"Found {hits} note(s) matching '{q}'.")
            else:
                st.info("No matches yet.")

        st.markdown("---")
        st.markdown("#### 🗂️ Conversations")
        threads = cast(List[Dict[str, str]], st.session_state["empchat__threads"])
        active = cast(str, st.session_state["empchat__active"])
        labels = [f"{'✅ ' if t['id']==active else ''}{t['title']}" for t in threads]
        pick = st.selectbox("Switch thread", labels, index=max(0, [t["id"] for t in threads].index(active)))
        st.session_state["empchat__active"] = threads[labels.index(pick)]["id"]

        if st.button("➕ New thread", use_container_width=True):
            tid = f"t{int(time.time())}"
            threads.append({"id": tid, "title": f"Thread {len(threads)+1}"})
            st.session_state["empchat__active"] = tid
            st.rerun()

        st.markdown("---")
        st.markdown("#### ⬇️ Export")
        msgs = _messages("empchat")
        st.download_button(
            "Export JSON",
            data=json.dumps(msgs, indent=2).encode("utf-8"),
            file_name="employee_assistant_chat.json",
            mime="application/json",
            use_container_width=True,
        )
        st.download_button(
            "Export Markdown",
            data="\n\n".join([f"**{m['role']} ({m['ts']})**\n\n{m['content']}" for m in msgs]).encode("utf-8"),
            file_name="employee_assistant_chat.md",
            mime="text/markdown",
            use_container_width=True,
        )

        if st.button("🧹 Clear thread", use_container_width=True):
            st.session_state[_get_thread_key("empchat")] = []
            st.rerun()

    # ---------- Main content ----------
    msgs = _messages("empchat")

    # Starter cards (only when empty)
    if len(msgs) == 0:
        c1, c2, c3 = st.columns(3)
        with c1:
            st.markdown(
                '<div class="cv-card"><b>📌 Incident summary</b><br><span style="opacity:.78;font-weight:700;">Summarize a spike in failed payments.</span></div>',
                unsafe_allow_html=True,
            )
            if st.button("Use: Incident summary", key="emp_s1", use_container_width=True):
                st.session_state["empchat_draft"] = "Summarize today’s incident: payment failures spiked. Give timeline + root cause hypotheses + next steps."
                st.rerun()
        with c2:
            st.markdown(
                '<div class="cv-card"><b>🧾 Draft internal update</b><br><span style="opacity:.78;font-weight:700;">Write a status update for Slack.</span></div>',
                unsafe_allow_html=True,
            )
            if st.button("Use: Status update", key="emp_s2", use_container_width=True):
                st.session_state["empchat_draft"] = "Draft a short internal update about current system status and what we’re doing next."
                st.rerun()
        with c3:
            st.markdown(
                '<div class="cv-card"><b>✅ Ops checklist</b><br><span style="opacity:.78;font-weight:700;">Create an on-call runbook checklist.</span></div>',
                unsafe_allow_html=True,
            )
            if st.button("Use: Runbook checklist", key="emp_s3", use_container_width=True):
                st.session_state["empchat_draft"] = "Create a crisp on-call checklist for investigating transaction ingestion delays."
                st.rerun()

    # Chips = just prompt starters (no canned assistant output)
    chips = [
        "Make a 5-step checklist",
        "Draft an email update",
        "Summarize logs/metrics",
        "Propose 3 options + tradeoffs",
        "Write a postmortem template",
    ]
    chip_cols = st.columns(5)
    for i, txt in enumerate(chips):
        with chip_cols[i]:
            if st.button(txt, key=f"empchip_{i}", use_container_width=True):
                st.session_state["empchat_draft"] = txt + ": "
                st.rerun()

    st.markdown('<div class="cv-chat-shell">', unsafe_allow_html=True)
    st.markdown(
        """
<div class="cv-chat-header">
  <div>
    <div class="cv-chat-title">Conversation</div>
    <div class="cv-chat-sub">WhatsApp-style bubbles • typing indicator • export • threads</div>
  </div>
  <div style="opacity:.7;font-weight:900;font-size:12px;">Employee Mode</div>
</div>
""",
        unsafe_allow_html=True,
    )

    # Render messages
    for m in msgs:
        with st.chat_message(m["role"]):
            st.markdown(m["content"])
            st.markdown(f'<div class="cv-ts">{m["ts"]}</div>', unsafe_allow_html=True)

            if m.get("role") == "assistant":
                evs = m.get("evidence") or []
                if isinstance(evs, list) and len(evs) > 0:
                    with st.expander(f"Evidence ({len(evs)})"):
                        for i, e in enumerate(evs, start=1):
                            title = str(e.get("title") or f"Evidence {i}")
                            source = str(e.get("source") or "")
                            snippet = str(e.get("snippet") or "")
                            url = e.get("url")
                            st.markdown(f"**[E{i}] {title}**")
                            if source:
                                st.caption(f"source: {source}")
                            if snippet:
                                st.write(snippet)
                            if url:
                                st.write(url)
                            st.markdown("---")

                if show_debug and isinstance(m.get("debug"), dict):
                    with st.expander("Debug"):
                        st.json(m.get("debug"))

    # --- Composer ---
    # Streamlit chat_input cannot be prefilled. If we have a draft, show a prefilled textarea + Send.
    draft = cast(str, st.session_state.get("empchat_draft", ""))

    def _send(text: str) -> None:
        text = (text or "").strip()
        if not text:
            return

        _append("empchat", "user", text)

        typing = st.empty()
        typing.markdown(
            '<div style="padding:10px 12px;"><span class="cv-typing"><span class="cv-dot"></span><span class="cv-dot"></span><span class="cv-dot"></span></span></div>',
            unsafe_allow_html=True,
        )

        try:
            reply, evs, dbg = _employee_assistant_generate(
                user_text=text,
                history_msgs=msgs,
                persona=persona,
                kb_items=cast(List[Dict[str, str]], st.session_state.get("empchat_kb", [])),
                user_id=user_id,
                start_date=sd,
                end_date=ed,
            )
        except Exception as e:
            reply = f"⚠️ Error generating response: {e}"
            evs = []
            dbg = {"error": str(e)}

        typing.empty()
        _append("empchat", "assistant", reply, evidence=evs, debug=dbg)
        st.session_state.pop("empchat_draft", None)
        st.rerun()

    if draft:
        st.markdown('<div class="cv-draft">', unsafe_allow_html=True)
        st.caption("Draft ready (from a starter button). Edit, then send.")
        txt = st.text_area("Message", value=draft, height=90, label_visibility="collapsed", key="empchat_draft_box")
        csend, ccancel = st.columns([1, 1])
        with csend:
            if st.button("Send", use_container_width=True, key="empchat_send_draft"):
                _send(txt)
        with ccancel:
            if st.button("Cancel", use_container_width=True, key="empchat_cancel_draft"):
                st.session_state.pop("empchat_draft", None)
                st.rerun()
        st.markdown("</div>", unsafe_allow_html=True)
    else:
        prompt = st.chat_input("Ask internal questions… (runbooks, ops, drafting, metrics)")
        if prompt:
            _send(prompt)

    st.markdown("</div>", unsafe_allow_html=True)


if __name__ == "__main__":
    main()