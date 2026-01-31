import { geminiJson } from "./gemini.js";
import { getUserMerchantCategory } from "../store/merchantMap.js";
import { normalizeMerchant } from "../utils/normalizeMerchant.js";

const DEBUG_TAG = "categorize-v3-memory-first";

export type CategorizeInput = {
  userId: string;
  accountId: string;
  transaction: {
    id: string;
    name?: string;
    merchant?: string;
    description?: string;
    amount: number;
    isoDate: string;
  };
};

export type CategorizeOutput = {
  transactionId: string;
  normalizedMerchant: string;
  categoryId: string;
  confidence: number;
  needsUserConfirmation: boolean;
  explanation: string;
  source: "memory" | "gemini";
  debugTag: string;
  memorySource?: "user" | "legacy";
};

const CATEGORY_TAXONOMY = [
  "groceries",
  "dining",
  "coffee",
  "transport",
  "gas",
  "rent",
  "utilities",
  "subscriptions",
  "shopping",
  "health",
  "travel",
  "income",
  "transfer",
  "other"
] as const;

type CategoryId = (typeof CATEGORY_TAXONOMY)[number];
const CONFIRM_THRESHOLD = 0.7;

export async function categorizeTransaction(input: CategorizeInput): Promise<CategorizeOutput> {
  const rawMerchant = (input.transaction.merchant ?? input.transaction.name ?? "").trim();
  const rawDesc = (input.transaction.description ?? "").trim();
  const fallback = rawMerchant || rawDesc || "Unknown";
  const normalized = normalizeMerchant(fallback);

  const mem = await getUserMerchantCategory(input.userId.trim(), normalized);
  if (mem) {
    return {
      transactionId: input.transaction.id,
      normalizedMerchant: normalized,
      categoryId: mem.categoryId,
      confidence: 0.99,
      needsUserConfirmation: false,
      explanation:
        mem.source === "user"
          ? "Learned from your past categorization."
          : "Learned from existing merchant mapping.",
      source: "memory",
      debugTag: DEBUG_TAG,
      memorySource: mem.source
    };
  }

  // Gemini fallback
  const system = `
Return ONLY valid JSON:
{
  "normalizedMerchant": string,
  "categoryId": one of ${JSON.stringify(CATEGORY_TAXONOMY)},
  "confidence": number (0..1),
  "explanation": string (<= 20 words)
}
Rules:
- If ambiguous, output categoryId="other" and confidence <= 0.6.
- If salary/payroll -> "income"
- If transfer/cc payment -> "transfer"
`;

  const user = `
Transaction:
- merchant: ${rawMerchant || "N/A"}
- description: ${rawDesc || "N/A"}
- amount: ${input.transaction.amount}
- isoDate: ${input.transaction.isoDate}
Pre-normalized merchant suggestion: ${normalized}
`;

  const out = await geminiJson<{
    normalizedMerchant: string;
    categoryId: string;
    confidence: number;
    explanation: string;
  }>({
    system,
    user,
    model: "gemini-2.5-flash",
    timeoutMs: 15000
  });

  const normalizedMerchant = normalizeMerchant(String(out.normalizedMerchant ?? "")) || normalized;
  const categoryId = coerceCategoryId(out.categoryId);
  const confidence = clamp01(Number(out.confidence));
  const explanation = String(out.explanation ?? "Categorized by model.").slice(0, 200);

  return {
    transactionId: input.transaction.id,
    normalizedMerchant,
    categoryId,
    confidence,
    needsUserConfirmation: confidence < CONFIRM_THRESHOLD,
    explanation,
    source: "gemini",
    debugTag: DEBUG_TAG
  };
}

function coerceCategoryId(x: unknown): CategoryId {
  const s = String(x ?? "other").toLowerCase().trim();
  return (CATEGORY_TAXONOMY as readonly string[]).includes(s) ? (s as CategoryId) : "other";
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
