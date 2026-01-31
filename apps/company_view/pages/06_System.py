import streamlit as st

from lib.config import get_config
from lib.llm_api import llm_health, llm_tx_ping

cfg = get_config()
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
st.subheader("🛠️ System Health")

st.markdown("### LLM Service")
try:
    h = llm_health(cfg.llm_base_url)
    st.success("/v1/health OK")
    st.json(h)
except Exception as e:
    st.error(f"/v1/health failed no plsss: {e}")

st.markdown("### Transactions Router")
try:
    p = llm_tx_ping(cfg.llm_base_url)
    st.success("/v1/transactions/ping OK")
    st.json(p)
except Exception as e:
    st.error(f"/v1/transactions/ping failed: {e}")

st.markdown("### Environment checks")
st.write({
    "LLM_BASE_URL": cfg.llm_base_url,
    "SUPABASE_URL_present": bool(cfg.supabase_url),
    "SUPABASE_SERVICE_ROLE_KEY_present": bool(cfg.supabase_service_role_key),
    "VEO_REF_GCS_present": bool(cfg.veo_ref_gcs),
})