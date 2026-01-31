import { db } from "@/db";
import { getSecureDb } from "@/db/secure-client";
import { currentUser } from "@clerk/nextjs/server";
import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import superjson from "superjson";

// 1. Context Creation
export const createTRPCContext = cache(async () => {
  const user = await currentUser();
  const secureDb = user ? await getSecureDb() : null;
  return {
    user: user,
    db: db,
    secureDb: secureDb,
  };
});

// 2. Initialization
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

// 3. Exports
export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const authedProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return opts.next({
    ctx: { ...opts.ctx, user: opts.ctx.user },
  });
});
