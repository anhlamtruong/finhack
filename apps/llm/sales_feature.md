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
