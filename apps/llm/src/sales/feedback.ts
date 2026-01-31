// apps/llm/src/sales/feedback.ts
import { nowIso, type FeedbackEvent } from "./utils.js";

/**
 * Store feedback. v1:
 * - If Mongo is available (apps/llm/src/lib/mongo.ts), write to collection
 * - Otherwise just log (still useful while waiting on infra)
 */
export async function recordFeedback(ev: FeedbackEvent): Promise<{ stored: boolean }> {
  const event: FeedbackEvent = {
    ...ev,
    createdAtIso: ev.createdAtIso ?? nowIso(),
  };

  // basic validation
  if (!event.userId || typeof event.userId !== "string") throw new Error("[sales] Missing userId");
  if (!event.action) throw new Error("[sales] Missing action");

  // Try Mongo if available
  try {
    const mod: any = await import("../lib/mongo.js"); // optional
    const getMongo = mod?.getMongo;
    if (typeof getMongo !== "function") throw new Error("mongo helper not found");

    const mongo = await getMongo();
    const db = mongo.db;
    if (!db) throw new Error("mongo db missing");

    await db.collection("sales_feedback").insertOne(event as any);
    return { stored: true };
  } catch {
    // fallback to log (do not crash feature)
    console.log("[sales] feedback", event);
    return { stored: false };
  }
}