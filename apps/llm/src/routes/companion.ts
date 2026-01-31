import express from "express";
import { geminiJson } from "../services/gemini";
import { generateDraftAssets } from "../services/companions/gen-art";
import {
  buildCompanionPrompt,
  buildCompanionSummaryPrompt,
} from "../services/companions/companionPrompt";
import { cleanupDraftAssets } from "../services/companions/cleanup";
import { formatPrompt } from "../utils/promptFormatter";

/**
 * @module CompanionRouter
 * Express router for companion generation + chat endpoints.
 */
export const companionRouter = express.Router();
export default companionRouter;

const ROUTER_VERSION = "2026-01-28.1";
console.log(`[llm] companion router loaded version=${ROUTER_VERSION}`);

/**
 * Trim/guard string inputs so LLM payloads stay well-formed.
 */
function safeStr(v: unknown, fallback = "") {
  if (typeof v !== "string") return fallback;
  const trimmed = v.trim();
  return trimmed.length ? trimmed : fallback;
}

/**
 * Numeric guard used for financial context inputs.
 */
function safeNum(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Best-effort JSON parsing for LLM responses that may include markdown fences.
 */
function parseRelaxedJson(input: unknown) {
  if (typeof input === "object" && input !== null) return input as any;
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;

  // Strip markdown code fences if present.
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const fenced = fenceMatch?.[1]?.trim();
  const candidate = fenced && fenced.length ? fenced : raw;

  try {
    return JSON.parse(candidate);
  } catch {
    // Try to recover from extra prose by extracting the first JSON object.
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const slice = candidate.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(slice);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Deterministic persona used when Gemini is unavailable.
 */
function fallbackCompanion(prompt: string) {
  return {
    name: prompt ? `${prompt.slice(0, 16)} Buddy` : "Chuchube",
    archetype: "guardian",
    visuals: { primaryColor: "#22c55e", accessory: "ledger-charm" },
    assets: {
      baby: { idle: null, hungry: null, sleepy: null },
      adult: { idle: null, hungry: null, sleepy: null },
      mythic: { idle: null, hungry: null, sleepy: null },
    },
    personality: {
      tone: "supportive",
      backstory: "A loyal guide who celebrates every dollar you keep.",
      financialFocus: "saving",
    },
    initialStats: { energy: 95, hunger: 10 },
  };
}


/**
 * Ping endpoint for health checks.
 * @route GET /ping
 * @returns {object} { ok: boolean, route: string, routerVersion: string, ts: string }
 * @description Returns basic health and version info for the companion router.
 */
companionRouter.get("/ping", (_req, res) => {
  console.log("[llm][companion.ping] request", {
    ts: new Date().toISOString(),
  });
  res.json({
    ok: true,
    route: "companion/ping",
    routerVersion: ROUTER_VERSION,
    ts: new Date().toISOString(),
  });
  console.log("[llm][companion.ping] response", {
    ok: true,
    routerVersion: ROUTER_VERSION,
    ts: new Date().toISOString(),
  });
});


/**
 * Generate a new companion persona and draft assets.
 * @route POST /generate
 * @param {object} req.body - { userId: string, prompt: string }
 * @returns {object} { ok: boolean, companion: object }
 * @description Generates a new companion persona using LLM and returns draft assets.
 */
companionRouter.post("/generate", async (req, res) => {
  try {
    const userId = safeStr(req.body?.userId, "unknown");
    const prompt = safeStr(req.body?.prompt, "");
    console.log("[llm][companion.generate] request", {
      userId,
      promptPreview: prompt.slice(0, 120),
      hasPrompt: Boolean(prompt),
      ts: new Date().toISOString(),
    });

    // Build LLM prompt for persona + visuals.
    const { system, userPrompt } = buildCompanionPrompt({ userId, prompt });

    const model = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
    const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.0-flash";

    // Try primary model, then fallback model.
    let ai: any = null;
    try {
      ai = await geminiJson<any>({
        system,
        user: userPrompt,
        model,
        timeoutMs: 30000,
        maxOutputTokens: 5000,
        temperature: 0,
      });
    } catch (err: any) {
      console.warn("[llm][companion.generate] gemini primary failed", {
        message: err?.message,
        model,
        ts: new Date().toISOString(),
      });

      try {
        ai = await geminiJson<any>({
          system,
          user: userPrompt,
          model: fallbackModel,
          timeoutMs: 30000,
          maxOutputTokens: 5000,
          temperature: 0,
        });
      } catch (fallbackErr: any) {
        console.warn("[llm][companion.generate] gemini fallback failed", {
          message: fallbackErr?.message,
          model: fallbackModel,
          ts: new Date().toISOString(),
        });
      }
    }

    console.log("[llm][companion.generate] gemini result", {
      usedModel: ai ? (ai.__model ?? model) : "fallback-only",
      hasAi: Boolean(ai),
      ts: new Date().toISOString(),
    });

    // Merge fallback with any AI-generated content.
    const base = fallbackCompanion(prompt);
    const companion = {
      ...base,
      ...(ai ?? {}),
      assets: ai?.assets ?? base.assets,
      personality: ai?.personality ?? base.personality,
    };

    // Generate draft assets (stored locally under /public/assets).
    const draftAssets = await generateDraftAssets({
      userId,
      archetype: companion.archetype ?? "guardian",
      prompt,
      visuals: companion.visuals ?? {},
    });

    companion.assets = draftAssets.assets;
    (companion as any).draftId = draftAssets.draftId;

    res.json({ ok: true, companion });
    console.log("[llm][companion.generate] response", {
      ok: true,
      hasAssets: Boolean(companion?.assets),
      draftId: (companion as any)?.draftId,
      ts: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error("[llm][companion.generate] error", {
      message: e?.message,
      stack: e?.stack,
      ts: new Date().toISOString(),
    });
    res.status(500).json({
      ok: false,
      error: e?.message ?? "companion generate failed",
    });
  }
});


/**
 * Chat endpoint for companion interaction.
 * @route POST /chat
 * @param {object} req.body - { message: string, context?: object }
 * @returns {object} { ok: boolean, reply: string, animation: string, tone: string, safeToSpend: number }
 * @description Sends a message and context to the LLM and returns a short, context-aware reply.
 */
companionRouter.post("/chat", async (req, res) => {
  try {
    const message = safeStr(req.body?.message, "Hello");
    const context = req.body?.context ?? {};
    const safeToSpend = safeNum(context.safeToSpend, 0);
    console.log("[llm][companion.chat] request", {
      messagePreview: message.slice(0, 120),
      hasContext: Boolean(context && Object.keys(context).length > 0),
      hasScreen: Boolean((context as any)?.currentScreen),
      ts: new Date().toISOString(),
    });

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const { system, userPrompt } = buildCompanionSummaryPrompt({
      message,
      context,
    });

    let ai: any;
    try {
      ai = await geminiJson<any>({
        system,
        user: userPrompt,
        model,
        timeoutMs: 20000,
        maxOutputTokens: 10000,
        temperature: 0,
      });
    } catch (err: any) {
      if (!String(err?.message ?? "").includes("did not return valid JSON")) {
        throw err;
      }
      console.warn("[llm][companion.chat] retrying with relaxed JSON handling", {
        message: err?.message,
        ts: new Date().toISOString(),
      });
      const relaxedSystem =
        "Return valid JSON if possible. You may include minimal prose, but include a single JSON object.\n" +
        system;

      const raw = await geminiJson<any>({
        system: relaxedSystem,
        user: userPrompt,
        model,
        timeoutMs: 25000,
        maxOutputTokens: 12000,
        temperature: 0,
      });

      ai = parseRelaxedJson(raw) ?? raw;
    }

    if (typeof ai === "string") {
      ai = parseRelaxedJson(ai) ?? { reply: ai };
    }

    const summary = safeStr(
      ai?.summary,
      "Here’s a quick snapshot. Tap for the full report.",
    );
    const highlights = Array.isArray(ai?.highlights) ? ai.highlights : [];
    const risks = Array.isArray(ai?.risks) ? ai.risks : [];
    const suggests = Array.isArray(ai?.suggests) ? ai.suggests : [];
    const animation = safeStr(ai?.animation, "idle");
    const tone = safeStr(ai?.tone, "warm");
    const reply = summary;

    res.json({
      ok: true,
      reply,
      summary,
      highlights,
      risks,
      suggests,
      animation,
      tone,
      safeToSpend,
    });
    console.log("[llm][companion.chat] response", {
      ok: true,
      replyPreview: reply.slice(0, 120),
      animation,
      tone,
      ts: new Date().toISOString(),
    });
  } catch (e: any) {
    console.warn("[llm][companion.chat] error", {
      message: e?.message,
      ts: new Date().toISOString(),
    });
    const fallback = {
      ok: true,
      reply: "I'm here whenever you need a nudge. Aim to save a little today!",
      summary: "I can help summarize this page. Tap again to see a full report.",
      highlights: [],
      risks: [],
      suggests: [],
      animation: "idle",
      tone: "warm",
    };
    res.status(200).json(fallback);
    console.log("[llm][companion.chat] response", {
      ok: true,
      replyPreview: fallback.reply.slice(0, 120),
      animation: fallback.animation,
      tone: fallback.tone,
      ts: new Date().toISOString(),
    });
  }
});

/**
 * Cleanup endpoint for removing draft companion assets.
 * @route POST /cleanup
 * @param {object} req.body - { path: string }
 * @returns {object} { ok: boolean, deleted: boolean }
 * @description Deletes draft assets at the given path.
 */
companionRouter.post("/cleanup", async (req, res) => {
  try {
    const rawPath = safeStr(req.body?.path, "");
    console.log("[llm][companion.cleanup] request", {
      hasPath: Boolean(rawPath),
      pathPreview: rawPath.slice(0, 160),
      ts: new Date().toISOString(),
    });
    if (!rawPath) {
      return res.status(400).json({ ok: false, error: "path is required" });
    }

    const deleted = await cleanupDraftAssets(rawPath);
    const response = { ok: true, deleted };
    res.json(response);
    console.log("[llm][companion.cleanup] response", {
      ...response,
      ts: new Date().toISOString(),
    });
    return;
  } catch (e: any) {
    console.warn("[llm][companion.cleanup] error", {
      message: e?.message,
      ts: new Date().toISOString(),
    });
    return res.status(500).json({ ok: false, error: e?.message ?? "cleanup failed" });
  }
});
