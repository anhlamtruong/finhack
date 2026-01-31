import express from "express";
import { supabaseAdmin } from "../services/supabase.js";
import { geminiJson } from "../services/gemini.js";

/**
 * Transactions + coaching routes for the LLM service.
 */
export const transactionsRouter = express.Router();
export default transactionsRouter;

/**
 * Bump this whenever you change this file.
 * Use it to confirm the running server is using the latest router code.
 */
const ROUTER_VERSION = "2026-01-27.3";

// Log on module load so you can prove which router file is actually running.
console.log(`[llm] transactions router loaded version=${ROUTER_VERSION}`);

/**
 * Clamp a number within bounds.
 */
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Resolve timeout budget for the coaching endpoint.
 */
function coachTimeoutMs(overrideMs?: unknown) {
  // Total end-to-end budget for the coach endpoint.
  // Priority: request override -> env -> default.
  const raw = safeNum(
    overrideMs ?? process.env.COACH_TIMEOUT_MS ??
      process.env.COACH_GEMINI_TIMEOUT_MS ?? 9000,
    9000,
  );

  // Never less than 2s, never more than 120s.
  return clamp(Number.isFinite(raw) ? raw : 9000, 2000, 120000);
}

/**
 * Read amount divisor for DB scaling (e.g. cents -> dollars).
 */
function amountDivisor() {
  // If your DB stores cents, set AMOUNT_DIVISOR=100.
  // Default is 1 (no scaling) to avoid guessing.
  const d = safeNum(process.env.AMOUNT_DIVISOR ?? 1, 1);
  return d > 0 ? d : 1;
}

/**
 * Format amounts for prompt-friendly summaries.
 */
function fmtAmount(n: number) {
  const div = amountDivisor();
  if (div === 1) return String(Math.round(n));
  const v = n / div;
  // fixed 2 decimals for currency-like scaling
  return v.toFixed(2);
}

/**
 * Generate a fallback coach message when LLM is unavailable.
 */
function coachHeuristicMessage(args: {
  days: number;
  summary: ReturnType<typeof summarize>;
}) {
  const cats = args.summary.topCategories
    .slice(0, 3)
    .map((x) => x.category_id)
    .filter(Boolean)
    .join(", ") || "(none)";

  const spendStr = fmtAmount(args.summary.spend);
  const incomeStr = fmtAmount(args.summary.income);
  const netStr = fmtAmount(args.summary.net);

  // Note: amounts are scaled only if AMOUNT_DIVISOR is set (e.g. 100 for cents).
  return (
    `You spent ${spendStr} and earned ${incomeStr} in the last ${args.days} days (net ${netStr}). ` +
    `Top spend categories: ${cats}.`
  );
}

/**
 * Compact transaction rows to keep LLM prompts short.
 */
function compactRecent(transactions: TxRow[], max = 60) {
  // Keep payload small + stable (prevents large prompts and slow model calls).
  return transactions.slice(0, max).map((t) => ({
    id: t.id,
    amount: t.amount,
    payee: t.payee,
    note: t.note,
    date: t.date,
    account_id: t.account_id,
    category_id: t.category_id,
  }));
}

type TxRow = {
  id: string;
  amount: number; // int4 (often cents)
  payee: string | null;
  // Supabase schema has been seen as either `note` or `notes`.
  // We normalize into `note`.
  note: string | null;
  date: string; // timestamp
  account_id: string;
  category_id: string | null;
};

/**
 * Convert Date to yyyy-mm-dd.
 */
function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Parse a day anchor ISO (yyyy-mm-dd) into a Date.
 */
function parseTodayIso(todayIso?: string) {
  // Treat todayIso as a day anchor; use UTC midnight for range queries.
  const base = todayIso ? new Date(`${todayIso}T00:00:00.000Z`) : new Date();
  if (Number.isNaN(base.getTime())) return new Date();
  return base;
}

/**
 * Safe numeric coercion for env/config values.
 */
function safeNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Normalize note/notes column into a single value.
 */
function getRequestId(req: any): string {
  const h = req?.headers?.["x-request-id"];
  if (typeof h === "string" && h.trim()) return h.trim();
  if (Array.isArray(h) && typeof h[0] === "string" && h[0].trim()) return h[0].trim();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * Normalize note/notes column into a single value.
 */
function normalizeNote(row: any): string | null {
  const v = row?.notes ?? row?.note ?? null;
  return v == null ? null : String(v);
}

/**
 * Missing-column errors can appear in multiple shapes:
 * - "column transactions.note does not exist"
 * - "column \"note\" does not exist"
 * - "Could not find the 'note' column of 'transactions' in the schema cache"
 */
/**
 * Detect missing-column errors across common Postgres/Supabase formats.
 */
function isMissingColumnError(msg: string, table: string, col: string) {
  const m = String(msg || "").toLowerCase();
  const t = String(table).toLowerCase();
  const c = String(col).toLowerCase();

  // postgrest-ish: "column transactions.note does not exist"
  if (
    m.includes("column") &&
    m.includes(`${t}.${c}`) &&
    (m.includes("does not exist") || m.includes("not exist"))
  ) {
    return true;
  }

  // other postgres/postgrest shapes without table qualifier
  // e.g. "column \"note\" does not exist" or "column note does not exist"
  if (
    m.includes("column") &&
    (m.includes(`\"${c}\"`) || m.includes(`'${c}'`) || m.includes(` ${c} `) ||
      m.endsWith(` ${c}`)) &&
    (m.includes("does not exist") || m.includes("not exist"))
  ) {
    return true;
  }

  // supabase schema cache error
  // e.g. "could not find the 'note' column of 'transactions' in the schema cache"
  if (
    m.includes("could not find") &&
    m.includes(`'${c}'`) &&
    m.includes(`'${t}'`) &&
    m.includes("schema cache")
  ) {
    return true;
  }

  return false;
}

type Awaitable<T> = PromiseLike<T>;

/**
 * Promise wrapper with timeout and labeled errors.
 */
async function withTimeout<T>(
  p: Awaitable<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let t: any;
  const timeout = new Promise<never>((_, rej) => {
    t = setTimeout(() => {
      const err: any = new Error(`${label} timed out after ${timeoutMs}ms`);
      err.status = 504;
      rej(err);
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(p), timeout]);
  } finally {
    clearTimeout(t);
  }
}

/**
 * Fetch account IDs owned by the user.
 */
async function getOwnedAccountIds(userId: string) {
  const { data, error } = await withTimeout(
    supabaseAdmin.from("accounts").select("id").eq("user_id", userId),
    8000,
    "Supabase accounts query",
  );

  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => String(r.id));
}

/**
 * Ensure accountId belongs to the user before reading transactions.
 */
async function assertAccountOwned(userId: string, accountId: string) {
  const { data, error } = await withTimeout(
    supabaseAdmin
      .from("accounts")
      .select("id")
      .eq("id", accountId)
      .eq("user_id", userId)
      .maybeSingle(),
    8000,
    "Supabase account ownership query",
  );

  if (error) throw new Error(error.message);
  if (!data) {
    const err: any = new Error("Forbidden: account does not belong to user");
    err.status = 403;
    throw err;
  }
}

/**
 * Fetch a limited transaction history for coach prompts.
 */
async function fetchHistory(opts: {
  userId: string;
  accountId?: string;
  days: number;
  todayIso?: string;
  limit: number;
}) {
  const today = parseTodayIso(opts.todayIso);
  const toIso = new Date(today.getTime() + 24 * 3600 * 1000).toISOString();
  const fromIso = new Date(today.getTime() - opts.days * 24 * 3600 * 1000)
    .toISOString();

  if (opts.accountId) {
    await assertAccountOwned(opts.userId, opts.accountId);
  }

  const ownedAccountIds = opts.accountId
    ? [opts.accountId]
    : await getOwnedAccountIds(opts.userId);

  const baseSelect = "id,amount,payee,date,account_id,category_id";

  if (ownedAccountIds.length === 0) {
    return {
      fromIso,
      toIso,
      transactions: [] as TxRow[],
      selectUsed: baseSelect,
      noteFieldUsed: null,
    };
  }

  async function runSelect(selectCols: string) {
    const q = supabaseAdmin
      .from("transactions")
      .select(selectCols)
      .gte("date", fromIso)
      .lt("date", toIso)
      .order("date", { ascending: false })
      .limit(opts.limit)
      .in("account_id", ownedAccountIds);

    const { data, error } = await withTimeout(
      q,
      15000,
      "Supabase transactions query",
    );
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  // Robust column handling:
  // 1) try `notes`
  // 2) if missing, try `note`
  // 3) if both missing, proceed without a note field
  const variants = [
    { cols: `${baseSelect},notes`, noteFieldUsed: "notes" as const },
    { cols: `${baseSelect},note`, noteFieldUsed: "note" as const },
    { cols: baseSelect, noteFieldUsed: null },
  ];

  let data: any[] | null = null;
  let lastErr: any = null;
  let selectUsed = baseSelect;
  let noteFieldUsed: "notes" | "note" | null = null;

  for (const v of variants) {
    try {
      data = await runSelect(v.cols);
      lastErr = null;
      selectUsed = v.cols;
      noteFieldUsed = v.noteFieldUsed;
      break;
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message ?? "");

      // Only fall through to the next variant when the *selected* column is missing.
      if (
        v.noteFieldUsed === "notes" &&
        isMissingColumnError(msg, "transactions", "notes")
      ) continue;
      if (
        v.noteFieldUsed === "note" &&
        isMissingColumnError(msg, "transactions", "note")
      ) continue;

      // Not a missing-column case -> surface immediately.
      throw e;
    }
  }

  if (!data) {
    throw lastErr ?? new Error("Failed to fetch transaction history");
  }

  const rows = data.map((r: any) => ({
    id: String(r.id),
    amount: safeNum(r.amount, 0),
    payee: r.payee == null ? null : String(r.payee),
    note: normalizeNote(r),
    date: String(r.date),
    account_id: String(r.account_id),
    category_id: r.category_id == null ? null : String(r.category_id),
  })) as TxRow[];

  return { fromIso, toIso, transactions: rows, selectUsed, noteFieldUsed };
}

function summarize(transactions: TxRow[]) {
  // amount convention: negative = spending, positive = income
  let income = 0;
  let spend = 0;

  const byCategory: Record<string, number> = {};
  const byPayee: Record<string, number> = {};

  for (const t of transactions) {
    const amt = safeNum(t.amount, 0);

    if (amt >= 0) income += amt;
    else spend += Math.abs(amt);

    const cat = t.category_id ?? "uncategorized";
    if (amt < 0) byCategory[cat] = (byCategory[cat] ?? 0) + Math.abs(amt);
 
    const payee = (t.payee ?? "unknown").trim().toUpperCase();
    if (amt < 0) byPayee[payee] = (byPayee[payee] ?? 0) + Math.abs(amt);
  }

  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([category_id, totalSpend]) => ({
      category_id,
      totalSpend: Math.round(totalSpend),
    }));

  const topPayees = Object.entries(byPayee)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([payee, totalSpend]) => ({
      payee,
      totalSpend: Math.round(totalSpend),
    }));

  return {
    income: Math.round(income),
    spend: Math.round(spend),
    net: Math.round(income - spend),
    topCategories,
    topPayees,
  };
}

// -----------------------------
// Routes
// -----------------------------

transactionsRouter.get("/ping", (_req, res) => {
  res.json({
    ok: true,
    route: "transactions/ping",
    nowIso: new Date().toISOString(),
    routerVersion: ROUTER_VERSION,
  });
});

/**
 * GET /v1/transactions/storage-status
 * Simple Supabase probe + confirms which transactions note field exists.
 */
transactionsRouter.get("/storage-status", async (_req, res) => {
  try {
    const urlPresent = Boolean(
      process.env.SUPABASE_URL && String(process.env.SUPABASE_URL).trim(),
    );
    const keyPresent = Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
        String(process.env.SUPABASE_SERVICE_ROLE_KEY).trim(),
    );

    // Probe a cheap table read; if RLS/keys are wrong, Supabase will return an error.
    const probe = supabaseAdmin.from("accounts").select("id").limit(1);
    const { data, error } = await withTimeout(
      probe,
      8000,
      "Supabase storage-status probe",
    );

    if (error) {
      return res.status(502).json({
        ok: false,
        error: error.message,
        routerVersion: ROUTER_VERSION,
        env: {
          SUPABASE_URL: urlPresent,
          SUPABASE_SERVICE_ROLE_KEY: keyPresent,
        },
      });
    }

    // Also probe transactions select variants so we can report which note field exists.
    const baseSelect = "id,amount,payee,date,account_id,category_id";
    const variants = [
      { cols: `${baseSelect},notes`, noteFieldUsed: "notes" as const },
      { cols: `${baseSelect},note`, noteFieldUsed: "note" as const },
      { cols: baseSelect, noteFieldUsed: null },
    ];

    let txSelectUsed: string | null = null;
    let txNoteFieldUsed: "notes" | "note" | null = null;

    for (const v of variants) {
      try {
        const q = supabaseAdmin.from("transactions").select(v.cols).limit(1);
        const { error: txErr } = await withTimeout(
          q,
          8000,
          "Supabase transactions storage-status probe",
        );
        if (txErr) throw new Error(txErr.message);
        txSelectUsed = v.cols;
        txNoteFieldUsed = v.noteFieldUsed;
        break;
      } catch (e: any) {
        const msg = String(e?.message ?? "");
        if (
          v.noteFieldUsed === "notes" &&
          isMissingColumnError(msg, "transactions", "notes")
        ) continue;
        if (
          v.noteFieldUsed === "note" &&
          isMissingColumnError(msg, "transactions", "note")
        ) continue;
        // other errors -> stop
        txSelectUsed = null;
        txNoteFieldUsed = null;
        break;
      }
    }

    return res.json({
      ok: true,
      routerVersion: ROUTER_VERSION,
      env: { SUPABASE_URL: urlPresent, SUPABASE_SERVICE_ROLE_KEY: keyPresent },
      sampleCount: Array.isArray(data) ? data.length : null,
      transactionsProbe: {
        selectUsed: txSelectUsed,
        noteFieldUsed: txNoteFieldUsed,
      },
    });
  } catch (e: any) {
    const status = Number(e?.status ?? 500);
    return res.status(status).json({
      ok: false,
      error: e?.message ?? "Unknown error",
      routerVersion: ROUTER_VERSION,
    });
  }
});

/**
 * GET /v1/transactions/history?userId=...&accountId=...&days=120&todayIso=2026-01-21&limit=500
 */
transactionsRouter.get("/history", async (req, res) => {
  try {
    const userId = typeof req.query.userId === "string"
      ? req.query.userId
      : undefined;
    if (!userId) {
      return res.status(400).json({ ok: false, error: "Missing userId" });
    }

    const accountId = typeof req.query.accountId === "string"
      ? req.query.accountId
      : undefined;
    const days = Math.max(
      1,
      Math.min(3650, safeNum(req.query.days ?? 120, 120)),
    );
    const todayIso = typeof req.query.todayIso === "string"
      ? req.query.todayIso
      : undefined;
    const limit = Math.max(
      1,
      Math.min(2000, safeNum(req.query.limit ?? 500, 500)),
    );

    const { fromIso, toIso, transactions, selectUsed, noteFieldUsed } =
      await fetchHistory({
        userId,
        accountId,
        days,
        todayIso,
        limit,
      });

    res.json({
      ok: true,
      routerVersion: ROUTER_VERSION,
      userId,
      accountId: accountId ?? null,
      range: { fromIso, toIso, days },
      debug: {
        routerVersion: ROUTER_VERSION,
        selectUsed,
        noteFieldUsed,
      },
      count: transactions.length,
      summary: summarize(transactions),
      transactions,
    });
  } catch (e: any) {
    const status = Number(e?.status ?? 500);
    res.status(status).json({
      ok: false,
      error: e?.message ?? "Unknown error",
      routerVersion: ROUTER_VERSION,
    });
  }
});

/**
 * POST /v1/transactions/coach-from-history
 * Body: { userId, accountId?, days?, todayIso?, tone? }
 */
transactionsRouter.post("/coach-from-history", async (req, res) => {
  try {
    const t0 = Date.now();
    const requestId = getRequestId(req);

    const userId = typeof req.body?.userId === "string"
      ? req.body.userId
      : undefined;
    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: "Missing userId",
        routerVersion: ROUTER_VERSION,
      });
    }

    const accountId = typeof req.body?.accountId === "string"
      ? req.body.accountId
      : undefined;
    const days = Math.max(
      1,
      Math.min(3650, safeNum(req.body?.days ?? 120, 120)),
    );
    const todayIso = typeof req.body?.todayIso === "string"
      ? req.body.todayIso
      : undefined;
    const tone = typeof req.body?.tone === "string"
      ? req.body.tone
      : "friendly";

    const { transactions } = await fetchHistory({
      userId,
      accountId,
      days,
      todayIso,
      limit: 500,
    });

    const summary = summarize(transactions);
    const recentCompact = compactRecent(transactions, 60);

    // Fast heuristic path if Gemini is not configured.
    if (!process.env.GEMINI_API_KEY) {
      const msg = coachHeuristicMessage({ days, summary });
      return res.json({
        ok: true,
        userId,
        accountId: accountId ?? null,
        message: msg,
        highlights: [],
        risks: [],
        suggestedActions: [],
        source: "heuristic",
        routerVersion: ROUTER_VERSION,
        debug: {
          elapsedMs: Date.now() - t0,
          usedGemini: false,
          amountDivisor: amountDivisor(),
        },
      });
    }

    // Keep total request bounded so callers with curl --max-time 10 don't hang.
    const totalBudgetMs = coachTimeoutMs(req.body?.timeoutMs);
    // Give Gemini slightly less than the total budget (leave room for JSON + IO).
    const geminiBudgetMs = Math.max(1500, totalBudgetMs - 800);

    const payload = {
      tone,
      todayIso: todayIso ?? isoDay(new Date()),
      days,
      userId,
      accountId: accountId ?? null,
      summary,
      recentTransactions: recentCompact,
    };

    const system =
      "You are a personal finance coach. Use ONLY the provided summary + recentTransactions. " +
      "Do not invent merchants or amounts. " +
      "Return ONLY valid JSON (no markdown, no code fences). " +
      "Keys: ok,message,highlights,risks,suggestedActions.";

    try {
      const out = await withTimeout(
        geminiJson<{
          ok: true;
          message: string;
          highlights: string[];
          risks: string[];
          suggestedActions: string[];
        }>({
          model: process.env.GEMINI_MODEL || "gemini-3-pro-preview",
          timeoutMs: geminiBudgetMs,
          temperature: 0.3,
          system,
          user: JSON.stringify(payload, null, 2),
        }),
        totalBudgetMs,
        "coach-from-history (gemini)",
      );

      return res.json({
        ...out,
        userId,
        accountId: accountId ?? null,
        source: "gemini",
        routerVersion: ROUTER_VERSION,
        debug: {
          elapsedMs: Date.now() - t0,
          usedGemini: true,
          totalBudgetMs,
          geminiBudgetMs,
          amountDivisor: amountDivisor(),
        },
      });
    } catch (e: any) {
      const emsg = String(e?.message ?? "Gemini error");
      const isTimeout = Number(e?.status ?? 0) === 504 ||
        /timed out|timeout|aborted/i.test(emsg);

      // If Gemini fails or times out, return a safe heuristic fallback quickly.
      const msg = coachHeuristicMessage({ days, summary });

      return res.json({
        ok: true,
        userId,
        accountId: accountId ?? null,
        message: isTimeout
          ? `${msg} (AI coach timed out — quick summary shown.)`
          : msg,
        highlights: [],
        risks: [],
        suggestedActions: [],
        source: isTimeout ? "heuristic_timeout" : "heuristic_fallback",
        routerVersion: ROUTER_VERSION,
        debug: {
          elapsedMs: Date.now() - t0,
          usedGemini: true,
          totalBudgetMs,
          geminiBudgetMs,
          amountDivisor: amountDivisor(),
          geminiError: emsg.slice(0, 500),
        },
      });
    }
  } catch (e: any) {
    const status = Number(e?.status ?? 500);
    res.status(status).json({
      ok: false,
      error: e?.message ?? "Unknown error",
      routerVersion: ROUTER_VERSION,
    });
  }
});
