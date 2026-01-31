import { Router } from "express";
import { getMongo } from "../lib/mongo";

/**
 * MongoDB connectivity routes.
 */
const router = Router();

/**
 * Simple ping endpoint to verify Mongo connectivity.
 */
router.get("/v1/mongo/ping", async (_req, res) => {
  const { db } = await getMongo();
  const r = await db.command({ ping: 1 });
  res.json({ ok: true, ping: r.ok });
});

export default router;