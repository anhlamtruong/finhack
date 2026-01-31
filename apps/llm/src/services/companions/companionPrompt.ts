import { formatPrompt } from "../../utils/promptFormatter";

/**
 * Build the Gemini prompt for companion configuration generation.
 * Returns a system guardrail string + user prompt payload.
 */
export function buildCompanionPrompt(args: {
  userId: string;
  prompt: string;
}) {
  // Force JSON-only output so the API can parse reliably.
  const system = "Return ONLY valid JSON. No markdown, no code fences, no prose.";
  const userPrompt = formatPrompt({
    role: "Finance Tamagotchi companion designer (RPG style)",
    task: "Generate a companion config that fits the prompt.",
    input: {
      userId: args.userId,
      prompt: args.prompt,
    },
    context: {
      ts: new Date().toISOString(),
    },
    rules: [
      "Required fields: name, archetype, visuals{primaryColor, accentColor?, accessory?}.",
      "assets{baby{idle, hungry?, sleepy?, happy?}, adult{idle, hungry?, sleepy?, happy?}, mythic{idle, hungry?, sleepy?, happy?}}.",
      "personality{tone, backstory, financialFocus}, initialStats{energy, hunger}.",
      "Visuals must be richly descriptive with concrete adjectives (materials, textures, motifs).",
      "Avoid vague descriptors; keep the same visual identity across stages.",
      "Keep colors in hex. Keep backstory short (<=30 words).",
    ],
    output: {
      name: "string",
      archetype: "string",
      visuals: {
        primaryColor: "#RRGGBB",
        accentColor: "#RRGGBB?",
        accessory: "string?",
      },
      assets: {
        baby: { idle: "string?", hungry: "string?", sleepy: "string?", happy: "string?" },
        adult: { idle: "string?", hungry: "string?", sleepy: "string?", happy: "string?" },
        mythic: { idle: "string?", hungry: "string?", sleepy: "string?", happy: "string?" },
      },
      personality: {
        tone: "string",
        backstory: "string",
        financialFocus: "string",
      },
      initialStats: { energy: "number", hunger: "number" },
    },
  });

  return { system, userPrompt };
}

/**
 * Build the Gemini prompt for companion summary analysis.
 * Returns a system guardrail string + user prompt payload.
 */
export function buildCompanionSummaryPrompt(args: {
  message: string;
  context: Record<string, unknown>;
}) {
  const system = "Return ONLY valid JSON. No markdown, no prose, no code fences.";
  const userPrompt = formatPrompt({
    role: "Supportive finance companion",
    task:
      "Analyze the provided screen data and return a concise summary with actionable insights.",
    input: {
      message: args.message,
      context: args.context,
    },
    context: {
      ts: new Date().toISOString(),
    },
    rules: [
      "summary must be 1-2 sentences and include key numbers when available.",
      "Format currency using $ with comma separators and 2 decimals when available (e.g., $1,234.56).",
      "highlights, risks, suggests must be arrays of short strings.",
      "Keep each list item under 24 words.",
      "If data is missing, be transparent and keep it brief.",
      "animation should be one of: idle,hungry,dirty,sleepy,excited,scared,proud.",
      "tone should be one of: warm, supportive, calm, upbeat.",
    ],
    output: {
      summary: "string",
      highlights: ["string"],
      risks: ["string"],
      suggests: ["string"],
      tone: "string",
      animation: "string",
    },
  });

  return { system, userPrompt };
}
