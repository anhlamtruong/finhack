export type CategoryCapsResponse = {
  totalDailyBudget: number;
  caps: Record<string, number>;
  explanation: string;
};

const DEFAULT_WEIGHTS: Record<string, number> = {
  coffee: 0.2,
  dining: 0.35,
  groceries: 0.25,
  transport: 0.2
};

export function computeCategoryCaps(totalDailyBudget: number, weights?: Record<string, number>): CategoryCapsResponse {
  const budget = Math.max(0, Number(totalDailyBudget) || 0);
  const w = normalizeWeights(weights ?? DEFAULT_WEIGHTS);

  const caps: Record<string, number> = {};
  for (const [cat, frac] of Object.entries(w)) {
    caps[cat] = round2(budget * frac);
  }

  return {
    totalDailyBudget: round2(budget),
    caps,
    explanation: `Split ${round2(budget)}/day into category caps using weights: ${Object.entries(w)
      .map(([k,v]) => `${k}=${Math.round(v*100)}%`)
      .join(", ")}.`
  };
}

function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const cleaned: Record<string, number> = {};
  for (const [k, v] of Object.entries(weights)) {
    const x = Number(v);
    if (Number.isFinite(x) && x > 0) cleaned[k] = x;
  }
  const sum = Object.values(cleaned).reduce((a,b) => a+b, 0);
  if (sum <= 0) return DEFAULT_WEIGHTS;

  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(cleaned)) out[k] = v / sum;
  return out;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
