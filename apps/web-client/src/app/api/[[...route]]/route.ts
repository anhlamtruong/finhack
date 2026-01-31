import { Hono } from "hono";
import { handle } from "hono/vercel";
import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "@/server/routers/app";
import { createTRPCContext } from "@/server/init";
import plaid from "./plaid";
import summaryRouter from "./summary";
import healthRouter from "./health";
export const runtime = "nodejs"; // or 'nodejs'

const app = new Hono().basePath("/api");

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const routes = app.route("/summary", summaryRouter).route(
  "/health",
  healthRouter,
).route(
  "/plaid",
  plaid,
);

// tRPC router on '/trpc'
app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: createTRPCContext,
  }),
);

export const GET = handle(app);
export const POST = handle(app);
export const DELETE = handle(app);
export type AppType = typeof routes;
