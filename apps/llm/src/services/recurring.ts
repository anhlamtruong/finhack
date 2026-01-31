import { normalizeMerchant } from "../utils/normalizeMerchant.js";

export type TxLike = {
  id?: string;
  merchant?: string;
  name?: string;
  description?: string;
  amount: number;
  isoDate: string; // YYYY-MM-DD
  categoryId?: string;
};

export type Cadence = "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly" | "irregular";

export type RecurringHit = {
  normalizedMerchant: string;
  cadence: Cadence;
  count: number;
  avgAmount: number;
  stdAmount: number;
  lastIsoDate: string;
  nextExpectedIsoDate: string | null;
  confidence: number; // 0..1
  explanation: string;
};

type CadenceDef = {
  cadence: Exclude<Cadence, "irregular">;
  periodDays: number;
  toleranceDays: number;
};

const CADENCES: CadenceDef[] = [
  { cadence: "weekly", periodDays: 7, toleranceDays: 1.5 },
  { cadence: "biweekly", periodDays: 14, toleranceDays: 2.5 },
  { cadence: "monthly", periodDays: 30, toleranceDays: 5.0 },
  { cadence: "quarterly", periodDays: 90, toleranceDays: 10.0 },
  { cadence: "yearly", periodDays: 365, toleranceDays: 20.0 }
];

export function detectRecurring(transactions: TxLike[]): RecurringHit[] {
  const cleaned = transactions
    .filter(t => Number.isFinite(t.amount) && !!t.isoDate)
    .map(t => ({
      ...t,
      isoDate: String(t.isoDate).slice(0, 10),
      normalizedMerchant: normalizeMerchant(
        String(t.merchant ?? t.name ?? t.description ?? "").trim()
      )
    }))
    .filter(t => t.normalizedMerchant.length > 0);

  const byMerchant = new Map<string, typeof cleaned>();
  for (const tx of cleaned) {
    const k = tx.normalizedMerchant;
    if (!byMerchant.has(k)) byMerchant.set(k, []);
    byMerchant.get(k)!.push(tx);
  }

  const results: RecurringHit[] = [];

  for (const [merchant, txs] of byMerchant.entries()) {
    if (txs.length < 3) continue;

    const sorted = [...txs].sort((a, b) => isoToMs(a.isoDate) - isoToMs(b.isoDate));

    const deltas: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const d = (isoToMs(sorted[i].isoDate) - isoToMs(sorted[i - 1].isoDate)) / 86400000;
      if (Number.isFinite(d) && d > 0) deltas.push(d);
    }
    if (deltas.length < 2) continue;

    const medianDelta = median(deltas);
    const best = pickBestCadence(medianDelta);
    if (!best) continue;

    const within = deltas.filter(d => Math.abs(d - best.periodDays) <= best.toleranceDays).length;
    const deltaConsistency = within / deltas.length;

    const amounts = sorted.map(t => Math.abs(t.amount));
    const avgAmount = mean(amounts);
    const stdAmount = stddev(amounts);
    const cv = avgAmount > 0 ? stdAmount / avgAmount : 1;
    const amountStability = clamp01(1 - cv);

    const countBoost = clamp01((sorted.length - 3) / 5);

    const confidence =
      clamp01(0.55 * deltaConsistency + 0.25 * amountStability + 0.20 * countBoost);

    if (confidence < 0.65) continue;

    const lastIso = sorted[sorted.length - 1].isoDate;
    const nextIso = addNextByCadence(lastIso, best.cadence);

    results.push({
      normalizedMerchant: merchant,
      cadence: best.cadence,
      count: sorted.length,
      avgAmount: round2(avgAmount),
      stdAmount: round2(stdAmount),
      lastIsoDate: lastIso,
      nextExpectedIsoDate: nextIso,
      confidence: round2(confidence),
      explanation: explanation(best.cadence, sorted.length, deltaConsistency, amountStability)
    });
  }

  results.sort((a, b) => b.confidence - a.confidence);
  return results;
}

function pickBestCadence(medianDelta: number): CadenceDef | null {
  let best: { def: CadenceDef; score: number } | null = null;

  for (const def of CADENCES) {
    const dist = Math.abs(medianDelta - def.periodDays);
    const score = clamp01(1 - dist / def.toleranceDays);
    if (!best || score > best.score) best = { def, score };
  }

  if (!best || best.score < 0.2) return null;
  return best.def;
}

function explanation(cadence: Cadence, count: number, deltaConsistency: number, amountStability: number): string {
  const cons = Math.round(deltaConsistency * 100);
  const stab = Math.round(amountStability * 100);
  return `${count} charges with ~${cadence} pattern; ${cons}% date consistency; ${stab}% amount stability.`;
}

function isoToMs(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

function addNextByCadence(iso: string, cadence: Cadence): string | null {
  if (!iso) return null;
  if (cadence === "weekly") return addDaysIso(iso, 7);
  if (cadence === "biweekly") return addDaysIso(iso, 14);
  if (cadence === "monthly") return addMonthsIso(iso, 1);
  if (cadence === "quarterly") return addMonthsIso(iso, 3);
  if (cadence === "yearly") return addYearsIso(iso, 1);
  return null;
}

function addDaysIso(iso: string, days: number): string | null {
  const ms = isoToMs(iso);
  const out = new Date(ms + days * 86400000);
  return out.toISOString().slice(0, 10);
}

function addMonthsIso(iso: string, monthsToAdd: number): string | null {
  const [y0, m0, d0] = iso.split("-").map(Number);
  if (!y0 || !m0 || !d0) return null;

  let y = y0;
  let m = m0 - 1 + monthsToAdd; // 0-based
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;

  const dim = daysInMonthUTC(y, m);
  const d = Math.min(d0, dim);

  const out = new Date(Date.UTC(y, m, d));
  return out.toISOString().slice(0, 10);
}

function addYearsIso(iso: string, yearsToAdd: number): string | null {
  const [y0, m0, d0] = iso.split("-").map(Number);
  if (!y0 || !m0 || !d0) return null;

  const y = y0 + yearsToAdd;
  const m = m0 - 1;
  const dim = daysInMonthUTC(y, m);
  const d = Math.min(d0, dim);

  const out = new Date(Date.UTC(y, m, d));
  return out.toISOString().slice(0, 10);
}

function daysInMonthUTC(year: number, month0: number): number {
  // month0: 0=Jan
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((acc, x) => acc + (x - m) * (x - m), 0) / (xs.length - 1);
  return Math.sqrt(v);
}

function median(xs: number[]): number {
  const a = [...xs].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 === 0 ? (a[mid - 1] + a[mid]) / 2 : a[mid];
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
