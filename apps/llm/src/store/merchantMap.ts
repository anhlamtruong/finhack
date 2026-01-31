import fs from "node:fs/promises";

type MerchantMap = Record<
  string,
  { categoryId: string; confidence: number; updatedAt: string }
>;

// Supports both:
// - per-user key: "u1:STARBUCKS"
// - legacy key: "STARBUCKS"
const DATA_PATH = new URL("../../data/merchant_map.json", import.meta.url);

// In-memory overlay (always works even if disk is full)
let memMap: MerchantMap = Object.create(null);

// Track whether disk writes are currently failing (e.g., ENOSPC)
let memoryOnly = false;
let lastDiskError: string | null = null;

// Simple in-process mutex to avoid concurrent writes
let writeLock: Promise<void> = Promise.resolve();

async function readDiskMap(): Promise<MerchantMap> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw) as MerchantMap;
    return parsed ?? {};
  } catch {
    return {};
  }
}

// Merge disk + memory overlay (memory wins)
async function readMap(): Promise<MerchantMap> {
  const disk = await readDiskMap();
  return { ...disk, ...memMap };
}

async function writeDiskMap(map: MerchantMap): Promise<void> {
  writeLock = writeLock.then(async () => {
    await fs.writeFile(DATA_PATH, JSON.stringify(map, null, 2), "utf8");
  });
  return writeLock;
}

function makeKey(userId: string, normalizedMerchant: string) {
  return `${userId}:${normalizedMerchant}`;
}

export function getStorageStatus() {
  return {
    dataPath: DATA_PATH.pathname,
    mode: memoryOnly ? ("memory-only" as const) : ("disk" as const),
    lastDiskError
  };
}

export async function getUserMerchantCategory(
  userId: string,
  normalizedMerchant: string
): Promise<{ categoryId: string; source: "user" | "legacy" } | null> {
  if (!normalizedMerchant) return null;

  const u = String(userId ?? "").trim();
  const m = String(normalizedMerchant ?? "").trim().toUpperCase();

  const map = await readMap();

  // 1) per-user key first
  if (u) {
    const k = makeKey(u, m);
    const hit = map[k]?.categoryId;
    if (hit) return { categoryId: hit, source: "user" };
  }

  // 2) fallback to legacy (global) key
  const legacyHit = map[m]?.categoryId;
  if (legacyHit) return { categoryId: legacyHit, source: "legacy" };

  return null;
}

export async function upsertUserMerchantCategory(
  userId: string,
  normalizedMerchant: string,
  categoryId: string,
  confidence = 1
): Promise<void> {
  const u = String(userId ?? "").trim();
  const m = String(normalizedMerchant ?? "").trim().toUpperCase();
  if (!u || !m) return;

  const k = makeKey(u, m);
  const record = {
    categoryId,
    confidence,
    updatedAt: new Date().toISOString()
  };

  // Always update memory so app keeps working even if disk is full
  memMap[k] = record;

  // Try to persist to disk. If ENOSPC, keep running memory-only.
  try {
    const map = await readDiskMap();
    map[k] = record;
    await writeDiskMap(map);

    // if disk write succeeded, clear memory-only flag
    memoryOnly = false;
    lastDiskError = null;
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    lastDiskError = msg;

    if (msg.includes("ENOSPC")) {
      memoryOnly = true;
      console.warn("[merchantMap] ENOSPC: running in memory-only mode until disk frees up.");
      return;
    }
    throw e;
  }
}
