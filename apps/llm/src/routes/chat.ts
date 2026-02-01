import { Router } from "express";

export const chatRouter = Router();

type ChatReq = {
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  context?: any;
};

function safeStr(x: any) {
  return typeof x === "string" ? x : x == null ? "" : String(x);
}

function mkAnswer(kind: "employee" | "support", req: ChatReq) {
  const message = safeStr(req.message).trim();
  const filters = req?.context?.filters ?? null;
  const userId = req?.context?.user_id ?? null;

  const header = kind === "employee" ? "👩‍💼 Employee Assistant" : "🧑‍💻 Customer Support Assistant";

  return {
    ok: true,
    answer:
      `${header}\n\n` +
      `Got your message: **${message || "(empty)"}**\n\n` +
      `Context:\n` +
      `- filters: ${filters ? JSON.stringify(filters) : "none"}\n` +
      `- user_id: ${userId ?? "none"}\n\n` +
      `Next: wire this to Gemini + transactions evidence.`,
    citations: [],
    actions: [],
  };
}

chatRouter.post("/employee", async (req, res) => {
  try {
    const body = (req.body ?? {}) as ChatReq;
    const message = safeStr(body.message).trim();
    if (!message) return res.status(400).json({ ok: false, error: "Missing message" });
    return res.json(mkAnswer("employee", body));
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? "employee chat failed" });
  }
});

chatRouter.post("/support", async (req, res) => {
  try {
    const body = (req.body ?? {}) as ChatReq;
    const message = safeStr(body.message).trim();
    if (!message) return res.status(400).json({ ok: false, error: "Missing message" });
    return res.json(mkAnswer("support", body));
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? "support chat failed" });
  }
});