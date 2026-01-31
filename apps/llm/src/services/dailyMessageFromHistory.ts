import { getHistory } from "../store/historyStore";
import { callGeminiText } from "./gemini"; // use your existing Gemini caller (or rename to match your project)

function isoToday() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

export async function generateDailyMessageFromHistory(input: {
  userId: string;
  todayIso?: string;
  windowDays?: number;
  tone?: string;
}) {
  const todayIso = input.todayIso ?? isoToday();
  const windowDays = input.windowDays ?? 30;
  const tone = input.tone ?? "friendly";

  // fetch last N days (simple string compare works for YYYY-MM-DD)
  const fromIso = (() => {
    const d = new Date(todayIso + "T00:00:00");
    d.setDate(d.getDate() - windowDays);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  })();

  const hist = getHistory(input.userId, { from: fromIso, to: todayIso, limit: 5000 });

  const spentTotal = sum(hist.map((t) => t.amount));
  const avgDaily = spentTotal / Math.max(1, windowDays);

  // spend today
  const todayTx = hist.filter((t) => t.isoDate === todayIso);
  const spentToday = sum(todayTx.map((t) => t.amount));

  // top categories in window
  const byCat = new Map<string, number>();
  for (const t of hist) byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
  const topCats = Array.from(byCat.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, amount]) => ({ category, amount: Number(amount.toFixed(2)) }));

  // simple “safeToSpendToday” heuristic: average daily spend - already spent today
  const safeToSpendToday = Math.max(0, Number((avgDaily - spentToday).toFixed(2)));

  const prompt = `
You are a budgeting coach for a personal finance app.
Write ONE short message (max 2 sentences) in a ${tone} tone.

Context:
- Date: ${todayIso}
- Last ${windowDays} days total spend: $${spentTotal.toFixed(2)}
- Average daily spend (last ${windowDays} days): $${avgDaily.toFixed(2)}
- Spent today so far: $${spentToday.toFixed(2)}
- Safe to spend today (heuristic): $${safeToSpendToday.toFixed(2)}
- Top categories this period: ${topCats.map(c => `${c.category}($${c.amount})`).join(", ")}

Rules:
- Be practical (one actionable suggestion).
- No future bill predictions.
- Do not mention internal heuristics or that you're an AI.
Return only the message text.
`.trim();

  const msg = await callGeminiText(prompt);

  return {
    message: msg,
    source: "gemini",
    model: "gemini-2.5-flash",
    debug: {
      todayIso,
      windowDays,
      fromIso,
      count: hist.length,
      spentTotal: Number(spentTotal.toFixed(2)),
      avgDaily: Number(avgDaily.toFixed(2)),
      spentToday: Number(spentToday.toFixed(2)),
      safeToSpendToday,
      topCats,
    },
  };
}