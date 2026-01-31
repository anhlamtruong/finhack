// apps/llm/src/services/salesSuggest.ts

function uniq(xs: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    const k = x.trim().toLowerCase();
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

/**
 * For v1: simple curated + finance-aligned suggestions.
 * Later: mix in user purchase categories + wishlist + goals.
 */
export function buildWomenFirstSuggestions(args?: {
  goal?: "save" | "health" | "career" | "selfcare" | "home" | "fitness" | "unknown";
  budgetMax?: number;
}) {
  const budgetHint =
    typeof args?.budgetMax === "number" && Number.isFinite(args.budgetMax) ? ` under $${args.budgetMax}` : "";

  const base = [
    `period essentials kit${budgetHint}`,
    `menstrual cup beginner friendly${budgetHint}`,
    `organic cotton pads fragrance free${budgetHint}`,
    `comfortable wireless bra supportive${budgetHint}`,
    `women-owned skincare gentle cleanser${budgetHint}`,
    `women-owned activewear leggings squat proof${budgetHint}`,
    `work tote bag women-owned brand${budgetHint}`,
    `interview outfit women-owned brand${budgetHint}`,
    `book by women authors personal finance${budgetHint}`,
    `budget-friendly wedding guest dress${budgetHint}`,
    `glasses frames women-owned brand${budgetHint}`,
    `safe razor sensitive skin women-owned${budgetHint}`,
  ];

  // Light goal-based bias
  const goal = args?.goal ?? "unknown";
  const goalAdds: Record<string, string[]> = {
    save: [
      `price drop alerts women essentials`,
      `best value period products bulk`,
      `dup es for popular makeup`,
    ],
    health: [
      `period pain relief heat patch`,
      `iron supplements women (check label)`,
      `sleep mask blackout`,
    ],
    career: [
      `women-owned laptop bag`,
      `standing desk converter compact`,
      `blue light glasses women-owned`,
    ],
    selfcare: [
      `journaling kit women-owned brand`,
      `aromatherapy lavender roll-on`,
      `hair mask deep conditioning`,
    ],
    home: [
      `women-owned home organization`,
      `ergonomic chair cushion`,
      `kitchen essentials minimal`,
    ],
    fitness: [
      `sports bra high impact supportive`,
      `yoga mat non slip`,
      `walking shoes women`,
    ],
    unknown: [],
  };

  return uniq([...base, ...(goalAdds[goal] ?? [])]).slice(0, 12);
}

/**
 * Rewrite user query to emphasize women-first shopping.
 * This keeps it subtle (not spammy) and still returns good coverage.
 */
export function womenFocusQuery(q: string, opts?: { values?: string[] }) {
  const values = opts?.values?.length
    ? opts.values
    : ["women-owned", "women-led", "ethical", "sustainable"];

  // Add only 1–2 value keywords to avoid wrecking relevance.
  const add = values.slice(0, 2).join(" ");
  const cleaned = q.trim();
  if (!cleaned) return cleaned;

  // If user already typed women-owned etc, don't duplicate.
  const lc = cleaned.toLowerCase();
  if (lc.includes("women-owned") || lc.includes("women owned") || lc.includes("women-led") || lc.includes("female-founded")) {
    return cleaned;
  }

  return `${cleaned} ${add}`.trim();
}