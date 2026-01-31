import fs from "node:fs";
import path from "node:path";

export type Tx = {
  id: string;
  userId: string;
  isoDate: string;          // YYYY-MM-DD
  merchant: string;
  amount: number;           // positive number = spend
  category: string;         // e.g. "Dining"
  accountId?: string;
  notes?: string;
};

const FIXTURE_PATH = path.join(
  process.cwd(),
  "data",
  "fixtures",
  "transactions_history.json"
);

let mem: Tx[] | null = null;

export function loadHistory(): Tx[] {
  if (mem) return mem;
  if (!fs.existsSync(FIXTURE_PATH)) return [];
  const raw = fs.readFileSync(FIXTURE_PATH, "utf-8");
  const parsed = JSON.parse(raw) as { ok?: boolean; data?: Tx[] } | Tx[];
  mem = Array.isArray(parsed) ? parsed : (parsed.data ?? []);
  return mem!;
}

export function getHistory(userId: string, opts?: { from?: string; to?: string; limit?: number }) {
  const all = loadHistory().filter((t) => t.userId === userId);

  const from = opts?.from;
  const to = opts?.to;
  let rows = all;

  if (from) rows = rows.filter((t) => t.isoDate >= from);
  if (to) rows = rows.filter((t) => t.isoDate <= to);

  // newest first
  rows = rows.sort((a, b) => (a.isoDate < b.isoDate ? 1 : -1));

  const limit = opts?.limit ?? 200;
  return rows.slice(0, limit);
}

export function upsertMany(txs: Tx[]) {
  const cur = loadHistory();
  const byId = new Map(cur.map((t) => [t.id, t]));
  for (const t of txs) byId.set(t.id, t);
  mem = Array.from(byId.values());
  return mem;
}