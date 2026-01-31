# apps/company_view/lib/llm_api.py
import requests

def llm_health(llm_base_url: str) -> dict:
    r = requests.get(f"{llm_base_url.rstrip('/')}/v1/health", timeout=10)
    r.raise_for_status()
    return r.json()

def llm_tx_ping(llm_base_url: str) -> dict:
    r = requests.get(f"{llm_base_url.rstrip('/')}/v1/transactions/ping", timeout=10)
    r.raise_for_status()
    return r.json()

def generate_mascot_video(
    llm_base_url: str,
    preset: str | None,
    tx_summary: dict | None,
    ref_gcs: str | None,
    out_name: str,
    extra: str | None = None,
):
    payload: dict = {"outName": out_name}
    if preset:
        payload["preset"] = preset
    if tx_summary:
        payload["txSummary"] = tx_summary
    if ref_gcs:
        payload["refGcs"] = ref_gcs
    if extra:
        payload["extra"] = extra

    r = requests.post(f"{llm_base_url.rstrip('/')}/v1/mascot/video", json=payload, timeout=180)
    r.raise_for_status()
    return r.json()