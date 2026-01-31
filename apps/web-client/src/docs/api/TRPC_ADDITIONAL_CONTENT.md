## 7. Deep Dive: Mutations

Mutations are used to create, update, or delete data.

### A. Defining a Mutation (Server)

In your router file (e.g., `src/server/routers/post-router.ts`), use `.mutation()` instead of `.query()`.

**TypeScript**

```
import { z } from "zod";
import { createTRPCRouter, authedProcedure } from "../init";

export const postRouter = createTRPCRouter({
  create: authedProcedure
    .input(z.object({
      title: z.string().min(1),
      content: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Perform database operation
      const post = await ctx.db.post.create({
        data: {
          title: input.title,
          content: input.content,
          authorId: ctx.user.id,
        },
      });

      // 2. Return the result
      return post;
    }),
});
```

### B. Using a Mutation (Client)

Use the `useMutation` hook. This provides functions to trigger the mutation and handle its lifecycle states (`pending`, `success`, `error`).

**TypeScript**

```
"use client";
import { useTRPC } from "@/trpc/client";
import { useState } from "react";
import { toast } from "sonner"; // Assuming you use sonner/toast

export function CreatePostForm() {
  const trpc = useTRPC();
  const utils = trpc.useUtils(); // Access to QueryClient utils
  const [title, setTitle] = useState("");

  const createPost = trpc.post.create.useMutation({
    // 1. On Success: Invalidate the list so it refetches automatically
    onSuccess: async (newPost) => {
      toast.success("Post created!");
      setTitle("");
      // Refetches the 'getAll' query immediately
      await utils.post.getAll.invalidate();
    },
    // 2. On Error: Handle failures
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        createPost.mutate({ title, content: "..." });
      }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={createPost.isPending}
      />
      <button type="submit" disabled={createPost.isPending}>
        {createPost.isPending ? "Saving..." : "Create Post"}
      </button>
    </form>
  );
}
```

### C. Optimistic Updates

Optimistic updates update the UI _before_ the server responds, making the app feel instant.

**TypeScript**

```
const createPost = trpc.post.create.useMutation({
  onMutate: async (newPostInput) => {
    // 1. Cancel outgoing refetches so they don't overwrite our optimistic update
    await utils.post.getAll.cancel();

    // 2. Snapshot the previous value
    const previousPosts = utils.post.getAll.getData();

    // 3. Optimistically update the cache
    utils.post.getAll.setData(undefined, (old) => {
      return [...(old ?? []), {
        id: "temp-id",
        title: newPostInput.title,
        content: newPostInput.content
      }];
    });

    // 4. Return context with the snapshot
    return { previousPosts };
  },
  onError: (err, newPost, context) => {
    // 5. Rollback on error
    utils.post.getAll.setData(undefined, context?.previousPosts);
  },
  onSettled: () => {
    // 6. Always refetch after error or success to ensure data validity
    utils.post.getAll.invalidate();
  },
});
```

---

## 8. Deep Dive: Prefetching

Prefetching loads data into the cache before the user needs it.

### A. Server-Side Prefetching (RSC)

This is the standard pattern for Next.js App Router to prevent loading spinners on initial page load.

**File:** `src/app/posts/[id]/page.tsx`

**TypeScript**

```
import { trpc, HydrateClient } from "@/trpc/server";

export default async function PostPage({ params }: { params: { id: string } }) {
  // 1. Prefetch the query
  // void: We start fetching but don't block the stream immediately (optional)
  // await: We wait for data before sending HTML (good for SEO critical content)
  void trpc.post.getById.prefetch({ id: params.id });

  return (
    // 2. HydrateClient serializes the cache to the client
    <HydrateClient>
      <PostView id={params.id} />
    </HydrateClient>
  );
}
```

### B. Client-Side Interaction Prefetching

Prefetch data when a user hovers over a link, so the page is instant when they click.

**TypeScript**

```
"use client";
import { useTRPC } from "@/trpc/client";
import Link from "next/link";

export function PostLink({ id }: { id: string }) {
  const trpc = useTRPC();
  const utils = trpc.useUtils();

  const handleMouseEnter = () => {
    // Prefetch specific data
    utils.post.getById.prefetch({ id });
  };

  return (
    <Link href={`/posts/${id}`} onMouseEnter={handleMouseEnter}>
      Read Post
    </Link>
  );
}
```

---

## 9. Deep Dive: Subscriptions (WebSockets)

**Note:** Subscriptions require a long-running server (Node.js/Bun). They **do not work** natively on serverless environments like Vercel Functions (Standard/Edge) without a separate WebSocket host or service (like Pusher).

If you are hosting on a VPS (Coolify, Railway, DigitalOcean), you can use this setup:

### A. Define Subscription (Router)

Use `publicProcedure.subscription` with an async generator or observable.

**TypeScript**

```
import { observable } from '@trpc/server/observable';
import { EventEmitter } from 'events';
import { createTRPCRouter, publicProcedure } from '../init';

// Simple event emitter (for single server instance only)
const ee = new EventEmitter();

export const chatRouter = createTRPCRouter({
  onMessage: publicProcedure.subscription(() => {
    return observable<{ text: string }>((emit) => {
      // 1. Event listener
      const onMessage = (data: { text: string }) => {
        emit.next(data);
      };

      // 2. Bind event
      ee.on('message', onMessage);

      // 3. Cleanup on unsubscribe
      return () => {
        ee.off('message', onMessage);
      };
    });
  }),

  sendMessage: publicProcedure
    .input(z.string())
    .mutation(({ input }) => {
      ee.emit('message', { text: input });
      return { success: true };
    }),
});
```

### B. Set up WebSocket Server (Node.js + Hono)

You need to run a separate entry point or a custom server script, not just the Next.js standard start.

**TypeScript**

```
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import { WebSocketServer } from 'ws';
import { appRouter } from './routers/_app';
import { createTRPCContext } from './init';

// Create WS Server
const wss = new WebSocketServer({ port: 3001 });

const handler = applyWSSHandler({
  wss,
  router: appRouter,
  createContext: createTRPCContext,
});

console.log('✅ WebSocket Server listening on ws://localhost:3001');

// Clean up on exit
process.on('SIGTERM', () => {
  handler.broadcastReconnectNotification();
  wss.close();
});
```

### C. Use Subscription (Client)

You must update your `client.tsx` to include a `wsLink`.

**Update:** `src/trpc/client.tsx`

**TypeScript**

```
// ... imports
import { splitLink, httpBatchLink, wsLink } from "@trpc/client";
import { createWSClient } from "@trpc/client";

function getLinks() {
  // Create WS Client (only in browser)
  const wsClient = typeof window !== "undefined"
    ? createWSClient({ url: 'ws://localhost:3001' })
    : null;

  return [
    // Split Link: Send subscriptions to WS, everything else to HTTP
    splitLink({
      condition: (op) => op.type === 'subscription',
      true: wsLink({ client: wsClient! }),
      false: httpBatchLink({ url: getUrl() }),
    }),
  ];
}
// ... pass getLinks() to createTRPCClient
```

**Component Usage:**

**TypeScript**

```
"use client";
import { useTRPC } from "@/trpc/client";
import { useState } from "react";

export function ChatRoom() {
  const trpc = useTRPC();
  const [messages, setMessages] = useState<string[]>([]);

  // Subscribe
  trpc.chat.onMessage.useSubscription(undefined, {
    onData: (data) => {
      setMessages((prev) => [...prev, data.text]);
    },
  });

  return (
    <div>
      {messages.map((m, i) => <div key={i}>{m}</div>)}
    </div>
  );
}
```
