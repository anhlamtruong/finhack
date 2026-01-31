from __future__ import annotations

from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Tuple

import numpy as np
import pandas as pd
import streamlit as st

from lib.config import get_config
from lib.data_sources import load_transactions
from lib.metrics import overspend_alerts

# Optional Plotly (keeps page working if Plotly isn't installed)
try:
    import plotly.express as px
    import plotly.graph_objects as go

    _PLOTLY_OK = True
except Exception:
    px = None  # type: ignore
    go = None  # type: ignore
    _PLOTLY_OK = False


# -----------------------------
# App config
# -----------------------------
st.set_page_config(
    page_title="Company View • Users",
    page_icon="👥",
    layout="wide",
    initial_sidebar_state="expanded",
)


# -----------------------------
# Theme + UI helpers
# -----------------------------
def _app_root() -> Path:
    # pages/ -> company_view/
    return Path(__file__).resolve().parents[1]


def _read_css() -> str:
    """Read shared CSS and defensively strip accidental <style> wrappers."""
    css_path = _app_root() / "assets" / "styles.css"
    if not css_path.exists():
        return ""

    css = css_path.read_text(encoding="utf-8")
    css = css.replace("<style>", "").replace("</style>", "")
    return css


def load_css() -> None:
    """Load shared theme CSS (safe even if app.py didn't run)."""
    if st.session_state.get("_css_injected__company_view"):
        return

    base_css = _read_css()
    if base_css:
        st.markdown(f"<style>{base_css}</style>", unsafe_allow_html=True)

    # Page-specific polish to ensure this tab matches the pink×navy theme
    st.markdown(
        """
<style>
/* Users page micro-polish (inherits the global pink/navy theme) */
.cv-kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:8px 0 18px;}
@media (max-width:1100px){.cv-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}
.cv-kpi{border-radius:18px;padding:14px 14px 12px;background:rgba(8,13,38,.55);border:1px solid rgba(255,61,154,.18);
        box-shadow:0 16px 40px rgba(0,0,0,.25);backdrop-filter: blur(14px);}
.cv-kpi .t{font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:900;color:rgba(255,255,255,.82);}
.cv-kpi .v{font-size:28px;font-weight:950;letter-spacing:-.02em;margin-top:6px;color:#fff;}
.cv-kpi .s{font-size:12px;margin-top:4px;color:rgba(255,255,255,.75);}

.cv-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;font-weight:900;font-size:12px;
          background:rgba(255,61,154,.14);border:1px solid rgba(255,61,154,.25);color:#fff;}
.cv-dot{width:8px;height:8px;border-radius:50%;background:#FF3D9A;box-shadow:0 0 18px rgba(255,61,154,.75);}

.cv-section-title{font-size:16px;font-weight:950;letter-spacing:-.01em;margin:6px 0 10px;color:#fff;}
.cv-subtle{color:rgba(255,255,255,.72);font-size:13px;font-weight:700;}

/* Make native Streamlit alerts less "green/orange" and more on-brand */
div[data-testid="stAlert"]{border-radius:16px;border:1px solid rgba(255,61,154,.22);background:rgba(8,13,38,.65) !important;}
</style>
""",
        unsafe_allow_html=True,
    )

    st.session_state["_css_injected__company_view"] = True


def top_nav() -> None:
    """Horizontal nav pills (keeps UI consistent across pages)."""
    st.markdown('<div class="navbar">', unsafe_allow_html=True)
    cols = st.columns(6)
    pages = [
        ("🏁 Overview", "pages/01_Overview.py"),
        ("👥 Users", "pages/02_Users.py"),
        ("💳 Transactions", "pages/03_Transactions.py"),
        ("🚨 Alerts", "pages/04_Alerts.py"),
        ("🎬 Content AI", "pages/05_Content_AI.py"),
        ("🛠️ System", "pages/06_System.py"),
    ]

    for (label, p), c in zip(pages, cols):
        with c:
            try:
                st.page_link(p, label=label)
            except Exception:
                st.markdown(f"<span class='navpill'>{label}</span>", unsafe_allow_html=True)

    st.markdown("</div>", unsafe_allow_html=True)


def header(title: str, subtitle: str, mode: str) -> None:
    mode_label = "LIVE" if mode == "Live" else "DEMO"
    st.markdown(
        f"""
<div class="company-header">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
    <div>
      <div style="font-size:30px;font-weight:950;letter-spacing:-0.02em;">{title}</div>
      <div class="cv-subtle" style="margin-top:6px;">{subtitle}</div>
    </div>
    <div style="display:flex;gap:10px;align-items:center;">
      <div class="cv-badge"><span class="cv-dot"></span>{mode_label}</div>
      <div style="text-align:right;">
        <div style="font-size:12px;opacity:.70;">Last refresh</div>
        <div style="font-weight:950;">{datetime.now().strftime('%Y-%m-%d %H:%M')}</div>
      </div>
    </div>
  </div>
</div>
""",
        unsafe_allow_html=True,
    )


def _money(x: float) -> str:
    ax = abs(float(x))
    sign = "-" if x < 0 else ""
    if ax >= 1_000_000_000:
        return f"{sign}${ax/1_000_000_000:.2f}B"
    if ax >= 1_000_000:
        return f"{sign}${ax/1_000_000:.2f}M"
    if ax >= 1_000:
        return f"{sign}${ax/1_000:.1f}K"
    return f"{sign}${ax:,.0f}"


def _pct(x: float) -> str:
    return f"{x*100:.1f}%"


def _date_tuple_default(days: int = 30) -> Tuple[date, date]:
    end = date.today()
    start = end - timedelta(days=days)
    return start, end


# -----------------------------
# Data loading (safe)
# -----------------------------
@st.cache_data(ttl=60, show_spinner=False)
def _load_transactions_safe(cfg, start: date, end: date) -> Tuple[pd.DataFrame, str]:
    """
    Load transactions; never crash page — returns df + mode label.
    - Live: from Supabase via lib.data_sources
    - Demo fallback: generated data if network/env is missing
    """
    try:
        df = load_transactions(cfg, start, end)
        if df is None:
            return pd.DataFrame(), "No data returned"
        return df, "Live"
    except Exception as e:
        # Fallback demo data (so page ALWAYS renders)
        rng = np.random.default_rng(7)
        days = max(2, (end - start).days)
        n_users = 1500
        n = int(n_users * max(6, min(18, days // 2)))

        dt0 = datetime.combine(start, datetime.min.time())
        dts = [dt0 + timedelta(seconds=int(rng.integers(0, days * 86400))) for _ in range(n)]
        user_ids = rng.integers(1, n_users + 1, size=n)

        cats = np.array(
            ["Groceries", "Dining", "Transport", "Bills", "Rent", "Shopping", "Entertainment", "Health", "Income"]
        )
        cat = rng.choice(cats, size=n, p=[0.16, 0.12, 0.08, 0.12, 0.14, 0.10, 0.08, 0.06, 0.14])

        spend = -np.abs(rng.normal(loc=44, scale=70, size=n))
        income = np.abs(rng.normal(loc=180, scale=220, size=n))
        amt = np.where(cat == "Income", income, spend)

        df = pd.DataFrame(
            {
                cfg.col_date: pd.to_datetime(dts),
                cfg.col_account: user_ids,
                cfg.col_amount: amt,
                (getattr(cfg, "col_category", None) or "category"): cat,
                (getattr(cfg, "col_payee", None) or "payee"): rng.choice(
                    ["Amazon", "Uber", "Woolies", "Netflix", "Rent", "Salary", "Apple", "Gym"], size=n
                ),
                (getattr(cfg, "col_note", None) or "note"): rng.choice(["", "", "monthly", "one-off", "planned"], size=n),
            }
        )
        return df, f"Demo (fallback: {e})"


def _prep_users_table(df: pd.DataFrame, cfg) -> pd.DataFrame:
    """Aggregate per-account metrics for monitoring."""
    acct = cfg.col_account
    amt = cfg.col_amount
    dt = cfg.col_date

    work = df.copy()
    work[dt] = pd.to_datetime(work[dt], errors="coerce").dt.tz_localize(None)
    work = work.dropna(subset=[dt, acct, amt])

    g = work.groupby(acct)[amt].agg(
        tx_count="count",
        net="sum",
        spend=lambda s: float(s[s < 0].sum()),
        income=lambda s: float(s[s > 0].sum()),
        avg_abs=lambda s: float(np.mean(np.abs(s))) if len(s) else 0.0,
    )

    last_seen = work.groupby(acct)[dt].max().rename("last_seen")
    first_seen = work.groupby(acct)[dt].min().rename("first_seen")

    out = g.join([last_seen, first_seen]).reset_index()
    out["days_active"] = (out["last_seen"] - out["first_seen"]).dt.days.clip(lower=0)
    out["status"] = np.where(out["net"] < 0, "overspent", "ok")

    # Risk score 0..100 (triage): more negative net + high activity => higher risk
    denom = np.maximum(np.abs(out["income"].to_numpy()), 50.0)
    risk = (np.clip(-out["net"].to_numpy(), 0, None) / denom) * 60 + (np.clip(out["tx_count"].to_numpy(), 0, 200) / 200.0) * 40
    out["risk_score"] = np.clip(risk, 0, 100)

    out["segment"] = pd.cut(
        out["risk_score"],
        bins=[-0.1, 20, 45, 70, 100.1],
        labels=["Low risk", "Watch", "At risk", "High risk"],
    )

    return out


# -----------------------------
# Page
# -----------------------------
def main() -> None:
    load_css()
    cfg = get_config()

    default_start, default_end = _date_tuple_default(30)
    start = st.session_state.get("range_start", default_start)
    end = st.session_state.get("range_end", default_end)

    # Sidebar controls
    with st.sidebar:
        st.markdown("### 👥 Users / Accounts")
        st.caption("Company monitoring: engagement, risk, and savings behavior.")

        # If app.py didn’t set session_state yet, let user choose here
        if "range_start" not in st.session_state or "range_end" not in st.session_state:
            picked = st.date_input(
                "📅 Date range",
                value=(default_start, default_end),
                max_value=date.today(),
            )
            if isinstance(picked, tuple) and len(picked) == 2:
                start, end = picked
                st.session_state["range_start"] = start
                st.session_state["range_end"] = end

        st.markdown("---")
        st.markdown("#### 🔎 Filters")
        status_filter = st.multiselect("Status", ["ok", "overspent"], default=["ok", "overspent"])
        segment_filter = st.multiselect(
            "Risk segment",
            ["Low risk", "Watch", "At risk", "High risk"],
            default=["Low risk", "Watch", "At risk", "High risk"],
        )
        min_tx = st.slider("Min transactions", min_value=1, max_value=50, value=3)
        search = st.text_input("Search account_id", value="", placeholder="e.g. 1024")
        sort_by = st.selectbox("Sort by", ["risk_score", "tx_count", "net", "last_seen"], index=0)
        sort_desc = st.checkbox("Sort descending", value=True)

        st.markdown("---")
        st.markdown("#### ⚙️ Actions")
        if st.button("🔄 Refresh", use_container_width=True):
            st.cache_data.clear()
            st.rerun()

    # Load data
    with st.spinner("Loading transactions…"):
        df, mode = _load_transactions_safe(cfg, start, end)

    header("👥 Users / Accounts", "Engagement + financial health monitoring.", mode)
    top_nav()

    if df.empty:
        st.warning("No data in this range.")
        st.stop()

    acct = cfg.col_account
    amt = cfg.col_amount
    dt = cfg.col_date

    df = df.copy()
    df[dt] = pd.to_datetime(df[dt], errors="coerce").dt.tz_localize(None)
    df = df.dropna(subset=[dt, acct, amt])
    df["day"] = df[dt].dt.date

    users = _prep_users_table(df, cfg)

    # Global KPIs (on-brand cards)
    total_users = int(users[acct].nunique())
    overspent_users = int((users["status"] == "overspent").sum())
    overspent_rate = overspent_users / max(1, total_users)
    total_net = float(users["net"].sum())
    avg_tx = float(users["tx_count"].mean()) if len(users) else 0.0

    st.markdown(
        f"""
<div class="cv-kpi-grid">
  <div class="cv-kpi"><div class="t">Active users</div><div class="v">{total_users:,}</div><div class="s">Accounts with activity in range</div></div>
  <div class="cv-kpi"><div class="t">Overspent users</div><div class="v">{overspent_users:,}</div><div class="s">Rate: {_pct(overspent_rate)}</div></div>
  <div class="cv-kpi"><div class="t">Net flow</div><div class="v">{_money(total_net)}</div><div class="s">Income − Spend across users</div></div>
  <div class="cv-kpi"><div class="t">Avg tx / user</div><div class="v">{avg_tx:.1f}</div><div class="s">Engagement intensity proxy</div></div>
</div>
""",
        unsafe_allow_html=True,
    )

    # Apply filters
    filtered = users.copy()
    filtered = filtered[filtered["status"].isin(status_filter)]
    filtered = filtered[filtered["segment"].astype(str).isin(segment_filter)]
    filtered = filtered[filtered["tx_count"] >= min_tx]

    if search.strip():
        filtered = filtered[filtered[acct].astype(str).str.contains(search.strip(), case=False, na=False)]

    filtered = filtered.sort_values(sort_by, ascending=not sort_desc)

    # Charts
    left, right = st.columns([1.25, 1.0])

    with left:
        st.markdown('<div class="cv-section-title">📊 Risk distribution</div>', unsafe_allow_html=True)
        st.markdown('<div class="cv-subtle">Triage users who may need coaching based on risk score.</div>', unsafe_allow_html=True)
        if _PLOTLY_OK and len(filtered) > 0:
            fig = px.histogram(filtered, x="risk_score", nbins=24)
            fig.update_layout(
                height=340,
                margin=dict(l=10, r=10, t=10, b=10),
                paper_bgcolor="rgba(0,0,0,0)",
                plot_bgcolor="rgba(0,0,0,0)",
                font=dict(color="rgba(255,255,255,.88)"),
            )
            fig.update_xaxes(showgrid=False, zeroline=False)
            fig.update_yaxes(showgrid=True, gridcolor="rgba(255,255,255,.08)", zeroline=False)
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.bar_chart(filtered["risk_score"].value_counts().sort_index())

    with right:
        st.markdown('<div class="cv-section-title">🕒 Active users by day</div>', unsafe_allow_html=True)
        st.markdown('<div class="cv-subtle">Daily active accounts (DAU).</div>', unsafe_allow_html=True)
        daily = df.groupby("day")[acct].nunique().reset_index(name="active_users").sort_values("day")
        if _PLOTLY_OK and len(daily) > 0:
            fig = px.line(daily, x="day", y="active_users")
            fig.update_layout(
                height=340,
                margin=dict(l=10, r=10, t=10, b=10),
                paper_bgcolor="rgba(0,0,0,0)",
                plot_bgcolor="rgba(0,0,0,0)",
                font=dict(color="rgba(255,255,255,.88)"),
            )
            fig.update_xaxes(showgrid=False, zeroline=False)
            fig.update_yaxes(showgrid=True, gridcolor="rgba(255,255,255,.08)", zeroline=False)
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.line_chart(daily.set_index("day"))

    st.markdown("<br>", unsafe_allow_html=True)

    # Segment donut + top risk table
    a, b = st.columns([1.0, 1.4])
    with a:
        st.markdown('<div class="cv-section-title">🧩 Risk segments</div>', unsafe_allow_html=True)
        seg = filtered["segment"].astype(str).value_counts().reset_index()
        seg.columns = ["segment", "users"]
        if _PLOTLY_OK and len(seg) > 0:
            fig = px.pie(seg, values="users", names="segment", hole=0.58)
            fig.update_layout(
                height=320,
                margin=dict(l=10, r=10, t=10, b=10),
                paper_bgcolor="rgba(0,0,0,0)",
                plot_bgcolor="rgba(0,0,0,0)",
                font=dict(color="rgba(255,255,255,.90)"),
                legend=dict(orientation="h", yanchor="bottom", y=-0.1, xanchor="center", x=0.5),
            )
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.dataframe(seg, use_container_width=True, hide_index=True)

    with b:
        st.markdown('<div class="cv-section-title">🔥 Highest risk accounts</div>', unsafe_allow_html=True)
        st.markdown('<div class="cv-subtle">Quick triage list (top 25).</div>', unsafe_allow_html=True)
        top = filtered[[acct, "risk_score", "tx_count", "net", "income", "spend", "last_seen", "segment", "status"]].head(25).copy()
        st.dataframe(top, use_container_width=True, height=320)

    st.markdown("<br>", unsafe_allow_html=True)

    # Accounts table
    st.markdown('<div class="cv-section-title">🧑‍💼 Accounts table</div>', unsafe_allow_html=True)
    st.caption("Sort/filter to triage who needs coaching. Risk score uses net-negative pressure + high activity.")

    show = filtered[[acct, "tx_count", "net", "income", "spend", "avg_abs", "last_seen", "status", "segment", "risk_score"]].copy()

    # Pretty display, numeric CSV
    display = show.copy()
    for col in ["net", "income", "spend", "avg_abs"]:
        display[col] = display[col].astype(float).map(_money)

    st.dataframe(display.head(500), use_container_width=True, height=420)

    csv = show.to_csv(index=False).encode("utf-8")
    st.download_button(
        "⬇️ Download accounts CSV",
        data=csv,
        file_name=f"company_view_accounts_{start}_{end}.csv",
        mime="text/csv",
        use_container_width=True,
    )

    st.markdown("---")

    # Overspend alerts
    st.markdown('<div class="cv-section-title">🚨 Overspend alerts (top)</div>', unsafe_allow_html=True)
    st.markdown('<div class="cv-subtle">Accounts with unusually high negative net in the range.</div>', unsafe_allow_html=True)
    try:
        alerts = overspend_alerts(df, amt, acct, n=20)
        st.dataframe(alerts, use_container_width=True, height=320)
    except Exception as e:
        st.warning(f"Could not compute overspend alerts: {e}")

    # Drilldown
    st.markdown('<div class="cv-section-title">🔎 Drilldown</div>', unsafe_allow_html=True)
    st.caption("Inspect a single account’s recent transactions.")

    options = filtered[acct].astype(str).head(2000).tolist()
    if not options:
        st.info("No accounts match current filters.")
        return

    pick = st.selectbox("Select account_id", options=options)

    sub = df[df[acct].astype(str) == str(pick)].copy().sort_values(dt, ascending=False)

    u_spend = float(sub.loc[sub[amt] < 0, amt].sum())
    u_income = float(sub.loc[sub[amt] > 0, amt].sum())
    u_net = u_income + u_spend

    st.markdown(
        f"""
<div class="cv-kpi-grid" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-top:10px;">
  <div class="cv-kpi"><div class="t">User tx</div><div class="v">{len(sub):,}</div><div class="s">Transactions in range</div></div>
  <div class="cv-kpi"><div class="t">User spend</div><div class="v">{_money(u_spend)}</div><div class="s">Sum of negatives</div></div>
  <div class="cv-kpi"><div class="t">User income</div><div class="v">{_money(u_income)}</div><div class="s">Sum of positives</div></div>
  <div class="cv-kpi"><div class="t">User net</div><div class="v">{_money(u_net)}</div><div class="s">Income − Spend</div></div>
</div>
""",
        unsafe_allow_html=True,
    )

    if _PLOTLY_OK and len(sub) > 0:
        by_day = sub.groupby(sub[dt].dt.date)[amt].sum().reset_index(name="net")
        by_day = by_day.rename(columns={by_day.columns[0]: "day"})
        fig = px.bar(by_day, x="day", y="net")
        fig.update_layout(
            height=270,
            margin=dict(l=10, r=10, t=10, b=10),
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
            font=dict(color="rgba(255,255,255,.88)"),
        )
        fig.update_xaxes(showgrid=False, zeroline=False)
        fig.update_yaxes(showgrid=True, gridcolor="rgba(255,255,255,.08)", zeroline=False)
        st.plotly_chart(fig, use_container_width=True)

    st.dataframe(sub.head(250), use_container_width=True, height=420)


if __name__ == "__main__":
    main()