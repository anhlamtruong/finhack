// apps/llm/src/services/resend.ts
// Resend REST client (no SDK) — strict TypeScript friendly

export type SendEmailArgs = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
};

export type ResendSendEmailResponse = {
  id?: string;
};

const RESEND_API_BASE = "https://api.resend.com";

/**
 * Default "from" address.
 * Prefer env at runtime; this exported const is mainly for convenience.
 */
export const RESEND_FROM: string = process.env.RESEND_FROM ?? "";

/**
 * Internal fetch helper with timeout + JSON error handling
 */
async function resendFetch<T>(path: string, init: RequestInit, timeoutMs = 15000): Promise<T> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("[llm] Missing RESEND_API_KEY");

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(`${RESEND_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });

    const json = (await resp.json().catch(() => ({}))) as any;

    if (!resp.ok) {
      const msg = json?.message || json?.error || `Resend error ${resp.status}`;
      throw new Error(msg);
    }

    return json as T;
  } catch (e: any) {
    // Normalize abort errors
    if (e?.name === "AbortError") {
      throw new Error("[llm] Resend request timed out");
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Send an email via Resend REST API.
 * Docs: POST /emails
 * Body fields include: from, to, subject, text, html, reply_to
 */
export async function sendEmail(args: SendEmailArgs): Promise<ResendSendEmailResponse> {
  const from = args.from ?? process.env.RESEND_FROM;
  if (!from) throw new Error("[llm] Missing RESEND_FROM (e.g. 'Chuchube <no-reply@chuchube.co>')");

  if (!args.to) throw new Error("[llm] Missing 'to'");
  if (!args.subject) throw new Error("[llm] Missing 'subject'");
  if (!args.text && !args.html) throw new Error("[llm] Provide at least 'text' or 'html'");

  return resendFetch<ResendSendEmailResponse>("/emails", {
    method: "POST",
    body: JSON.stringify({
      from,
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html,
      reply_to: args.replyTo, // Resend REST field name
    }),
  });
}

/**
 * Fetch an email object via Resend REST API.
 * Docs: GET /emails/:id
 */
export async function getEmail(id: string): Promise<any> {
  if (!id) throw new Error("[llm] Missing email id");
  return resendFetch<any>(`/emails/${encodeURIComponent(id)}`, { method: "GET" });
}

/**
 * Convenience wrapper matching older imports:
 *   import { resend } from "./resend.js"
 *   await resend.sendEmail(...)
 */
export const resend = {
  sendEmail,
  getEmail,
};