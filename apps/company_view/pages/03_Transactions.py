from __future__ import annotations

from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Tuple

import numpy as np
import pandas as pd
import streamlit as st

from lib.config import get_config
from lib.data_sources import load_transactions

# Optional Plotly (page still works without it)
try:
    import plotly.express as px
    import plotly.graph_objects as go

    _PLOTLY_OK = True
except Exception:
    px = None  # type: ignore
    go = None  # type: ignore
    _PLOTLY_OK = False


# -----------------------------
# UI helpers
# -----------------------------

def _app_root() -> Path:
    # pages/ -> company_view/
    return Path(__file__).resolve().parents[1]


def load_css() -> None:
    """Load shared CSS theme (safe even if app.py didn't inject it)."""
    if st.session_state.get("_css_injected__company_view"):
        return

    css_path = _app_root() / "assets" / "styles.css"
    if css_path.exists():
        st.markdown(f"<style>{css_path.read_text(encoding='utf-8')}</style>", unsafe_allow_html=True)

    st.session_state["_css_injected__company_view"] = True


def top_nav() -> None:
    """Horizontal nav pills (consistent across pages)."""
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


def header(title: str, subtitle: str) -> None:
    st.markdown(
        f"""
<div class="company-header">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
    <div>
      <div style="font-size:30px;font-weight:950;letter-spacing:-0.02em;">{title}</div>
      <div style="opacity:.90;margin-top:6px;font-size:14px;font-weight:800;">{subtitle}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:12px;opacity:.80;">Last refresh</div>
      <div style="font-weight:900;">{datetime.now().strftime('%Y-%m-%d %H:%M')}</div>
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


def _date_tuple_default(days: int = 30) -> Tuple[date, date]:
    end = date.today()
    start = end - timedelta(days=days)
    return start, end


# -----------------------------
# Safe data loading (never crash)
# -----------------------------

@st.cache_data(ttl=60, show_spinner=False)
def _load_transactions_safe(cfg, start: date, end: date) -> Tuple[pd.DataFrame, str]:
    """Load transactions; if Supabase/env/network fails, return demo data + mode."""
    try:
        df = load_transactions(cfg, start, end)
        if df is None:
            return pd.DataFrame(), "No data returned"
        return df, "Live"
    except Exception as e:
        rng = np.random.default_rng(11)
        days = max(2, (end - start).days)
        n_users = 1400
        n = int(n_users * max(8, min(22, days // 2)))

        dt0 = datetime.combine(start, datetime.min.time())
        dts = [dt0 + timedelta(seconds=int(rng.integers(0, days * 86400))) for _ in range(n)]
        user_ids = rng.integers(1, n_users + 1, size=n)

        cats = np.array(
            ["Groceries", "Dining", "Transport", "Bills", "Rent", "Shopping", "Entertainment", "Health", "Income"]
        )
        cat = rng.choice(cats, size=n, p=[0.16, 0.12, 0.08, 0.12, 0.14, 0.10, 0.08, 0.06, 0.14])

        spend = -np.abs(rng.normal(loc=46, scale=75, size=n))
        income = np.abs(rng.normal(loc=190, scale=240, size=n))
        amt = np.where(cat == "Income", income, spend)

        df = pd.DataFrame(
            {
                cfg.col_date: pd.to_datetime(dts),
                cfg.col_account: user_ids,
                cfg.col_amount: amt,
                (getattr(cfg, "col_category", None) or "category"): cat,
                (getattr(cfg, "col_payee", None) or "payee"): rng.choice(
                    ["Amazon", "Uber", "Woolies", "Netflix", "Rent", "Salary", "Apple", "Gym", "Target"], size=n
                ),
                (getattr(cfg, "col_note", None) or "note"): rng.choice(["", "", "monthly", "one-off", "planned"], size=n),
            }
        )
        return df, f"Demo (fallback: {e})"


def _normalize_df(df: pd.DataFrame, cfg) -> pd.DataFrame:
    """Standardize columns and types."""
    dt = cfg.col_date
    acct = cfg.col_account
    amt = cfg.col_amount

    out = df.copy()
    out[dt] = pd.to_datetime(out[dt], errors="coerce").dt.tz_localize(None)
    out = out.dropna(subset=[dt, acct, amt])
    out["day"] = out[dt].dt.date

    # Ensure optional columns exist
    cat_col = getattr(cfg, "col_category", "category")
    payee_col = getattr(cfg, "col_payee", "payee")
    note_col = getattr(cfg, "col_note", "note")

    for c in [cat_col, payee_col, note_col]:
        if c not in out.columns:
            out[c] = ""

    out[cat_col] = out[cat_col].fillna("Unknown")
    out[payee_col] = out[payee_col].fillna("")
    out[note_col] = out[note_col].fillna("")

    return out


def _compute_flags(df: pd.DataFrame, cfg, large_tx_threshold: float) -> pd.DataFrame:
    """Simple monitoring flags: large spend + unusual payee frequency."""
    dt = cfg.col_date
    acct = cfg.col_account
    amt = cfg.col_amount
    cat_col = getattr(cfg, "col_category", "category")
    payee_col = getattr(cfg, "col_payee", "payee")

    work = df.copy()
    work["abs_amount"] = work[amt].abs()

    # Large spend flag
    work["flag_large_spend"] = (work[amt] < 0) & (work["abs_amount"] >= float(large_tx_threshold))

    # Unusual payee: appears only once for that account in the filtered window AND is a spend
    counts = work.groupby([acct, payee_col]).size().rename("payee_count").reset_index()
    work = work.merge(counts, on=[acct, payee_col], how="left")
    work["flag_new_payee"] = (work[amt] < 0) & (work["payee_count"] <= 1) & (work[payee_col].astype(str).str.len() > 0)

    # Category spike: if spend in a category is top 1 for account
    cat_spend = (
        work[work[amt] < 0]
        .groupby([acct, cat_col])[amt]
        .sum()
        .rename("cat_spend")
        .reset_index()
    )
    if not cat_spend.empty:
        cat_spend["rank_cat"] = cat_spend.groupby(acct)["cat_spend"].rank(method="dense")
        top_cat = cat_spend[cat_spend["rank_cat"] == 1][[acct, cat_col]].copy()
        top_cat["flag_top_category"] = True
        work = work.merge(top_cat, on=[acct, cat_col], how="left")
        work["flag_top_category"] = work["flag_top_category"].fillna(False)
    else:
        work["flag_top_category"] = False

    # A combined "needs_review" signal
    work["needs_review"] = work[["flag_large_spend", "flag_new_payee"]].any(axis=1)

    return work


# -----------------------------
# Page
# -----------------------------

def main() -> None:
    load_css()
    cfg = get_config()

    # Pull global range from app.py if present; otherwise local
    default_start, default_end = _date_tuple_default(30)
    start = st.session_state.get("range_start", default_start)
    end = st.session_state.get("range_end", default_end)

    header("💳 Transactions", "Deep dive: filters, anomalies, exports, and trends (pink × navy, dark theme).")
    top_nav()

    with st.sidebar:
        st.markdown("### 💳 Transactions Explorer")
        st.caption("Filter, investigate anomalies, and export for ops / compliance.")

        if "range_start" not in st.session_state or "range_end" not in st.session_state:
            start, end = st.date_input(
                "📅 Date range",
                value=(default_start, default_end),
                max_value=date.today(),
            )

        st.markdown("---")
        st.markdown("#### 🔎 Filters")

        mode_filter = st.selectbox("Type", ["All", "Spend only", "Income only"], index=0)
        large_tx_threshold = st.number_input("Large tx threshold ($)", min_value=50, max_value=10000, value=400, step=50)

        st.markdown("---")
        st.markdown("#### ⚙️ Actions")
        if st.button("🔄 Refresh", use_container_width=True):
            st.cache_data.clear()
            st.rerun()

    with st.spinner("Loading transactions…"):
        raw_df, mode = _load_transactions_safe(cfg, start, end)

    if raw_df.empty:
        st.warning("No transactions found for this range.")
        st.stop()

    df = _normalize_df(raw_df, cfg)

    if mode == "Live":
        st.success("Live data loaded")
    else:
        st.warning(f"***Using {mode}")

    acct_col = cfg.col_account
    cat_col = getattr(cfg, "col_category", "category")
    payee_col = getattr(cfg, "col_payee", "payee")
    note_col = getattr(cfg, "col_note", "note")
    amt_col = cfg.col_amount
    dt_col = cfg.col_date

    # Filter controls (top row)
    c1, c2, c3, c4, c5 = st.columns([1.2, 1.2, 1.2, 1.6, 1.0])

    with c1:
        accounts = ["All"] + sorted(df[acct_col].dropna().astype(str).unique().tolist())[:800]
        acct = st.selectbox("account_id", accounts, index=0)

    with c2:
        cats = ["All"] + sorted(df[cat_col].dropna().astype(str).unique().tolist())
        cat = st.selectbox("category", cats, index=0)

    with c3:
        payees = ["All"] + sorted(df[payee_col].dropna().astype(str).unique().tolist())[:400]
        payee = st.selectbox("payee", payees, index=0)

    with c4:
        q = st.text_input("Search (payee / note)", value="", placeholder="e.g. rent, uber, netflix")

    with c5:
        sort_by = st.selectbox("Sort", ["Newest", "Oldest", "Largest (abs)", "Smallest (abs)"])

    out = df.copy()

    if acct != "All":
        out = out[out[acct_col].astype(str) == str(acct)]

    if cat != "All":
        out = out[out[cat_col].astype(str) == str(cat)]

    if payee != "All":
        out = out[out[payee_col].astype(str) == str(payee)]

    if q.strip():
        q2 = q.strip().lower()
        out = out[
            out[payee_col].fillna("").astype(str).str.lower().str.contains(q2)
            | out[note_col].fillna("").astype(str).str.lower().str.contains(q2)
        ]

    if mode_filter == "Spend only":
        out = out[out[amt_col] < 0]
    elif mode_filter == "Income only":
        out = out[out[amt_col] > 0]

    if sort_by == "Newest":
        out = out.sort_values(dt_col, ascending=False)
    elif sort_by == "Oldest":
        out = out.sort_values(dt_col, ascending=True)
    elif sort_by == "Largest (abs)":
        out = out.assign(_abs=out[amt_col].abs()).sort_values("_abs", ascending=False).drop(columns=["_abs"])
    else:
        out = out.assign(_abs=out[amt_col].abs()).sort_values("_abs", ascending=True).drop(columns=["_abs"])

    # KPIs
    spend = float(out.loc[out[amt_col] < 0, amt_col].sum())
    income = float(out.loc[out[amt_col] > 0, amt_col].sum())
    net = income + spend
    unique_users = int(out[acct_col].nunique())
    tx_count = int(len(out))

    k1, k2, k3, k4, k5 = st.columns(5)
    with k1:
        st.metric("🧾 Transactions", f"{tx_count:,}")
    with k2:
        st.metric("👥 Active users", f"{unique_users:,}")
    with k3:
        st.metric("💸 Spend", _money(spend))
    with k4:
        st.metric("💰 Income", _money(income))
    with k5:
        st.metric("📈 Net", _money(net))

    st.markdown("<br>", unsafe_allow_html=True)

    # Flags/anomalies
    flagged = _compute_flags(out, cfg, large_tx_threshold=float(large_tx_threshold))
    flagged_count = int(flagged["needs_review"].sum())

    if flagged_count > 0:
        st.warning(f"⚠️ {flagged_count:,} transactions flagged for review (large spend / new payee)")

    # Charts
    left, right = st.columns([1.3, 1.0])

    with left:
        st.markdown("### 📈 Daily net flow")
        daily = flagged.groupby("day")[amt_col].sum().reset_index(name="net").sort_values("day")
        if _PLOTLY_OK and not daily.empty:
            fig = px.area(daily, x="day", y="net")
            fig.update_layout(
                height=320,
                margin=dict(l=10, r=10, t=10, b=10),
                paper_bgcolor="rgba(0,0,0,0)",
                plot_bgcolor="rgba(0,0,0,0)",
            )
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.line_chart(daily.set_index("day") if not daily.empty else pd.DataFrame({"net": []}))

    with right:
        st.markdown("### 🧠 Category mix")
        cat_mix = (
            flagged[flagged[amt_col] < 0]
            .groupby(cat_col)[amt_col]
            .sum()
            .abs()
            .rename("spend")
            .reset_index()
            .sort_values("spend", ascending=False)
            .head(12)
        )
        if _PLOTLY_OK and not cat_mix.empty:
            fig = px.bar(cat_mix, x=cat_col, y="spend")
            fig.update_layout(
                height=320,
                margin=dict(l=10, r=10, t=10, b=10),
                paper_bgcolor="rgba(0,0,0,0)",
                plot_bgcolor="rgba(0,0,0,0)",
            )
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.bar_chart(cat_mix.set_index(cat_col)["spend"] if not cat_mix.empty else pd.Series(dtype=float))

    st.markdown("<br>", unsafe_allow_html=True)

    # Tabs: Table / Anomalies / Payees
    tab1, tab2, tab3 = st.tabs(["📄 Table", "🚨 Review Queue", "🏪 Payees"])

    with tab1:
        st.markdown("### 📄 Transaction table")

        # Pagination
        page_size = st.selectbox("Rows per page", [100, 250, 500, 1000], index=1)
        total = len(flagged)
        pages = max(1, int(np.ceil(total / page_size)))
        page = st.number_input("Page", min_value=1, max_value=pages, value=1)

        start_i = (page - 1) * page_size
        end_i = min(total, start_i + page_size)

        view_cols = [dt_col, acct_col, cat_col, payee_col, amt_col, note_col, "needs_review", "flag_large_spend", "flag_new_payee"]
        view_cols = [c for c in view_cols if c in flagged.columns]

        st.dataframe(flagged.iloc[start_i:end_i][view_cols], use_container_width=True, height=520)
        st.caption(f"Showing {start_i+1:,}–{end_i:,} of {total:,} rows")

        csv = flagged[view_cols].to_csv(index=False).encode("utf-8")
        st.download_button(
            "⬇️ Download filtered CSV",
            data=csv,
            file_name=f"company_view_transactions_{start}_{end}.csv",
            mime="text/csv",
            use_container_width=True,
        )

    with tab2:
        st.markdown("### 🚨 Review queue")
        st.caption("Quick triage list for ops/compliance: large spends and new payees.")

        review = flagged[flagged["needs_review"]].copy()
        review = review.sort_values(dt_col, ascending=False)

        if review.empty:
            st.success("✅ No flagged transactions in the current filter window.")
        else:
            # Show top flagged
            top = review.head(200)
            st.dataframe(
                top[[dt_col, acct_col, cat_col, payee_col, amt_col, note_col, "flag_large_spend", "flag_new_payee"]],
                use_container_width=True,
                height=520,
            )

            # Simple summary
            s1, s2, s3 = st.columns(3)
            with s1:
                st.metric("Flagged tx", f"{len(review):,}")
            with s2:
                st.metric("Large spend", f"{int(review['flag_large_spend'].sum()):,}")
            with s3:
                st.metric("New payee", f"{int(review['flag_new_payee'].sum()):,}")

    with tab3:
        st.markdown("### 🏪 Payee insights")
        st.caption("Top payees by spend + payee concentration (can reveal risky patterns).")

        pay = (
            flagged[flagged[amt_col] < 0]
            .groupby(payee_col)[amt_col]
            .sum()
            .abs()
            .rename("spend")
            .reset_index()
            .sort_values("spend", ascending=False)
        )

        if pay.empty:
            st.info("No spend transactions in current selection.")
        else:
            topn = st.slider("Top N payees", 5, 50, 15)
            pay_top = pay.head(topn)

            cA, cB = st.columns([1.15, 1.0])
            with cA:
                if _PLOTLY_OK:
                    fig = px.bar(pay_top, x=payee_col, y="spend")
                    fig.update_layout(
                        height=320,
                        margin=dict(l=10, r=10, t=10, b=10),
                        paper_bgcolor="rgba(0,0,0,0)",
                        plot_bgcolor="rgba(0,0,0,0)",
                    )
                    st.plotly_chart(fig, use_container_width=True)
                else:
                    st.bar_chart(pay_top.set_index(payee_col)["spend"])

            with cB:
                # Concentration: how much top payees dominate
                total_spend = float(pay["spend"].sum())
                top5 = float(pay.head(5)["spend"].sum())
                top10 = float(pay.head(10)["spend"].sum())
                st.metric("Spend concentration (Top 5)", f"{(top5/max(total_spend,1))*100:.1f}%")
                st.metric("Spend concentration (Top 10)", f"{(top10/max(total_spend,1))*100:.1f}%")

                st.dataframe(pay_top, use_container_width=True, height=320)


if __name__ == "__main__":
    main()