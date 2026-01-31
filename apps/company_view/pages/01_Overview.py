# apps/company_view/pages/01_Overview.py

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Tuple

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import requests
import streamlit as st


# -----------------------------
# Utilities
# -----------------------------

def _app_root() -> Path:
    # pages/ -> company_view/
    return Path(__file__).resolve().parents[1]


def _inject_css_once() -> None:
    """Load the shared CSS even if app.py didn't run (safe in multipage)."""
    if st.session_state.get("_css_injected__company_view"):
        return

    css_path = _app_root() / "assets" / "styles.css"
    if css_path.exists():
        st.markdown(f"<style>{css_path.read_text(encoding='utf-8')}</style>", unsafe_allow_html=True)

    st.session_state["_css_injected__company_view"] = True


def _fmt_money(x: float) -> str:
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


@dataclass
class DataStatus:
    ok: bool
    label: str
    detail: str


# -----------------------------
# Data loading (safe + fallback)
# -----------------------------

def _supabase_configured() -> bool:
    url = (os.getenv("SUPABASE_URL") or "").strip()
    key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or "").strip()

    if not url or "your_project.supabase.co" in url:
        return False
    if not key or "YOUR_" in key:
        return False
    return True


@st.cache_data(show_spinner=False, ttl=120)
def _load_transactions_supabase(start: date, end: date) -> pd.DataFrame:
    """
    Best-effort: use project lib if present; otherwise raises.
    Import inside to avoid hard-crash at import time.
    """
    from lib.config import AppConfig  # type: ignore
    from lib.data_sources import load_transactions  # type: ignore

    cfg = AppConfig.from_env()  # type: ignore
    return load_transactions(cfg, start, end)  # type: ignore


@st.cache_data(show_spinner=False, ttl=120)
def _sample_transactions(start: date, end: date, n_users: int = 1800) -> pd.DataFrame:
    rng = np.random.default_rng(7)

    days = (end - start).days
    if days <= 1:
        days = 2

    # simulate ~ volume depending on period
    base = int(n_users * max(8, min(28, days // 2)))
    n = int(base + rng.integers(0, max(1, base // 3)))

    dt0 = datetime.combine(start, datetime.min.time())
    dts = [dt0 + timedelta(seconds=int(rng.integers(0, days * 86400))) for _ in range(n)]

    user_ids = rng.integers(1, n_users + 1, size=n)
    cats = np.array(
        ["Groceries", "Dining", "Transport", "Bills", "Rent", "Shopping", "Entertainment", "Health", "Income"]
    )
    cat = rng.choice(cats, size=n, p=[0.16, 0.12, 0.08, 0.12, 0.14, 0.10, 0.08, 0.06, 0.14])

    spend = -np.abs(rng.normal(loc=42, scale=65, size=n))
    income = np.abs(rng.normal(loc=180, scale=220, size=n))
    amt = np.where(cat == "Income", income, spend)

    df = pd.DataFrame(
        {
            "date": pd.to_datetime(dts),
            "user_id": user_ids,
            "category": cat,
            "amount": amt,
            "payee": rng.choice(["Amazon", "Uber", "Woolies", "Netflix", "Rent", "Salary", "Apple", "Gym"], size=n),
            "note": rng.choice(["", "", "", "monthly", "one-off", "planned"], size=n),
        }
    )
    df["date"] = df["date"].dt.tz_localize(None)
    df["day"] = df["date"].dt.date
    df["weekday"] = df["date"].dt.day_name()
    df["hour"] = df["date"].dt.hour
    return df


def _load_transactions(start: date, end: date) -> Tuple[pd.DataFrame, DataStatus]:
    if _supabase_configured():
        try:
            df = _load_transactions_supabase(start, end)

            cols = {c.lower(): c for c in df.columns}
            if "date" not in cols and "created_at" in cols:
                df = df.rename(columns={cols["created_at"]: "date"})
            if "amount" not in cols and "amt" in cols:
                df = df.rename(columns={cols["amt"]: "amount"})

            if "date" not in df.columns or "amount" not in df.columns:
                raise ValueError("Transactions missing required columns: date, amount")

            df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.tz_localize(None)
            df = df.dropna(subset=["date", "amount"]).copy()
            df["day"] = df["date"].dt.date
            df["weekday"] = df["date"].dt.day_name()
            df["hour"] = df["date"].dt.hour

            if "user_id" not in df.columns:
                if "account_id" in df.columns:
                    df["user_id"] = df["account_id"]
                else:
                    df["user_id"] = 0

            if "category" not in df.columns:
                if "category_id" in df.columns:
                    df["category"] = df["category_id"].astype(str)
                else:
                    df["category"] = "Unknown"

            return df, DataStatus(True, "Live data", "Loaded from Supabase")
        except Exception as e:
            return _sample_transactions(start, end), DataStatus(False, "Fallback data", f"Supabase load failed: {e}")

    return _sample_transactions(start, end), DataStatus(False, "Demo data", "Supabase not configured yet (sample data)")


# -----------------------------
# Optional health checks (safe)
# -----------------------------

def _llm_health() -> DataStatus:
    base = (os.getenv("LLM_API_BASE") or os.getenv("LLM_BASE_URL") or os.getenv("API_BASE_URL") or "").strip()
    if not base:
        base = "http://localhost:8080"  # local default

    url = base.rstrip("/") + "/v1/health"
    try:
        r = requests.get(url, timeout=3)
        if r.ok:
            return DataStatus(True, "LLM API", f"OK ({r.status_code})")
        return DataStatus(False, "LLM API", f"Error ({r.status_code})")
    except Exception as e:
        return DataStatus(False, "LLM API", f"Unreachable: {e}")


# -----------------------------
# UI blocks
# -----------------------------

def _hero(title: str, subtitle: str) -> None:
    st.markdown(
        f"""
        <div class="company-header">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
            <div>
              <div style="font-size:30px;font-weight:950;letter-spacing:-0.02em;">{title}</div>
              <div style="opacity:.90;margin-top:6px;font-size:14px;">{subtitle}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:12px;opacity:.85;">Last refresh</div>
              <div style="font-weight:900;">{datetime.now().strftime('%Y-%m-%d %H:%M')}</div>
            </div>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def _top_nav() -> None:
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


def _kpi_row(df: pd.DataFrame) -> None:
    spend = float(df.loc[df["amount"] < 0, "amount"].sum())
    income = float(df.loc[df["amount"] > 0, "amount"].sum())
    net = income + spend

    active_users = int(df["user_id"].nunique())
    tx_count = int(len(df))

    aum_proxy = max(0.0, net)
    savings_rate = (net / income) if income > 0 else 0.0

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        st.metric("👥 Active Users", f"{active_users:,}")
    with c2:
        st.metric("💸 Spend", _fmt_money(spend))
    with c3:
        st.metric("💰 Income", _fmt_money(income))
    with c4:
        st.metric("📈 Net Flow", _fmt_money(net), delta=_pct(savings_rate) if income > 0 else "—")

    c5, c6, c7, c8 = st.columns(4)
    with c5:
        st.metric("🧾 Transactions", f"{tx_count:,}")
    with c6:
        st.metric("🏦 AUM (proxy)", _fmt_money(aum_proxy))
    with c7:
        avg_abs = float(np.mean(np.abs(df["amount"])) if len(df) else 0.0)
        st.metric("📦 Avg Tx Size", _fmt_money(avg_abs))
    with c8:
        per_user = df.groupby("user_id")["amount"].sum()
        overspend_share = float((per_user < 0).mean()) if len(per_user) else 0.0
        st.metric("⚠️ Overspend Users", _pct(overspend_share))


def _timeseries(df: pd.DataFrame) -> None:
    by_day = (
        df.groupby(["day"])
        .agg(
            spend=("amount", lambda x: float(x[x < 0].sum())),
            income=("amount", lambda x: float(x[x > 0].sum())),
            net=("amount", "sum"),
        )
        .reset_index()
        .sort_values("day")
    )
    by_day["cum_net"] = by_day["net"].cumsum()

    fig = go.Figure()
    fig.add_trace(go.Scatter(x=by_day["day"], y=by_day["income"], name="Income", mode="lines", line=dict(width=3)))
    fig.add_trace(go.Scatter(x=by_day["day"], y=by_day["spend"], name="Spend", mode="lines", line=dict(width=3)))
    fig.add_trace(
        go.Scatter(
            x=by_day["day"],
            y=by_day["cum_net"],
            name="Cumulative net",
            mode="lines",
            line=dict(width=3, dash="dot"),
        )
    )

    fig.update_layout(
        height=420,
        margin=dict(l=10, r=10, t=35, b=10),
        hovermode="x unified",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="left", x=0),
        title="📈 Cashflow Trends",
    )
    fig.update_xaxes(title="Day")
    fig.update_yaxes(title="Amount")
    st.plotly_chart(fig, use_container_width=True)


def _category_breakdown(df: pd.DataFrame) -> None:
    cats = (
        df.assign(abs_amount=lambda x: np.abs(x["amount"]))
        .groupby("category", dropna=False)["abs_amount"]
        .sum()
        .sort_values(ascending=False)
        .head(12)
        .reset_index()
    )

    fig = px.bar(cats, x="abs_amount", y="category", orientation="h", title="🧩 Top Categories (by volume)")
    fig.update_layout(
        height=420,
        margin=dict(l=10, r=10, t=35, b=10),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
    )
    fig.update_xaxes(title="Absolute amount")
    fig.update_yaxes(title="")
    st.plotly_chart(fig, use_container_width=True)


def _heatmap(df: pd.DataFrame) -> None:
    order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    pivot = (
        df.pivot_table(index="weekday", columns="hour", values="amount", aggfunc="count", fill_value=0)
        .reindex(order)
        .reset_index()
    )
    heat = pivot.set_index("weekday")

    fig = px.imshow(heat, aspect="auto", title="🕒 Activity Heatmap (transaction count)")
    fig.update_layout(
        height=320,
        margin=dict(l=10, r=10, t=35, b=10),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
    )
    st.plotly_chart(fig, use_container_width=True)


def _insights(df: pd.DataFrame) -> None:
    spend = float(df.loc[df["amount"] < 0, "amount"].sum())
    income = float(df.loc[df["amount"] > 0, "amount"].sum())
    net = income + spend

    per_user = df.groupby("user_id")["amount"].sum()
    overspend_share = float((per_user < 0).mean()) if len(per_user) else 0.0

    by_day = (
        df.groupby(["day"])
        .agg(spend=("amount", lambda x: float(-x[x < 0].sum())))
        .reset_index()
        .sort_values("day")
    )
    by_day["roll"] = by_day["spend"].rolling(7, min_periods=3).mean()
    denom = by_day["spend"].rolling(7, min_periods=3).std().replace(0, np.nan)
    by_day["z"] = (by_day["spend"] - by_day["roll"]) / denom
    spikes = by_day.loc[by_day["z"] > 2.2]

    st.markdown(
        """
        <div class="card">
          <div style="font-weight:950;font-size:16px;">✨ Executive Insights</div>
          <div style="opacity:.85;margin-top:6px;">Fast signal summary you can paste into an internal update.</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    c1, c2 = st.columns([2, 1])

    with c1:
        bullets = [
            f"Net flow is <b>{_fmt_money(net)}</b> on income <b>{_fmt_money(income)}</b> for this period.",
            f"<b>{_pct(overspend_share)}</b> of active users are net-negative (good coaching candidates).",
        ]
        if len(spikes) > 0:
            last_spike = spikes.iloc[-1]
            bullets.append(
                f"Detected <b>{len(spikes)}</b> spend spikes vs 7-day baseline (latest: {last_spike['day']} @ {_fmt_money(last_spike['spend'])})."
            )
        else:
            bullets.append("No major spend spikes detected vs the 7-day baseline.")

        st.markdown(
            """
            <div class="card">
              <div style="line-height:1.8;opacity:.92;">• """
            + "</div><div style='line-height:1.8;opacity:.92;'>• ".join(bullets)
            + """
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with c2:
        sr = (net / income) if income > 0 else 0.0
        sr = max(-0.2, min(0.6, sr))

        fig = go.Figure(
            go.Indicator(
                mode="gauge+number",
                value=sr * 100,
                number={"suffix": "%"},
                title={"text": "Savings rate"},
                gauge={
                    "axis": {"range": [-20, 60]},
                    "bar": {"color": "rgba(255,61,154,0.95)"},
                    "bgcolor": "rgba(0,0,0,0)",
                    "borderwidth": 0,
                    "steps": [
                        {"range": [-20, 0], "color": "rgba(255,61,154,0.12)"},
                        {"range": [0, 15], "color": "rgba(255,61,154,0.08)"},
                        {"range": [15, 60], "color": "rgba(255,61,154,0.05)"},
                    ],
                },
            )
        )
        fig.update_layout(height=260, margin=dict(l=10, r=10, t=40, b=10), paper_bgcolor="rgba(0,0,0,0)")
        st.plotly_chart(fig, use_container_width=True)


# -----------------------------
# Page
# -----------------------------

def main() -> None:
    _inject_css_once()

    with st.sidebar:
        st.markdown("### 🧭 Company View")
        st.caption("Operations dashboard for Chuchube.")

        start, end = st.date_input("📅 Date range", value=_date_tuple_default(30), max_value=date.today())

        st.markdown("---")
        st.markdown("#### ⚙️ Controls")
        allow_demo = st.checkbox("Allow demo fallback", value=True, help="If Supabase isn’t configured, use sample data.")

        if st.button("🔄 Refresh now", use_container_width=True):
            st.cache_data.clear()
            st.rerun()

        st.markdown("---")
        st.markdown("#### 🧪 System")
        st.write("Supabase:", "✅ configured" if _supabase_configured() else "⚠️ not configured")

        llm = _llm_health()
        st.write(f"LLM API: {'✅' if llm.ok else '⚠️'} {llm.detail}")

    _hero("🏁 Company Overview", "Monitor product usage, savings behavior, and operational health (pink + navy).")
    _top_nav()

    with st.spinner("Loading dashboard data…"):
        df, status = _load_transactions(start, end)

    if not allow_demo and not status.ok:
        st.error("Supabase is not configured (and demo fallback is disabled). Configure SUPABASE_URL / keys in .env.")
        st.stop()

    if status.ok:
        st.success(f"✅ {status.label} — {status.detail}")
    else:
        st.warning(f"⚠️ {status.label} — {status.detail}")
        st.caption("Tip: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment to switch to live data.")

    _kpi_row(df)
    st.markdown("<br>", unsafe_allow_html=True)

    left, right = st.columns([2, 1])
    with left:
        _timeseries(df)
    with right:
        _category_breakdown(df)

    st.markdown("<br>", unsafe_allow_html=True)

    c1, c2 = st.columns([1.2, 1.0])
    with c1:
        _heatmap(df)
    with c2:
        _insights(df)

    st.markdown("---")

    with st.expander("📦 Data preview + export", expanded=False):
        st.caption("This is the exact data feeding the charts above.")
        st.dataframe(df.sort_values("date", ascending=False).head(200), use_container_width=True, height=360)

        csv = df.to_csv(index=False).encode("utf-8")
        st.download_button(
            "⬇️ Download CSV",
            data=csv,
            file_name=f"company_view_transactions_{start}_{end}.csv",
            mime="text/csv",
        )

    st.markdown(
        f"<div style='text-align:center;opacity:.75;padding:12px 0;'>© Chuchube • Updated {datetime.now().strftime('%Y-%m-%d %H:%M')}</div>",
        unsafe_allow_html=True,
    )


if __name__ == "__main__":
    main()