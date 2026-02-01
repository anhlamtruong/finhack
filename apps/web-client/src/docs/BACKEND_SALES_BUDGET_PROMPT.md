# 🔧 Backend Implementation Prompt: Sales Budget & Enhanced Deal Data

**Role:** Backend Engineer  
**Stack:** Node.js/Express, tRPC, MongoDB/PostgreSQL, LLM API integration  
**Objective:** Implement budget integration and enhanced deal data for the Sales UI

---

## Context

The frontend Sales page (`/sales`) needs:

1. User's monthly remaining budget to show affordability indicators
2. Enhanced deal data with computed savings fields
3. Budget-aware search filtering

The frontend already has:

- `trpc.sales.search` → returns `Deal[]`
- `trpc.sales.suggest` → returns `string[]` suggestions
- `trpc.sales.recordFeedback` → records click/save/dismiss
- `page-context-mapper.ts` already fetches `summary.remaining` for companion context

---

## Task 1: Create `sales.getBudget` Procedure

Create a new tRPC query that returns the user's monthly budget status.

**File:** `src/services/sales/procedures/get-budget.ts`

```typescript
import { z } from "zod";
import { authedProcedure } from "@/server/init";
import { startOfMonth, endOfMonth, differenceInDays } from "date-fns";

// Output type
export type SalesBudgetOutput = {
  remaining: number; // Monthly remaining balance in dollars
  spent: number; // Total spent this month in dollars
  income: number; // Total income this month in dollars
  budgetCaps?: {
    shopping?: number; // Shopping category budget limit
    entertainment?: number; // Entertainment category budget limit
    groceries?: number; // Groceries category budget limit
  };
  safeToSpend: number; // Daily safe-to-spend amount
  daysLeftInMonth: number; // Days remaining in current month
  lastUpdated: string; // ISO timestamp
};

export const getSalesBudget = authedProcedure
  .output(
    z.object({
      remaining: z.number(),
      spent: z.number(),
      income: z.number(),
      budgetCaps: z
        .object({
          shopping: z.number().optional(),
          entertainment: z.number().optional(),
          groceries: z.number().optional(),
        })
        .optional(),
      safeToSpend: z.number(),
      daysLeftInMonth: z.number(),
      lastUpdated: z.string(),
    }),
  )
  .query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const daysLeftInMonth = differenceInDays(monthEnd, now) + 1;

    // TODO: Fetch from your database
    // Reuse logic from page-context-mapper.ts or get-ai-summary.ts

    // Example implementation:
    // const transactions = await db.query.transactions.findMany({
    //   where: and(
    //     eq(transactions.userId, userId),
    //     gte(transactions.date, monthStart),
    //     lte(transactions.date, monthEnd)
    //   )
    // });

    // const income = transactions
    //   .filter(t => t.amount > 0)
    //   .reduce((sum, t) => sum + t.amount, 0);

    // const spent = Math.abs(transactions
    //   .filter(t => t.amount < 0)
    //   .reduce((sum, t) => sum + t.amount, 0));

    // const remaining = income - spent;
    // const safeToSpend = remaining / daysLeftInMonth;

    // Placeholder - replace with actual DB queries
    const income = 5000;
    const spent = 3200;
    const remaining = income - spent;
    const safeToSpend = Math.max(0, remaining / daysLeftInMonth);

    return {
      remaining,
      spent,
      income,
      budgetCaps: {
        shopping: 500,
        entertainment: 200,
        groceries: 800,
      },
      safeToSpend: Math.round(safeToSpend * 100) / 100,
      daysLeftInMonth,
      lastUpdated: now.toISOString(),
    };
  });
```

**Register in router:**

```typescript
// src/server/routers/sales.ts
import { getSalesBudget } from "@/services/sales/procedures/get-budget";

export const salesRouter = createTRPCRouter({
  search: searchSales,
  suggest: suggestSales,
  recordFeedback: recordSalesFeedback,
  getBudget: getSalesBudget, // NEW
});
```

---

## Task 2: Enhance Deal Response with Computed Fields

Update the search procedure to return additional computed fields for each deal.

**File:** `src/services/sales/procedures/search.ts`

### Enhanced Deal type:

```typescript
export type Deal = {
  // Existing fields
  id?: string;
  title: string;
  url: string;
  source?: string | null;
  brand?: string | null;
  image?: string | null;
  priceText?: string | null;
  price?: number | null;
  originalPriceText?: string | null;
  originalPrice?: number | null;
  discountText?: string | null;
  rating?: number | null;
  reviews?: number | null;
  delivery?: string | null;
  tag?: string | null;
  reason?: string | null;

  // NEW computed fields
  savingsAmount?: number | null; // originalPrice - price (absolute $)
  savingsPercent?: number | null; // ((originalPrice - price) / originalPrice) * 100
  valueScore?: number | null; // 1-10 AI score (price/quality/reviews ratio)
  freeShipping?: boolean; // true if delivery contains "free" or "$0"
  primeEligible?: boolean; // true if Prime/fast shipping detected
  isAffordable?: boolean; // true if price <= user's remaining budget
};
```

### Computation logic (add to search.ts):

```typescript
interface RawDeal {
  title: string;
  url: string;
  price?: number | null;
  originalPrice?: number | null;
  rating?: number | null;
  reviews?: number | null;
  delivery?: string | null;
  tag?: string | null;
  // ... other fields
}

function enrichDeal(deal: RawDeal, userRemaining?: number): Deal {
  const savingsAmount =
    deal.originalPrice && deal.price
      ? Math.round((deal.originalPrice - deal.price) * 100) / 100
      : null;

  const savingsPercent =
    deal.originalPrice && deal.price && deal.originalPrice > 0
      ? Math.round(
          ((deal.originalPrice - deal.price) / deal.originalPrice) * 100,
        )
      : null;

  const freeShipping =
    deal.delivery?.toLowerCase().includes("free") ||
    deal.delivery?.includes("$0") ||
    false;

  const primeEligible =
    deal.delivery?.toLowerCase().includes("prime") ||
    deal.tag?.toLowerCase().includes("prime") ||
    false;

  const valueScore = calculateValueScore({
    ...deal,
    savingsPercent,
    freeShipping,
  });

  const isAffordable =
    userRemaining !== undefined &&
    deal.price !== null &&
    deal.price !== undefined
      ? deal.price <= userRemaining
      : undefined;

  return {
    ...deal,
    savingsAmount,
    savingsPercent,
    freeShipping,
    primeEligible,
    valueScore,
    isAffordable,
  };
}

function calculateValueScore(deal: {
  price?: number | null;
  rating?: number | null;
  reviews?: number | null;
  savingsPercent?: number | null;
  freeShipping?: boolean;
}): number | null {
  if (!deal.price || !deal.rating) return null;

  // Heuristic: higher rating + higher savings + more reviews = better value
  let score = deal.rating * 2; // Base: 0-10

  if (deal.savingsPercent && deal.savingsPercent > 20) score += 1;
  if (deal.savingsPercent && deal.savingsPercent > 40) score += 1;
  if (deal.reviews && deal.reviews > 100) score += 0.5;
  if (deal.reviews && deal.reviews > 1000) score += 0.5;
  if (deal.freeShipping) score += 0.5;

  return Math.min(10, Math.round(score * 10) / 10);
}
```

### Update search procedure:

```typescript
export const searchSales = authedProcedure
  .input(
    z.object({
      query: z.string().min(1),
      priceMin: z.number().optional(),
      priceMax: z.number().optional(),
      womenFocus: z.boolean().optional(),
      budgetMax: z.number().optional(), // NEW: User's remaining budget
      onlyAffordable: z.boolean().optional(), // NEW: Filter to affordable only
      withReasons: z.boolean().optional(),
      reasonsMax: z.number().optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    const userRemaining = input.budgetMax;

    // ... existing LLM API call ...

    // Post-process: enrich deals with computed fields
    const enrichedItems = items.map((deal) => enrichDeal(deal, userRemaining));

    // Filter if onlyAffordable is true
    const filteredItems =
      input.onlyAffordable && userRemaining !== undefined
        ? enrichedItems.filter(
            (d) =>
              d.price !== null &&
              d.price !== undefined &&
              d.price <= userRemaining,
          )
        : enrichedItems;

    return {
      items: filteredItems,
      count: filteredItems.length,
      querySent: processedQuery,
      womenFocus: input.womenFocus,
    };
  });
```

---

## Task 3: Update Types Export

**File:** `src/services/sales/types.ts`

```typescript
// Add to existing types

export type SalesBudgetOutput = {
  remaining: number;
  spent: number;
  income: number;
  budgetCaps?: {
    shopping?: number;
    entertainment?: number;
    groceries?: number;
  };
  safeToSpend: number;
  daysLeftInMonth: number;
  lastUpdated: string;
};

// Update Deal type with new optional fields
export type Deal = {
  id?: string;
  title: string;
  url: string;
  source?: string | null;
  brand?: string | null;
  image?: string | null;
  priceText?: string | null;
  price?: number | null;
  originalPriceText?: string | null;
  originalPrice?: number | null;
  discountText?: string | null;
  rating?: number | null;
  reviews?: number | null;
  delivery?: string | null;
  tag?: string | null;
  reason?: string | null;

  // Computed fields (NEW)
  savingsAmount?: number | null;
  savingsPercent?: number | null;
  valueScore?: number | null;
  freeShipping?: boolean;
  primeEligible?: boolean;
  isAffordable?: boolean;
};

// Update search input type
export type SalesSearchInput = {
  query: string;
  priceMin?: number;
  priceMax?: number;
  womenFocus?: boolean;
  budgetMax?: number; // NEW
  onlyAffordable?: boolean; // NEW
  withReasons?: boolean;
  reasonsMax?: number;
};
```

---

## Task 4: Update Procedure Exports

**File:** `src/services/sales/procedures/index.ts`

```typescript
export { searchSales } from "./search";
export { recordSalesFeedback } from "./record-feedback";
export { suggestSales } from "./suggest";
export { getSalesBudget } from "./get-budget"; // NEW
```

---

## Task 5: Create Frontend Hook

**File:** `src/services/sales/hooks/use-sales-budget.ts`

```typescript
"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

export const useSalesBudget = () => {
  const trpc = useTRPC();

  const { data, isLoading, error, refetch } = useQuery({
    ...trpc.sales.getBudget.queryOptions(),
    staleTime: 2 * 60 * 1000, // 2 minute cache (budget changes more frequently)
    refetchOnWindowFocus: true,
  });

  return {
    remaining: data?.remaining ?? 0,
    spent: data?.spent ?? 0,
    income: data?.income ?? 0,
    budgetCaps: data?.budgetCaps,
    safeToSpend: data?.safeToSpend ?? 0,
    daysLeftInMonth: data?.daysLeftInMonth ?? 0,
    isLoading,
    error,
    refetch,
  };
};
```

---

## Summary: API Contract

| Endpoint                    | Method   | Input                                         | Output                     |
| --------------------------- | -------- | --------------------------------------------- | -------------------------- |
| `trpc.sales.getBudget`      | Query    | none                                          | `SalesBudgetOutput`        |
| `trpc.sales.search`         | Query    | `{ query, budgetMax?, onlyAffordable?, ... }` | `{ items: Deal[], count }` |
| `trpc.sales.suggest`        | Query    | `{ goal?, budgetMax?, womenFocus? }`          | `string[]`                 |
| `trpc.sales.recordFeedback` | Mutation | `{ dealId, type, query?, budgetMax? }`        | `{ ok, stored }`           |

---

## Frontend Will Display

```
┌─────────────────────────────────────────────────────────┐
│  💰 You have $847 left this month                       │
│  ████████████░░░░░░░░ 68% spent | $45/day safe to spend │
├─────────────────────────────────────────────────────────┤
│  🔍 [Search deals...]                                    │
│  ┌─────┐ ┌─────────┐ ┌──────────┐                       │
│  │Chips│ │Suggested│ │Pre-search│                       │
│  └─────┘ └─────────┘ └──────────┘                       │
├─────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                  │
│  │ [Image] │  │ [Image] │  │ [Image] │                  │
│  │ -30%    │  │ -45%    │  │ FREE 📦 │                  │
│  │ ✓ $29   │  │ ⚠ $899  │  │ ✓ $15   │                  │
│  │ Save $12│  │ Save $74│  │ Save $8 │                  │
│  │ ⭐ 4.5  │  │ ⭐ 4.8  │  │ ⭐ 4.2  │                  │
│  │ Value:8 │  │ Value:9 │  │ Value:7 │                  │
│  └─────────┘  └─────────┘  └─────────┘                  │
│  ✓ = Within budget  ⚠ = Over budget                     │
└─────────────────────────────────────────────────────────┘
```

---

## Deliverables Checklist

- [ ] `src/services/sales/procedures/get-budget.ts` — New procedure
- [ ] `src/services/sales/procedures/search.ts` — Add `enrichDeal()` post-processing + new input fields
- [ ] `src/services/sales/procedures/index.ts` — Export `getSalesBudget`
- [ ] `src/server/routers/sales.ts` — Register `getBudget` endpoint
- [ ] `src/services/sales/types.ts` — Add `SalesBudgetOutput`, update `Deal` and `SalesSearchInput`
- [ ] `src/services/sales/hooks/use-sales-budget.ts` — Frontend hook

---

## Testing

```bash
# Test getBudget endpoint
curl -X GET "http://localhost:3000/api/trpc/sales.getBudget" \
  -H "Authorization: Bearer <token>"

# Test search with budget filtering
curl -X GET "http://localhost:3000/api/trpc/sales.search?input={\"query\":\"laptop\",\"budgetMax\":500,\"onlyAffordable\":true}" \
  -H "Authorization: Bearer <token>"
```
