import random
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.express as px
import streamlit as st

from lib.config import get_config
from lib.data_sources import load_transactions


# -----------------------------
# UI helpers
# -----------------------------
def load_css() -> None:
    css_path = Path(__file__).resolve().parent.parent / "assets" / "styles.css"
    if css_path.exists():
        st.markdown(f"<style>{css_path.read_text()}</style>", unsafe_allow_html=True)


def navbar(active: str = "Alerts") -> None:
    """
    Lightweight nav pills (works even without extra packages).
    Uses Streamlit multipage query param routing: /?page=pages/<file>.py
    """
    pages = [
        ("Overview", "01_Overview"),
        ("Users", "02_Users"),
        ("Transactions", "03_Transactions"),
        ("Alerts", "04_Alerts"),
        ("Content AI", "05_Content_AI"),
        ("System", "06_System"),
    ]

    pills = []
    for label, page in pages:
        cls = "navpill active" if label == active else "navpill"
        pills.append(f"<a class='{cls}' href='/?page=pages/{page}.py'>{label}</a>")

    st.markdown(
        f"""
<div class="navbar">
  <div class="navbar-left">
    <div class="brand">Chuchube • Company View</div>
    <div class="brand-sub">Risk + Monitoring</div>
  </div>
  <div class="navbar-right">
    {''.join(pills)}
  </div>
</div>
""",
        unsafe_allow_html=True,
    )


def header(title: str, subtitle: str) -> None:
    st.markdown(
        f"""
<div class="company-header">
  <h1 style="margin:0;">{title}</h1>
  <div style="opacity:.92;margin-top:6px;font-weight:800;">{subtitle}</div>
</div>
""",
        unsafe_allow_html=True,
    )


def _safe_dt(v, default: datetime) -> datetime:
    try:
        if v is None:
            return default
        if isinstance(v, datetime):
            return v
        return pd.to_datetime(v).to_pydatetime()
    except Exception:
        return default


# -----------------------------
# Data: live -> fallback demo
# -----------------------------
def _demo_transactions(cfg, start: datetime, end: datetime, n_users: int = 180, n_rows: int = 7000) -> pd.DataFrame:
    rng = np.random.default_rng(7)

    start = pd.to_datetime(start)
    end = pd.to_datetime(end)
    if end <= start:
        end = start + pd.Timedelta(days=30)

    # sample timestamps every 30 minutes
    dates = pd.date_range(start=start, end=end, freq="30min")
    if len(dates) == 0:
        dates = pd.date_range(end=datetime.now(), periods=24 * 14, freq="H")

    user_ids = [f"u_{i:04d}" for i in range(1, n_users + 1)]
    categories = [
        "Groceries", "Dining", "Transport", "Bills", "Shopping",
        "Subscriptions", "Health", "Entertainment", "Travel", "Other",
    ]
    payees = [
        "Uber", "Amazon", "Walmart", "Netflix", "Spotify", "Apple",
        "Target", "Costco", "Shell", "Delta", "CVS", "Whole Foods",
        "DoorDash", "Airbnb", "Local Cafe",
    ]

    # Spend is negative, income is positive
    amt = -np.abs(rng.normal(loc=45, scale=75, size=n_rows))
    income_mask = rng.random(n_rows) < 0.09
    amt[income_mask] = np.abs(rng.normal(loc=900, scale=650, size=income_mask.sum()))

    notes = rng.choice(
        ["", "", "", "promo", "refund", "gift", "late fee", "international", "", ""],
        size=n_rows,
        replace=True,
    )

    df = pd.DataFrame(
        {
            cfg.col_date: rng.choice(dates, size=n_rows, replace=True),
            cfg.col_amount: np.round(amt, 2),
            cfg.col_account: rng.choice(user_ids, size=n_rows, replace=True),
            cfg.col_category: rng.choice(categories, size=n_rows, replace=True),
            cfg.col_payee: rng.choice(payees, size=n_rows, replace=True),
            cfg.col_note: notes,
        }
    )

    df[cfg.col_date] = pd.to_datetime(df[cfg.col_date])
    df = df.sort_values(cfg.col_date).reset_index(drop=True)
    return df


@st.cache_data(ttl=60)
def _load_transactions_safe(cfg, start: datetime, end: datetime) -> tuple[pd.DataFrame, bool, str]:
    """Return (df, is_demo, message) — never raises."""
    try:
        df = load_transactions(cfg, start, end)
        if df is None:
            raise RuntimeError("load_transactions returned None")
        return df, False, "Live data connected"
    except Exception as e:
        df = _demo_transactions(cfg, start, end)
        return df, True, f"Demo mode (data source unavailable): {e}"


# -----------------------------
# Alert logic
# -----------------------------
def _compute_alerts(
    cfg,
    tx: pd.DataFrame,
    large_spend: float,
    rapid_spend_window_h: int,
    rapid_spend_count: int,
    suspicious_keywords: list[str],
) -> pd.DataFrame:
    if tx.empty:
        return pd.DataFrame(
            columns=["severity", "rule", "date", "account_id", "amount", "category", "payee", "note", "explain"]
        )

    df = tx.copy()

    date_col = cfg.col_date
    amt_col = cfg.col_amount
    acct_col = cfg.col_account
    cat_col = cfg.col_category
    payee_col = cfg.col_payee
    note_col = cfg.col_note

    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    df[amt_col] = pd.to_numeric(df[amt_col], errors="coerce")
    df = df.dropna(subset=[date_col, amt_col, acct_col]).copy()

    df[cat_col] = df.get(cat_col, "").fillna("Unknown")
    df[payee_col] = df.get(payee_col, "").fillna("")
    df[note_col] = df.get(note_col, "").fillna("")

    spend_df = df[df[amt_col] < 0].copy()
    alerts: list[dict] = []

    # 1) Large spend
    large = spend_df[spend_df[amt_col] <= -abs(float(large_spend))].copy()
    for _, r in large.iterrows():
        alerts.append(
            dict(
                severity="high",
                rule="Large spend",
                date=r[date_col],
                account_id=r[acct_col],
                amount=float(r[amt_col]),
                category=r[cat_col],
                payee=r[payee_col],
                note=r[note_col],
                explain=f"Spend {float(r[amt_col]):,.2f} exceeds threshold (-{abs(float(large_spend)):,.2f}).",
            )
        )

    # 2) New payee (first time in selected range)
    ap = spend_df[[acct_col, payee_col, date_col, amt_col, cat_col, note_col]].copy()
    ap["_payee_norm"] = ap[payee_col].astype(str).str.strip().str.lower()
    ap = ap[ap["_payee_norm"] != ""].sort_values(date_col)
    first_seen = ap.groupby([acct_col, "_payee_norm"], as_index=False).first()
    first_seen = first_seen[first_seen[amt_col] <= -15]  # ignore tiny
    for _, r in first_seen.iterrows():
        alerts.append(
            dict(
                severity="medium",
                rule="New payee",
                date=r[date_col],
                account_id=r[acct_col],
                amount=float(r[amt_col]),
                category=r[cat_col],
                payee=r[payee_col],
                note=r[note_col],
                explain="First occurrence of this payee for the user inside the selected range.",
            )
        )

    # 3) Rapid spend bursts (N spends in H hours)
    if rapid_spend_window_h > 0 and rapid_spend_count > 0 and not spend_df.empty:
        spend_df2 = spend_df.sort_values(date_col).copy()
        spend_df2["_ts"] = spend_df2[date_col].astype("int64") // 10**9
        window_s = int(rapid_spend_window_h) * 3600

        burst_idx = set()
        for acct, g in spend_df2.groupby(acct_col, sort=False):
            ts = g["_ts"].to_numpy()
            idx = g.index.to_numpy()
            j = 0
            for i in range(len(ts)):
                while ts[i] - ts[j] > window_s:
                    j += 1
                cnt = i - j + 1
                if cnt >= rapid_spend_count:
                    burst_idx.add(idx[i])

        if burst_idx:
            g2 = spend_df2.loc[list(burst_idx)].copy()
            for _, r in g2.iterrows():
                alerts.append(
                    dict(
                        severity="high",
                        rule="Rapid spend burst",
                        date=r[date_col],
                        account_id=r[acct_col],
                        amount=float(r[amt_col]),
                        category=r[cat_col],
                        payee=r[payee_col],
                        note=r[note_col],
                        explain=f"≥{rapid_spend_count} spend tx within {rapid_spend_window_h}h rolling window.",
                    )
                )

    # 4) Keyword flagged
    if suspicious_keywords:
        s = df[note_col].astype(str).str.lower()
        hit = s.apply(lambda x: any(k in x for k in suspicious_keywords))
        key_df = df[hit].copy()
        for _, r in key_df.iterrows():
            sev = "medium" if float(r[amt_col]) < 0 else "low"
            alerts.append(
                dict(
                    severity=sev,
                    rule="Keyword flagged",
                    date=r[date_col],
                    account_id=r[acct_col],
                    amount=float(r[amt_col]),
                    category=r.get(cat_col, "Unknown"),
                    payee=r.get(payee_col, ""),
                    note=r.get(note_col, ""),
                    explain=f"Note contains risk keyword: {', '.join(suspicious_keywords)}",
                )
            )

    out = pd.DataFrame(alerts)
    if out.empty:
        return out

    sev_order = {"high": 0, "medium": 1, "low": 2}
    out["_sev"] = out["severity"].map(sev_order).fillna(9).astype(int)
    out = out.sort_values(["_sev", "date"], ascending=[True, False]).drop(columns=["_sev"]).reset_index(drop=True)
    return out


# -----------------------------
# Page
# -----------------------------
load_css()
navbar("Alerts")

cfg = get_config()

now = datetime.now()
start = _safe_dt(st.session_state.get("range_start"), now - timedelta(days=30))
end = _safe_dt(st.session_state.get("range_end"), now)

header("🚨 Alerts & Risk Monitor", "Company view • anomaly detection • review queue")

with st.sidebar:
    st.markdown("### ⚙️ Alert Controls")
    st.caption("Tune sensitivity — app never crashes if live data is missing.")

    large_spend = st.slider("Large spend threshold ($)", 50, 5000, 300, 25)
    rapid_spend_window_h = st.slider("Burst window (hours)", 1, 24, 3, 1)
    rapid_spend_count = st.slider("Burst count (tx)", 2, 12, 6, 1)

    st.markdown("### 🧷 Keywords")
    kw = st.text_input("Comma-separated", value="refund,chargeback,late fee,international")
    suspicious_keywords = [k.strip().lower() for k in kw.split(",") if k.strip()]

    st.markdown("---")
    force_demo = st.toggle("Force demo mode", value=False)

@st.cache_data(ttl=60)
def _load(start_dt: datetime, end_dt: datetime, force_demo_mode: bool):
    if force_demo_mode:
        return _demo_transactions(cfg, start_dt, end_dt), True, "Demo mode (forced)"
    return _load_transactions_safe(cfg, start_dt, end_dt)

tx, is_demo, msg = _load(start, end, force_demo)

badge = "DEMO" if is_demo else "LIVE"
status_cls = "status-badge demo" if is_demo else "status-badge live"
st.markdown(
    f"""
<div class="status-row">
  <div class="{status_cls}">{badge}</div>
  <div class="status-text">{msg}</div>
</div>
""",
    unsafe_allow_html=True,
)

if tx is None or tx.empty:
    st.warning("No transactions found for the selected range.")
    st.stop()

alerts = _compute_alerts(
    cfg,
    tx,
    large_spend=float(large_spend),
    rapid_spend_window_h=int(rapid_spend_window_h),
    rapid_spend_count=int(rapid_spend_count),
    suspicious_keywords=suspicious_keywords,
)

# KPIs
amt_col = cfg.col_amount
acct_col = cfg.col_account

s_amt = pd.to_numeric(tx[amt_col], errors="coerce").fillna(0)
spend = float(s_amt[s_amt < 0].sum())
income = float(s_amt[s_amt > 0].sum())
net = income + spend
users = int(tx[acct_col].nunique())

k1, k2, k3, k4, k5 = st.columns(5)
k1.metric("Active users", f"{users:,}")
k2.metric("Transactions", f"{len(tx):,}")
k3.metric("Spend", f"${abs(spend):,.0f}")
k4.metric("Income", f"${income:,.0f}")
k5.metric("Alerts", f"{len(alerts):,}")

st.markdown("<div style='height:10px'></div>", unsafe_allow_html=True)

tab1, tab2, tab3 = st.tabs(["🧭 Overview", "🧾 Review Queue", "📜 Rules & Explainability"])

with tab1:
    c1, c2 = st.columns([1.4, 1])

    with c1:
        st.subheader("Alerts over time")
        if alerts.empty:
            st.info("No alerts triggered with current thresholds.")
        else:
            a = alerts.copy()
            a["day"] = pd.to_datetime(a["date"]).dt.date
            agg = a.groupby(["day", "severity"], as_index=False).size()

            fig = px.area(agg, x="day", y="size", color="severity")
            fig.update_layout(
                height=360,
                margin=dict(l=10, r=10, t=10, b=10),
                paper_bgcolor="rgba(0,0,0,0)",
                plot_bgcolor="rgba(0,0,0,0)",
                legend_title_text="",
            )
            st.plotly_chart(fig, use_container_width=True)

    with c2:
        st.subheader("Alert mix")
        if alerts.empty:
            st.caption("—")
        else:
            mix = alerts.groupby("rule", as_index=False).size().sort_values("size", ascending=False)
            fig2 = px.bar(mix.head(12), x="size", y="rule", orientation="h")
            fig2.update_layout(
                height=360,
                margin=dict(l=10, r=10, t=10, b=10),
                paper_bgcolor="rgba(0,0,0,0)",
                plot_bgcolor="rgba(0,0,0,0)",
            )
            st.plotly_chart(fig2, use_container_width=True)

    st.subheader("User risk concentration")
    c3, c4 = st.columns([1, 1])

    with c3:
        if alerts.empty:
            st.caption("No alerts to rank users.")
        else:
            u = alerts.groupby(["account_id", "severity"], as_index=False).size()
            weights = {"high": 3, "medium": 2, "low": 1}
            u["score"] = u["severity"].map(weights).fillna(1) * u["size"]
            scores = u.groupby("account_id", as_index=False)["score"].sum().sort_values("score", ascending=False)

            fig3 = px.bar(scores.head(20), x="account_id", y="score")
            fig3.update_layout(
                height=320,
                margin=dict(l=10, r=10, t=10, b=10),
                paper_bgcolor="rgba(0,0,0,0)",
                plot_bgcolor="rgba(0,0,0,0)",
                xaxis_title="",
            )
            st.plotly_chart(fig3, use_container_width=True)

    with c4:
        st.subheader("Top payees in alerts")
        if alerts.empty:
            st.caption("—")
        else:
            p = alerts.copy()
            p["payee"] = p["payee"].fillna("")
            p = p[p["payee"].str.strip() != ""]
            top = p.groupby("payee", as_index=False).size().sort_values("size", ascending=False).head(12)

            fig4 = px.pie(top, names="payee", values="size", hole=0.55)
            fig4.update_layout(
                height=320,
                margin=dict(l=10, r=10, t=10, b=10),
                paper_bgcolor="rgba(0,0,0,0)",
            )
            st.plotly_chart(fig4, use_container_width=True)

with tab2:
    st.subheader("Review Queue")
    st.caption("Triage high-risk items first • Filter + export for audit logs.")

    if alerts.empty:
        st.info("No items to review.")
    else:
        f1, f2, f3, f4 = st.columns([1, 1, 1.2, 1])
        with f1:
            sev = st.multiselect("Severity", ["high", "medium", "low"], default=["high", "medium"])
        with f2:
            rules = ["All"] + sorted(alerts["rule"].unique().tolist())
            rule = st.selectbox("Rule", rules)
        with f3:
            user_q = st.text_input("User contains", value="")
        with f4:
            lim = st.selectbox("Rows", [200, 500, 1000, 2000], index=1)

        out = alerts.copy()
        out = out[out["severity"].isin(sev)]
        if rule != "All":
            out = out[out["rule"] == rule]
        if user_q.strip():
            out = out[out["account_id"].astype(str).str.contains(user_q.strip(), case=False, na=False)]

        # local-only review state
        if "_review_status" not in st.session_state:
            st.session_state["_review_status"] = {}

        out["review_id"] = (
            out["date"].astype(str) + "|" + out["account_id"].astype(str) + "|" + out["rule"].astype(str)
        )
        out["status"] = out["review_id"].map(lambda k: st.session_state["_review_status"].get(k, "Open"))

        if len(out) > 0:
            pick = st.selectbox("Select review_id", options=out["review_id"].head(300).tolist())
            act = st.selectbox("Set status", ["Open", "Investigating", "Resolved", "False positive"])
            if st.button("Apply status", use_container_width=True):
                st.session_state["_review_status"][pick] = act
                st.toast("Updated review status", icon="✅")

        show = out[
            ["severity", "rule", "date", "account_id", "amount", "category", "payee", "note", "status", "explain"]
        ].copy()
        show["date"] = pd.to_datetime(show["date"]).dt.strftime("%Y-%m-%d %H:%M")

        st.dataframe(show.head(int(lim)), use_container_width=True, height=520)
        st.caption(f"Showing {min(len(show), int(lim)):,} of {len(show):,} alerts")

        csv = show.to_csv(index=False).encode("utf-8")
        st.download_button(
            "⬇️ Download filtered alerts (CSV)",
            data=csv,
            file_name=f"chuchube_alerts_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
            mime="text/csv",
            use_container_width=True,
        )

with tab3:
    st.subheader("Rules")
    st.markdown(
        """
- **Large spend**: flags spend transactions whose amount is below the threshold (spend is negative).
- **New payee**: flags the first time a user pays a payee within the selected date range.
- **Rapid spend burst**: flags users making ≥ *N* spend transactions inside the rolling *H* hour window.
- **Keyword flagged**: flags notes containing risk keywords.

These rules are intentionally **simple and explainable** for MVP/hackathon.
In production you’d connect to a real risk model + reviewer feedback loop.
"""
    )

    st.subheader("Explainability sample")
    if alerts.empty:
        st.info("No alerts to explain.")
    else:
        ex = alerts[["severity", "rule", "date", "account_id", "amount", "category", "payee", "explain"]].head(25).copy()
        ex["date"] = pd.to_datetime(ex["date"]).dt.strftime("%Y-%m-%d %H:%M")
        st.dataframe(ex, use_container_width=True, height=420)

st.markdown("---")
st.caption(f"Last refresh: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} • Range: {start.date()} → {end.date()}")