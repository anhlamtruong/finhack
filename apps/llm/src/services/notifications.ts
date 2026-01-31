import express from "express";
import { sendEmail } from "../services/resend.js";

export const notificationsRouter = express.Router();

/**
 * POST /v1/notify/email
 * Body: { to, subject, text?, html?, from?, replyTo? }
 */
notificationsRouter.post("/email", async (req, res) => {
  try {
    const to = req.body?.to;
    const subject = req.body?.subject;

    if (!to || !subject) {
      return res.status(400).json({ ok: false, error: "Missing 'to' or 'subject'" });
    }

    const text = typeof req.body?.text === "string" ? req.body.text : undefined;
    const html = typeof req.body?.html === "string" ? req.body.html : undefined;

    if (!text && !html) {
      return res.status(400).json({ ok: false, error: "Provide at least 'text' or 'html'" });
    }

    const resp = await sendEmail({
      to,
      subject,
      text,
      html,
      from: typeof req.body?.from === "string" ? req.body.from : undefined,
      replyTo: typeof req.body?.replyTo === "string" ? req.body.replyTo : undefined,
    });

    // Resend SDK returns { data, error } shape
    if ((resp as any)?.error) {
      return res.status(500).json({ ok: false, error: (resp as any).error?.message ?? "Resend error" });
    }

    return res.json({
      ok: true,
      id: (resp as any)?.data?.id ?? null,
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? "Unknown error" });
  }
});