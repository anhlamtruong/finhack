from __future__ import annotations

import json
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, cast

import streamlit as st

from common.config import settings
from common.rag import plan_and_fetch_evidence, answer_with_citations
from common.schemas import EvidenceItem


# -----------------------------
# Page config
# -----------------------------
st.set_page_config(
    page_title="Company View • Customer Support",
    page_icon="🎧",
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
    css = css_path.read_text(encoding="utf-8").replace("<style>", "").replace("</style>", "")
    return css


def load_css() -> None:
    if st.session_state.get("_css_injected__company_view_support"):
        return

    base_css = _read_css()
    if base_css:
        st.markdown(f"<style>{base_css}</style>", unsafe_allow_html=True)

    st.markdown(
        """
<style>
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

div[data-testid="stChatMessage"]{
  border-radius:18px !important;
  border:1px solid rgba(255,255,255,.06);
  background:rgba(8,13,38,.40);
  box-shadow:0 10px 28px rgba(0,0,0,.25);
  backdrop-filter: blur(14px);
  padding:10px 12px !important;
  margin:10px 0 !important;
}
div[data-testid="stChatMessage"] *{ color:rgba(255,255,255,.90); }

div[data-testid="stChatMessage"][data-message-author="user"]{
  background:linear-gradient(135deg, rgba(10,18,64,.60), rgba(8,13,38,.55));
  border:1px solid rgba(255,255,255,.10);
}
div[data-testid="stChatMessage"][data-message-author="assistant"]{
  background:linear-gradient(135deg, rgba(255,61,154,.18), rgba(10,18,64,.55));
  border:1px solid rgba(255,61,154,.20);
}

.cv-ts{opacity:.0;font-size:11px;font-weight:800;color:rgba(255,255,255,.65);margin-top:6px;transition:opacity .2s ease;}
div[data-testid="stChatMessage"]:hover .cv-ts{opacity:1;}

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
</style>
""",
        unsafe_allow_html=True,
    )

    st.session_state["_css_injected__company_view_support"] = True


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
      <div style="font-size:12px;opacity:.70;">Now</div>
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


def _ts() -> str:
    return datetime.now().strftime("%H:%M")


def _ensure_state() -> None:
    if "support_chat" not in st.session_state:
        st.session_state["support_chat"] = []
    if "support_ticket" not in st.session_state:
        st.session_state["support_ticket"] = {
            "id": "TCK-1042",
            "priority": "High",
            "status": "Open",
            "topic": "Disputed transaction",
            "customer": "Customer #4921",
        }
    if "support_notes" not in st.session_state:
        st.session_state["support_notes"] = []


def _append(role: str, content: str, evidence: Optional[List[Dict[str, Any]]] = None, debug: Optional[Dict[str, Any]] = None) -> None:
    st.session_state["support_chat"].append(ChatMsg(role=role, content=content, ts=_ts(), evidence=evidence, debug=debug).__dict__)


def _messages() -> List[Dict[str, Any]]:
    return cast(List[Dict[str, Any]], st.session_state.get("support_chat", []))


# -----------------------------
# Support assistant (Gemini + RAG)
# -----------------------------
def _clip(s: str, n: int = 280) -> str:
    s = (s or "").strip()
    if len(s) <= n:
        return s
    return s[: n - 1].rstrip() + "…"


def _to_history_for_rag(msgs: List[Dict[str, Any]], max_turns: int = 12) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    for m in msgs[-max_turns:]:
        role = str(m.get("role") or "").strip()
        content = str(m.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            out.append({"role": role, "content": content})
    return out


def _make_local_note_evidence(query: str, notes: List[Dict[str, str]], max_items: int = 3) -> List[EvidenceItem]:
    q = (query or "").strip().lower()
    if not q:
        return []

    out: List[EvidenceItem] = []
    for it in notes:
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


def _support_assistant_generate(
    *,
    user_text: str,
    history_msgs: List[Dict[str, Any]],
    ticket: Dict[str, Any],
    tone: str,
    workflow: str,
    user_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    local_notes: Optional[List[Dict[str, str]]] = None,
) -> Tuple[str, List[Dict[str, Any]], Dict[str, Any]]:
    system = (
        "You are Chuchube Finance Customer Support. Write replies that are accurate, safe, and helpful. "
        "Ask for missing details when needed. Prefer evidence when available. "
        "Never invent transaction details, merchant names, or outcomes. "
        f"Tone: {tone}. Workflow: {workflow}."
    )

    rag_history = _to_history_for_rag(history_msgs)

    context_block = {
        "ticket": ticket,
        "tone": tone,
        "workflow": workflow,
        "user_id": user_id,
        "start_date": start_date,
        "end_date": end_date,
    }
    user_prompt = f"""Customer message / request:
{user_text}

Context (operator-provided):
{json.dumps(context_block, ensure_ascii=False, indent=2)}
"""

    plan, evidence, debug = plan_and_fetch_evidence(
        system=system,
        user_prompt=user_prompt,
        history=rag_history,
        user_id=user_id,
        start_date=start_date,
        end_date=end_date,
        domain="support",
    )

    local_notes = local_notes or []
    local_evs = _make_local_note_evidence(user_text, local_notes, max_items=3)
    if local_evs:
        evidence = (cast(List[EvidenceItem], evidence) + local_evs)[: settings.max_evidence_items]

    answer = answer_with_citations(
        system=system,
        user_prompt=user_prompt,
        history=rag_history,
        plan=plan,
        evidence=evidence,
        debug=debug,
        domain="support",
    )

    evidence_dicts: List[Dict[str, Any]] = [e.model_dump() for e in evidence]
    return answer, evidence_dicts, debug


# -----------------------------
# Page
# -----------------------------
def main() -> None:
    load_css()
    _ensure_state()

    header("🎧 Customer Service Support", "Ticket triage + consistent tone. Evidence-grounded replies, quick actions, export.")
    top_nav()

    with st.sidebar:
        st.markdown("### 🎧 Support Assistant")
        st.caption("Draft replies grounded in evidence (transactions + KB).")

        st.markdown("---")
        st.markdown("#### 🎫 Ticket")
        t = st.session_state["support_ticket"]
        t["id"] = st.text_input("ID", value=str(t.get("id", "")))
        t["priority"] = st.selectbox("Priority", ["Low", "Medium", "High", "Urgent"], index=(["Low", "Medium", "High", "Urgent"].index(str(t.get("priority", "High"))) if str(t.get("priority", "High")) in ["Low", "Medium", "High", "Urgent"] else 2))
        t["status"] = st.selectbox("Status", ["Open", "Pending", "Resolved"], index=(["Open", "Pending", "Resolved"].index(str(t.get("status", "Open"))) if str(t.get("status", "Open")) in ["Open", "Pending", "Resolved"] else 0))
        t["topic"] = st.text_input("Topic", value=str(t.get("topic", "")))
        t["customer"] = st.text_input("Customer", value=str(t.get("customer", "")))

        st.markdown("---")
        st.markdown("#### 🧭 Reply settings")
        tone = st.selectbox("Tone", ["Warm + confident", "Very empathetic", "Short + direct"], index=0)
        workflow = st.selectbox("Workflow", ["Refund / dispute", "Bug / app issue", "General inquiry"], index=0)

        st.markdown("---")
        st.markdown("#### 🔎 Optional evidence filters")
        user_id = st.text_input("User ID (optional)", value="", placeholder="user_...").strip() or None
        sd = st.text_input("Start date (YYYY-MM-DD)", value="", placeholder="2026-01-01").strip() or None
        ed = st.text_input("End date (YYYY-MM-DD)", value="", placeholder="2026-01-31").strip() or None
        show_debug = st.toggle("Show debug", value=bool(settings.enable_debug))

        st.markdown("---")
        st.markdown("#### 🧠 Local notes (optional)")
        up = st.file_uploader("Upload .txt / .md (policies, SOPs)", type=["txt", "md"], accept_multiple_files=True)
        if up:
            for f in up:
                try:
                    txt = f.read().decode("utf-8", errors="ignore")
                    st.session_state["support_notes"].append({"name": f.name, "text": txt[:50_000]})
                except Exception:
                    pass

        st.markdown("---")
        st.markdown("#### ⬇️ Export")
        msgs = _messages()
        st.download_button(
            "Export JSON",
            data=json.dumps(msgs, indent=2).encode("utf-8"),
            file_name="support_chat.json",
            mime="application/json",
            use_container_width=True,
        )
        st.download_button(
            "Export Markdown",
            data="\n\n".join([f"**{m['role']} ({m['ts']})**\n\n{m['content']}" for m in msgs]).encode("utf-8"),
            file_name="support_chat.md",
            mime="text/markdown",
            use_container_width=True,
        )

        if st.button("🧹 Clear chat", use_container_width=True):
            st.session_state["support_chat"] = []
            st.rerun()

    left, right = st.columns([1.6, 1.0])

    with right:
        st.markdown("### 🧾 Ticket")
        t = st.session_state["support_ticket"]
        st.markdown(f"**ID:** {t.get('id','')}")
        st.markdown(f"**Priority:** {t.get('priority','')}")
        st.markdown(f"**Status:** {t.get('status','')}")
        st.markdown(f"**Topic:** {t.get('topic','')}")
        st.markdown(f"**Customer:** {t.get('customer','')}")

        st.markdown("---")
        st.markdown("### ⚡ Quick replies")
        c1, c2, c3 = st.columns(3)
        with c1:
            if st.button("Ask for details", use_container_width=True):
                st.session_state["support_draft"] = "Please share the transaction date, amount, and merchant name (as shown), plus the email on the account."
                st.rerun()
        with c2:
            if st.button("Apologize + reassure", use_container_width=True):
                st.session_state["support_draft"] = "Sorry for the trouble — we’ll get this resolved. I’m reviewing this now and will share next steps shortly."
                st.rerun()
        with c3:
            if st.button("Escalate", use_container_width=True):
                st.session_state["support_draft"] = "I’m escalating this to our specialist team. I’ll update you as soon as I have confirmation."
                st.rerun()

        st.markdown("---")
        st.markdown("### ✍️ Draft composer")
        draft_txt = st.session_state.get("support_draft", "")
        draft_txt = st.text_area("(Optional) Edit before sending", value=draft_txt, height=140)
        send_draft = st.button("Send draft", use_container_width=True)

    with left:
        st.markdown('<div class="cv-chat-shell">', unsafe_allow_html=True)
        st.markdown(
            """
<div class="cv-chat-header">
  <div>
    <div class="cv-chat-title">Conversation</div>
    <div class="cv-chat-sub">Fancy chat • evidence • export</div>
  </div>
  <div style="opacity:.7;font-weight:900;font-size:12px;">Support Mode</div>
</div>
""",
            unsafe_allow_html=True,
        )

        msgs = _messages()
        for m in msgs:
            with st.chat_message(m["role"]):
                st.markdown(m["content"])
                st.markdown(f'<div class="cv-ts">{m["ts"]}</div>', unsafe_allow_html=True)

                if m.get("role") == "assistant":
                    evs = m.get("evidence") or []
                    if isinstance(evs, list) and len(evs) > 0:
                        with st.expander("Evidence (latest)"):
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

        prompt = st.chat_input("Paste a customer message or ask for a draft reply…")

        if send_draft and draft_txt.strip():
            st.session_state.pop("support_draft", None)
            prompt = draft_txt.strip()

        if prompt:
            _append("user", prompt)

            typing = st.empty()
            typing.markdown(
                '<div style="padding:10px 12px;"><span class="cv-typing"><span class="cv-dot"></span><span class="cv-dot"></span><span class="cv-dot"></span></span></div>',
                unsafe_allow_html=True,
            )
            time.sleep(0.12)

            try:
                reply, evs, dbg = _support_assistant_generate(
                    user_text=prompt,
                    history_msgs=msgs,
                    ticket=cast(Dict[str, Any], st.session_state.get("support_ticket", {})),
                    tone=tone,
                    workflow=workflow,
                    user_id=user_id,
                    start_date=sd,
                    end_date=ed,
                    local_notes=cast(List[Dict[str, str]], st.session_state.get("support_notes", [])),
                )
            except Exception as e:
                reply = (
                    "Sorry — support assistant failed to generate a response. "
                    "Check GEMINI_API_KEY and TX_API_BASE/Supabase settings, then retry.\n\n"
                    f"Error: {type(e).__name__}: {e}"
                )
                evs = []
                dbg = {"error": str(e)}

            typing.empty()
            _append("assistant", reply, evidence=evs, debug=dbg)
            st.rerun()

        st.markdown("</div>", unsafe_allow_html=True)


if __name__ == "__main__":
    main()
