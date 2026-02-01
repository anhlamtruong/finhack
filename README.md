
<div align="center">

<a href="https://devpost.com/software/finance-queens"><b>🏆 Devpost: FinHack </b></a>

<br/>

<i>AI finance agents that live in your real-life context — capture purchases, learn your habits, find better deals, and coach you into budget-aware, shared saving… <b>Women-first</b>.</i>

<br/><br/>

<img alt="Finance Queens Banner" src="https://readme-typing-svg.demolab.com?font=Inter&weight=800&size=36&duration=2500&pause=800&color=FFFFFF&center=true&vCenter=true&width=980&lines=Finance+Queens;Women-first+AI+finance+agents;Spending+%E2%86%92+Insights+%E2%86%92+Better+choices" />

<br/><br/>

<!-- Core stack badges -->
<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-111827?logo=typescript&logoColor=3178C6" />
<img alt="Node.js" src="https://img.shields.io/badge/Node.js-111827?logo=node.js&logoColor=339933" />
<img alt="Express" src="https://img.shields.io/badge/Express-111827?logo=express&logoColor=ffffff" />
<img alt="Python" src="https://img.shields.io/badge/Python-111827?logo=python&logoColor=3776AB" />
<img alt="Streamlit" src="https://img.shields.io/badge/Streamlit-111827?logo=streamlit&logoColor=FF4B4B" />
<img alt="Docker" src="https://img.shields.io/badge/Docker-111827?logo=docker&logoColor=2496ED" />

<br/>

<!-- Data + AI badges -->
<img alt="Snowflake" src="https://img.shields.io/badge/Snowflake-111827?logo=snowflake&logoColor=29B5E8" />
<img alt="Supabase" src="https://img.shields.io/badge/Supabase-111827?logo=supabase&logoColor=3ECF8E" />
<img alt="Gemini" src="https://img.shields.io/badge/Gemini-111827?logo=google&logoColor=ffffff" />
<img alt="Claude" src="https://img.shields.io/badge/Claude%203.7%20Sonnet-111827?logo=anthropic&logoColor=ffffff" />
<img alt="ElevenLabs" src="https://img.shields.io/badge/ElevenLabs-111827?logoColor=ffffff" />

<br/>

<!-- Infra + integrations badges -->
<img alt="Vultr" src="https://img.shields.io/badge/Vultr-111827?logoColor=ffffff" />
<img alt="Terraform" src="https://img.shields.io/badge/Terraform-111827?logo=terraform&logoColor=7B42BC" />
<img alt="Solana" src="https://img.shields.io/badge/Solana-111827?logo=solana&logoColor=14F195" />
<img alt="SerpAPI" src="https://img.shields.io/badge/SerpAPI-111827?logoColor=ffffff" />
<img alt="Resend" src="https://img.shields.io/badge/Resend-111827?logoColor=ffffff" />
<img alt="MongoDB" src="https://img.shields.io/badge/MongoDB-111827?logo=mongodb&logoColor=47A248" />

<br/><br/>

<img alt="license" src="https://img.shields.io/badge/license-MIT-2ea44f" />

</div>

---

# Finance Queens (FinHack)

**Finance Queens** is a women-first personal finance experience + an internal ops dashboard.

- For users: low-friction spending capture, budget-aware guidance, and smarter purchase discovery.
- For teams: a **Company View** dashboard that monitors trends, anomalies, and system health — with an **Employee Assistant** that explains what’s happening in plain language.

If budgeting apps feel like homework, this is the opposite: **supportive, contextual, and designed to be used every day.**

---

## Why this matters

Many people disengage from finance tools because:

- Tracking is tedious (high friction).
- Feedback feels judgmental instead of supportive.
- Most tools assume stable income + solo decision-making.
- Shared saving (roommates/partners/friends) lacks clarity and accountability.

We built Finance Queens to make saving feel **encouraging**, **practical**, and **repeatable**.

---

## What it does

### 1) Voice-to-transaction (low friction)
Capture purchases naturally (speak instead of type). We extract key details (amount/category/note) and update insights in real-time.

### 2) Women-first purchase discovery
A smart “better deal” layer that compares options and can prioritize women-owned / women-led choices (optional focus mode).

### 3) Personalized coaching + habit reinforcement
The app learns patterns and nudges users with **actionable next steps** (not guilt). Think: “here’s one small move today.”

### 4) Risk / anomaly detection + forecasting
We use fast forecasting on transaction aggregates to predict spend and flag potential overspend risk for the week ahead.

### 5) Company View (internal ops dashboard)
A Streamlit dashboard for the team: users, transactions, alerts, trends, and AI assistants to speed up investigation and support.

---

## Tech stack (4 layers)

| Layer | Technologies | Key use |
|---|---|---|
| **Product + UI** | Streamlit, Figma | Internal ops dashboard + assistants; fast demo-ready UI |
| **Services + APIs** | Node.js, Express, TypeScript | LLM backend + endpoints (`/v1/transactions`, `/v1/chat`, `/v1/mascot`, `/v1/sales`, `/v1/health`) |
| **Data + ML** | Snowflake (ML Forecast), Supabase, MongoDB, pandas, NumPy | Aggregates + forecasting + storage + data transforms |
| **AI + Infra** | Gemini API, Claude 3.7 Sonnet, ElevenLabs, SerpAPI, Docker, Vultr, Terraform, Solana Devnet, Resend | Chat assistants, voice workflows, product search, containers + deployment, optional on-chain audit trail, email reminders |

> Note: Some integrations are “prototype/optional” for the hackathon demo, but the architecture is built to support them cleanly.

---

## Architecture (high level)

```text
User (web/mobile)
   │
   ▼
Node/Express API (apps/llm)  ──► External AI/Tools (Gemini, ElevenLabs, SerpAPI)
   │
   ├─► Data layer (Supabase / Snowflake)
   │
   └─► Company View (Streamlit dashboard) (apps/company_view)
           └─► Employee Assistant + Support Assistant

Deployment: Docker → Vultr VM (backend + dashboard)
Optional: Solana Devnet audit log (risk flags / receipts / events)
```

---

## Quickstart (local)

### 1) Start the backend (LLM service)

```bash
cd apps/llm
npm install
PORT=8080 npm run start

# health check
curl -sS http://127.0.0.1:8080/v1/health
```

### 2) Start Company View (Streamlit)

```bash
cd apps/company_view
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

streamlit run app.py --server.port 8501
```

Open: `http://localhost:8501`

### Environment

Create `apps/company_view/.env` (dotenv format, `KEY=value`):

```bash
# backend base
LLM_BASE_URL=http://127.0.0.1:8080

# optional live data (dashboard falls back to demo/mock data if not set)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# assistants
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

# optional
REQUEST_TIMEOUT_S=30
```

---

## Snowflake ML Forecast (demo-friendly)

We use **Snowflake ML Forecast** to generate a 7‑day spend prediction + uncertainty band (fast enough for hackathon demos):

```sql
CREATE OR REPLACE SNOWFLAKE.ML.FORECAST SPEND_FORECAST_DEMO (
  INPUT_DATA => SYSTEM$REFERENCE('TABLE', 'FINHACK_DB.ANALYTICS.DAILY_SPEND_DEMO'),
  SERIES_COLNAME => 'USER_ID',
  TIMESTAMP_COLNAME => 'DAY',
  TARGET_COLNAME => 'SPEND',
  CONFIG_OBJECT => {
    'frequency': '1 day',
    'method': 'fast',
    'evaluate': false
  }
);

SELECT *
FROM TABLE(SPEND_FORECAST_DEMO!FORECAST(FORECASTING_PERIODS => 7));
```

---

## Deployment (Vultr)

We containerize the backend with Docker and deploy to a Vultr VM with a public health endpoint for judges to verify uptime.

Typical flow:

```bash
# build (from repo root)
docker build -t finhack-llm:latest -f apps/llm/Dockerfile .

# run
docker rm -f finhack-llm 2>/dev/null || true
docker run -d --name finhack-llm --restart unless-stopped -p 8080:8080 finhack-llm:latest

# verify
curl -sS http://127.0.0.1:8080/v1/health
```

---

## Real-world impact

Finance Queens is built for the real world:

- **Less friction → more consistency.** Voice capture makes tracking sustainable.
- **Supportive coaching.** We replace guilt-based budgeting with small, actionable next steps.
- **Shared saving clarity.** Transparent goals make group saving less awkward.
- **Earlier risk signals.** Forecasting + anomaly detection helps users (and teams) act before a problem compounds.

---

## Repo layout (what’s in this monorepo)

```text
apps/
  llm/            # Node/Express API + AI endpoints
  company_view/   # Streamlit internal dashboard + assistants
```

---

## License

MIT
