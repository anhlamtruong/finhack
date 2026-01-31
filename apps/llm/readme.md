## Run

### Local development

From repo root:

```
npm run dev -w apps/llm
```

Base URL: http://127.0.0.1:8080

### Docker (Testing & Production)

**Build the image:**

From repo root:

```bash
docker build -f apps/llm/Dockerfile -t chuchube-llm .
```

**Run the container locally:**

```bash
docker run --rm -d -p 8080:8080 \
  -e PORT=8080 \
  -e NODE_ENV=production \
  -e GEMINI_API_KEY=your_key_here \
  -e SUPABASE_URL=your_url_here \
  -e SUPABASE_SERVICE_ROLE_KEY=your_key_here \
  --name chuchube-llm \
  chuchube-llm
```

**Test the health endpoint:**

```bash
curl -sS http://127.0.0.1:8080/v1/health
```

**Stop the container:**

```bash
docker stop chuchube-llm
```

The Dockerfile includes:
- Multi-stage build for optimized image size
- `ffmpeg` for video generation
- Health check configured for `/v1/health` endpoint

### Deploy to Railway

1. **Connect your repository:**
   - Go to [Railway](https://railway.app) and create a new project
   - Connect your GitHub repository (anhlamtruong/chuchube-finance)

2. **Configure the service:**
   - Select the repository
   - Railway will auto-detect the monorepo
   - In service settings, configure:
     - **Build context**: repo root
     - **Dockerfile**: `apps/llm/Dockerfile`

3. **Set environment variables:**
   Add these in Railway's environment variables section (get values from `.env.example`):
   - `PORT` (Railway sets this automatically, but set to 8080 as fallback)
   - `NODE_ENV=production`
   - `GEMINI_API_KEY` (from Google Cloud)
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com`
   - Any other services (MongoDB, Clerk, etc.) based on your `.env.example`

4. **Set health check:**
   - In Railway's service settings, configure health check:
     - **Path**: `/v1/health`
     - **Interval**: 30s
     - **Timeout**: 5s

5. **Deploy:**
   - Click "Deploy" and Railway will build and deploy your service
   - Railway provides a public URL automatically

6. **Verify deployment:**

```bash
curl -sS https://your-railway-url.up.railway.app/v1/health
```

## Endpoints

### Health / sanity

- GET /v1/health
- GET /v1/transactions/ping
- GET /v1/transactions/storage-status

### Categorization + memory

- POST /v1/transactions/categorize
- POST /v1/transactions/feedback-category
- POST /v1/transactions/confirm
- GET /v1/transactions/lookup?userId=...&raw=...

### Recurring + bills

- POST /v1/transactions/recurring-detect
- POST /v1/transactions/upcoming-bills

### Daily coaching

- POST /v1/transactions/daily-spend
- POST /v1/transactions/category-caps
- POST /v1/transactions/daily-message

### Transaction history

- GET /v1/transactions/history?userId=...&days=30&limit=50&accountId=...

## Examples

### Smoke

```bash
curl -sS --max-time 5 "http://127.0.0.1:8080/v1/transactions/ping" | jq
```

### Confirm (store user memory: merchant -> category)

```bash
curl -sS --max-time 10 -X POST "http://127.0.0.1:8080/v1/transactions/confirm" \
  -H "Content-Type: application/json" \
  }' | jq
```

### Categorize

```bash
curl -sS --max-time 10 -X POST "http://127.0.0.1:8080/v1/transactions/categorize" \
  -H "Content-Type: application/json" \
  }' | jq
```

### Recurring detect

```bash
curl -sS --max-time 10 -X POST "http://127.0.0.1:8080/v1/transactions/recurring-detect" \
  -H "Content-Type: application/json" \
  }' | jq
```

### Upcoming bills

```bash
curl -sS --max-time 10 -X POST "http://127.0.0.1:8080/v1/transactions/upcoming-bills" \
  -H "Content-Type: application/json" \
  }' | jq
```

### Daily spend (safe-to-spend today)

```bash
curl -sS --max-time 10 -X POST "http://127.0.0.1:8080/v1/transactions/daily-spend" \
  -H "Content-Type: application/json" \
  }' | jq
```

### Category caps

```bash
curl -sS --max-time 10 -X POST "http://127.0.0.1:8080/v1/transactions/category-caps" \
  -H "Content-Type: application/json" \
  }' | jq
```

### Daily message

```bash
curl -sS --max-time 15 -X POST "http://127.0.0.1:8080/v1/transactions/daily-message" \
  -H "Content-Type: application/json" \
  }' | jq
```

### History + coach from history

```bash
# history for all user-owned accounts
curl -sS "http://127.0.0.1:8080/v1/transactions/history?userId=u1&days=30&limit=50" | jq

# history for single account
curl -sS "http://127.0.0.1:8080/v1/transactions/history?userId=u1&accountId=account_1&days=30&limit=50" | jq

# coach for all user-owned accounts
curl -sS --max-time 25 -X POST "http://127.0.0.1:8080/v1/transactions/coach-from-history" \
  -H "Content-Type: application/json" \
  -d '{"userId":"u1","days":120,"tone":"friendly"}' | jq

# coach for a single account
curl -sS --max-time 25 -X POST "http://127.0.0.1:8080/v1/transactions/coach-from-history" \
  -H "Content-Type: application/json" \
  -d '{"userId":"u1","accountId":"account_1","days":120,"tone":"friendly"}' | jq
```

## Data model (Supabase `transactions`)

We assume the table has at least:

- `id: text`
- `amount: int4` (negative = spend, positive = income)
- `payee: text`
- `note/notes: text` (API uses `note`)
- `date: timestamp`
- `account_id: text`
- `category_id: text`

# apps/llm — AI API

## Endpoints

Health / sanity
GET /v1/health
GET /v1/transactions/ping
GET /v1/transactions/storage-status

Categorization + memory
POST /v1/transactions/categorize
POST/v1/transactions/feedback-category
POST /v1/transactions/confirm
GET /v1/transactions/lookup?userId=...&raw=...

Recurring + bills
POST /v1/transactions/recurring-detect
POST /v1/transactions/upcoming-bills

Daily coaching
POST /v1/transactions/daily-spend
POST /v1/transactions/category-caps
POST /v1/transactions/daily-message (Gemini-generated message)

## Run

```bash
npm run dev -w apps/llm
```

Base: http://127.0.0.1:8080

Smoke

```bash
curl -sS --max-time 5 "http://127.0.0.1:8080/v1/transactions/ping" | jq
```

1. Confirm (store user memory: merchant -> category)

```bash
curl -sS --max-time 10 -X POST "http://127.0.0.1:8080/v1/transactions/confirm" \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"u1",
    "categoryId":"coffee",
    "transaction":{"merchant":"STARBUCKS #9999","description":"STARBUCKS STORE 9999"}
  }' | jq
```

2. Categorize

```bash
curl -sS --max-time 10 -X POST "http://127.0.0.1:8080/v1/transactions/categorize" \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"u1",
    "accountId":"a1",
    "transaction":{
      "id":"t_mem_test",
      "merchant":"STARBUCKS #7777",
      "description":"STARBUCKS STORE 7777",
      "amount":5.55,
      "isoDate":"2026-01-21"
    }
  }' | jq
```

3. Recurring detect (monthly subscriptions, etc.)

```bash
curl -sS --max-time 10 -X POST "http://127.0.0.1:8080/v1/transactions/recurring-detect" \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"u1",
    "transactions":[
      {"merchant":"NETFLIX.COM","amount":15.49,"isoDate":"2025-11-20"},
      {"merchant":"NETFLIX.COM","amount":15.49,"isoDate":"2025-12-20"},
      {"merchant":"NETFLIX.COM","amount":15.49,"isoDate":"2026-01-20"},
      {"merchant":"SPOTIFY","amount":10.99,"isoDate":"2025-11-05"},
      {"merchant":"SPOTIFY","amount":10.99,"isoDate":"2025-12-05"},
      {"merchant":"SPOTIFY","amount":10.99,"isoDate":"2026-01-05"}
    ]
  }' | jq
```

4. Upcoming bills (from recurring patterns)

```bash
curl -sS --max-time 10 -X POST "http://127.0.0.1:8080/v1/transactions/upcoming-bills" \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"u1",
    "todayIso":"2026-01-21",
    "horizonDays": 40,
    "transactions":[
      {"merchant":"NETFLIX.COM","amount":15.49,"isoDate":"2025-11-20"},
      {"merchant":"NETFLIX.COM","amount":15.49,"isoDate":"2025-12-20"},
      {"merchant":"NETFLIX.COM","amount":15.49,"isoDate":"2026-01-20"},
      {"merchant":"SPOTIFY","amount":10.99,"isoDate":"2025-11-05"},
      {"merchant":"SPOTIFY","amount":10.99,"isoDate":"2025-12-05"},
      {"merchant":"SPOTIFY","amount":10.99,"isoDate":"2026-01-05"}
    ]
  }' | jq
```

5. Daily spend (safe-to-spend today)

```bash
curl -sS --max-time 10 -X POST "http://127.0.0.1:8080/v1/transactions/daily-spend" \
  -H "Content-Type: application/json" \
  -d '{
    "todayIso":"2026-01-21",
    "balanceNow": 500,
    "goalAmount": 200,
    "goalDueIso":"2026-02-21",
    "alreadySaved": 0,
    "horizonDays": 40,
    "upcomingBills":[
      {"normalizedMerchant":"SPOTIFY","cadence":"monthly","expectedIsoDate":"2026-02-05","expectedAmount":10.99,"confidence":0.8,"daysUntil":15,"explanation":"..."},
      {"normalizedMerchant":"NETFLIX","cadence":"monthly","expectedIsoDate":"2026-02-20","expectedAmount":15.49,"confidence":0.8,"daysUntil":30,"explanation":"..."}
    ]
  }' | jq
```

6. Category caps (splits daily budget into caps)

```bash
curl -sS --max-time 10 -X POST "http://127.0.0.1:8080/v1/transactions/category-caps" \
  -H "Content-Type: application/json" \
  -d '{ "totalDailyBudget": 8.82 }' | jq
```

7. Daily message (LLM coaching text)

```bash
curl -sS --max-time 15 -X POST "http://127.0.0.1:8080/v1/transactions/daily-message" \
  -H "Content-Type: application/json" \
  -d '{
    "todayIso":"2026-01-21",
    "safeToSpendToday": 8.82,
    "caps": { "coffee": 1.76, "dining": 3.09, "groceries": 2.21, "transport": 1.76 },
    "upcoming": [
      {"normalizedMerchant":"SPOTIFY","expectedIsoDate":"2026-02-05","expectedAmount":10.99,"daysUntil":15,"confidence":0.8},
      {"normalizedMerchant":"NETFLIX","expectedIsoDate":"2026-02-20","expectedAmount":15.49,"daysUntil":30,"confidence":0.8}
    ],
    "tone":"friendly"
  }' | jq
```

=======

- `id: text`
- `amount: int4` (negative = spend, positive = income)
- `payee: text`
- `note/notes: text` (we normalize to `note` in the API)
- `date: timestamp`
- `account_id: text`
- `category_id: text`

## Endpoints

### 1) Ping

**GET** `/v1/transactions/ping`

```bash
curl -sS "http://127.0.0.1:8080/v1/transactions/ping" | jq
```

### 2) Transaction history (scoped by user/account)

**GET** `/v1/transactions/history?userId=u1&days=30&limit=50&accountId=account_1`

- `userId` **required**
- `accountId` optional (if omitted: all accounts owned by `userId`)

```bash
# all accounts owned by user
curl -sS "http://127.0.0.1:8080/v1/transactions/history?userId=u1&days=30&limit=50" | jq

# single account only
curl -sS "http://127.0.0.1:8080/v1/transactions/history?userId=u1&accountId=account_1&days=30&limit=50" | jq
```

Response:

- `summary: { income, spend, net, topCategories[], topPayees[] }`
- `transactions[]` (normalized rows)

### 3) AI Coach message from history

**POST** `/v1/transactions/coach-from-history`

Body:

- `userId` **required**
- `accountId` optional
- `days` optional (default 120)
- `todayIso` optional (`YYYY-MM-DD`)
- `tone` optional (`friendly` | `direct` | `strict`)

```bash
# coach for all user-owned accounts
curl -sS --max-time 25 -X POST "http://127.0.0.1:8080/v1/transactions/coach-from-history" \
  -H "Content-Type: application/json" \
  -d '{"userId":"u1","days":120,"tone":"friendly"}' | jq

# coach for a single account
curl -sS --max-time 25 -X POST "http://127.0.0.1:8080/v1/transactions/coach-from-history" \
  -H "Content-Type: application/json" \
  -d '{"userId":"u1","accountId":"account_1","days":120,"tone":"friendly"}' | jq
```

Response:

- `message` (string)
- `highlights[]`, `risks[]`, `suggestedActions[]`
- `source` (`gemini` | `heuristic`)

# (apps/llm)

Express service:

- Pulls transaction history from Supabase
- Generates an AI Daily Coach message from history
- Sends emails + checks delivery status via Resend

## Data model (Supabase `transactions`)

We assume the table has at least:

- `id: text`
- `amount: int4` (**negative = spend**, **positive = income**)
- `payee: text`
- `note/notes: text` (API uses `note`)
- `date: timestamp`
- `account_id: text`
- `category_id: text`

## Local dev

From repo root:

```bash
npm run dev -w apps/llm
# htp://127.0.0.1:8080 by default
```

```bash
CORS_ORIGINS=https://chuchube.co,https://www.chuchube.co,http://localhost:3000
# resend email
RESEND_API_KEY=...
RESEND_FROM=Chuchube <no-reply@chuchube.co>
```

---

## Endpoints

### 1) Ping

**GET** `/v1/transactions/ping`

```bash
curl -sS "http://127.0.0.1:8080/v1/transactions/ping" | jq
```

### 2) Transaction history (scoped)

**GET** `/v1/transactions/history?userId=u1&days=30&limit=50&accountId=account_1`

- `userId` **required**
- `accountId` optional
  - if omitted: returns **all accounts owned by** `userId`
  - if provided: returns **only** that `accountId` (and only if it belongs to `userId`)

```bash
# all accounts owned by user
curl -sS "http://127.0.0.1:8080/v1/transactions/history?userId=u1&days=30&limit=50" | jq

# single account only
curl -sS "http://127.0.0.1:8080/v1/transactions/history?userId=u1&accountId=account_1&days=30&limit=50" | jq
```

Response includes:

- `summary: { income, spend, net, topCategories[], topPayees[] }`
- `transactions[]` (normalized rows)

### 3) AI Coach message from history

**POST** `/v1/transactions/coach-from-history`

Body:

- `userId` **required**
- `accountId` optional
- `days` optional (default `120`)
- `todayIso` optional (`YYYY-MM-DD`)
- `tone` optional (`friendly` | `direct` | `strict`)

```bash
# coach for all user-owned accounts
curl -sS --max-time 25 -X POST "http://127.0.0.1:8080/v1/transactions/coach-from-history" \
  -H "Content-Type: application/json" \
  -d '{"userId":"u1","days":120,"tone":"friendly"}' | jq

# for a single account
curl -sS --max-time 25 -X POST "http://127.0.0.1:8080/v1/transactions/coach-from-history" \
  -H "Content-Type: application/json" \
  -d '{"userId":"u1","accountId":"account_1","days":120,"tone":"friendly"}' | jq
```

Response:

- `message` (string)
- `highlights[]`, `risks[]`, `suggestedActions[]`
- `source` (`gemini` | `heuristic`)

---

## Email (Resend)

### 4) Send email

**POST** `/v1/notify/email`

Body:

- `to` (string or array)
- `subject` (string)
- `text` and/or `html`
- optional `from` (`"Name <email@domain>"`) and `replyTo`

```bash
curl -sS --max-time 20 -X POST "http://127.0.0.1:8080/v1/notify/email" \
  -H "Content-Type: application/json" \
  -d '{
    "to":" anhlamtruong1012@gmail.com",
    "subject":"status Test",
    "html":"<h2>Ping OK con de</h2><p>check delivery status next.</p>"
  }' | jq
```

### 5) Check email status

**GET** `/v1/notify/email/:id`

```bash
EMAIL_ID="cdcf91ef-cd59-4a4e-8519-7ed39809b8e1"
curl -sS "http://127.0.0.1:8080/v1/notify/email/${EMAIL_ID}" | jq
```

```bash
TX_ID="txn_2026-01-21_income_0"

HTML=$(cat <<EOF
<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f6f7fb;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:18px;border:1px solid #eef2f7;">
    <h2 style="margin:0 0 8px;">Transaction ready^^</h2>
    <p style="margin:0 0 14px;color:#374151;line-height:1.6;">
      Tap below to view details for <strong>${TX_ID}</strong>.
    </p>
    <a href="https://chuchube.co/transactions/${TX_ID}"
       style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 14px;border-radius:10px;font-weight:700;">
      View transaction
    </a>
    <p style="margin:14px 0 0;color:#6b7280;font-size:12px;">
      If the button doesn’t work, copy this link:<br/>
      https://chuchube.co/transactions/${TX_ID}
    </p>
  </div>
</body></html>
EOF
)

jq -n --arg to "npnallstar@gmail.com" \
      --arg subject "Chuchube trans details" \
      --arg html "$HTML" \
' {"to":$to,"subject":$subject,"html":$html} ' \
| curl -sS --max-time 20 -X POST "http://127.0.0.1:8080/v1/notify/email" \
    -H "Content-Type: application/json" \
    -d @- \
| jq
```

# apps/llm — Chuchube LLM Service

Express service used by the frontend/backend to:

- Read transaction history from Supabase (scoped by `userId` + optional `accountId`)
- Generate an AI “Daily Coach” message from history (Gemini)
- Send emails + check delivery status (Resend)
- Generate short mascot motion videos from a reference image (Vertex AI Veo) and serve them as static assets

---

## Local dev

From repo root:

```bash
npm run dev -w apps/llm
# http://127.0.0.1:8080 by default
```

CORS is enabled for browser clients. For local frontend dev, allow `http://localhost:3000`.

---

## Environment variables

### Required (depending on features you use)

**Supabase (transactions):**

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

**Gemini (coach):**

- `GEMINI_API_KEY`

**Resend (email):**

- `RESEND_API_KEY`
- `RESEND_FROM` (must be in `email@example.com` or `Name <email@example.com>` format)

**Veo / Vertex AI (mascot video):**

- `PROJECT_ID` (GCP project)
- `LOCATION` (e.g. `us-central1`)
- `MODEL_ID` (e.g. `veo-3.1-fast-generate-001`)
- `VEO_REF_GCS` (recommended) — `gs://<bucket>/mascot1.png` (reference image used for style consistency)

### Optional

- `PORT` (default `8080`)
- `CORS_ORIGINS` (comma-separated; defaults to `https://chuchube.co, https://www.chuchube.co, http://localhost:3000`)
- `VEO_POLL_MAX` (default `60`)
- `VEO_POLL_INTERVAL_MS` (default `3000`)
- `VERTEX_ACCESS_TOKEN` (server deployments; local dev can rely on `gcloud auth print-access-token`)

> Note: Veo calls use **Vertex AI** (not the `generativelanguage.googleapis.com` base URL). You need billing + Vertex AI API enabled on the project.

---

## Data model (Supabase `transactions`)

We assume the table has at least:

- `id: text`
- `amount: int4` (**negative = spend**, **positive = income**)
- `payee: text`
- `note/notes: text` (API normalizes to `note`)
- `date: timestamp`
- `account_id: text`
- `category_id: text`

---

## Static assets

Generated videos are saved to:

- `apps/llm/assets/generated/*.mp4`

They are served by this service at:

- `GET /assets/generated/<file>.mp4`

Example (after generating a video):

```bash
open "http://127.0.0.1:8080/assets/generated/mascot_motion_latest.mp4"
```

---

## Endpoints

### 1) Ping

**GET** `/v1/transactions/ping`

```bash
curl -sS "http://127.0.0.1:8080/v1/transactions/ping" | jq
```

---

### 2) Transaction history (scoped)

**GET** `/v1/transactions/history?userId=u1&days=30&limit=50&accountId=account_1`

- `userId` **required**
- `accountId` optional
  - if omitted: returns **all accounts owned by** `userId`
  - if provided: returns **only** that `accountId` (and only if it belongs to `userId`)

```bash
# all accounts owned by user
curl -sS "http://127.0.0.1:8080/v1/transactions/history?userId=u1&days=30&limit=50" | jq

# single account only
curl -sS "http://127.0.0.1:8080/v1/transactions/history?userId=u1&accountId=account_1&days=30&limit=50" | jq
```

Response includes:

- `summary: { income, spend, net, topCategories[], topPayees[] }`
- `transactions[]` (normalized rows)

---

### 3) AI Coach message from history

**POST** `/v1/transactions/coach-from-history`

Body:

- `userId` **required**
- `accountId` optional
- `days` optional (default `120`)
- `todayIso` optional (`YYYY-MM-DD`)
- `tone` optional (`friendly` | `direct` | `strict`)

```bash
# coach for all user-owned accounts
curl -sS --max-time 25 -X POST "http://127.0.0.1:8080/v1/transactions/coach-from-history" \
  -H "Content-Type: application/json" \
  -d '{"userId":"u1","days":120,"tone":"friendly"}' | jq

# coach for a single account
curl -sS --max-time 25 -X POST "http://127.0.0.1:8080/v1/transactions/coach-from-history" \
  -H "Content-Type: application/json" \
  -d '{"userId":"u1","accountId":"account_1","days":120,"tone":"friendly"}' | jq
```

Response:

- `message` (string)
- `highlights[]`, `risks[]`, `suggestedActions[]`
- `source` (`gemini` | `heuristic`)

---

## Email (Resend)

### 4) Send email

**POST** `/v1/notify/email`

Body:

- `to` (string or array)
- `subject` (string)
- `text` and/or `html`
- optional `from` (`"Name <email@domain>"`) and `replyTo`

```bash
curl -sS --max-time 20 -X POST "http://127.0.0.1:8080/v1/notify/email" \
  -H "Content-Type: application/json" \
  -d '{
    "to":"npnallstar@gmail.com",
    "subject":"Chuchube • Status Test",
    "html":"<h2>Ping ✅</h2><p>Checking delivery status next.</p>"
  }' | jq
```

### 5) Check email delivery status

**GET** `/v1/notify/email/:id`

```bash
EMAIL_ID="cdcf91ef-cd59-4a4e-8519-7ed39809b8e1"
curl -sS "http://127.0.0.1:8080/v1/notify/email/${EMAIL_ID}" | jq
```

`email.last_event` is Resend’s latest status (e.g. `delivered`, `bounced`, `suppressed`).

**Linking to frontend pages**

- Email buttons can link to `https://chuchube.co/transactions/<id>`.
- If the user sees **404**, it means the **frontend route/page isn’t deployed (or doesn’t exist) yet** — the email link itself is fine.

---

## Mascot video :> >

OUTPUT : short MP4 from a reference img + motion prompt, saves it to `apps/llm/assets/generated` , and reTurns a URL the frontend can play.

### 6) List motion presets

**GET** `/v1/mascot/presets`

```bash
curl -sS "http://127.0.0.1:8080/v1/mascot/presets" | jq
```

### 7) Generate a mascot motion video

**POST** `/v1/mascot/video`

Body (choose one path):

- **Preset-based**: `preset` in `{good, streak, warning, overspent, neutral}`
- **Auto**: provide `txSummary` and the service chooses a preset

Optional:

- `refGcs` (override reference image) — otherwise uses `VEO_REF_GCS`
- `outName` (base filename, default `mascot_motion_latest`)
- `extra` (extra prompt constraints)

```bash
# preset-based
curl -sS --max-time 120 -X POST "http://127.0.0.1:8080/v1/mascot/video" \
  -H "Content-Type: application/json" \
  -d '{
    "preset":"good",
    "outName":"mascot_motion_latest"
  }' | jq


curl -sS --max-time 120 -X POST "http://127.0.0.1:8080/v1/mascot/video" \
  -H "Content-Type: application/json" \
  -d '{
    "txSummary": {"spend": 120.50, "income": 300.00, "net": 179.50},
    "outName":"mascot_motion_net_positive"
  }' | jq
```

Response:

- `publicUrl` (playable URL under `/assets/generated/...`)
- `fileName`, `bytes`, `presetUsed`

Example: open the returned URL:

```bash
open "http://127.0.0.1:8080/assets/generated/mascot_motion_latest.mp4"
```

---

## Frontend integration notes

- The frontend can:
  - Call `/v1/transactions/history` and `/v1/transactions/coach-from-history` scoped by `userId` + `accountId`.
  - Use `/v1/notify/email` to send templates and embed links to `https://chuchube.co/transactions/<id>`.
  - Generate a mascot motion MP4 with `/v1/mascot/video`, then render the returned `publicUrl` in a `<video>` element.

```html
<video
  src="http://127.0.0.1:8080/assets/generated/mascot_motion_latest.mp4"
  autoplay
  muted
  loop
  playsinline
></video>
```

# apps/llm — API (Transactions + Coaching)

Express service for:
- Transaction APIs (history, storage probe)
- Gemini-powered coaching message from history
- Resend email send + status
- Serves generated assets under `/assets/*`

## Run (local)

From repo root:

```bash
npm run dev -w apps/llm
# or:
PORT=8080 npm run start -w apps/llm
```

Base URL (default): `http://127.0.0.1:8080`

## Environment

Required for **transactions/history + storage-status**:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Required for **Gemini coaching**:
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (optional)

Required for **email (Resend)**:
- `RESEND_API_KEY`
- `RESEND_FROM` (e.g. `Chuchube <no-reply@chuchube.co>`)

Optional:
- `PORT` (default `8080`)
- `CORS_ORIGINS` (comma-separated)
- `COACH_GEMINI_TIMEOUT_MS` (default used by coach route)

## Key endpoints

### Health
- `GET /v1/health`
- `GET /v1/transactions/ping`
- `GET /v1/transactions/storage-status`

### Transactions
- `GET /v1/transactions/history?userId=...&days=30&limit=50&accountId=...`
- `POST /v1/transactions/coach-from-history`

### Email (Resend)
- `POST /v1/notify/email`
- `GET /v1/notify/email/:id`

## Quick tests

Set variables (bash/zsh):

```bash
BASE=${BASE:-http://127.0.0.1:8080}
: "${USER_ID:?set USER_ID first}"
```

Ping + storage:

```bash
curl -sS "$BASE/v1/transactions/ping" | jq
curl -sS "$BASE/v1/transactions/storage-status" | jq
```

History (all user-owned accounts):

```bash
curl -sS --max-time 20 \
  "$BASE/v1/transactions/history?userId=$USER_ID&days=30&limit=5" \
| jq '{ok,error,range,debug,count,first:(.transactions[0]//null)}'
```

Coach from history (Gemini if configured; may fall back to heuristic on timeout):

```bash
curl -sS --max-time 45 -X POST "$BASE/v1/transactions/coach-from-history" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$USER_ID\",\"days\":120,\"tone\":\"friendly\",\"timeoutMs\":30000}" \
| jq '{ok,source,routerVersion,message,highlights,risks,suggestedActions,error}'
```

Email send + status:

```bash
: "${TO_EMAIL:?set TO_EMAIL first}"

EMAIL_ID=$(curl -sS --max-time 20 -X POST "$BASE/v1/notify/email" \
  -H "Content-Type: application/json" \
  -d "{\"to\":\"$TO_EMAIL\",\"subject\":\"Chuchube • Test\",\"html\":\"<h2>Ping ✅</h2><p>Resend test</p>\"}" \
| jq -r '.id')

echo "EMAIL_ID=$EMAIL_ID"
curl -sS "$BASE/v1/notify/email/$EMAIL_ID" | jq
```

MongoDB test curl -sS http://127.0.0.1:8080/v1/mongo/ping | jq .
## Notes

- `transactions` table note field can be `note` or `notes`; API normalizes to `note`.
- Generated assets are served from: `GET /assets/generated/<file>`