# Hono + tRPC Architecture Guide

This architecture combines **Hono** (as the high-performance API server), **tRPC** (for end-to-end type safety), and **Next.js App Router** (React Server Components).

## 1. Installation

Install the required dependencies:

**Bash**

```
npm install hono @hono/trpc-server @trpc/server @trpc/client @trpc/react-query @tanstack/react-query zod superjson server-only
```

---

## 2. Directory Structure

Organize your project to separate "Server Logic" from "Client/React Logic".

**Plaintext**

```
src/
├── app/
│   ├── api/
│   │   └── [[...route]]/
│   │       └── route.ts      <-- Hono Entry Point
│   └── layout.tsx            <-- Wraps app in Provider
├── server/
│   ├── init.ts               <-- tRPC Context & Initialization
│   └── routers/
│       ├── _app.ts           <-- Root Router
│       └── post-router.ts    <-- Example Sub-router
└── trpc/
    ├── client.tsx            <-- Client Provider (Browser)
    ├── server.tsx            <-- Server Helper (RSC Prefetching)
    └── query-client.ts       <-- React Query Config
```

---

## 3. Core Setup Files

### A. Server Initialization (`src/server/init.ts`)

This initializes tRPC and defines your context (auth, db connections).

**TypeScript**

```
import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import superjson from "superjson";
// import { auth } from "@/auth"; // Your auth library

export const createTRPCContext = cache(async () => {
  // const session = await auth();
  return {
    // user: session?.user ?? null,
    // db: prisma,
  };
});

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(async (opts) => {
  // if (!opts.ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return opts.next();
});
```

### B. The Hono API Route (`src/app/api/[[...route]]/route.ts`)

This replaces standard Next.js API routes. It uses Hono to handle requests.

**TypeScript**

```
import { Hono } from "hono";
import { handle } from "hono/vercel";
import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "@/server/routers/_app";
import { createTRPCContext } from "@/server/init";

export const runtime = "edge"; // 'nodejs' or 'edge'

const app = new Hono().basePath("/api");

// 1. Mount tRPC
app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: createTRPCContext,
  })
);

// 2. (Optional) Add standard REST endpoints
app.get("/hello", (c) => {
  return c.json({ message: "Hello from Hono!" });
});

export const GET = handle(app);
export const POST = handle(app);
```

### C. Client Provider (`src/trpc/client.tsx`)

**TypeScript**

```
"use client";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState } from "react";
import { makeQueryClient } from "./query-client";
import type { AppRouter } from "@/server/routers/_app";
import superjson from "superjson";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

let browserQueryClient: any = undefined;

function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

function getUrl() {
  const base = typeof window !== "undefined" ? "" : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}/api/trpc`;
}

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          transformer: superjson,
          url: getUrl(),
        }),
      ],
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
```

---

## 4. How to Add New Procedures

### Scenario A: Adding to an Existing Router

Modify the file where the router is defined (e.g., `src/server/routers/post-router.ts`).

**TypeScript**

```
export const postRouter = createTRPCRouter({
  // Existing...
  getById: publicProcedure.input(z.string()).query(...)

  // NEW PROCEDURE
  create: protectedProcedure
    .input(z.object({ title: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return { id: 123, title: input.title };
    }),
});
```

### Scenario B: Creating a New Router

1. Create `src/server/routers/billing-router.ts`:
   **TypeScript**

   ```
   import { createTRPCRouter, protectedProcedure } from "../init";

   export const billingRouter = createTRPCRouter({
     getInvoices: protectedProcedure.query(() => ["inv_1", "inv_2"]),
   });
   ```

2. Register it in `src/server/routers/_app.ts`:
   **TypeScript**

   ```
   import { createTRPCRouter } from "../init";
   import { postRouter } from "./post-router";
   import { billingRouter } from "./billing-router"; // <-- Import

   export const appRouter = createTRPCRouter({
     post: postRouter,
     billing: billingRouter, // <-- Register
   });

   export type AppRouter = typeof appRouter;
   ```

---

## 5. Usage Patterns

### A. In Client Components (Standard)

Use the hooks provided by `useTRPC` (or the direct export if configured that way).

**TypeScript**

```
"use client";
import { useTRPC } from "@/trpc/client";

export function PostList() {
  const trpc = useTRPC();

  // Query
  const { data, isLoading } = trpc.post.getAll.useQuery();

  // Mutation
  const createPost = trpc.post.create.useMutation({
    onSuccess: () => {
      trpc.post.getAll.invalidate();
    }
  });

  return (
    <button onClick={() => createPost.mutate({ title: "New" })}>
      Create
    </button>
  );
}
```

### B. In Server Components (Prefetching)

Use `HydrateClient` to fetch data on the server and pass it to the client cache. This prevents loading spinners on initial page load.

**`src/app/posts/page.tsx`**

**TypeScript**

```
import { trpc, HydrateClient } from "@/trpc/server";
import { PostListClient } from "./_components/post-list-client";

export default async function Page() {
  // 1. Prefetch on the server
  void trpc.post.getAll.prefetch();

  // 2. Hydrate
  return (
    <HydrateClient>
      <main>
        <h1>Posts</h1>
        {/* The client component will find data in the cache immediately */}
        <PostListClient />
      </main>
    </HydrateClient>
  );
}
```

---

## 6. Advanced Hono Usage

Since you are using Hono as the entry point, you can easily add middleware or non-tRPC routes.

**Modify `src/app/api/[[...route]]/route.ts`:**

**TypeScript**

```
// Add Logger Middleware
app.use('*', async (c, next) => {
  console.log(`[${c.req.method}] ${c.req.url}`);
  await next();
});

// Add a Webhook Handler (e.g., Stripe)
app.post('/webhook', async (c) => {
  const body = await c.req.text();
  // Verify signature...
  return c.json({ received: true });
});
```
