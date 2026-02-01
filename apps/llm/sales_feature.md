# Sales Feature for Women and people — (Updated: SerpAPI + eBay + Etsy)

## 1) What 
A **Sales / Deals** feature inside **Chuchube** (finance + saving app) that helps users discover **relevant discounts and cheaper alternatives**, while intentionally uplifting **women empowerment**:
- Prefer **women-owned / women-led** brands and values-based shopping when possible (without blocking mainstream inventory).
- Support practical needs (period prep, work essentials, wellness, safety, event outfits) with budget-aware recommendations.
- Let users give feedback so recommendations improve over time.

Core promise: **“Spend less, buy smarter, support women.”**

---

## 2) User Xperience 
| Moment | What happens | Women-first angle |
|---|---|---|
| Entry point | Sales tab/button inside dashboard | Framed as “save money + support women” |
| Before typing | Suggestion chips based on history + common needs | Women-first categories (period care, workwear, wellness, women-led brands) |
| Search | User types general or specific item | Auto-boost query with women-led keywords (toggleable) |
| Results | Cards show image/price/discount/source | Highlight women-led merchants when known (badges later) |
| Feedback | “Save”, “Too expensive”, “Not relevant”, “Prefer women-led” | Feedback becomes personalization + re-ranking |

---

## 3) Providers & APIs 
### Provider table
| Provider | What it’s best for | Pros | Cons / notes | Status |
|---|---|---|---|---|
| **SerpAPI (Google Shopping engine)** | Broad shopping coverage + pricing quickly | Easiest to integrate, good for MVP coverage, real-time-ish | Paid, can have query edge cases, not a direct affiliate | **Active (now)** |
| **eBay Browse API** | Strong marketplace inventory + pricing, long-tail items | Great inventory depth, structured product data | Requires app keys + OAuth; rate limits | **Planned (pending)** |
| **Etsy API** | Women-led/indie + “values-based” shopping | Strong for unique goods, creator economy | Key approval pending; policy constraints | **Planned (pending)** |

### How (routing)
| Search intent | Primary provider | Fallback provider | Why |
|---|---|---|---|
| Generic product query | SerpAPI | eBay | broad coverage + marketplace fallback |
| Indie / handmade / gifts | Etsy | SerpAPI | stronger women-led / small business signal |
| Used / collectible / niche | eBay | SerpAPI | marketplace depth |
| If one provider returns 0 | Next provider | (then broaden query) | reliability |

---

## 4) Architecture backend + frontend
### Backend (apps/llm)
| Component | Responsibility | Notes |
|---|---|---|
| `routes/sales.ts` | `/ping`, `/suggest`, `/search`, `/feedback` | Single router, modular providers |
| `sales/providers/serpapi.ts` | Call SerpAPI + map to `SaleItem[]` | Already working |
| `sales/providers/ebay.ts` | Call eBay Browse + map to `SaleItem[]` | Add when keys active |
| `sales/providers/etsy.ts` | Call Etsy + map to `SaleItem[]` | Add when keys active |
| `sales/utils.ts` | Types + helpers | `SaleItem`, `clamp`, `safeNum`, `mustEnv`, `requestId` |
| `lib/mongo.ts` | Store feedback events (optional) | Current TLS issue needs fix |

### Frontend (apps/web-client)
| Component | Responsibility | Notes |
|---|---|---|
| Sales page/tab | Search bar + filters + results grid | Calls `/suggest` and `/search` |
| Result cards | Image, price, discount, brand/source + click-out | Add women-led badges later |
| Feedback buttons | “Save”, “Not relevant”, “Too expensive” | POST to `/feedback` |
| Local caching | Avoid re-fetch spam | Debounce input |

---

## 5) API routes (LLM service)
Mounted at: `/v1/sales`

| Route | Method | Purpose | Key inputs | Output |
|---|---:|---|---|---|
| `/ping` | GET | health check | — | `{ ok, routerVersion }` |
| `/suggest` | POST | pre-search chips | `goal?`, `budgetMax?` | `{ suggestions[] }` |
| `/search` | POST | multi-provider search | `query` (required), filters | `{ items[], meta, providerDebug }` |
| `/feedback` | POST | store personalization signals | `userId` required | `{ stored, mongoError? }` |

---

## 6) Data model 
### `SaleItem` (what UI consumes)
| Field | Type | Meaning |
|---|---|---|
| `title` | string | product title |
| `url` | string | click-out link |
| `image` | string\|null | thumbnail |
| `source` | string\|null | store / merchant |
| `brand` | string\|null | brand (when known) |
| `price` | number\|null | extracted numeric price |
| `priceText` | string\|null | raw formatted price |
| `originalPrice` | number\|null | strikethrough price (if any) |
| `discountText` | string\|null | “10% OFF”, etc |
| `rating` | number\|null | rating |
| `reviews` | number\|null | review count |
| `delivery` | string\|null | shipping text |
| `tag` | string\|null | extra label (“LOW PRICE”) |

---

## 7) Environment variables (keys)
| Variable | Needed for | Required now? |
|---|---|---|
| `SERPAPI_API_KEY` | SerpAPI shopping search |  Yes |
| `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` | eBay Browse API (OAuth) |  Later |
| `ETSY_API_KEY` / (OAuth fields as required) | Etsy API |  Later |
| `MONGODB_URI` | feedback storage | Optional |
| `MONGODB_DB` | feedback DB name | Optional |

---

## 8) End-to-end plan
| Phase | Goal | Deliverable |
|---|---|---|
| 0 (now) | SerpAPI-only MVP | Search + suggest + basic UI + click-out |
| 1 | Reliability + UX polish | loading states, fallback search, pagination, better ranking |
| 2 | Personalization + finance tie-in | “cheaper than last purchase”, savings insights, feedback-driven ranking |
| 3 | Multi-provider | Add eBay + Etsy providers, merge + dedupe results |

---

## 9) Next steps (what to do right now)
| Priority | Task | Why |
|---:|---|---|
| 1 | Fix Mongo TLS issue in `lib/mongo.ts` (optional) | so `/feedback` can store signals |
| 2 | Build the Sales UI page in `apps/web-client` | unblock product demo |
| 3 | Add fallback logic when results are empty | improves perceived reliability |
| 4 | Add eBay/Etsy provider stubs (behind env flags) | smooth future integration |

---

## 10) Are we coding eBay/Etsy now?
Yes — **we can add provider stubs** (no keys required) so the system is ready:
- `sales/providers/ebay.ts` and `sales/providers/etsy.ts`
- Each returns `{ items: [], meta, providerDebug }` until keys are active
- `routes/sales.ts` chooses which providers to call based on env vars + search intent

# Notes:
**will update on Thursday if get approved for eBay and Etsy API key**
**considering chrome extension after**
**connect LLM and Supa**

# Sales Feature for Women & People — Chuchube Finance

**Last updated:** 2026-01-31  
**Service:** `apps/llm` (Node/Express)  
**Local base URL:** `http://127.0.0.1:8080`

Core promise: **“Spend less, buy smarter, support women.”**

---

## 1) What
A **Sales / Deals** feature inside **Chuchube** (finance + saving app) that helps users discover **relevant discounts and cheaper alternatives**, while intentionally uplifting **women empowerment**:

- Prefer **women-owned / women-led** inventory when possible (**toggleable**, never blocks mainstream inventory).
- Support practical needs (period prep, work essentials, wellness, safety, event outfits) with budget-aware recommendations.
- Provide short **“reason”** strings on result cards to make choices fast.

---

## 2) Current status (what’s actually live)

### ✅ Live endpoints (working locally)

#### Sales API (LIVE)
Mounted at: **`/v1/sales`**
- `GET /v1/sales/ping`
-  `POST /v1/sales/search` (SerpAPI Google Shopping via UDM=28)

#### Transactions API (LIVE)
Mounted at: **`/v1/transactions`**
-  `GET /v1/transactions/ping`
- ✅`GET /v1/transactions/history?userId=...&days=...&limit=...` (**requires `userId`**)

---

## 3) User Experience
| Moment | What happens | Women-first angle |
|---|---|---|
| Entry point | Sales tab/button inside dashboard | Framed as “save money + support women” |
| Before typing | Suggestion chips (planned) | Women-first categories (period care, workwear, wellness) |
| Search | User types an item | Toggle adds women-led keywords |
| Results | Cards show image/price/source | Short reason strings + later badges |
| Filters | priceMin/priceMax + maxResults | Budget-aware recommendations |
| Feedback (planned) | Save / Not relevant / Too expensive | Personalization + re-ranking |

---

## 4) Providers & APIs

### Provider table
| Provider | What it’s best for | Pros | Cons / notes | Status |
|---|---|---|---|---|
| **SerpAPI (Google Shopping engine)** | Broad shopping coverage + pricing quickly | Easy MVP coverage, real-time-ish | Paid; query edge cases; not affiliate | ✅ Active (now) |
| **eBay Browse API** | Strong marketplace inventory + pricing | Inventory depth, structured data | Requires OAuth; rate limits | ⏳ Planned |
| **Etsy API** | Indie / creator economy (women-led signal) | Strong values-based shopping | Key approval/policy constraints | ⏳ Planned |

### Facts enrichment (optional layer)
We have code to enrich results with **facts/categories/barcodes** and re-rank, but it is **not wired into the `/v1/sales/search` response yet**.
- Implemented helper: `apps/llm/src/sales/providers/multi.ts` (`enrichWithFacts()`)
- Current API debug shows: `withFacts: false` even when requested

---

## 5) Architecture (backend + frontend)

### Backend (apps/llm)
| Component | Responsibility | Notes |
|---|---|---|
| `src/routes/sales.ts` | `/ping`, `/search` | Primary Sales router |
| `src/sales/providers/serpapi.ts` | Calls SerpAPI + maps to `SaleItem[]` | Active |
| `src/sales/providers/multi.ts` | Facts enrichment + dedupe + rerank | Exists; not wired into API yet |
| `src/routes/transactions.ts` | transactions endpoints | `history` requires `userId` |
| `src/routes/companion.ts` | companion endpoints | Works; uses Gemini |

### Frontend (apps/web-client)
| Component | Responsibility | Notes |
|---|---|---|
| Sales page/tab | Search bar + filters + results grid | Calls `/v1/sales/search` |
| Result cards | Image, price, discount, source + click-out | Shows `reason` strings |
| Feedback buttons (planned) | “Save”, “Not relevant”, “Too expensive” | POST to `/feedback` later |

---

## 6) API routes (Sales) — details

### `GET /v1/sales/ping`
Response:
```json
{ "ok": true, "routerVersion": "..." }
```

Test:
```bash
curl -sS http://127.0.0.1:8080/v1/sales/ping | jq .
```

---

### `POST /v1/sales/search`
**Request body (commonly used):**
```json
{
  "query": "ramen",
  "womenFocus": true,
  "maxResults": 6,
  "priceMin": null,
  "priceMax": null,
  "withReasons": true,
  "reasonsMax": 3,
  "debug": true,
  "gl": "us",
  "hl": "en"
}
```

**Behavior**
- If `womenFocus=true`, query is boosted:
  - `queryUsed = "<query> women-owned women-led"`
- Uses SerpAPI (Google Shopping) and normalizes results into `SaleItem[]`
- Adds `reason` strings when `withReasons=true`
- Adds debug metadata when `debug=true`

**Response shape (simplified):**
```json
{
  "ok": true,
  "routerVersion": "...",
  "requestId": "...",
  "queryUsed": "ramen women-owned women-led",
  "womenFocus": true,
  "withReasons": true,
  "reasonsMax": 3,
  "count": 6,
  "items": [
    {
      "title": "...",
      "url": "...",
      "source": "Etsy",
      "image": "...",
      "priceText": "$3.40",
      "price": 3.4,
      "rating": 5,
      "reviews": 31,
      "delivery": null,
      "tag": null,
      "base_rank": 0,
      "reason": "$3.4 • 5★ • 31 reviews"
    }
  ],
  "querySent": "ramen women-owned women-led",
  "debug": {
    "cache": "miss",
    "qRaw": "ramen",
    "queryUsed": "ramen women-owned women-led",
    "providerQuery": "ramen women-owned women-led",
    "providerQueryHinted": "ramen women-owned women-led",
    "gl": "us",
    "hl": "en",
    "maxResults": 6,
    "priceMin": null,
    "priceMax": null,
    "withReasons": true,
    "reasonsMax": 3,
    "withFacts": false,
    "factsDomains": ["food","beauty","products"],
    "factsPageSize": 12,
    "categoryWeight": 0.35,
    "factsMatchThreshold": 90,
    "factsDedupeThreshold": 94,
    "querySent": "ramen women-owned women-led"
  }
}
```

**Tests (copy/paste)**
Women-first:
```bash
curl -sS -X POST "http://127.0.0.1:8080/v1/sales/search" \
  -H "Content-Type: application/json" \
  -d '{"query":"ramen","womenFocus":true,"maxResults":6,"withReasons":true,"reasonsMax":3,"debug":true}' \
| jq '.ok,.count,.items[0].reason,.debug.cache,.debug.querySent'
```

Plain:
```bash
curl -sS -X POST "http://127.0.0.1:8080/v1/sales/search" \
  -H "Content-Type: application/json" \
  -d '{"query":"ramen","womenFocus":false,"maxResults":6,"withReasons":true,"reasonsMax":3,"debug":true}' \
| jq '.ok,.count,.items[0].reason,.debug.cache,.debug.querySent'
```

Price cap example:
```bash
curl -sS -X POST "http://127.0.0.1:8080/v1/sales/search" \
  -H "Content-Type: application/json" \
  -d '{"query":"period day kit","womenFocus":true,"maxResults":12,"priceMax":40,"withReasons":true,"reasonsMax":3,"debug":true,"gl":"us","hl":"en"}' \
| jq '.ok,.count,.items[0].price,.items[0].reason,.debug.querySent'
```

---

## 7) Data model
### `SaleItem` (UI contract)
| Field | Type | Meaning |
|---|---|---|
| `title` | string | product title |
| `url` | string | click-out link |
| `image` | string\|null | thumbnail |
| `source` | string\|null | store / merchant |
| `brand` | string\|null | brand (when known) |
| `price` | number\|null | numeric price |
| `priceText` | string\|null | formatted price |
| `originalPrice` | number\|null | strikethrough price |
| `originalPriceText` | string\|null | formatted original price |
| `discountText` | string\|null | “10% OFF”, etc |
| `rating` | number\|null | rating |
| `reviews` | number\|null | review count |
| `delivery` | string\|null | shipping text |
| `tag` | string\|null | extra label |
| `base_rank` | number | provider order |
| `reason` | string\|null | short explanation (when enabled) |

---

## 8) Golden tests (✅ passing)
We have a golden test harness that checks:
- `ok=true`
- `queryUsed` present
- `count == len(items)`
- `debug.cache` and `debug.querySent` present
- items have `title/url/source`
- reasons present in top N

---

## 9) Environment variables
| Variable | Needed for | Required now? |
|---|---|---|
| `SERPAPI_API_KEY` | SerpAPI shopping search | ✅ Yes |
| `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET` | eBay Browse API (OAuth) | Later |
| `ETSY_API_KEY` (+ OAuth as needed) | Etsy API | Later |

---

## 10) Next steps 

### Priority A — Wire facts enrichment (high impact)
Goal: Make `withFacts=true` actually enrich results and add categories.
- Where: `apps/llm/src/routes/sales.ts`
- Call: `enrichWithFacts({ query, items, domains, factsPageSize, matchThreshold, dedupeThreshold, categoryWeight })`
- Return enriched `items` and include enrichment debug in `debug`

### Priority B — Multi-provider routing (eBay/Etsy stubs)
Goal: add provider stubs behind env flags so future integration is painless.
- Add: `sales/providers/ebay.ts`, `sales/providers/etsy.ts`
- Merge logic: dedupe by barcode then fuzzy title+brand

### Priority C — Feedback endpoint
Goal: capture `Save / Not relevant / Too expensive` signals.
- Add route: `POST /v1/sales/feedback`
- Store in: Supabase (recommended for hackathon) or Mongo (optional)

### Priority D — Company View assistants (currently blocked)
Implement the endpoints Company View expects:
- `POST /v1/chat/employee`
- `POST /v1/chat/support`

---

## Quick note
`/v1/transactions/history` requires `userId`. If you call it without `userId`, you’ll get:
```json
{ "ok": false, "error": "Missing userId" }
```

Example:
```bash
USER_ID="some_user"
curl -sS "http://127.0.0.1:8080/v1/transactions/history?userId=${USER_ID}&days=30&limit=50" | jq .
```