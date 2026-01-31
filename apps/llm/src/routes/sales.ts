// apps/llm/src/routes/sales.ts
import express, {
  type Request,
  type Response,
  type NextFunction,
  type ErrorRequestHandler,
} from "express";

// NOTE: keep `.js` in import specifiers so Node ESM can resolve compiled files in `dist/`
import * as salesSuggest from "../sales/suggest.js";
import { searchSales } from "../sales/search.js";
import { getMongo } from "../lib/mongo.js";

export const salesRouter = express.Router();
export default salesRouter;

/**
 * Bump when you change this file.
 */
const ROUTER_VERSION = "2026-01-30.sales.13";
console.log(`[llm] sales router loaded version=${ROUTER_VERSION}`);

//
// IMPORTANT: index.ts may mount /v1/sales before app.use(express.json()).
// Make this router self-contained by enabling body parsing here.
//
salesRouter.use(
  express.json({
    limit: "2mb",
    type: ["application/json", "application/*+json"],
  })
);
salesRouter.use(express.urlencoded({ extended: true }));

const invalidJsonHandler: ErrorRequestHandler = (err: any, _req, res, next) => {
  if (err && typeof err === "object" && (err as any).type === "entity.parse.failed") {
    return res
      .status(400)
      .json({ ok: false, error: "Invalid JSON body", routerVersion: ROUTER_VERSION });
  }
  return next(err);
};
salesRouter.use(invalidJsonHandler);

// -----------------------------
// Helpers
// -----------------------------

function nowIso() {
  return new Date().toISOString();
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function safeNum(v: any, fallback = NaN) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(v: any, fallback = false) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["1", "true", "yes", "y", "on"].includes(s)) return true;
    if (["0", "false", "no", "n", "off"].includes(s)) return false;
  }
  return fallback;
}

function getRequestId(req: Request): string {
  const h = req.headers["x-request-id"];
  if (typeof h === "string" && h.trim()) return h.trim();
  if (Array.isArray(h) && typeof h[0] === "string" && h[0].trim()) return h[0].trim();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function pickString(...candidates: any[]): string {
  for (const v of candidates) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v)) {
      const first = v.find((x) => typeof x === "string" && x.trim());
      if (typeof first === "string") return first.trim();
    }
  }
  return "";
}

function normalizeWhitespace(s: string): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBody(req: Request): any {
  const b: any = (req as any).body;
  // Some clients send a JSON string in the body; handle best-effort.
  if (typeof b === "string") {
    const s = b.trim();
    if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
      try {
        return JSON.parse(s);
      } catch {
        return b;
      }
    }
  }
  return b;
}

function getSuggestFns() {
  // We import `* as salesSuggest` so this works whether the module exports named or default.
  const mod: any = salesSuggest as any;
  const fromNamed = {
    buildWomenFirstSuggestions: mod.buildWomenFirstSuggestions,
    womenFocusQuery: mod.womenFocusQuery,
  };
  const fromDefault = mod.default
    ? {
        buildWomenFirstSuggestions: mod.default.buildWomenFirstSuggestions,
        womenFocusQuery: mod.default.womenFocusQuery,
      }
    : {};

  const buildWomenFirstSuggestions =
    fromNamed.buildWomenFirstSuggestions || fromDefault.buildWomenFirstSuggestions;
  const womenFocusQuery = fromNamed.womenFocusQuery || fromDefault.womenFocusQuery;

  return {
    buildWomenFirstSuggestions,
    womenFocusQuery,
  } as {
    buildWomenFirstSuggestions?: (args: { goal: string; budgetMax?: number }) => string[];
    womenFocusQuery?: (q: string) => string;
  };
}

async function getMongoDbForFeedback(): Promise<any> {
  const out: any = await getMongo();

  // Preferred: { db: Db }
  if (out && out.db && typeof out.db.collection === "function") return out.db;

  // Legacy: Db directly
  if (out && typeof out.collection === "function") return out;

  // Legacy: MongoClient directly
  if (out && typeof out.db === "function") {
    const dbName = process.env.MONGODB_DB || process.env.MONGODB_DATABASE || undefined;
    return dbName ? out.db(dbName) : out.db();
  }

  // Alternate: { client: MongoClient }
  if (out && out.client && typeof out.client.db === "function") {
    const dbName = process.env.MONGODB_DB || process.env.MONGODB_DATABASE || undefined;
    return dbName ? out.client.db(dbName) : out.client.db();
  }

  throw new Error("[sales] Mongo handle does not look like a Db or MongoClient");
}

async function tryWriteFeedbackToMongo(doc: any) {
  // Best-effort: feedback should not break UX.
  try {
    const db = await getMongoDbForFeedback();
    const col = db.collection("sales_feedback");
    await col.insertOne(doc);
    return { stored: true } as const;
  } catch (e: any) {
    return { stored: false, error: e?.message ?? "mongo_write_failed" } as const;
  }
}

// ---- querySent helper (so jq .debug.querySent always works) ----

function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  const s = Number.isInteger(n)
    ? String(n)
    : n
        .toFixed(2)
        .replace(/\.0+$/, "")
        .replace(/(\.\d*[1-9])0+$/, "$1");
  return `$${s}`;
}

function buildBudgetHint(priceMin?: number, priceMax?: number): string {
  const hasMin = typeof priceMin === "number" && Number.isFinite(priceMin);
  const hasMax = typeof priceMax === "number" && Number.isFinite(priceMax);

  if (hasMin && hasMax) {
    const lo = Math.min(priceMin!, priceMax!);
    const hi = Math.max(priceMin!, priceMax!);
    return ` between ${formatMoney(lo)} and ${formatMoney(hi)}`;
  }
  if (hasMax) return ` under ${formatMoney(priceMax!)}`;
  if (hasMin) return ` over ${formatMoney(priceMin!)}`;
  return "";
}

function computeQuerySent(queryUsed: string, priceMin?: number, priceMax?: number): string {
  const hint = buildBudgetHint(priceMin, priceMax);
  return normalizeWhitespace(`${queryUsed}${hint}`);
}

// -----------------------------
// Routes
// -----------------------------

salesRouter.get("/ping", (_req: Request, res: Response) => {
  res.json({ ok: true, route: "sales/ping", routerVersion: ROUTER_VERSION, nowIso: nowIso() });
});

/**
 * POST /v1/sales/suggest
 * Body: { goal?, budgetMax? }
 */
salesRouter.post("/suggest", async (req: Request, res: Response) => {
  const requestId = getRequestId(req);

  try {
    const body = normalizeBody(req) ?? {};
    const goal = pickString(body?.goal, (req.query as any)?.goal) || "unknown";
    const budgetMax = safeNum(body?.budgetMax ?? (req.query as any)?.budgetMax, NaN);

    const { buildWomenFirstSuggestions } = getSuggestFns();
    if (typeof buildWomenFirstSuggestions !== "function") {
      return res.status(500).json({
        ok: false,
        error:
          "salesSuggest.buildWomenFirstSuggestions is not exported (check apps/llm/src/sales/suggest.ts)",
        routerVersion: ROUTER_VERSION,
        requestId,
      });
    }

    const suggestions = buildWomenFirstSuggestions({
      goal,
      budgetMax: Number.isFinite(budgetMax) ? budgetMax : undefined,
    });

    return res.json({ ok: true, routerVersion: ROUTER_VERSION, requestId, suggestions });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: e?.message ?? "Unknown error",
      routerVersion: ROUTER_VERSION,
      requestId,
    });
  }
});

/**
 * SEARCH endpoints
 * - POST /v1/sales/search (preferred)
 * - GET  /v1/sales/search?query=... (convenience)
 *
 * Delegates to apps/llm/src/sales/search.ts
 */
async function handleSearch(req: Request, res: Response) {
  const requestId = getRequestId(req);

  try {
    const body = normalizeBody(req) ?? {};

    const qRaw = normalizeWhitespace(
      pickString(body?.query, body?.q) ||
        pickString((req.query as any)?.query, (req.query as any)?.q)
    );

    if (!qRaw) {
      return res.status(400).json({
        ok: false,
        error: "Missing query",
        routerVersion: ROUTER_VERSION,
        requestId,
        debug: {
          contentType: String(req.headers["content-type"] ?? "(none)"),
          bodyType: typeof body,
          bodyKeys: body && typeof body === "object" ? Object.keys(body) : [],
          queryKeys: req.query ? Object.keys(req.query as any) : [],
        },
      });
    }

    const womenFocus = toBool(body?.womenFocus ?? (req.query as any)?.womenFocus, true);
    const gl = pickString(body?.gl, (req.query as any)?.gl) || (process.env.SERPAPI_DEFAULT_GL ?? "us");
    const hl = pickString(body?.hl, (req.query as any)?.hl) || (process.env.SERPAPI_DEFAULT_HL ?? "en");

    const maxResults = clamp(
      safeNum(body?.maxResults ?? (req.query as any)?.maxResults, 12),
      1,
      30
    );

    const timeoutMs = clamp(
      safeNum(body?.timeoutMs ?? (req.query as any)?.timeoutMs, 12000),
      2000,
      60000
    );

    const cacheTtlMs = clamp(
      safeNum(body?.cacheTtlMs ?? (req.query as any)?.cacheTtlMs, 60_000),
      500,
      10 * 60 * 1000
    );

    const priceMinN = safeNum(body?.priceMin ?? (req.query as any)?.priceMin, NaN);
    const priceMaxN = safeNum(body?.priceMax ?? (req.query as any)?.priceMax, NaN);
    const priceMin = Number.isFinite(priceMinN) ? priceMinN : undefined;
    const priceMax = Number.isFinite(priceMaxN) ? priceMaxN : undefined;

    const withReasons = toBool(body?.withReasons ?? (req.query as any)?.withReasons, false);
    const reasonsMax = clamp(
      safeNum(body?.reasonsMax ?? (req.query as any)?.reasonsMax, 6),
      0,
      maxResults
    );

    const debug = toBool(body?.debug ?? (req.query as any)?.debug, false);

    const out = await searchSales({
      query: qRaw,
      womenFocus,
      gl,
      hl,
      maxResults,
      timeoutMs,
      cacheTtlMs,
      ...(priceMin != null ? { priceMin } : {}),
      ...(priceMax != null ? { priceMax } : {}),
      ...(withReasons ? { withReasons: true, reasonsMax } : {}),
      ...(debug ? { debug: true } : {}),
    } as any);

    // Ensure querySent exists for jq `.debug.querySent`
    const forcedQuerySent = computeQuerySent(out.queryUsed, priceMin, priceMax);

    const debugOut = debug
      ? out.debug
        ? { ...(out.debug as any) }
        : null
      : undefined;

    if (debugOut) {
      if (typeof (debugOut as any).querySent !== "string" || !(debugOut as any).querySent.trim()) {
        (debugOut as any).querySent = forcedQuerySent;
      }
    }

    return res.json({
      ok: true,
      routerVersion: ROUTER_VERSION,
      requestId,

      queryUsed: out.queryUsed,
      womenFocus: out.womenFocus,

      withReasons,
      reasonsMax,

      count: out.count,
      items: out.items,

      // top-level convenience
      querySent: (out as any)?.debug?.querySent ?? forcedQuerySent,

      ...(debug ? { debug: debugOut } : {}),
    });
  } catch (e: any) {
    const msg = String(e?.message ?? "Unknown error");
    const isTimeout = /timeout/i.test(msg);
    return res.status(isTimeout ? 504 : 500).json({
      ok: false,
      error: msg,
      routerVersion: ROUTER_VERSION,
      requestId,
    });
  }
}

salesRouter.post("/search", handleSearch);
salesRouter.get("/search", handleSearch);

/**
 * POST /v1/sales/feedback
 * Accepts { userId } OR { user_id }
 * Body: { action, query, itemUrl, itemTitle, reason, budgetMax?, categoryHint? }
 */
salesRouter.post("/feedback", async (req: Request, res: Response) => {
  const requestId = getRequestId(req);

  try {
    const body = normalizeBody(req) ?? {};

    const userId =
      pickString(body?.userId, body?.user_id) ||
      pickString((req.query as any)?.userId, (req.query as any)?.user_id);

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: "Missing userId",
        routerVersion: ROUTER_VERSION,
        requestId,
        debug: {
          contentType: String(req.headers["content-type"] ?? "(none)"),
          bodyType: typeof body,
          bodyKeys: body && typeof body === "object" ? Object.keys(body) : [],
        },
      });
    }

    const action = pickString(body?.action, (req.query as any)?.action) || "unknown";
    const query = pickString(body?.query, body?.q, (req.query as any)?.query, (req.query as any)?.q);

    const itemUrl = pickString(
      body?.itemUrl,
      body?.item_url,
      (req.query as any)?.itemUrl,
      (req.query as any)?.item_url
    );

    const itemTitle = pickString(
      body?.itemTitle,
      body?.item_title,
      (req.query as any)?.itemTitle,
      (req.query as any)?.item_title
    );

    const reason = pickString(body?.reason, (req.query as any)?.reason);

    const budgetMax = safeNum(body?.budgetMax ?? (req.query as any)?.budgetMax, NaN);
    const categoryHint = pickString(
      body?.categoryHint,
      body?.category_hint,
      (req.query as any)?.categoryHint
    );

    const event = {
      ts: nowIso(),
      requestId,
      userId,
      action,
      query,
      itemUrl,
      itemTitle,
      reason,
      budgetMax: Number.isFinite(budgetMax) ? budgetMax : undefined,
      categoryHint: categoryHint || undefined,
      ua: String(req.headers["user-agent"] ?? ""),
      ip: String((req.headers["x-forwarded-for"] ?? "") || req.ip || ""),
      routerVersion: ROUTER_VERSION,
    };

    const mongoWrite = await tryWriteFeedbackToMongo(event);

    return res.json({
      ok: true,
      routerVersion: ROUTER_VERSION,
      requestId,
      stored: mongoWrite.stored,
      mongoError: mongoWrite.stored ? null : mongoWrite.error,
    });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: e?.message ?? "Unknown error",
      routerVersion: ROUTER_VERSION,
      requestId,
    });
  }
});

// -----------------------------
// Router-local final error handler (keeps responses JSON)
// -----------------------------
salesRouter.use(
  ((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[sales] error", err);
    const status = typeof err?.status === "number" ? err.status : 500;
    const message = typeof err?.message === "string" ? err.message : "Internal Server Error";
    res.status(status).json({ ok: false, error: message, routerVersion: ROUTER_VERSION });
  }) as any
);