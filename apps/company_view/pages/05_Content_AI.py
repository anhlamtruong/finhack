import streamlit as st

from lib.config import get_config
from lib.data_sources import load_transactions
from lib.llm_api import generate_mascot_video

import streamlit as st
from pathlib import Path

def load_css():
    css_path = Path(__file__).resolve().parent.parent / "assets" / "styles.css"
    st.markdown(f"<style>{css_path.read_text()}</style>", unsafe_allow_html=True)

def header(title: str, subtitle: str):
    st.markdown(
        f"""
<div class="company-header">
  <h1 style="margin:0;">{title}</h1>
  <div style="opacity:.92;margin-top:6px;font-weight:800;">{subtitle}</div>
</div>
""",
        unsafe_allow_html=True,
    )
cfg = get_config()
start = st.session_state.get("range_start")
end = st.session_state.get("range_end")

st.subheader("🎬 AI Content (Mascot Videos)")

st.markdown(
    "This page calls your **Express LLM service** endpoint `POST /v1/mascot/video` and then previews the returned "
    "`/assets/generated/...` MP4 so frontend can embed it later."
)

if not cfg.llm_base_url:
    st.error("Missing LLM_BASE_URL")
    st.stop()

df = load_transactions(cfg, start, end)
acct_col = cfg.col_account
amt_col = cfg.col_amount

if df.empty:
    st.warning("No transactions available for this date range.")
    st.stop()

accounts = sorted(df[acct_col].dropna().unique().tolist())[:500]
pick = st.selectbox("Pick an account_id (acts like a user key)", accounts)

sub = df[df[acct_col] == pick]
income = float(sub[sub[amt_col] > 0][amt_col].sum())
spend = float(-sub[sub[amt_col] < 0][amt_col].sum())
net = income - spend

st.markdown("#### Context (this range)")
c1, c2, c3 = st.columns(3)
c1.metric("Income", f"${income:,.0f}")
c2.metric("Spend", f"${spend:,.0f}")
c3.metric("Net", f"${net:,.0f}")

preset = st.selectbox("Preset (optional)", ["(auto)", "good", "streak", "warning", "overspent", "neutral"])
out_name = st.text_input("Output filename base", value="mascot_motion_latest")
ref_gcs = st.text_input("Reference image GCS (optional)", value=cfg.veo_ref_gcs or "")

if st.button("🚀 Generate mascot video"):
    with st.spinner("Generating video (Veo)…"):
        payload_summary = {"income": income, "spend": spend, "net": net}
        resp = generate_mascot_video(
            llm_base_url=cfg.llm_base_url,
            preset=None if preset == "(auto)" else preset,
            tx_summary=payload_summary,
            ref_gcs=ref_gcs.strip() or None,
            out_name=out_name.strip() or "mascot_motion_latest",
        )

    if resp.get("ok"):
        url = resp.get("publicUrl")
        st.success(f"Generated: {url}")
        # If your llm service is local, Streamlit needs absolute URL:
        abs_url = cfg.llm_base_url + url
        st.video(abs_url)
        st.json(resp)
    else:
        st.error(resp.get("error", "Unknown error"))
        st.json(resp)