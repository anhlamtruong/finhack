# Drizzle + Supabase RLS (Clerk) Wrapper

This project uses a secure Drizzle wrapper to apply Supabase RLS automatically for every database query. The goal is to avoid repeating `db.transaction()` and `set_config(...)` across the codebase while keeping the security model strict and consistent.

## Why this exists

- **Zero boilerplate**: developers write normal Drizzle queries and wrap them in `secureDb.rls(...)`.
- **Safety by default**: RLS claims are always injected when using the wrapper.
- **Performance**: the JWT is injected only for the duration of the transaction.

## Secure wrapper

Located at [src/db/secure-client.ts](../../db/secure-client.ts).

```ts
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function getSecureDb() {
  const { getToken } = await auth();
  const token = await getToken({ template: "supabase" });

  if (!token) {
    throw new Error("Unauthorized: No Clerk Supabase token found");
  }

  return {
    rls: async <T>(
      queryCallback: (tx: typeof db) => Promise<T>,
    ): Promise<T> => {
      return await db.transaction(async (tx) => {
        try {
          await tx.execute(
            sql`select set_config('request.jwt.claims', ${token}, true)`,
          );

          return await queryCallback(tx as typeof db);
        } finally {
          await tx.execute(
            sql`select set_config('request.jwt.claims', NULL, true)`,
          );
        }
      });
    },
  };
}
```

## Usage in server code

```ts
import { getSecureDb } from "@/db/secure-client";
import { transactions } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function getRecentTransactions() {
  const secureDb = await getSecureDb();
  return await secureDb.rls((tx) =>
    tx.select().from(transactions).orderBy(desc(transactions.date)),
  );
}
```

## Usage in tRPC

`secureDb` is available on the tRPC context. Prefer it when running any query that should be protected by RLS.

```ts
export const transactionsRouter = router({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.secureDb.rls((tx) => tx.select().from(transactions));
  }),
});
```

## Fallback behavior

Some procedures may fall back to the regular `db` client if `secureDb` is unavailable (for example, when there is no authenticated user). That is a safety valve for non-RLS flows and should be used only when appropriate.

## Recommended pattern

- Use `secureDb.rls(...)` for any user-scoped query.
- Keep all business logic inside the callback.
- Avoid calling `db.transaction()` directly unless you need a multi-step transaction outside the RLS wrapper.
