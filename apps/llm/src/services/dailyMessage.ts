import { geminiJson } from "./gemini.js";

export type DailyMessageInput = {
  todayIso: string;
  safeToSpendToday: number;
  caps: Record<string, number>;
  upcoming?: Array<{
    normalizedMerchant: string;
    expectedIsoDate: string;
    expectedAmount: number;
    daysUntil: number;
    confidence?: number;
  }>;
  tone?: "friendly" | "strict" | "playful";
};

export type DailyMessageOutput = {
  message: string;
  source: "gemini";
  model: string;
};

export async function generateDailyMessage(input: DailyMessageInput): Promise<DailyMessageOutput> {
  const tone = input.tone ?? "friendly";

  // Pick top 3 caps
  const topCaps = Object.entries(input.caps ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => ({ category: k, cap: round2(v) }));

  // Upcoming bills within 30 days
  const upcomingSoon = (input.upcoming ?? [])
    .filter(b => Number.isFinite(b.daysUntil) && b.daysUntil >= 0 && b.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 3)
    .map(b => ({
      merchant: b.normalizedMerchant,
      daysUntil: b.daysUntil,
      amount: round2(b.expectedAmount),
      date: b.expectedIsoDate
    }));

  const budget = round2(input.safeToSpendToday);

  const mood =
    budget <= 5 ? "tight" : budget <= 15 ? "normal" : "relaxed";

  const system = `
You are a finance coach inside a budgeting app.
Write a SINGLE short iMessage-style message (max 450 characters).
Must be easy English, no jargon.
Return ONLY JSON: {"message": "..."}
Rules:
- Include today's safe budget as a dollar amount.
- Include 2-3 category caps (top categories).
- If upcomingSoon has items, mention at most 2 upcoming bills (merchant + daysUntil).
- End with 1 actionable suggestion.
- Tone: ${tone}. Mood: ${mood}.
- Use 0-2 emojis max.
`;

  const user = JSON.stringify(
    {
      todayIso: input.todayIso,
      safeToSpendToday: budget,
      topCaps,
      upcomingSoon
    },
    null,
    2
  );

  const out = await geminiJson<{ message: string }>({
    system,
    user,
    model: "gemini-2.5-flash",
    timeoutMs: 12000
  });

  const msg = String(out.message ?? "").trim();
  return { message: msg, source: "gemini", model: "gemini-2.5-flash" };
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
