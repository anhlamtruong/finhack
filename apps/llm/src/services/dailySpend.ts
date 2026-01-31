import type { UpcomingBill } from "./upcomingBills.js";

export type DailySpendRequest = {
  todayIso: string;          // YYYY-MM-DD
  balanceNow: number;        // available cash user can spend
  goalAmount: number;        // how much user wants to save
  goalDueIso: string;        // YYYY-MM-DD
  alreadySaved?: number;     // optional
  upcomingBills?: UpcomingBill[]; // optional (from upcoming-bills endpoint)
  horizonDays?: number;      // optional, default 30
};

export type DailySpendResponse = {
  safeToSpendToday: number;
  daysLeft: number;
  billReserve: number;
  goalRemaining: number;
  dailySaveNeeded: number;
  warnings: string[];
  explanation: string;
};

export function computeDailySpendLimit(req: DailySpendRequest): DailySpendResponse {
  const todayIso = req.todayIso.slice(0, 10);
  const dueIso = req.goalDueIso.slice(0, 10);

  const todayMs = isoToMs(todayIso);
  const dueMs = isoToMs(dueIso);

  const daysLeft = Math.max(0, Math.ceil((dueMs - todayMs) / 86400000));
  const horizonDays = Math.max(1, Math.min(365, req.horizonDays ?? 30));

  const alreadySaved = Math.max(0, Number(req.alreadySaved ?? 0));
  const goalRemaining = Math.max(0, Number(req.goalAmount) - alreadySaved);

  const upcoming = req.upcomingBills ?? [];
  const billReserve = round2(
    upcoming
      .filter(b => Number.isFinite(b.expectedAmount))
      .reduce((sum, b) => sum + Math.max(0, b.expectedAmount), 0)
  );

  const warnings: string[] = [];
  if (daysLeft === 0 && goalRemaining > 0) warnings.push("Goal due date is today or past due.");
  if (req.balanceNow < 0) warnings.push("balanceNow is negative.");

  const balanceNow = Number(req.balanceNow);

  // Savings pressure: how much to set aside per day (toward the goal)
  const dailySaveNeeded = daysLeft > 0 ? round2(goalRemaining / daysLeft) : round2(goalRemaining);

  // Reserve money for bills + goal, then spread remaining across time window
  const safePool = balanceNow - billReserve - goalRemaining;

  // Spend horizon: don’t divide by a giant number if goal due is far away;
  // use min(daysLeft, horizonDays) so the daily number is meaningful.
  const spendDays = Math.max(1, Math.min(daysLeft || horizonDays, horizonDays));
  let safeToSpendToday = safePool / spendDays;

  if (!Number.isFinite(safeToSpendToday)) safeToSpendToday = 0;
  safeToSpendToday = round2(Math.max(0, safeToSpendToday));

  if (safePool < 0) {
    warnings.push("Not enough balance to cover upcoming bills + goal.");
  }

  const explanation =
    `Balance ${round2(balanceNow)} - bills reserve ${billReserve} - goal remaining ${goalRemaining} ` +
    `= spendable pool ${round2(safePool)}. Spread across ${spendDays} day(s) -> ${safeToSpendToday}/day.`;

  return {
    safeToSpendToday,
    daysLeft,
    billReserve,
    goalRemaining: round2(goalRemaining),
    dailySaveNeeded,
    warnings,
    explanation
  };
}

function isoToMs(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
