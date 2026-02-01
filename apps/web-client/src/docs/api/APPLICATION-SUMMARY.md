#+ FinHack Finance — Application Summary

## Overview

FinHack Finance is an intelligent personal finance and budgeting dashboard focused on making transaction tracking, category editing, and daily money guidance fast and fun. The system combines a Next.js dashboard, a Supabase-backed data store, and a lightweight AI service for categorization, recurring detection, and coaching.

## Core Capabilities

- **Transactions**: View, add, and edit transactions with category assignment. Supports historical analysis and charts.
- **Categories**: Manage custom categories and budgets; category goals drive dashboard insights.
- **Accounts**: Track account metadata tied to transactions.
- **Reports**: Aggregated summaries (income/expenses/remaining, top categories, daily series).
- **AI utilities**: Categorization, recurring pattern detection, upcoming bills, daily safe‑to‑spend guidance, and coaching messages.

## High-Level Architecture

### 1) Web Client (apps/web-client)

- **Framework**: Next.js (App Router) + React.
- **API Layer**: tRPC for internal procedures; Hono used in server routes for API endpoints.
- **Auth**: Clerk (middleware + server auth in API routes).
- **Data Access**: Drizzle ORM + Postgres.
- **UI**: Radix UI, shadcn/ui patterns, TanStack Query/Table, Tailwind CSS.
- **Key pages/features**: Dashboard charts, transactions list + editing, category management, account sheets.

### 2) AI Service (apps/llm)

- **Runtime**: Node.js + Express.
- **Data Source**: Supabase Admin client for fetching transactions and accounts.
- **Endpoints**:
  - Categorization + memory feedback.
  - Recurring detection and upcoming bills.
  - Daily spend and category caps.
  - AI coaching message from history (Gemini-backed or heuristic fallback).

### 3) Database (Supabase Postgres)

- **Primary tables**:
  - `accounts` (id, plaid_id, name, user_id, user_email)
  - `categories` (id, plaid_id, name, user_id, monthly_budget, goal_type)
  - `transactions` (id, amount, payee, notes, date, account_id, category_id)
- **ORM**: Drizzle used in both the web client and edge functions.

### 4) Edge Functions (supabase/functions)

- **on-transaction-created**: Deno edge function triggered by DB inserts. Fetches transaction data and can trigger notifications.
- **Resend email helper**: Sends email on new transaction events (requires `RESEND_API_KEY`).

## Key Data Flows

1. **User signs in** via Clerk in the web client.
2. **Transactions/categories/accounts** are created and managed through Next.js + tRPC procedures, persisted in Supabase Postgres via Drizzle.
3. **Dashboard & reports** aggregate transaction history by date, category, and account for charts and summaries.
4. **AI service** consumes transaction history for categorization and coaching features.
5. **Supabase edge function** triggers on new transaction inserts and can send email notifications.

## AI Integration Prompt (Quiltt as Plaid Alternative)

Copy/paste this prompt into an AI to get a step‑by‑step integration plan:

---

**Prompt**

You are a senior full‑stack engineer. I need a step‑by‑step plan to integrate **Quiltt** (Plaid alternative) into a finance app called **FinHack Finance**.

Context:

- Web app: Next.js (apps/web-client), Clerk auth, tRPC, Drizzle ORM, Supabase Postgres.
- AI service: Node/Express (apps/llm) that reads transactions via Supabase.
- Supabase edge function triggers on new transaction inserts.
- Core product goals: intelligent personal finance dashboard; easy transaction editing & categorization.

**Must‑Have Quiltt Products**

1. Transactions (24 months of history, categorized/cleaned)
2. Balance (real‑time account balances)
3. Auth (instant bank authentication)

**Recommended Add‑ons** 4) Transactions Refresh (on‑demand latest transactions) 5) Recurring Transactions (subscriptions, bills, payroll)

Requirements for the plan:

- Describe data model mapping from Quiltt to existing `accounts`, `transactions`, `categories` tables.
- Specify where to store and secure Quiltt tokens (server‑side only).
- Define API endpoints to:
  - create/link a connection
  - fetch accounts/balances
  - import and refresh transactions
  - handle recurring transactions
- Include webhook strategy (if Quiltt supports it) to update data in near‑real‑time.
- Provide UI flow: connect bank, show syncing state, show balances, and allow manual refresh.
- Include test strategy and rollout steps (dev, staging, production).
- Call out any changes needed for edge functions or the LLM service so AI features continue to work.

## Return the plan as numbered steps with code pointers (files/areas to modify) and environment variables required.

---

## AI Prompt (Monthly Category Plan vs Actual + Monthly Statement)

Copy/paste this prompt into an AI to get a step‑by‑step implementation plan:

---

**Prompt**

You are a senior full‑stack engineer. I need a step‑by‑step plan to add a feature to **FinHack Finance** where users can see their **monthly total expenses per category** compared to their **monthly plan/budget**, and at the end of each month a **report/statement** is generated and stored in the database.

Context:

- Web app: Next.js (apps/web-client), Clerk auth, tRPC, Drizzle ORM, Supabase Postgres.
- Data model includes `categories` (with `monthly_budget`) and `transactions` (with `amount`, `category_id`, `date`).
- Reports and charts already aggregate transactions for dashboards.

Requirements for the plan:

- Define or extend a database table for monthly statements (e.g., `monthly_reports`) and the schema fields needed.
- Compute monthly spend per category, compare to budget, and store totals + variance.
- Decide how the report is generated (scheduled job/cron, on‑demand, or edge function) and how to backfill historical months.
- Add tRPC or API endpoints to fetch monthly summaries and statements.
- Update UI to display per‑category plan vs actual and a monthly statement view.
- Include caching/performance considerations for large transaction histories.
- Provide migration steps and environment variables (if any).

## Return the plan as numbered steps with file‑level pointers (what to change and where).
