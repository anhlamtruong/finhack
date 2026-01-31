// apps/llm/src/services/gemini.ts
// Robust Gemini helpers used by the LLM service.
// - geminiJson<T>: requests JSON output and parses defensively
// - geminiText: requests plain text
// - callGeminiText: small convenience wrapper used by other services
//
// Notes:
// - Uses the Google Generative Language API (v1beta) via REST.
// - Sends `systemInstruction` separately from user content.
// - Retries transient errors (429/500/502/503/504) with backoff.
// - Enforces a HARD overall deadline across retries.
// - Produces clearer errors for aborted/timeouts.

export type GeminiGenerateArgs = {
  system: string;
  user: string;
  model?: string; // e.g. "gemini-2.5-flash" or "gemini-3-pro-preview"
  timeoutMs?: number; // default depends on helper
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
};

type GeminiRawArgs = {
  system: string;
  user: string;
  model: string;
  timeoutMs: number;
  temperature: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  signal?: AbortSignal;
};

function nowMs() {
  return Date.now();
}

function toFiniteInt(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function geminiUrl(model: string, apiKey: string) {
  const base = (process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com").replace(
    /\/$/,
    "",
  );

  return `${base}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function isRetryableStatus(status: number) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function stripCodeFences(s: string) {
  const t = String(s ?? "").trim();
  if (!t) return t;

  // ```json ... ``` or ``` ... ```
  if (t.startsWith("```")) {
    return t.replace(/^```[a-zA-Z]*\s*/m, "").replace(/```\s*$/m, "").trim();
  }
  return t;
}

function extractTextOut(json: any): string {
  const parts = json?.candidates?.[0]?.content?.parts;

  if (Array.isArray(parts)) {
    return String(parts.map((p: any) => p?.text ?? "").join("") ?? "").trim();
  }

  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return String(text ?? "").trim();
}

function summarizeGeminiResponse(json: any) {
  const candidate = json?.candidates?.[0];
  return {
    hasCandidates: Array.isArray(json?.candidates),
    candidatesCount: Array.isArray(json?.candidates) ? json.candidates.length : 0,
    finishReason: candidate?.finishReason,
    safetyRatings: candidate?.safetyRatings,
    contentKeys: candidate?.content ? Object.keys(candidate.content) : [],
  };
}

function extractFirstJsonCandidate(text: string): string {
  const s = stripCodeFences(text);
  if (!s) return s;

  const trimmed = s.trim();
  const firstChar = trimmed[0];
  if (firstChar === "{" || firstChar === "[") return trimmed;

  // Otherwise find the first '{' or '[' and return a balanced slice.
  const startObj = trimmed.indexOf("{");
  const startArr = trimmed.indexOf("[");
  const start =
    startObj === -1
      ? startArr
      : startArr === -1
        ? startObj
        : Math.min(startObj, startArr);

  if (start === -1) return trimmed;

  const sub = trimmed.slice(start);
  const stack: string[] = [];

  for (let i = 0; i < sub.length; i++) {
    const ch = sub[i];
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") {
      const last = stack.pop();
      if (!last) continue;

      if ((last === "{" && ch !== "}") || (last === "[" && ch !== "]")) {
        // mismatch – keep scanning
        continue;
      }

      if (stack.length === 0) {
        return sub.slice(0, i + 1).trim();
      }
    }
  }

  return sub.trim();
}

function toHttpError(status: number, bodyText: string) {
  const msg = `Gemini error ${status}: ${bodyText}`;
  const err: any = new Error(msg);
  err.status = status;
  err.body = bodyText;
  return err;
}

function logGeminiError(details: {
  stage: string;
  model: string;
  attempt: number;
  maxAttempts: number;
  status?: number;
  body?: string;
  message?: string;
}) {
  const body = typeof details.body === "string" ? details.body : "";
  const snippet = body ? body.slice(0, 800) : undefined;
  console.warn("[llm][gemini] request failed", {
    stage: details.stage,
    model: details.model,
    attempt: details.attempt,
    maxAttempts: details.maxAttempts,
    status: details.status,
    message: details.message,
    bodySnippet: snippet,
    ts: new Date().toISOString(),
  });
}

function makeAbortError(message: string, status: number, cause?: any) {
  const err: any = new Error(message);
  err.status = status;
  err.cause = cause;
  return err;
}

/**
 * Core Gemini call.
 *
 * Guarantees:
 * - Will NOT run longer than `timeoutMs` total across retries.
 * - If `signal` is aborted, will abort the request promptly.
 */
async function geminiGenerateRaw(args: GeminiRawArgs): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const e: any = new Error("Missing GEMINI_API_KEY");
    e.status = 500;
    throw e;
  }

  // Optional hard cap (0/undefined means no cap)
  const hardCapMs = toFiniteInt(process.env.GEMINI_HARD_TIMEOUT_MS, 0);
  const totalTimeoutMs = hardCapMs > 0 ? Math.min(args.timeoutMs, hardCapMs) : args.timeoutMs;

  const url = geminiUrl(args.model, apiKey);

  const body: any = {
    systemInstruction: { parts: [{ text: args.system }] },
    contents: [{ role: "user", parts: [{ text: args.user }] }],
    generationConfig: {
      temperature: args.temperature,
      ...(typeof args.maxOutputTokens === "number" ? { maxOutputTokens: args.maxOutputTokens } : {}),
      ...(args.responseMimeType ? { responseMimeType: args.responseMimeType } : {}),
    },
  };

  const maxAttempts = clamp(toFiniteInt(process.env.GEMINI_MAX_RETRIES, 2) + 1, 1, 5);

  // Overall deadline across retries.
  const startedAt = nowMs();
  const deadlineAt = startedAt + totalTimeoutMs;

  // Mirror caller's abort signal (e.g., HTTP client disconnect).
  // We attach a listener that will be copied into each attempt's controller.
  let callerAborted = false;
  const onCallerAbort = () => {
    callerAborted = true;
  };
  if (args.signal) {
    if (args.signal.aborted) callerAborted = true;
    else args.signal.addEventListener("abort", onCallerAbort, { once: true });
  }

  try {
    let lastErr: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const remainingMs = Math.max(0, deadlineAt - nowMs());
      if (callerAborted) {
        throw makeAbortError("Gemini request aborted (client disconnected)", 499);
      }
      if (remainingMs <= 0) {
        throw makeAbortError(`Gemini request aborted (timeout after ${totalTimeoutMs}ms)`, 504);
      }

      // Per-attempt timeout: never exceed remaining time.
      // Also allow an env override to keep each attempt shorter than the total.
      const attemptCapMs = toFiniteInt(process.env.GEMINI_ATTEMPT_TIMEOUT_MS, 0);
      const attemptTimeoutMs = attemptCapMs > 0 ? Math.min(remainingMs, attemptCapMs) : remainingMs;

      const controller = new AbortController();
      const onAttemptAbort = () => controller.abort();

      if (args.signal) {
        if (args.signal.aborted) controller.abort();
        else args.signal.addEventListener("abort", onAttemptAbort, { once: true });
      }

      const t = setTimeout(() => controller.abort(), attemptTimeoutMs);

      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          const err = toHttpError(resp.status, text);

          logGeminiError({
            stage: "http",
            model: args.model,
            attempt,
            maxAttempts,
            status: resp.status,
            body: text,
            message: err?.message,
          });

          // Retry only if we have time left and status is retryable.
          if (attempt < maxAttempts && isRetryableStatus(resp.status)) {
            const afterRespRemaining = Math.max(0, deadlineAt - nowMs());
            if (afterRespRemaining <= 250) {
              throw makeAbortError(`Gemini request aborted (timeout after ${totalTimeoutMs}ms)`, 504, err);
            }

            const base = 400 * Math.pow(2, attempt - 1);
            const jitter = Math.floor(Math.random() * 200);
            const backoff = Math.min(base + jitter, Math.max(0, afterRespRemaining - 50));
            if (backoff > 0) await sleep(backoff);
            continue;
          }

          throw err;
        }

        return await resp.json();
      } catch (e: any) {
        const name = String(e?.name ?? "");
        const msg = String(e?.message ?? "");

        if (callerAborted || (args.signal && args.signal.aborted)) {
          throw makeAbortError("Gemini request aborted (client disconnected)", 499, e);
        }

        if (name === "AbortError" || msg.toLowerCase().includes("aborted")) {
          const elapsed = nowMs() - startedAt;
          // If we still have time and attempts left, let the loop continue.
          // Otherwise, surface a timeout.
          const stillHasTime = nowMs() < deadlineAt;
          if (attempt < maxAttempts && stillHasTime) {
            lastErr = e;
            continue;
          }
          throw makeAbortError(`Gemini request aborted (timeout after ${totalTimeoutMs}ms)`, 504, e);
        }

        lastErr = e;

        if (e?.status || msg) {
          logGeminiError({
            stage: "network",
            model: args.model,
            attempt,
            maxAttempts,
            status: e?.status,
            body: e?.body,
            message: msg || name,
          });
        }

        // Retry network-ish failures only if we still have time.
        const stillHasTime = nowMs() < deadlineAt;
        if (attempt < maxAttempts && stillHasTime) {
          const remaining = Math.max(0, deadlineAt - nowMs());
          const base = 300 * Math.pow(2, attempt - 1);
          const jitter = Math.floor(Math.random() * 200);
          const backoff = Math.min(base + jitter, Math.max(0, remaining - 50));
          if (backoff > 0) await sleep(backoff);
          continue;
        }

        throw lastErr;
      } finally {
        clearTimeout(t);
        if (args.signal) args.signal.removeEventListener("abort", onAttemptAbort);
      }
    }

    throw lastErr ?? new Error("Gemini request failed");
  } finally {
    if (args.signal) args.signal.removeEventListener("abort", onCallerAbort);
  }
}

export async function geminiJson<T>(args: GeminiGenerateArgs): Promise<T> {
  const model = args.model ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  // Defaults can be tuned via env (kept backwards compatible).
  const defaultJsonTimeout = toFiniteInt(process.env.GEMINI_JSON_TIMEOUT_MS, 60000);
  const timeoutMs = args.timeoutMs ?? defaultJsonTimeout;

  const temperature = typeof args.temperature === "number" ? args.temperature : 0.2;

  const json = await geminiGenerateRaw({
    system: args.system,
    user: args.user,
    model,
    timeoutMs,
    temperature,
    maxOutputTokens: args.maxOutputTokens,
    responseMimeType: "application/json",
    signal: args.signal,
  });

  const textOut = extractTextOut(json);
  if (!textOut) {
    console.warn("[llm][geminiJson] empty content", {
      model,
      summary: summarizeGeminiResponse(json),
    });
    throw new Error("Gemini returned empty content");
  }

  const candidate = extractFirstJsonCandidate(textOut);
  try {
    return JSON.parse(candidate) as T;
  } catch {
    const trimmed = stripCodeFences(textOut);
    const head = trimmed.slice(0, 500);
    const tail = trimmed.length > 500 ? trimmed.slice(-500) : "";
    const snippet = tail ? `${head}\n...\n${tail}` : head;
    const summary = summarizeGeminiResponse(json);
    throw new Error(
      `Gemini did not return valid JSON. length=${trimmed.length}. finishReason=${summary.finishReason}. Snippet: ${snippet}`,
    );
  }
}

export async function geminiText(args: GeminiGenerateArgs): Promise<string> {
  const model = args.model ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  const defaultTextTimeout = toFiniteInt(process.env.GEMINI_TEXT_TIMEOUT_MS, 60000);
  const timeoutMs = args.timeoutMs ?? defaultTextTimeout;

  const temperature = typeof args.temperature === "number" ? args.temperature : 0.4;

  const json = await geminiGenerateRaw({
    system: args.system,
    user: args.user,
    model,
    timeoutMs,
    temperature,
    maxOutputTokens: args.maxOutputTokens,
    signal: args.signal,
  });

  const textOut = extractTextOut(json);
  if (!textOut) throw new Error("Gemini returned empty content");
  return textOut;
}

// Convenience alias some services expect.
export async function callGeminiText(
  prompt: string,
  opts?: { model?: string; timeoutMs?: number; signal?: AbortSignal },
) {
  return geminiText({
    system: "You are a helpful finance coach. Return a short, friendly message.",
    user: prompt,
    model: opts?.model,
    timeoutMs: opts?.timeoutMs,
    signal: opts?.signal,
  });
}