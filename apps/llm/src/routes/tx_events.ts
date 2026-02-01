import express from "express";
import crypto from "crypto";
import { sfExec } from "../services/snowflake";

/**
 * @module TxEventsRouter
 * Ingests transaction-like events into Snowflake RAW schema and reads curated rows
 * from ANALYTICS views for the Company View dashboard.
 */
export const txEventsRouter = express.Router();
export default txEventsRouter;

const ROUTER_VERSION = "2026-02-01.tx_events.1";
console.log(`[llm] tx_events router loaded version=${ROUTER_VERSION}`);

function safeStr(v: unknown, fallback = "") {
  if (typeof v !== "string") return fallback;
  const t = v.trim();
  return t.length ? t : fallback;
}

function safeLimit(v: unknown, fallback = 50, max = 200) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

function safeJsonString(v: unknown) {
  // We always store a JSON object in VARIANT via PARSE_JSON(?).
  // If caller gives an object -> stringify.
  // If caller gives a string -> try JSON.parse to validate, else wrap.
  if (v === null || v === undefined) return "{}";

  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return "{}";
    try {
      // validate JSON
      JSON.parse(s);
      return s;
    } catch {
      // wrap as a JSON object
      return JSON.stringify({ value: s });
    }
  }

  try {
    return JSON.stringify(v);
  } catch {
    return "{}";
  }
}

async function sfRows<T = any>(sql: string, binds: any[] = []): Promise<T[]> {
  const out: any = await sfExec<any>(sql, binds);
  // Support either { rows: [...] } or direct array.
  if (Array.isArray(out)) return out as T[];
  if (Array.isArray(out?.rows)) return out.rows as T[];
  if (Array.isArray(out?.data)) return out.data as T[];
  return [];
}

/**
 * Ping endpoint for health checks.
 * @route GET /v1/tx/ping
 */
txEventsRouter.get("/ping", (_req, res) => {
  res.json({ ok: true, route: "tx/ping", routerVersion: ROUTER_VERSION, ts: new Date().toISOString() });
});

/**
 * Ingest a transaction event.
 * Designed for voice -> text pipelines (e.g., ElevenLabs transcription) and manual entry.
 *
 * @route POST /v1/tx/events
 * @body {
 *   userId: string,
 *   source?: string,            // e.g. "manual" | "elevenlabs" | "app" | "import"
 *   rawText?: string,           // raw utterance or note
 *   payload?: object|string     // JSON object (preferred) or JSON string
 * }
 * @returns { ok: true, eventId: string }
 */
txEventsRouter.post("/events", async (req, res) => {
  try {
    const userId = safeStr(req.body?.userId, "");
    const source = safeStr(req.body?.source, "manual");
    const rawText = safeStr(req.body?.rawText, "");
    const payloadJson = safeJsonString(req.body?.payload ?? {});

    if (!userId) {
      return res.status(400).json({ ok: false, error: "Missing userId" });
    }

    const eventId = crypto.randomUUID();

    // IMPORTANT: Snowflake column names in FINHACK_DB.RAW.TX_EVENTS are:
    // EVENT_ID, USER_ID, TS, SOURCE, RAW_TEXT, PAYLOAD
    const sql = `
      INSERT INTO FINHACK_DB.RAW.TX_EVENTS (EVENT_ID, TS, USER_ID, SOURCE, RAW_TEXT, PAYLOAD)
      SELECT ?, CURRENT_TIMESTAMP(), ?, ?, ?, PARSE_JSON(?)
    `;

    await sfExec(sql, [eventId, userId, source, rawText, payloadJson]);

    return res.json({ ok: true, eventId });
  } catch (e: any) {
    console.warn("[llm][tx.events] insert failed", { message: e?.message });
    return res.status(500).json({ ok: false, error: e?.message ?? "insert failed" });
  }
});

/**
 * Read recent transactions for a user from the curated ANALYTICS view.
 * This is what Company View should use to render charts/tables.
 *
 * @route GET /v1/tx/recent?userId=some_user&limit=50
 * @returns { ok: true, userId: string, count: number, transactions: any[] }
 */
txEventsRouter.get("/recent", async (req, res) => {
  try {
    const userId = safeStr(req.query.userId, "");
    const limit = safeLimit(req.query.limit, 50, 200);

    if (!userId) {
      return res.status(400).json({ ok: false, error: "Missing userId" });
    }

    // Use a bind for USER_ID; limit must be interpolated (Snowflake doesn’t bind LIMIT).
    const sql = `
      SELECT *
      FROM FINHACK_DB.ANALYTICS.V_TRANSACTIONS_FROM_EVENTS
      WHERE USER_ID = ?
      ORDER BY TS DESC
      LIMIT ${limit}
    `;

    const rows = await sfRows<any>(sql, [userId]);

    return res.json({
      ok: true,
      userId,
      count: rows.length,
      transactions: rows,
    });
  } catch (e: any) {
    console.warn("[llm][tx.recent] query failed", { message: e?.message });
    return res.status(500).json({ ok: false, error: e?.message ?? "query failed" });
  }
});

/**
 * Optional: quick schema introspection (useful for debugging during hackathon).
 *
 * @route GET /v1/tx/meta
 */
txEventsRouter.get("/meta", async (_req, res) => {
  try {
    const tables = await sfRows<any>(
      `SHOW TABLES IN SCHEMA FINHACK_DB.RAW`,
      [],
    );
    const views = await sfRows<any>(
      `SHOW VIEWS IN SCHEMA FINHACK_DB.ANALYTICS`,
      [],
    );
    return res.json({ ok: true, routerVersion: ROUTER_VERSION, rawTables: tables, analyticsViews: views });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? "meta failed" });
  }
});