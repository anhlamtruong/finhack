## 1. Setup Prisma Client Singleton

In Next.js development (especially with hot-reloading), creating a new `PrismaClient` on every request can exhaust your database connection limit. You need a singleton instance.

Create a new file: `src/server/db.ts`

**TypeScript**

**TypeScript**

```
import { PrismaClient } from "@prisma/client";

const createPrismaClient = () =>
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

---

## 2. Inject DB into tRPC Context

Modify your initialization file to pass the `db` instance into every request context.

**File:** `src/server/init.ts`

**TypeScript**

**TypeScript**

```
import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import superjson from "superjson";
import { db } from "@/server/db"; // <--- 1. Import the singleton

export const createTRPCContext = cache(async () => {
  // Add session/auth logic here if needed
  // const session = await auth();

  return {
    db, // <--- 2. Add db to the returned object
    // user: session?.user ?? null,
  };
});

// 3. Initialize tRPC Builder
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

// Example protected procedure
export const protectedProcedure = t.procedure.use(async (opts) => {
  // Logic to check opts.ctx.user
  return opts.next();
});
```

---

## 3. Usage in Routers

Now `ctx.db` is available in every procedure.

**File:** `src/server/routers/post-router.ts`

**TypeScript**

**TypeScript**

```
import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../init";

export const postRouter = createTRPCRouter({
  // QUERY: Fetch list
  getAll: publicProcedure.query(async ({ ctx }) => {
    // ctx.db is fully typed based on your Prisma schema
    return await ctx.db.post.findMany({
      orderBy: { createdAt: "desc" },
    });
  }),

  // MUTATION: Create new item
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.post.create({
        data: {
          name: input.name,
        },
      });
    }),
});
```

---

## 4. Env Configuration (Supabase Specific)

Since you are using Supabase, ensure your `.env` file uses the **Transaction Pooler** connection string (usually port 6543) for the `DATABASE_URL` to work best with Serverless/Edge environments, and the **Session Mode** (port 5432) for `DIRECT_URL` (used for migrations).

**File:** `.env`

**Code snippet**

```
# Connect to Supabase via connection pooling with Supavisor.
DATABASE_URL="postgres://[user]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/[db-name]?pgbouncer=true"

# Direct connection to the database. Used for migrations.
DIRECT_URL="postgres://[user]:[password]@aws-0-us-east-1.supabase.co:5432/[db-name]"
```

**File:** `prisma/schema.prisma`

**Code snippet**

```
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Post {
    id        Int      @id @default(autoincrement())
    name      String
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    @@index([name])
}
```
