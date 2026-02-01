// apps/llm/src/index.ts
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

// Static routers (compiled to .js in dist; Node ESM requires explicit extensions)

import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { execSync } from "node:child_process";


// NOTE: Node ESM requires file extensions for relative imports at runtime.
// To avoid "ERR_MODULE_NOT_FOUND" issues if the emitted specifier loses ".js",
// we dynamically import via a fully-qualified file URL.
async function getMongoDynamic() {
  const mod = await import(new URL("./lib/mongo.js", import.meta.url).href);
  if (!mod || typeof (mod as any).getMongo !== "function") {
    throw new Error("[llm] mongo module did not export getMongo()");
  }
  return (mod as any).getMongo() as ReturnType<
    (typeof mod & { getMongo: any })["getMongo"]
  >;
}

// Always load apps/llm/.env regardless of where node is started from
dotenv.config({ path: new URL("../.env", import.meta.url) });

// Bump this any time you want to confirm you're running the latest server build.
// (Useful when hot-reload or "wrong file" issues cause confusion.)
const SERVICE_VERSION = process.env.SERVICE_VERSION || "2026-01-26.index.1";

function safeGitSha(): string | null {
  try {
    const sha = execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString("utf8")
      .trim();
    return sha || null;
  } catch {
    return null;
  }
}

const GIT_SHA = safeGitSha();

type AnyRouterModule = {
  default?: any;
  [key: string]: any;
};

type LoadedRouter = {
  router: RequestHandler;
  loadedFrom: string;
};

async function loadRouter(
  moduleBasePath: string,
  namedExport: string,
): Promise<LoadedRouter> {
  // In production (dist), only .js exists.
  // In dev (tsx), .ts exists.
  // We also avoid importing files that don't exist to prevent misleading errors.
  const candidates = [`${moduleBasePath}.js`, `${moduleBasePath}.ts`];

  let lastErr: any = null;

  for (const p of candidates) {
    try {
      const url = new URL(p, import.meta.url);
      const fsPath = fileURLToPath(url);

      // Skip if file not present
      try {
        await fs.access(fsPath);
      } catch {
        continue;
      }

      const mod = (await import(url.href)) as AnyRouterModule;
      const router = (mod as any)[namedExport] ?? mod.default;

      if (!router) {
        const keys = Object.keys(mod ?? {});
        throw new Error(
          `[llm] Router module '${p}' did not export '${namedExport}' or default. Exports: ${keys.join(", ")}`,
        );
      }

      return { router: router as RequestHandler, loadedFrom: url.href };
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr ?? new Error(`[llm] Failed to load router '${moduleBasePath}'`);
}

function envList(name: string, fallback: string[]) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function nowIso() {
  return new Date().toISOString();
}

function envFlag(name: string) {
  return Boolean(
    process.env[name] && String(process.env[name]).trim().length > 0,
  );
}

// -----------------------------
// Routers
// -----------------------------
// Mongo router is defined inline to avoid ESM path/extension issues in dist builds.
// Health + transactions remain dynamically loaded.
const mongoRouter = express.Router();
const mongoRouterLoadedFrom = "inline:index.ts";
let mongoRouterLoadError: string | null = null;

// -----------------------------
// Routers (loaded dynamically)
// -----------------------------
let healthRouter: RequestHandler;
let transactionsRouter: RequestHandler;
let companionRouter: RequestHandler;
let txEventsRouter: RequestHandler;

let healthRouterLoadedFrom = "(unloaded)";
let transactionsRouterLoadedFrom = "(unloaded)";
let companionRouterLoadedFrom = "(unloaded)";
let txEventsRouterLoadedFrom = "(unloaded)";

let healthRouterLoadError: string | null = null;
let transactionsRouterLoadError: string | null = null;
let companionRouterLoadError: string | null = null;
let txEventsRouterLoadError: string | null = null;

// --- Mongo endpoints ---
mongoRouter.get("/v1/mongo/ping", async (_req: Request, res: Response) => {
  try {
    const { db } = await getMongoDynamic();
    // `ping` works across driver versions
    await db.command({ ping: 1 });
    return res.json({
      ok: true,
      mongo: { connected: true, db: db.databaseName },
    });
  } catch (e: any) {
    const msg = e?.message ?? "Mongo ping failed";
    mongoRouterLoadError = msg;
    return res.status(500).json({ ok: false, error: msg });
  }
});

mongoRouter.get("/v1/mongo/info", async (_req: Request, res: Response) => {
  try {
    const { client, db } = await getMongoDynamic();
    const uri = process.env.MONGODB_URI || "";
    const redacted = uri
      ? uri.replace(/:\/\/([^:]+):([^@]+)@/g, "://$1:***@")
      : null;

    // Best-effort connection info
    const address = (client as any)?.options?.srvHost ||
      (client as any)?.options?.hosts?.[0] || null;

    return res.json({
      ok: true,
      mongo: {
        db: db.databaseName,
        address,
        uriRedacted: redacted,
      },
    });
  } catch (e: any) {
    const msg = e?.message ?? "Mongo info failed";
    mongoRouterLoadError = msg;
    return res.status(500).json({ ok: false, error: msg });
  }
});

try {
  const out = await loadRouter("./routes/health", "healthRouter");
  healthRouter = out.router;
  healthRouterLoadedFrom = out.loadedFrom;
  console.log(`[llm] loaded health router from ${healthRouterLoadedFrom}`);
} catch (e: any) {
  const errMsg = e?.message ?? "Failed to load health router";
  healthRouterLoadError = errMsg;
  console.error("[llm] health router load failed:", errMsg);
  healthRouter = ((_req: Request, res: Response) => {
    res.status(500).json({ ok: false, error: errMsg });
  }) as RequestHandler;
}

try {
  const out = await loadRouter("./routes/transactions", "transactionsRouter");
  transactionsRouter = out.router;
  transactionsRouterLoadedFrom = out.loadedFrom;
  console.log(
    `[llm] loaded transactions router from ${transactionsRouterLoadedFrom}`,
  );
} catch (e: any) {
  const errMsg = e?.message ??
    "Failed to load transactions router. Check SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY and rebuild.";
  transactionsRouterLoadError = errMsg;
  console.error("[llm] transactions router load failed:", errMsg);
  transactionsRouter = ((_req: Request, res: Response) => {
    res.status(500).json({ ok: false, error: errMsg });
  }) as RequestHandler;
}

// Loads the financial companion router (persona generate + chat) with the same defensive pattern.
try {
  const out = await loadRouter("./routes/companion", "companionRouter");
  companionRouter = out.router;
  companionRouterLoadedFrom = out.loadedFrom;
  console.log(
    `[llm] loaded companion router from ${companionRouterLoadedFrom}`,
  );
} catch (e: any) {
  const errMsg = e?.message ?? "Failed to load companion router";
  companionRouterLoadError = errMsg;
  console.error("[llm] companion router load failed:", errMsg);
  companionRouter = ((_req: Request, res: Response) => {
    res.status(500).json({ ok: false, error: errMsg });
  }) as RequestHandler;
}

// Loads the tx_events router with the same defensive pattern.
try {
  const out = await loadRouter("./routes/tx_events", "txEventsRouter");
  txEventsRouter = out.router;
  txEventsRouterLoadedFrom = out.loadedFrom;
  console.log(
    `[llm] loaded txEvents router from ${txEventsRouterLoadedFrom}`,
  );
} catch (e: any) {
  const errMsg = e?.message ?? "Failed to load txEvents router";
  txEventsRouterLoadError = errMsg;
  console.error("[llm] txEvents router load failed:", errMsg);
  txEventsRouter = ((_req: Request, res: Response) => {
    res.status(500).json({ ok: false, error: errMsg });
  }) as RequestHandler;
}

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);

// -----------------------------
// CORS
// -----------------------------
const corsOrigins = envList("CORS_ORIGINS", [
  "https://finhack.app",
  "https://www.finhack.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
  "http://localhost:3004",
  "http://localhost:3005",
  "http://localhost:3006",
  "http://localhost:3007",
  "http://localhost:3008",
]);

const corsMiddleware = cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl / server-to-server
    if (corsOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked origin: ${origin}`));
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
});
// Apply CORS early (before routes)
app.use(corsMiddleware);
// Preflight
app.options(/.*/, corsMiddleware);
// CORS error -> JSON
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (
    err && typeof err.message === "string" &&
    err.message.startsWith("CORS blocked origin:")
  ) {
    return res.status(403).json({ ok: false, error: err.message });
  }
  return next(err);
});

// Log every request + duration
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  console.log(`[req] ${req.method} ${req.url}`);
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(
      `[res] ${req.method} ${req.url} -> ${res.statusCode} (${ms}ms)`,
    );
  });
  next();
});

// JSON parser
app.use(express.json({ limit: "2mb" }));

// Invalid JSON -> JSON error
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({ ok: false, error: "Invalid JSON body" });
  }
  return next(err);
});

// -----------------------------
// Static assets (temporary draft hosting)
// -----------------------------
const assetsDir = fileURLToPath(new URL("../public/assets/", import.meta.url));
const generatedDir = path.join(assetsDir, "generated");
await fs.mkdir(generatedDir, { recursive: true });

app.use(
  "/assets",
  express.static(assetsDir, {
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "no-store");
    },
  }),
);

// -----------------------------
// Root + meta + health
// -----------------------------
app.get("/", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "finhack-llm",
    nowIso: nowIso(),
    version: SERVICE_VERSION,
    git: GIT_SHA,
  });
});

// A stable metadata endpoint to verify *exactly* what code is running.
app.get("/v1/_meta", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "finhack-llm",
    ts: nowIso(),
    version: SERVICE_VERSION,
    git: GIT_SHA,
    routers: {
      mongo: {
        loadedFrom: mongoRouterLoadedFrom,
        loadError: mongoRouterLoadError,
      },
      health: {
        loadedFrom: healthRouterLoadedFrom,
        loadError: healthRouterLoadError,
      },
      transactions: {
        loadedFrom: transactionsRouterLoadedFrom,
        loadError: transactionsRouterLoadError,
      },
      companion: {
        loadedFrom: companionRouterLoadedFrom,
        loadError: companionRouterLoadError,
      },
      tx_events: {
        loadedFrom: txEventsRouterLoadedFrom,
        loadError: txEventsRouterLoadError,
      },
    },
    env: {
      MONGODB_URI: envFlag("MONGODB_URI"),
      GEMINI_API_KEY: envFlag("GEMINI_API_KEY"),
      GEMINI_MODEL: process.env.GEMINI_MODEL ?? null,
      SUPABASE_URL: envFlag("SUPABASE_URL"),
      SUPABASE_SERVICE_ROLE_KEY: envFlag("SUPABASE_SERVICE_ROLE_KEY"),
      RESEND_API_KEY: envFlag("RESEND_API_KEY"),
      RESEND_FROM: process.env.RESEND_FROM ?? null,
      VEO_REF_GCS: process.env.VEO_REF_GCS ?? null,
    },
  });
});

// Keep a direct /v1/health handler (in addition to the router) so the endpoint
// stays stable even if the dynamic router fails to load.
app.get("/v1/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "llm",
    ts: nowIso(),
    version: SERVICE_VERSION,
    git: GIT_SHA,
  });
});

// Convenience ping endpoint (some curl scripts call /v1/health/ping)
app.get("/v1/health/ping", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "llm",
    route: "health/ping",
    ts: nowIso(),
    version: SERVICE_VERSION,
    git: GIT_SHA,
  });
});

// -----------------------------
// Storage status (Supabase sanity)
// -----------------------------
// NOTE: "storage-status" is just a *connectivity probe*.
// It verifies that SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY can successfully read via PostgREST.
// It is NOT related to Supabase Storage buckets.
async function handleStorageStatus(_req: Request, res: Response) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return res.status(500).json({
      ok: false,
      error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
      version: SERVICE_VERSION,
      git: GIT_SHA,
      supabase: {
        urlPresent: Boolean(url),
        serviceRoleKeyPresent: Boolean(key),
      },
    });
  }

  // after the guard, TS should treat these as strings
  const base = url.replace(/\/$/, "");
  const headers: HeadersInit = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);

  async function probe(selectPath: string) {
    const probeUrl = `${base}/rest/v1/${selectPath}`;
    const resp = await fetch(probeUrl, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    const text = await resp.text().catch(() => "");
    return { probeUrl, resp, text };
  }

  try {
    // 1) Minimal authenticated read to verify REST + permissions.
    const accounts = await probe("accounts?select=id&limit=1");

    if (!accounts.resp.ok) {
      return res.status(502).json({
        ok: false,
        error: `Supabase REST probe failed (${accounts.resp.status})`,
        version: SERVICE_VERSION,
        git: GIT_SHA,
        supabase: {
          url,
          probeUrl: accounts.probeUrl,
          status: accounts.resp.status,
          bodyPreview: accounts.text.slice(0, 300),
        },
      });
    }

    let sampleCount: number | null = null;
    try {
      const parsed = accounts.text ? JSON.parse(accounts.text) : null;
      sampleCount = Array.isArray(parsed) ? parsed.length : null;
    } catch {
      sampleCount = null;
    }

    // 2) Try to detect which note field exists on `transactions`.
    // We try: notes -> note -> neither.
    const txVariants: Array<{ label: "notes" | "note" | null; path: string }> =
      [
        { label: "notes", path: "transactions?select=id,notes&limit=1" },
        { label: "note", path: "transactions?select=id,note&limit=1" },
        { label: null, path: "transactions?select=id&limit=1" },
      ];

    let txNoteFieldUsed: "notes" | "note" | null = null;
    let txProbe:
      | { probeUrl: string; status: number; bodyPreview: string }
      | null = null;

    for (const v of txVariants) {
      const out = await probe(v.path);
      txProbe = {
        probeUrl: out.probeUrl,
        status: out.resp.status,
        bodyPreview: out.text.slice(0, 200),
      };

      if (out.resp.ok) {
        txNoteFieldUsed = v.label;
        break;
      }

      // If notes/note doesn't exist, PostgREST typically returns 400 with a schema-cache message.
      // We don't overfit parsing here; we simply fall through to next variant when it fails.
      continue;
    }

    return res.json({
      ok: true,
      version: SERVICE_VERSION,
      git: GIT_SHA,
      supabase: {
        url,
        accountsProbeUrl: accounts.probeUrl,
        accountsStatus: accounts.resp.status,
        sampleCount,
      },
      transactionsProbe: {
        noteFieldUsed: txNoteFieldUsed,
        lastProbe: txProbe,
      },
    });
  } catch (e: any) {
    const msg = e?.name === "AbortError"
      ? "Supabase REST probe timed out"
      : e?.message ?? "Unknown error";
    return res.status(504).json({
      ok: false,
      error: msg,
      version: SERVICE_VERSION,
      git: GIT_SHA,
      supabase: { url },
    });
  } finally {
    clearTimeout(t);
  }
}

// Primary endpoints (some scripts call these)
app.get("/v1/transactions/storage-status", handleStorageStatus);
app.get("/v1/storage-status", handleStorageStatus);

// -----------------------------
// RESEND email (REST, no SDK)
// -----------------------------
async function sendViaResend(args: {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("[llm] Missing RESEND_API_KEY");

  const from = args.from ?? process.env.RESEND_FROM;
  if (!from) {
    throw new Error(
      "[llm] Missing RESEND_FROM (e.g. 'FinHack <no-reply@finhack.app>')",
    );
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: args.to,
        subject: args.subject,
        text: args.text,
        html: args.html,
        reply_to: args.replyTo,
      }),
      signal: controller.signal,
    });

    const json = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const msg = (json as any)?.message ||
        (json as any)?.error ||
        `Resend error ${resp.status}`;
      throw new Error(msg);
    }

    return json as { id?: string };
  } finally {
    clearTimeout(t);
  }
}

async function getEmailViaResend(id: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("[llm] Missing RESEND_API_KEY");

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);

  try {
    const resp = await fetch(
      `https://api.resend.com/emails/${encodeURIComponent(id)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      },
    );

    const json = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const msg = (json as any)?.message ||
        (json as any)?.error ||
        `Resend error ${resp.status}`;
      throw new Error(msg);
    }

    return json;
  } finally {
    clearTimeout(t);
  }
}

app.post("/v1/notify/email", async (req: Request, res: Response) => {
  try {
    const to = req.body?.to;
    const subject = req.body?.subject;

    if (!to || !subject) {
      return res.status(400).json({
        ok: false,
        error: "Missing 'to' or 'subject'",
      });
    }

    const text = typeof req.body?.text === "string" ? req.body.text : undefined;
    const html = typeof req.body?.html === "string" ? req.body.html : undefined;

    if (!text && !html) {
      return res.status(400).json({
        ok: false,
        error: "Provide at least 'text' or 'html'",
      });
    }

    const from = typeof req.body?.from === "string" ? req.body.from : undefined;
    const replyTo = typeof req.body?.replyTo === "string"
      ? req.body.replyTo
      : undefined;

    const out = await sendViaResend({ to, subject, text, html, from, replyTo });
    return res.json({ ok: true, id: (out as any)?.id ?? null });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: e?.message ?? "Unknown error",
    });
  }
});

app.get("/v1/notify/email/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params?.id;
    if (!id) {
      return res.status(400).json({ ok: false, error: "Missing email id" });
    }

    const email = await getEmailViaResend(id);
    return res.json({ ok: true, email });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: e?.message ?? "Unknown error",
    });
  }
});

// -----------------------------
// Mascot video via Veo (Vertex AI)
// -----------------------------
type TxSummary = { spend?: number; income?: number; net?: number };

const BASE_MASCOT_STYLE =
  "Duolingo-like finance mascot (round baby chick), relaxed confident stance, small satisfied smile, warm eyes, subtle sparkle, " +
  "holding a neat checklist and a coin jar, posture upright and composed, soft pastel gradient background, clean 2D vector, thick outline, minimal shading, " +
  "friendly mobile UI illustration. Keep the exact character identity and style consistent with the reference image.";

const MOTION_PRESETS: Record<
  string,
  { label: string; animate: string; vibe: string }
> = {
  good: {
    label: "On track",
    vibe: "confident + calm",
    animate:
      "Animate: gentle idle breathing, blink twice, tiny head tilt, subtle sparkle twinkle, checklist bounce, coin jar wiggle. Smooth, cute, minimal motion.",
  },
  streak: {
    label: "Streak / winning",
    vibe: "happy + celebratory",
    animate:
      "Animate: happy bounce (small), quick blink, sparkle burst twinkle near head, checklist wiggle like a proud checkmark moment, coin jar tiny celebratory shake. Keep motion smooth and short.",
  },
  warning: {
    label: "Slightly off-track",
    vibe: "attentive + coaching",
    animate:
      "Animate: gentle breathing, one slow blink, small head tilt as if thinking, checklist taps once, coin jar subtle steady wobble. Calm and supportive (not sad).",
  },
  overspent: {
    label: "Overspent",
    vibe: "soft concern + encouragement",
    animate:
      "Animate: gentle breathing, slow blink, tiny head dip then recover to upright, checklist slightly droops then straightens, coin jar steadies. Keep it kind, not dramatic.",
  },
  neutral: {
    label: "Neutral",
    vibe: "idle",
    animate:
      "Animate: gentle idle breathing, single blink, micro head sway. Very subtle.",
  },
};

function pickPresetFromSummary(s?: TxSummary): keyof typeof MOTION_PRESETS {
  const spend = Number(s?.spend ?? 0);
  const income = Number(s?.income ?? 0);
  const net = Number(s?.net ?? income - spend);

  if (income > 0 && net > 0 && spend > 0) {
    if (net / Math.max(income, 1) > 0.25) return "streak";
    return "good";
  }
  if (spend > 0 && net < 0) return "overspent";
  if (spend > 0 && net >= 0) return "warning";
  return "neutral";
}

function buildMascotPrompt(
  args: { preset?: string; txSummary?: TxSummary; extra?: string },
) {
  const chosen =
    (args.preset && (MOTION_PRESETS[args.preset] ? args.preset : undefined)) ??
      pickPresetFromSummary(args.txSummary);

  const preset = MOTION_PRESETS[chosen] ?? MOTION_PRESETS.neutral;

  const stats = args.txSummary
    ? `Context (numbers are real): spend=${args.txSummary.spend ?? 0}, income=${
      args.txSummary.income ?? 0
    }, net=${
      args.txSummary.net ??
        Number(args.txSummary.income ?? 0) - Number(args.txSummary.spend ?? 0)
    }.`
    : "";

  const extra = args.extra ? `Extra instruction: ${args.extra}` : "";

  return [
    BASE_MASCOT_STYLE,
    preset.animate,
    "Duration: ~6–8 seconds. Keep background consistent. No text captions. No scene cuts.",
    stats,
    extra,
  ]
    .filter(Boolean)
    .join("\n");
}

function getVertexAccessToken(): string {
  const envTok = process.env.VERTEX_ACCESS_TOKEN;
  if (envTok && envTok.trim()) return envTok.trim();

  try {
    const tok = execSync("gcloud auth print-access-token", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString("utf8")
      .trim();
    if (!tok) throw new Error("empty token");
    return tok;
  } catch {
    throw new Error(
      "[llm] Missing Vertex auth. Set VERTEX_ACCESS_TOKEN or run `gcloud auth login` (and install gcloud).",
    );
  }
}

function vertexBase() {
  const projectId = process.env.VEO_PROJECT_ID || process.env.GCP_PROJECT_ID ||
    process.env.PROJECT_ID;
  const location = process.env.VEO_LOCATION || process.env.LOCATION ||
    "us-central1";
  const modelId = process.env.VEO_MODEL_ID || "veo-3.1-fast-generate-001";

  if (!projectId) {
    throw new Error(
      "[llm] Missing VEO_PROJECT_ID (or GCP_PROJECT_ID / PROJECT_ID)",
    );
  }

  const base = `https://${location}-aiplatform.googleapis.com/v1` +
    `/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}`;

  return { projectId, location, modelId, base };
}

async function veoPredictLongRunning(
  args: { prompt: string; referenceGcsUri: string },
) {
  const { base } = vertexBase();
  const accessToken = getVertexAccessToken();

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 30000);

  try {
    const resp = await fetch(`${base}:predictLongRunning`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        instances: [{ prompt: args.prompt }],
        parameters: {
          referenceImages: [{
            image: { gcsUri: args.referenceGcsUri },
            referenceType: "asset",
          }],
        },
      }),
      signal: controller.signal,
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = (json as any)?.error?.message || (json as any)?.message ||
        `Vertex error ${resp.status}`;
      throw new Error(msg);
    }

    const opName = (json as any)?.name;
    if (!opName) throw new Error("Vertex did not return operation name");
    return opName as string;
  } finally {
    clearTimeout(t);
  }
}

async function veoFetchOperation(opName: string) {
  const { base } = vertexBase();
  const accessToken = getVertexAccessToken();

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 30000);

  try {
    const resp = await fetch(`${base}:fetchPredictOperation`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ operationName: opName }),
      signal: controller.signal,
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = (json as any)?.error?.message || (json as any)?.message ||
        `Vertex error ${resp.status}`;
      throw new Error(msg);
    }
    return json as any;
  } finally {
    clearTimeout(t);
  }
}

function extractVideoBase64(
  opJson: any,
): { b64: string; mimeType?: string } | null {
  const preds = opJson?.response?.predictions;
  if (Array.isArray(preds) && preds.length > 0) {
    const p0 = preds[0];
    const b64 = p0?.bytesBase64Encoded;
    const mimeType = p0?.mimeType;
    if (typeof b64 === "string" && b64.length > 1000) {
      return {
        b64,
        mimeType: typeof mimeType === "string" ? mimeType : undefined,
      };
    }
  }

  // Fallback: search object tree for a big base64 blob
  const stack: any[] = [opJson];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur) continue;
    if (typeof cur === "object") {
      for (const v of Object.values(cur)) {
        if (
          typeof v === "string" && v.length > 20000 &&
          /^[A-Za-z0-9+/=]+$/.test(v)
        ) return { b64: v };
        if (typeof v === "object") stack.push(v);
      }
    }
  }
  return null;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function generateMascotVideoToAssets(args: {
  prompt: string;
  referenceGcsUri: string;
  outBasename?: string;
}) {
  const opName = await veoPredictLongRunning({
    prompt: args.prompt,
    referenceGcsUri: args.referenceGcsUri,
  });

  const maxAttempts = Number(process.env.VEO_POLL_MAX ?? 60);
  const intervalMs = Number(process.env.VEO_POLL_INTERVAL_MS ?? 3000);

  let last: any = null;

  for (let i = 0; i < maxAttempts; i++) {
    const op = await veoFetchOperation(opName);
    last = op;

    if (op?.done === true) {
      if (op?.error) {
        throw new Error(op?.error?.message || "Veo operation failed");
      }

      const got = extractVideoBase64(op);
      if (!got) throw new Error("Veo done=true but no video bytes found");

      const buf = Buffer.from(got.b64, "base64");
      if (buf.length < 50_000) {
        throw new Error(`Video decode too small (${buf.length} bytes)`);
      }

      const safeBase = (args.outBasename ?? `mascot_motion_${Date.now()}`)
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .slice(0, 80);

      const outPath = path.join(generatedDir, `${safeBase}.mp4`);
      await fs.writeFile(outPath, buf);

      const fileName = path.basename(outPath);
      const publicUrl = `/assets/generated/${fileName}`;

      return {
        opName,
        filePath: outPath,
        fileName,
        publicUrl,
        bytes: buf.length,
        mimeType: got.mimeType ?? "video/mp4",
      };
    }

    await sleep(intervalMs);
  }

  throw new Error(
    `Timed out waiting for Veo after ${maxAttempts} attempts. Last keys: ${
      Object.keys(last ?? {}).join(", ")
    }`,
  );
}

app.get("/v1/mascot/presets", (_req: Request, res: Response) => {
  const presets = Object.entries(MOTION_PRESETS).map(([key, v]) => ({
    key,
    label: v.label,
    vibe: v.vibe,
  }));
  res.json({ ok: true, presets });
});

app.post("/v1/mascot/video", async (req: Request, res: Response) => {
  try {
    const refGcs =
      (typeof req.body?.refGcs === "string" && req.body.refGcs.trim()) ||
      process.env.VEO_REF_GCS;

    if (!refGcs) {
      return res.status(400).json({
        ok: false,
        error:
          "Missing reference image. Provide body.refGcs or set VEO_REF_GCS=gs://.../mascot1.png",
      });
    }

    const preset = typeof req.body?.preset === "string"
      ? req.body.preset
      : undefined;
    const extra = typeof req.body?.extra === "string"
      ? req.body.extra
      : undefined;

    const txSummary: TxSummary | undefined =
      req.body?.txSummary && typeof req.body.txSummary === "object"
        ? {
          spend: req.body.txSummary.spend,
          income: req.body.txSummary.income,
          net: req.body.txSummary.net,
        }
        : undefined;

    const outName = typeof req.body?.outName === "string"
      ? req.body.outName
      : "mascot_motion_latest";
    const prompt = buildMascotPrompt({ preset, txSummary, extra });

    const out = await generateMascotVideoToAssets({
      prompt,
      referenceGcsUri: refGcs,
      outBasename: outName,
    });

    return res.json({
      ok: true,
      presetUsed: preset ?? pickPresetFromSummary(txSummary),
      refGcs,
      opName: out.opName,
      fileName: out.fileName,
      filePath: out.filePath,
      publicUrl: out.publicUrl,
      bytes: out.bytes,
      mimeType: out.mimeType,
    });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: e?.message ?? "Unknown error",
    });
  }
});

// -----------------------------
// Mount routers
// -----------------------------
// Routers are mounted last so the explicit endpoints above remain stable.
// Mongo routes are mounted at their own paths (router defines /v1/mongo/*).
app.use(mongoRouter);
app.use("/v1/tx", txEventsRouter);
app.use("/v1/chat", (await import(new URL("./routes/chat.js", import.meta.url).href)).chatRouter);
console.log("[llm] loaded chat router from ./routes/chat.js");
app.use("/v1/sales", (await import(new URL("./routes/sales.js", import.meta.url).href)).salesRouter);
app.use("/v1/health", healthRouter);
app.use("/v1/transactions", transactionsRouter);
app.use("/v1/companion", companionRouter);

// 404
app.use(
  ((req: Request, res: Response) => {
    res.status(404).json({
      ok: false,
      error: "Not Found",
      path: req.originalUrl,
    });
  }) as RequestHandler,
);

// Final error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[llm] error", err);
  const status = typeof err?.status === "number" ? err.status : 500;
  const message = typeof err?.message === "string"
    ? err.message
    : "Internal Server Error";
  res.status(status).json({ ok: false, error: message });
});

const port = Number(process.env.PORT || 8080);

process.on(
  "unhandledRejection",
  (err) => console.error("[llm] unhandledRejection", err),
);
process.on(
  "uncaughtException",
  (err) => console.error("[llm] uncaughtException", err),
);

const server = app.listen(port, () => {
  let veo = {
    projectId: "(unset)",
    location: "(unset)",
    modelId: "(unset)",
    base: "",
  };
  try {
    veo = vertexBase();
  } catch {
    // ignore
  }

  console.log(`[llm] listening on :${port}`);
  console.log(`[llm] version=${SERVICE_VERSION} git=${GIT_SHA ?? "(none)"}`);
  console.log(`[llm] MONGODB_URI present? ${Boolean(process.env.MONGODB_URI)}`);
  console.log(
    `[llm] GEMINI_API_KEY present? ${Boolean(process.env.GEMINI_API_KEY)}`,
  );
  console.log(
    `[llm] RESEND_API_KEY present? ${Boolean(process.env.RESEND_API_KEY)}`,
  );
  console.log(
    `[llm] SUPABASE_URL present? ${Boolean(process.env.SUPABASE_URL)}`,
  );
  console.log(
    `[llm] SUPABASE_SERVICE_ROLE_KEY present? ${
      Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
    }`,
  );
  console.log(`[llm] CORS_ORIGINS: ${corsOrigins.join(", ")}`);
  console.log(`[llm] assetsDir: ${assetsDir}`);
  console.log(`[llm] generatedDir: ${generatedDir}`);
  console.log(
    `[llm] Veo config: project=${veo.projectId} location=${veo.location} model=${veo.modelId}`,
  );
  console.log(`[llm] VEO_REF_GCS present? ${Boolean(process.env.VEO_REF_GCS)}`);
});

async function closeMongoIfOpen() {
  try {
    const { client } = await getMongoDynamic();
    await client.close().catch(() => undefined);
  } catch {
    // ignore
  }
}

function shutdown(signal: string) {
  console.log(`[llm] ${signal} received, shutting down...`);
  server.close(async () => {
    await closeMongoIfOpen();
    console.log("[llm] server closed");
    process.exit(0);
  });

  // Force-exit if something is hanging (e.g., long-running fetch)
  setTimeout(() => {
    console.warn("[llm] forced shutdown after 5s");
    process.exit(1);
  }, 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
