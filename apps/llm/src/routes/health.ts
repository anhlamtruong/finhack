import { Router } from "express";
import { geminiJson } from "../services/gemini.js";

/**
 * Health + readiness routes for the LLM service.
 */
export const healthRouter = Router();

/**
 * True if an env var is set to a non-empty value.
 */
function envFlag(name: string) {
  return Boolean(process.env[name] && String(process.env[name]).trim().length > 0);
}

/**
 * Current timestamp as ISO string.
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * Safe string helper for env reporting.
 */
function safeStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/**
 * GET /v1/health
 * Basic service + env presence (no secrets).
 */
healthRouter.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "llm",
    ts: nowIso(),
    env: {
      GEMINI_API_KEY: envFlag("GEMINI_API_KEY"),
      GEMINI_MODEL: safeStr(process.env.GEMINI_MODEL),
      SUPABASE_URL: envFlag("SUPABASE_URL"),
      SUPABASE_SERVICE_ROLE_KEY: envFlag("SUPABASE_SERVICE_ROLE_KEY"),
      RESEND_API_KEY: envFlag("RESEND_API_KEY"),
      RESEND_FROM: safeStr(process.env.RESEND_FROM),
      VEO_REF_GCS: safeStr(process.env.VEO_REF_GCS),
      VEO_PROJECT_ID: safeStr(process.env.VEO_PROJECT_ID ?? process.env.PROJECT_ID ?? process.env.GCP_PROJECT_ID),
      VEO_LOCATION: safeStr(process.env.VEO_LOCATION ?? process.env.LOCATION),
      VEO_MODEL_ID: safeStr(process.env.VEO_MODEL_ID),
    },
  });
});

/**
 * GET /v1/health/ping
 * Convenience ping route.
 */
healthRouter.get("/ping", (_req, res) => {
  res.json({ ok: true, service: "llm", route: "health/ping", ts: nowIso() });
});

/**
 * GET /v1/health/ready
 * Readiness check: verifies required config is present (does not call external services).
 */
healthRouter.get("/ready", (_req, res) => {
  const missing: string[] = [];

  // Supabase is required for most transaction endpoints
  if (!envFlag("SUPABASE_URL")) missing.push("SUPABASE_URL");
  if (!envFlag("SUPABASE_SERVICE_ROLE_KEY")) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  // Optional services (warn but do not fail readiness)
  const warnings: string[] = [];
  if (!envFlag("GEMINI_API_KEY")) warnings.push("GEMINI_API_KEY (coach will fall back / may fail)");
  if (!envFlag("RESEND_API_KEY")) warnings.push("RESEND_API_KEY (email disabled)");
  if (!safeStr(process.env.RESEND_FROM)) warnings.push("RESEND_FROM (email may fail)");
  if (!safeStr(process.env.VEO_REF_GCS)) warnings.push("VEO_REF_GCS (mascot video requires ref image)");

  if (missing.length) {
    return res.status(503).json({ ok: false, service: "llm", ts: nowIso(), missing, warnings });
  }

  return res.json({ ok: true, service: "llm", ts: nowIso(), warnings });
});

/**
 * GET /v1/health/gemini
 * Tests Gemini from INSIDE your Node service (no frontend involved).
 * NOTE: This calls an external API and may be slow.
 */
healthRouter.get("/gemini", async (_req, res) => {
  try {
    const model = process.env.GEMINI_MODEL || "gemini-3-flash-preview";

    const out = await geminiJson<{ ok: boolean; model: string }>({
      system: "Return ONLY JSON.",
      user: JSON.stringify({ ok: true, model }, null, 0),
      model,
      timeoutMs: 15000,
    });

    res.json({ ok: true, model, gemini: out });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});
