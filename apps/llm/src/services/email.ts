import express from "express";
import { resend, RESEND_FROM } from "./resend.js";

export const emailRouter = express.Router();

// -----------------------------
// POST /v1/email/send
// Body: { to: string | string[], subject: string, html?: string, text?: string, from?: string, replyTo?: string }
// -----------------------------
emailRouter.post("/send", async (req, res) => {
  try {
    const toRaw = req.body?.to;
    const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";

    const to: string | string[] =
      typeof toRaw === "string"
        ? toRaw.trim()
        : Array.isArray(toRaw)
          ? toRaw.map((x) => String(x).trim()).filter(Boolean)
          : "";

    const html = typeof req.body?.html === "string" ? req.body.html : undefined;
    const text = typeof req.body?.text === "string" ? req.body.text : undefined;

    // Allow override, otherwise use RESEND_FROM/env
    const from = typeof req.body?.from === "string" ? req.body.from : (RESEND_FROM || undefined);
    const replyTo = typeof req.body?.replyTo === "string" ? req.body.replyTo : undefined;

    const hasTo = typeof to === "string" ? Boolean(to) : to.length > 0;
    if (!hasTo || !subject || (!html && !text)) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields: to, subject, and (html or text)",
      });
    }

    const out = await resend.sendEmail({
      to,
      subject,
      html,
      text,
      from,
      replyTo,
    });

    return res.json({ ok: true, id: out?.id ?? null });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? "Unknown error" });
  }
});

// -----------------------------
// GET /v1/email/:id
// -----------------------------
emailRouter.get("/:id", async (req, res) => {
  try {
    const id = String(req.params?.id ?? "").trim();
    if (!id) return res.status(400).json({ ok: false, error: "Missing email id" });

    const email = await resend.getEmail(id);
    return res.json({ ok: true, email });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? "Unknown error" });
  }
});