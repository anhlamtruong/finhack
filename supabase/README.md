# Supabase Edge Functions: Event-Driven Triggers

This guide explains how to set up Supabase Edge Functions that automatically trigger whenever a new row is inserted into your database, using Drizzle ORM to process the data.

## Prerequisites

- A Supabase Project configured and running.
- Supabase CLI installed (`npm install -g supabase`).
- Your project initialized as a monorepo (Node.js + Deno).

---

## Phase 1: Setup & Initialization

First, initialize the Supabase configuration in your project root and create the function.

```bash
# 1. Initialize Supabase (creates the /supabase folder)
npx supabase init

# 2. Link your local project to your cloud project
# Find your Project ID in your Supabase Dashboard URL
npx supabase link --project-ref <YOUR_PROJECT_ID>

# 3. Create the Edge Function
npx supabase functions new on-transaction-created
```

## Phase 2: Create the "Shared" Bridge Layer

Edge Functions run on Deno. To use Drizzle ORM without touching your Next.js (`web-client`) code, we create a specific schema layer just for the functions.

### 1. Create the Shared Directory

**Bash**

```
mkdir -p supabase/functions/_shared
```

### 2. Create the Schema Definition

Create `supabase/functions/_shared/schema.ts`:

**TypeScript**

```
import { integer, pgTable, text, timestamp } from "npm:drizzle-orm@^0.33.0/pg-core";

export const transactions = pgTable("transactions", {
  id: text("id").primaryKey(),
  amount: integer("amount").notNull(),
  payee: text("payee").notNull(),
  notes: text("notes"),
  date: timestamp("date", { mode: "date" }).notNull(),
  accountId: text("account_id").notNull(),
  categoryId: text("category_id"),
});
```

### 3. Create the Database Client Factory

Create `supabase/functions/_shared/client.ts`.
_Note: `prepare: false` is required for Supabase's transaction pooler._

**TypeScript**

```
import { drizzle } from "npm:drizzle-orm@^0.33.0/postgres-js";
import postgres from "npm:postgres@^3.4.4";
import * as schema from "./schema.ts";

export const createDbClient = (connectionString: string) => {
  // "prepare: false" is MANDATORY for Supabase Transaction Mode (Port 6543)
  const client = postgres(connectionString, { prepare: false });
  return drizzle(client, { schema });
};
```

---

## Phase 3: Configure Deno Dependencies

Update the Deno configuration file to map the imports.

Open `supabase/functions/on-transaction-created/deno.json`:

**JSON**

```
{
  "imports": {
    "drizzle-orm": "npm:drizzle-orm@^0.33.0",
    "drizzle-orm/": "npm:drizzle-orm@^0.33.0/",
    "postgres": "npm:postgres@^3.4.4",
    "@shared/": "../_shared/"
  }
}
```

---

## Phase 4: Write the Function Logic

Open `supabase/functions/on-transaction-created/index.ts` and replace the content:

**TypeScript**

```
import { createDbClient } from "@shared/client.ts";
import { transactions } from "@shared/schema.ts";
import { eq } from "drizzle-orm";

// SUPABASE_DB_URL is automatically injected in the cloud environment
const connectionString = Deno.env.get("SUPABASE_DB_URL")!;
const db = createDbClient(connectionString);

Deno.serve(async (req) => {
  try {
    const payload = await req.json();

    // Validate this is an INSERT on the transactions table
    if (payload.type === 'INSERT' && payload.table === 'transactions') {
      const newRecord = payload.record;
      console.log(`⚡ New Transaction: ${newRecord.id} - ${newRecord.payee}`);

      // Example: Use Drizzle to query the database
      const result = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, newRecord.id));

      console.log("✅ Drizzle Query Result:", result);

      // ADD CUSTOM LOGIC HERE (Emails, Alerts, Syncing, etc.)
    }

    return new Response(JSON.stringify({ message: "Webhook processed" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
```

---

## Phase 5: Deploy & Trigger

### 1. Deploy the Function

Deploy the function to the cloud. We use `--no-verify-jwt` because the trigger comes from the database itself, not a user.

**Bash**

```
npx supabase functions deploy on-transaction-created --no-verify-jwt
```

### 2. Set up the Database Trigger

Run this SQL in your **Supabase Dashboard > SQL Editor** .

_Replace `<YOUR_PROJECT_ID>` with your actual project reference ID._

**SQL**

```
-- 1. Enable the HTTP extension (allows DB to make web requests)
create extension if not exists pg_net;

-- 2. Create the Trigger
create trigger "on_transaction_created_trigger"
after insert
on "public"."transactions"
for each row
execute function supabase_functions.http_request(
  'https://<YOUR_PROJECT_ID>.supabase.co/functions/v1/on-transaction-created',
  'POST',
  '{"Content-type":"application/json"}',
  '{}',
  '1000'
);
```

---

## Verification

1. Go to your app or the Supabase Table Editor and create a new row in the `transactions` table.
2. Go to **Supabase Dashboard > Edge Functions > on-transaction-created > Logs** .
3. You should see `⚡ New Transaction: ...` followed by the fetched data.

---

## VS Code Troubleshooting

If you see red squiggly lines in your `supabase` folder, configure VS Code to recognize Deno.

1. Install the **Deno** extension by denoland.
2. Press `Ctrl + Shift + P` (or `Cmd + Shift + P`).
3. Type and run: `Deno: Initialize Workspace Configuration`.
4. Say "Yes" when prompted to enable Deno. Ensure it is **only** enabled for the `./supabase` path in `.vscode/settings.json`.
