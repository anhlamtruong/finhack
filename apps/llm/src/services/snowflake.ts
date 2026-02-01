import snowflake from "snowflake-sdk";

/**
 * Snowflake helper utilities for FinHack.
 *
 * Goals:
 * - Clear env validation + friendly errors
 * - Reusable connection (optional) to avoid reconnect-per-request overhead
 * - Simple `sfExec()` API with binds
 */

type ExecResult<T = any> = {
  rows: T[];
  count: number;
  meta?: {
    warehouse?: string;
    database?: string;
    schema?: string;
    role?: string;
    reusedConnection?: boolean;
  };
};

function must(v: string | undefined, name: string) {
  if (!v || !String(v).trim()) throw new Error(`Missing env var: ${name}`);
  return String(v).trim();
}

function opt(v: string | undefined, fallback: string) {
  return v && String(v).trim() ? String(v).trim() : fallback;
}

function boolEnv(v: string | undefined, fallback = false) {
  if (v == null) return fallback;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y";
}

function numEnv(v: string | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const SF_ACCOUNT = must(process.env.SNOWFLAKE_ACCOUNT, "SNOWFLAKE_ACCOUNT");
const SF_USERNAME = must(process.env.SNOWFLAKE_USERNAME, "SNOWFLAKE_USERNAME");
const SF_PASSWORD = must(process.env.SNOWFLAKE_PASSWORD, "SNOWFLAKE_PASSWORD");

const SF_ROLE = opt(process.env.SNOWFLAKE_ROLE, "");
const SF_WAREHOUSE = opt(process.env.SNOWFLAKE_WAREHOUSE, "");
const SF_DATABASE = opt(process.env.SNOWFLAKE_DATABASE, "");

const SF_SCHEMA_RAW = opt(process.env.SNOWFLAKE_SCHEMA_RAW, "RAW");
const SF_SCHEMA_ANALYTICS = opt(process.env.SNOWFLAKE_SCHEMA_ANALYTICS, "ANALYTICS");

const SF_REUSE_CONNECTION = boolEnv(process.env.SNOWFLAKE_REUSE_CONNECTION, true);
const SF_STMT_TIMEOUT_S = numEnv(process.env.SNOWFLAKE_STATEMENT_TIMEOUT_S, 30);

const SF_RETRY_MAX = Math.max(0, numEnv(process.env.SNOWFLAKE_RETRY_MAX, 1));
const SF_RETRY_BACKOFF_MS = Math.max(0, numEnv(process.env.SNOWFLAKE_RETRY_BACKOFF_MS, 250));

const SF_DEBUG = boolEnv(process.env.DEBUG_SNOWFLAKE, false);

let _conn: snowflake.Connection | null = null;
let _connReady: Promise<snowflake.Connection> | null = null;

function logDebug(message: string, extra?: any) {
  if (!SF_DEBUG) return;
  // eslint-disable-next-line no-console
  console.log(`[sf] ${message}`, extra ?? "");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function destroyConn(conn: snowflake.Connection) {
  await new Promise<void>((resolve) => {
    try {
      // snowflake-sdk typings often require a callback
      (conn as any).destroy((/* err: any */) => resolve());
    } catch {
      resolve();
    }
  });
}

function makeConnection(schema: string) {
  // snowflake-sdk typings can lag behind actual supported fields.
  // We cast to `any` to avoid TS blocking build.
  const cfg: any = {
    account: SF_ACCOUNT,
    username: SF_USERNAME,
    password: SF_PASSWORD,
    ...(SF_ROLE ? { role: SF_ROLE } : {}),
    ...(SF_WAREHOUSE ? { warehouse: SF_WAREHOUSE } : {}),
    ...(SF_DATABASE ? { database: SF_DATABASE } : {}),
    schema,
    statementTimeoutInSeconds: SF_STMT_TIMEOUT_S,
  };

  return snowflake.createConnection(cfg);
}

async function connectOnce(schema: string): Promise<snowflake.Connection> {
  if (!SF_REUSE_CONNECTION) {
    const fresh = makeConnection(schema);
    await new Promise<void>((resolve, reject) => {
      fresh.connect((err) => (err ? reject(err) : resolve()));
    });
    return fresh;
  }

  if (_conn && (_conn as any).__schema === schema) return _conn;

  if (_connReady) {
    const conn = await _connReady;
    if ((conn as any).__schema === schema) return conn;
  }

  _connReady = (async () => {
    if (_conn) {
      await destroyConn(_conn);
      _conn = null;
    }

    const conn = makeConnection(schema);
    await new Promise<void>((resolve, reject) => {
      conn.connect((err) => (err ? reject(err) : resolve()));
    });

    (conn as any).__schema = schema;
    _conn = conn;

    logDebug("connected", {
      account: SF_ACCOUNT,
      user: SF_USERNAME,
      role: SF_ROLE || undefined,
      warehouse: SF_WAREHOUSE || undefined,
      database: SF_DATABASE || undefined,
      schema,
      timeoutS: SF_STMT_TIMEOUT_S,
      reuse: SF_REUSE_CONNECTION,
    });

    return conn;
  })();

  return _connReady;
}

function normalizeBinds(binds: any[]) {
  return (binds ?? []).map((b) => {
    if (b == null) return null;
    if (typeof b === "object") return JSON.stringify(b);
    return b;
  });
}

async function execWithConn<T>(
  conn: snowflake.Connection,
  sqlText: string,
  binds: any[]
): Promise<T[]> {
  const safeBinds = normalizeBinds(binds);

  return new Promise<T[]>((resolve, reject) => {
    conn.execute({
      sqlText,
      binds: safeBinds,
      complete: (err, _stmt, rows) => {
        if (err) return reject(err);
        resolve((rows ?? []) as unknown as T[]);
      },
    });
  });
}

export async function sfExec<T = any>(
  sqlText: string,
  binds: any[] = [],
  opts?: { schema?: string }
): Promise<ExecResult<T>> {
  const schema = (opts?.schema ?? SF_SCHEMA_RAW).trim() || SF_SCHEMA_RAW;

  let lastErr: any = null;

  for (let attempt = 0; attempt <= SF_RETRY_MAX; attempt++) {
    try {
      const conn = await connectOnce(schema);
      const reused = SF_REUSE_CONNECTION && !!_conn;

      logDebug("exec", {
        attempt,
        schema,
        sqlPreview: String(sqlText).trim().slice(0, 160),
        bindsCount: (binds ?? []).length,
      });

      const rows = await execWithConn<T>(conn, sqlText, binds);

      if (!SF_REUSE_CONNECTION) {
        await destroyConn(conn);
      }

      return {
        rows,
        count: rows.length,
        meta: SF_DEBUG
          ? {
              warehouse: SF_WAREHOUSE || undefined,
              database: SF_DATABASE || undefined,
              schema,
              role: SF_ROLE || undefined,
              reusedConnection: reused,
            }
          : undefined,
      };
    } catch (e: any) {
      lastErr = e;

      if (SF_REUSE_CONNECTION) {
        try {
          if (_conn) await destroyConn(_conn);
        } catch {
          // ignore
        }
        _conn = null;
        _connReady = null;
      }

      logDebug("exec failed", { attempt, msg: e?.message ?? String(e) });

      if (attempt < SF_RETRY_MAX) {
        await sleep(SF_RETRY_BACKOFF_MS * (attempt + 1));
        continue;
      }
      throw e;
    }
  }

  throw lastErr ?? new Error("Snowflake exec failed");
}

export function sfExecRaw<T = any>(sqlText: string, binds: any[] = []) {
  return sfExec<T>(sqlText, binds, { schema: SF_SCHEMA_RAW });
}

export function sfExecAnalytics<T = any>(sqlText: string, binds: any[] = []) {
  return sfExec<T>(sqlText, binds, { schema: SF_SCHEMA_ANALYTICS });
}

export async function sfClose() {
  if (!_conn) return;
  try {
    await destroyConn(_conn);
  } catch {
    // ignore
  }
  _conn = null;
  _connReady = null;
}

process.on("SIGINT", () => void sfClose());
process.on("SIGTERM", () => void sfClose());