import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// dist/scripts -> dist -> (../) -> apps/llm/.env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { getMongo, closeMongo } from "../lib/mongo.js";

async function main() {
  const { db } = await getMongo();

  await db.collection("user_profiles").createIndex({ userId: 1 }, { unique: true });
  await db.collection("user_memory").createIndex({ userId: 1, createdAt: -1 });
  await db.collection("user_insights").createIndex({ userId: 1, createdAt: -1 });
  await db.collection("kb_docs").createIndex({ source: 1, docId: 1 }, { unique: true });

  console.log("Mongo indexes okok");
  await closeMongo();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});