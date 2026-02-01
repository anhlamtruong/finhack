# Company View 

Internal “company view” dashboard for **Chuchube Finance** — used by the team to monitor user health, transactions, alerts, system status, and AI tooling.

## Run

```bash
cd apps/company_view
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py
```

## Pages

Streamlit uses the `pages/` folder for navigation.

- **01_Overview** — KPIs + trends
- **02_Users** — user cohorts + retention + segmentation
- **03_Transactions** — spend categories + drilldowns
- **04_Alerts** — anomalies / risky patterns / rule-based flags
- **05_Content_AI** — mascot/content generation (Veo)
- **06_System** — health checks + dependency status
- **07_Employee_Assistant** — internal team copilot (ops/data/product)
- **08_Customer_Support** — support copilot (tickets, FAQs, troubleshooting)

## Required environment

Create `apps/company_view/.env` (or export env vars) as needed:

- `COMPANY_VIEW_API_BASE` — base URL for the backend (defaults to `http://localhost:8080`)
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — for pulling product data (if enabled)

> If Supabase isn’t configured yet, the dashboard should fall back to sample/mock data instead of crashing.

## Backend endpoints

These endpoints are expected to be served by the **LLM service** (the Node/Express server under `apps/llm`).

### Health
- `GET /v1/health` — basic service health

### Transactions
- `GET /v1/transactions` — used by Overview/Users/Transactions/Alerts pages

### Mascot / Content AI 
- `GET /v1/mascot/presets`
- `POST /v1/mascot/video` → returns `{ publicUrl }` (served under `/assets/generated/...`)

### Chat 
Used by the new assistant pages.

- `POST /v1/chat/employee`
  - Purpose: internal ops assistant (analytics, debugging, product + experiment notes)
- `POST /v1/chat/support`
  - Purpose: customer support assistant (FAQ, troubleshooting, ticket drafting)

**Recommended request shape**

```json
{
  "message": "string",
  "history": [{"role":"user|assistant","content":"..."}],
  "context": {
    "page": "employee|support",
    "filters": {"start":"YYYY-MM-DD","end":"YYYY-MM-DD"},
    "user_id": "optional",
    "evidence": {"transactions_sample": []}
  }
}
```

**Recommended response shape**

```json
{
  "ok": true,
  "answer": "markdown string",
  "citations": [{"title":"...","source":"...","snippet":"..."}],
  "actions": [{"type":"open_url|run_query|create_alert","payload":{}}]
}
```

## Notes for Lam Anh ಠ_ಠ

- If you see `ModuleNotFoundError: lib.llm_api`, ensure the page imports match the actual file names under `apps/company_view/lib/`.
- If you see `your_project.supabase.co` DNS errors, set real `SUPABASE_URL` + key or disable live data.
- Generated videos are served from the LLM service at `GET /assets/generated/<file>.mp4`.

```bash
open http://localhost:8080/assets/generated/mascot_motion_latest.mp4
```
# Company View (Streamlit)

Internal dashboard for **Chuchube Finance**.

## Run

Terminal A — start the LLM backend (serves transactions + AI endpoints):

```bash
cd apps/llm
npm install
PORT=8080 npm run start
# health check
curl -sS http://127.0.0.1:8080/v1/health | jq .
```

Terminal B — start Company View:

```bash
cd apps/company_view
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py --server.port 8501
```

Open: `http://localhost:8501`

## Environment

Create `apps/company_view/.env` (dotenv format: `KEY=value`, no quotes/extra characters).

Minimum (recommended):

- `GEMINI_API_KEY` — required for Employee/Support assistants
- `TX_API_BASE` — transactions source for RAG/tools
  - local default should be:
    - `TX_API_BASE=http://127.0.0.1:8080/v1/transactions/history`

Optional (if you want direct DB reads as fallback):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Optional tuning:

- `GEMINI_MODEL` (example: `gemini-2.5-flash`)
- `REQUEST_TIMEOUT_S` (default in code)

## Pages

Streamlit pages live in `pages/`:

- **01_Overview**
- **02_Users**
- **03_Transactions**
- **04_Alerts**
- **05_Content_AI**
- **06_System**
- **07_Employee_Assistant**
- **08_Customer_Support**

---

```bash
curl -sS http://127.0.0.1:8080/v1/transactions/ping | jq .
  
#  replace USER_ID
USER_ID="<user_id>"
curl -sS "http://127.0.0.1:8080/v1/transactions/history?userId=${USER_ID}&days=30&limit=5" | jq '{ok,count,summary}'
```

