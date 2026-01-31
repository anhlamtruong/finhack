import type { Cadence, RecurringHit } from "./recurring.js";

export type UpcomingBill = {
  normalizedMerchant: string;
  cadence: Cadence;
  expectedIsoDate: string;
  expectedAmount: number;
  confidence: number;
  daysUntil: number;
  explanation: string;
};

export function upcomingBillsFromRecurring(
  recurring: RecurringHit[],
  opts?: { todayIso?: string; horizonDays?: number }
): UpcomingBill[] {
  const todayIso = (opts?.todayIso ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const horizonDays = Math.max(1, Math.min(365, opts?.horizonDays ?? 30));

  const todayMs = isoToMs(todayIso);
  const endMs = todayMs + horizonDays * 86400000;

  const out: UpcomingBill[] = [];

  for (const r of recurring) {
    if (!r.nextExpectedIsoDate) continue;

    // Generate all occurrences within horizon
    let nextIso: string | null = r.nextExpectedIsoDate;
    let guard = 0;

    while (nextIso && guard++ < 60) {
      const nextMs = isoToMs(nextIso);
      if (nextMs < todayMs) {
        nextIso = addNextByCadence(nextIso, r.cadence);
        continue;
      }
      if (nextMs > endMs) break;

      out.push({
        normalizedMerchant: r.normalizedMerchant,
        cadence: r.cadence,
        expectedIsoDate: nextIso,
        expectedAmount: round2(r.avgAmount),
        confidence: round2(r.confidence),
        daysUntil: Math.round((nextMs - todayMs) / 86400000),
        explanation: r.explanation
      });

      // weekly/biweekly can produce multiple events inside horizon
      nextIso = addNextByCadence(nextIso, r.cadence);
    }
  }

  out.sort((a, b) => a.daysUntil - b.daysUntil || b.confidence - a.confidence);
  return out;
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
  let m = m0 - 1 + monthsToAdd;
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
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
