import json
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Dict, Tuple

import streamlit as st

from lib.config import get_config
from lib.auth import require_login, logout_button


# -----------------------------
# Page config
# -----------------------------
cfg = get_config()

st.set_page_config(
    page_title="Chuchube • Company View",
    page_icon="💗",
    layout="wide",
    initial_sidebar_state="expanded",
)


# -----------------------------
# Theme + CSS
# -----------------------------

def _read_file_text(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8")
    except Exception:
        try:
            return p.read_text()
        except Exception:
            return ""


def _inject_css() -> None:
    """Load shared CSS (assets/styles.css) then add extra app-level polish.

    Notes:
    - We inject a *single* <style> block to avoid Streamlit rendering CSS as text.
    - We strip any accidental <style> wrappers from the shared file.
    """

    def _strip_style_tags(s: str) -> str:
        s = s.replace("<style>", "").replace("</style>", "")
        return s

    css_path = Path(__file__).parent / "assets" / "styles.css"
    base_css = _strip_style_tags(_read_file_text(css_path)) if css_path.exists() else ""

    # Extra polish CSS lives here so we can keep styles.css reusable across pages.
    extra_css = r"""
    /* -------- App-Level upgrades (pink + navy, high-contrast, dark-only) -------- */
    :root{
      --cv-navy:#070B1A;
      --cv-navy2:#0B1026;
      --cv-navy3:#111A3A;
      --cv-ink:#EAF0FF;
      --cv-ink2:rgba(234,240,255,.78);
      --cv-pink:#FF3D9A;
      --cv-pink2:#FF5BB0;
      --cv-pink3:#FF86C8;
      --cv-border:rgba(255,255,255,.10);
      --cv-border2:rgba(255,61,154,.24);
      --cv-glass:rgba(11,16,38,.68);
      --cv-glass2:rgba(17,26,58,.62);
      --cv-shadow: 0 22px 48px rgba(0,0,0,.35);
      --cv-shadow2: 0 16px 34px rgba(255,61,154,.10);
      --cv-radius: 18px;
    }

    /* ---------- Dark animated background (NO white) ---------- */
    .stApp{
      background: radial-gradient(1100px 700px at 10% 0%, rgba(255, 61, 154, .18), transparent 60%),
                  radial-gradient(900px 560px at 92% 10%, rgba(255, 134, 200, .10), transparent 58%),
                  radial-gradient(700px 500px at 75% 90%, rgba(109, 40, 217, .10), transparent 56%),
                  linear-gradient(180deg, var(--cv-navy) 0%, var(--cv-navy2) 45%, #050714 100%);
    }

    /* extra sheen layer */
    .stApp::before{
      content:"";
      position: fixed;
      inset: 0;
      z-index: -1;
      background:
        radial-gradient(900px 520px at 12% 8%, rgba(255, 61, 154, .20), transparent 60%),
        radial-gradient(800px 480px at 88% 14%, rgba(255, 134, 200, .12), transparent 60%),
        radial-gradient(900px 600px at 50% 110%, rgba(255, 61, 154, .10), transparent 62%);
      filter: saturate(1.06);
      animation: cvGlow 7.5s ease-in-out infinite alternate;
    }
    @keyframes cvGlow{
      from{ opacity:.85; transform: translate3d(0,0,0) scale(1); }
      to  { opacity:1; transform: translate3d(0,-3px,0) scale(1.01); }
    }

    /* ---------- Streamlit chrome ---------- */
    header[data-testid="stHeader"]{ background: transparent !important; }
    [data-testid="stToolbar"]{ right: 0.75rem; }

    /* ---------- Sidebar ---------- */
    [data-testid="stSidebar"]{
      background: linear-gradient(180deg, rgba(7,11,26,.92) 0%, rgba(11,16,38,.92) 55%, rgba(7,11,26,.92) 100%) !important;
      border-right: 1px solid rgba(255,255,255,.06);
    }
    [data-testid="stSidebar"] *{ color: var(--cv-ink) !important; }
    [data-testid="stSidebar"] a{ color: var(--cv-ink) !important; }
    [data-testid="stSidebar"] .stButton>button{ width:100%; }

    /* Make default multipage nav look like pills */
    [data-testid="stSidebarNav"] ul{ padding-top: .25rem; }
    [data-testid="stSidebarNav"] li a{
      border-radius: 14px !important;
      padding: 10px 12px !important;
      margin: 6px 0 !important;
      background: rgba(255,255,255,.04) !important;
      border: 1px solid rgba(255,255,255,.08) !important;
      font-weight: 900 !important;
      transition: all .15s ease;
    }
    [data-testid="stSidebarNav"] li a:hover{
      border-color: rgba(255,61,154,.30) !important;
      background: rgba(255,61,154,.10) !important;
      transform: translateY(-1px);
      box-shadow: 0 14px 28px rgba(0,0,0,.25);
    }

    /* ---------- Typography ---------- */
    .stMarkdown, .stText, .stCaption{ color: var(--cv-ink) !important; }
    h1,h2,h3,h4{ color: var(--cv-ink) !important; letter-spacing: -.02em; }

    /* ---------- Cards (our .card class used throughout pages) ---------- */
    .card{
      background: linear-gradient(180deg, var(--cv-glass) 0%, rgba(11,16,38,.52) 100%) !important;
      border: 1px solid var(--cv-border) !important;
      border-radius: var(--cv-radius) !important;
      box-shadow: var(--cv-shadow) !important;
    }

    /* Glass helper for optional wrappers */
    .cv-glass{
      background: linear-gradient(180deg, rgba(11,16,38,.78) 0%, rgba(17,26,58,.60) 100%);
      border: 1px solid var(--cv-border);
      border-radius: var(--cv-radius);
      box-shadow: var(--cv-shadow);
    }
    .cv-glass:hover{
      transform: translateY(-1px);
      transition: transform .14s ease;
    }

    /* Header/hero container (class from styles.css) */
    .company-header{
      background: linear-gradient(135deg, rgba(255,61,154,.16) 0%, rgba(11,16,38,.78) 38%, rgba(17,26,58,.72) 100%) !important;
      border: 1px solid rgba(255,61,154,.22) !important;
      box-shadow: var(--cv-shadow) !important;
    }

    /* ---------- Badges ---------- */
    .cv-badge{
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(255, 61, 154, .12);
      border: 1px solid var(--cv-border2);
      color: var(--cv-ink) !important;
      font-weight: 950;
      font-size: .85rem;
      white-space: nowrap;
    }

    .cv-h2{
      font-size: 1.12rem;
      font-weight: 950;
      color: var(--cv-ink) !important;
      margin: 0 0 6px 0;
    }
    .cv-muted{ color: var(--cv-ink2) !important; font-weight: 800; }

    /* ---------- Navbar pills (top) ---------- */
    .navbar{ display:flex; gap:10px; flex-wrap:wrap; margin: 10px 0 14px 0; }
    .navpill{
      display:inline-flex;
      align-items:center;
      gap:8px;
      background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.10);
      color: var(--cv-ink);
      padding: 9px 12px;
      border-radius: 999px;
      font-weight: 950;
      box-shadow: 0 16px 30px rgba(0,0,0,.26);
      transition: all .16s ease;
    }
    .navpill:hover{
      transform: translateY(-1px);
      border-color: rgba(255, 61, 154, .35);
      background: rgba(255,61,154,.10);
      box-shadow: 0 18px 34px rgba(255,61,154,.12);
    }
    .navpill a{ text-decoration:none !important; font-weight: 950 !important; color: var(--cv-ink) !important; }

    /* ---------- Buttons ---------- */
    .stButton>button, .stFormSubmitButton>button{
      background: linear-gradient(135deg, rgba(255,61,154,.92) 0%, rgba(109,40,217,.55) 60%, rgba(7,11,26,.95) 120%) !important;
      border: 1px solid rgba(255,255,255,.12) !important;
      color: white !important;
      border-radius: 14px !important;
      font-weight: 950 !important;
      padding: .62rem 1rem !important;
      box-shadow: var(--cv-shadow2) !important;
      transition: transform .14s ease, box-shadow .14s ease, filter .14s ease;
    }
    .stButton>button:hover, .stFormSubmitButton>button:hover{
      transform: translateY(-1px);
      filter: brightness(1.06);
      box-shadow: 0 20px 40px rgba(255,61,154,.14);
    }

    .stDownloadButton>button{
      background: linear-gradient(135deg, rgba(11,16,38,.92) 0%, rgba(17,26,58,.86) 55%, rgba(255,61,154,.30) 130%) !important;
      border: 1px solid rgba(255,61,154,.22) !important;
      color: white !important;
      border-radius: 14px !important;
      font-weight: 950 !important;
      padding: .62rem 1rem !important;
      box-shadow: 0 18px 32px rgba(0,0,0,.28) !important;
    }

    /* ---------- Inputs ---------- */
    input, textarea{
      color: var(--cv-ink) !important;
    }
    .stTextInput>div>div, .stDateInput>div>div, .stSelectbox>div>div, .stMultiSelect>div>div{
      background: rgba(255,255,255,.05) !important;
      border: 1px solid rgba(255,255,255,.12) !important;
      border-radius: 14px !important;
    }

    /* ---------- Tabs ---------- */
    [data-testid="stTabs"] button{
      border-radius: 14px !important;
      font-weight: 950 !important;
      color: var(--cv-ink) !important;
    }
    [data-testid="stTabs"] button[aria-selected="true"]{
      background: rgba(255,61,154,.16) !important;
      border: 1px solid rgba(255,61,154,.28) !important;
    }

    /* ---------- Expanders ---------- */
    .streamlit-expanderHeader{
      background: rgba(255,255,255,.04) !important;
      border: 1px solid rgba(255,255,255,.08) !important;
      border-radius: 14px !important;
      font-weight: 950 !important;
      color: var(--cv-ink) !important;
    }

    /* ---------- Metrics ---------- */
    [data-testid="stMetric"]{
      background: linear-gradient(180deg, rgba(11,16,38,.70) 0%, rgba(17,26,58,.55) 100%) !important;
      border: 1px solid rgba(255,255,255,.10) !important;
      border-radius: 18px !important;
      padding: 14px 16px !important;
      box-shadow: 0 18px 34px rgba(0,0,0,.26) !important;
    }
    [data-testid="stMetricLabel"]{ color: var(--cv-ink2) !important; font-weight: 900 !important; }
    [data-testid="stMetricValue"]{ color: var(--cv-ink) !important; font-weight: 950 !important; }

    /* ---------- Dataframes ---------- */
    .stDataFrame, .dataframe{
      border-radius: 16px !important;
      overflow: hidden !important;
      border: 1px solid rgba(255,255,255,.10) !important;
    }

    /* Footer contrast */
    .cv-footer{ color: rgba(234,240,255,.64) !important; }
    """

    st.markdown(f"<style>\n{base_css}\n{extra_css}\n</style>", unsafe_allow_html=True)


_inject_css()


# -----------------------------
# Auth gate
# -----------------------------
require_login(cfg.dashboard_username, cfg.dashboard_password)


# -----------------------------
# Helpers
# -----------------------------

def _in_sample_mode() -> bool:
    # If Supabase not configured or placeholder URL, operate safely in sample mode.
    if not cfg.supabase_url or not cfg.supabase_service_role_key:
        return True
    return "your_project" in (cfg.supabase_url or "").lower()


@st.cache_data(show_spinner=False)
def _generate_sample_kpis(seed: int = 7) -> Dict[str, str]:
    """Lightweight sample KPIs to avoid extra deps; safe, deterministic."""
    # Avoid numpy dependency; use simple arithmetic.
    base_users = 7845
    dau = 2140
    mau = 15220
    aum = 12.4
    churn = 2.1
    risk = 0.17
    return {
        "Active Users": f"{base_users:,}",
        "DAU": f"{dau:,}",
        "MAU": f"{mau:,}",
        "AUM": f"${aum:.1f}M",
        "Churn": f"{churn:.1f}%",
        "Risk Flags": f"{int(risk*100)}%",
    }


def _hero(title: str, subtitle: str) -> None:
    st.markdown(
        f"""
<div class="cv-sticky">
  <div class="company-header">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <div>
        <h1 style="margin:0;">{title}</h1>
        <div style="opacity:.92;margin-top:6px;font-weight:800;">{subtitle}</div>
      </div>
      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <span class="cv-badge">💗 Chuchube Finance</span>
        <span class="cv-badge">🏢 Company View</span>
        <span class="cv-badge">⚡ {"Sample" if _in_sample_mode() else "Live"}</span>
      </div>
    </div>
  </div>
</div>
""",
        unsafe_allow_html=True,
    )


def _top_navbar() -> None:
    """Pill navigation (in addition to Streamlit sidebar nav)."""
    st.markdown('<div class="navbar">', unsafe_allow_html=True)

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

    cols = st.columns(len(pages))
    for c, (label, path) in zip(cols, pages):
        with c:
            st.markdown('<div class="navpill">', unsafe_allow_html=True)
            st.page_link(path, label=label)
            st.markdown("</div>", unsafe_allow_html=True)

    st.markdown("</div>", unsafe_allow_html=True)


def _get_range() -> Tuple[date, date]:
    start = st.session_state.get("range_start")
    end = st.session_state.get("range_end")
    if not isinstance(start, date) or not isinstance(end, date):
        end = date.today()
        start = end - timedelta(days=30)
    if start > end:
        start, end = end, start
    return start, end


def _toast_once(key: str, message: str, icon: str = "💗") -> None:
    if st.session_state.get(key):
        return
    try:
        st.toast(message, icon=icon)
    except Exception:
        # older Streamlit versions
        pass
    st.session_state[key] = True


# -----------------------------
# Sidebar controls (shared)
# -----------------------------
with st.sidebar:
    st.markdown("## 💗 Chuchube")
    st.caption("Company monitoring view")

    st.markdown("---")

    # Theme toggle (UI-only; we keep CSS as pink/navy; toggle is for density + visuals)
    st.markdown("### 🎨 Dashboard Preferences")
    compact = st.toggle("Compact layout", value=bool(st.session_state.get("compact", False)))
    st.session_state["compact"] = compact

    st.markdown("---")

    st.markdown("### 📅 Date Range")
    end = st.date_input("End", value=st.session_state.get("range_end", date.today()))
    start = st.date_input("Start", value=st.session_state.get("range_start", end - timedelta(days=30)))
    if start > end:
        st.error("Start must be <= End")

    st.session_state["range_start"] = start
    st.session_state["range_end"] = end

    st.markdown("---")

    st.markdown("### 🔌 Connections")
    if _in_sample_mode():
        st.info("Supabase: sample mode (safe)")
    else:
        st.success("Supabase: configured")

    # LLM API status hint (we don't call external services here)
    st.caption("LLM API: check **System** tab")

    st.markdown("---")

    logout_button()


# -----------------------------
# Main content
# -----------------------------
_hero(
    "💗 Company Dashboard",
    "Monitor users • app health • spending signals • AI content • system reliability",
)

_top_navbar()

# Onboarding / empty state
if "_seen_onboarding" not in st.session_state:
    _toast_once("_toast_welcome", "Welcome back — Company View is live.")

    with st.expander("✨ Quick tour (first time here)", expanded=True):
        st.markdown(
            """
- **Overview**: Executive KPIs + high-level trends
- **Users**: Growth, engagement, retention snapshots
- **Transactions**: Spend/income flow, categories, anomalies
- **Alerts**: Risk flags, overspend signals, unusual activity
- **Content AI**: Generate mascot motion videos for UI
- **System**: Health checks + environment sanity

Tip: Use the **date range** in the sidebar to re-scope everything.
"""
        )
        if st.button("Got it", use_container_width=True):
            st.session_state["_seen_onboarding"] = True
            st.rerun()


# Density spacing
if st.session_state.get("compact"):
    st.markdown("<style>.block-container{padding-top:.6rem}</style>", unsafe_allow_html=True)


# Status row
start, end = _get_range()
mode_badge = "Sample" if _in_sample_mode() else "Live"

st.markdown(
    f"""
<div class="card">
  <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:space-between;">
    <div>
      <div class="cv-h2">Today at a glance</div>
      <div class="cv-muted">Range: <b>{start.isoformat()}</b> → <b>{end.isoformat()}</b></div>
    </div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
      <span class="cv-badge">🧠 Mode: {mode_badge}</span>
      <span class="cv-badge">🕒 Updated: {datetime.now().strftime('%Y-%m-%d %H:%M')}</span>
    </div>
  </div>
</div>
""",
    unsafe_allow_html=True,
)


# KPI grid
kpis = _generate_sample_kpis()

c1, c2, c3, c4, c5, c6 = st.columns(6)
with c1:
    st.metric("👥 Active Users", kpis["Active Users"], "+12.5%")
with c2:
    st.metric("⚡ DAU", kpis["DAU"], "+4.1%")
with c3:
    st.metric("🌙 MAU", kpis["MAU"], "+6.7%")
with c4:
    st.metric("💰 AUM", kpis["AUM"], "+8.2%")
with c5:
    st.metric("📉 Churn", kpis["Churn"], "-0.3%")
with c6:
    st.metric("🚩 Risk Flags", kpis["Risk Flags"], "+1.0%")


# Main panels
left, right = st.columns([2.2, 1])

with left:
    st.markdown(
        """
<div class="card">
  <div class="cv-h2">Executive summary</div>
  <div class="cv-muted">A quick narrative so stakeholders understand what matters.</div>
  <div style="margin-top:10px;line-height:1.6;color: var(--cv-ink2);font-weight:700;">
    Users are growing steadily and savings behavior is trending positive. The largest operational risk remains
    **overspend spikes** and **category anomalies** — check the Alerts page for flagged segments.
    Content AI can generate mascot motion videos that match the user’s current financial vibe.
  </div>
</div>
""",
        unsafe_allow_html=True,
    )

    # Optional charts (only if installed)
    st.markdown(
        """
<div class="card">
  <div class="cv-h2">Trends (preview)</div>
  <div class="cv-muted">Lightweight charts here — deeper analysis lives in the tabs.</div>
</div>
""",
        unsafe_allow_html=True,
    )

    try:
        import pandas as pd
        import plotly.graph_objects as go

        # Tiny synthetic series for preview.
        days = (end - start).days or 30
        n = max(14, min(90, days + 1))
        idx = pd.date_range(end=pd.Timestamp(end), periods=n, freq="D")
        active = pd.Series(range(n)).apply(lambda i: 5200 + i * 18 + (i % 7) * 22)
        savings = pd.Series(range(n)).apply(lambda i: 310000 + i * 5200 + (i % 10) * 900)

        fig = go.Figure()
        fig.add_trace(go.Scatter(x=idx, y=active, name="Active users", mode="lines"))
        fig.add_trace(go.Scatter(x=idx, y=savings, name="Total savings ($)", mode="lines", yaxis="y2"))
        fig.update_layout(
            height=360,
            margin=dict(l=10, r=10, t=10, b=10),
            plot_bgcolor="rgba(0,0,0,0)",
            paper_bgcolor="rgba(0,0,0,0)",
            hovermode="x unified",
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
            yaxis=dict(title="Users"),
            yaxis2=dict(title="Savings ($)", overlaying="y", side="right"),
        )
        st.plotly_chart(fig, use_container_width=True)
    except Exception:
        st.info("Plot preview unavailable (install `pandas` + `plotly` in this venv if you want charts).")


with right:
    st.markdown(
        """
<div class="card">
  <div class="cv-h2">Quick actions</div>
  <div class="cv-muted">Fast ops you’ll use daily.</div>
</div>
""",
        unsafe_allow_html=True,
    )

    # Action buttons
    a1, a2 = st.columns(2)
    with a1:
        if st.button("🔄 Refresh", use_container_width=True):
            _toast_once("_toast_refreshed", "Refreshed (session re-run)", icon="🔄")
            st.rerun()
    with a2:
        if st.button("✨ Tip", use_container_width=True):
            st.toast("Try **Content AI** → generate a *neutral* mascot video for placeholder UI.", icon="✨")

    st.markdown("---")

    # Report exports (safe, local-only)
    st.markdown("#### 📄 Report exports")

    report_payload = {
        "range": {"start": start.isoformat(), "end": end.isoformat()},
        "mode": mode_badge,
        "kpis": kpis,
        "generatedAt": datetime.now().isoformat(),
    }

    st.download_button(
        "⬇️ Download JSON snapshot",
        data=json.dumps(report_payload, indent=2).encode("utf-8"),
        file_name=f"company_snapshot_{start.isoformat()}_{end.isoformat()}.json",
        mime="application/json",
        use_container_width=True,
    )

    st.caption("PDF export can be added later once we agree on a template.")

    st.markdown("---")

    st.markdown("#### 🧪 Safe mode")
    if _in_sample_mode():
        st.success("You are in **Sample Mode** — no external calls are made.")
        st.caption("To switch to live data, set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.")
    else:
        st.success("Live data is configured.")


# Bottom utility tabs (keeps app.py meaningful even before other pages are perfect)
st.markdown("---")

st.markdown("### Control Center")

tab1, tab2, tab3 = st.tabs(["🧭 Ops", "🧩 Data Notes", "🧠 AI Notes"])

with tab1:
    st.markdown(
        """
<div class="card">
  <div class="cv-h2">Ops checklist</div>
  <div class="cv-muted">Use this to keep daily operations consistent.</div>
  <ul style="margin:10px 0 0 18px;color: var(--cv-ink2);font-weight:750;line-height:1.7;">
    <li>Check <b>System</b> health: LLM service + Vertex token path.</li>
    <li>Review <b>Alerts</b>: overspend spikes, unusual category bursts, churn spikes.</li>
    <li>Generate one mascot motion for the latest UX state (good / warning / overspent).</li>
    <li>Export snapshot for weekly update.</li>
  </ul>
</div>
""",
        unsafe_allow_html=True,
    )

with tab2:
    st.markdown(
        """
<div class="card">
  <div class="cv-h2">Data notes</div>
  <div class="cv-muted">What the dashboard expects from upstream systems.</div>
  <div style="margin-top:10px;color: var(--cv-ink2);font-weight:750;line-height:1.7;">
    <b>Users</b>: user_id, created_at, last_active_at, region (optional)<br/>
    <b>Transactions</b>: date, amount, category, payee, note (optional), account_id<br/>
    <b>Derived signals</b>: spend_total, income_total, net, anomaly_flags, budget_status
  </div>
</div>
""",
        unsafe_allow_html=True,
    )

with tab3:
    st.markdown(
        """
<div class="card">
  <div class="cv-h2">AI notes</div>
  <div class="cv-muted">How Content AI should be used safely.</div>
  <div style="margin-top:10px;color: var(--cv-ink2);font-weight:750;line-height:1.7;">
    <b>Goal</b>: Generate short (~6–8s) mascot motion videos with consistent character identity.<br/>
    <b>Presets</b>: good / warning / overspent / streak / neutral.<br/>
    <b>Output</b>: saved under <code>apps/llm/assets/generated</code> and served via <code>/assets/generated/...mp4</code> by the LLM service.
  </div>
</div>
""",
        unsafe_allow_html=True,
    )


# Footer
st.markdown(
    f"""
<div class="cv-footer" style="text-align:center; padding: 18px; font-weight: 800;">
  © {datetime.now().year} Chuchube • Company View • Built with 💗 • Updated {datetime.now().strftime('%Y-%m-%d %H:%M')}
</div>
""",
    unsafe_allow_html=True,
)