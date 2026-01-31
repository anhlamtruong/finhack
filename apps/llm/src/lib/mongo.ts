import { Db, MongoClient } from "mongodb";

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

/**
 * Returns a connected MongoClient + Db handle.
 *
 * Notes:
 * - Do NOT use `client.topology` (removed/unstable across driver versions).
 * - `connect()` is safe to call; we cache a single connect promise.
 * - We read env vars at call-time (not import-time) to avoid crashing the app
 *   when Mongo is optional in some environments.
 */
export async function getMongo(): Promise<{ client: MongoClient; db: Db }> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI");

  const dbName = process.env.MONGODB_DB || "chuchube";

  // Reuse existing connected client if present.
  if (client) {
    return { client, db: client.db(dbName) };
  }

  // Create/connect once, share the same promise across concurrent callers.
  if (!clientPromise) {
    client = new MongoClient(uri, {
      // Atlas + modern driver best-practice: enable Server API to reduce
      // handshake quirks/deprecations across driver versions.
      serverApi: { version: "1", strict: true, deprecationErrors: true },

      // Sensible defaults for local dev + avoids hanging forever when TLS/network is broken.
      connectTimeoutMS: 8000,
      socketTimeoutMS: 12000,

      // Keep pool modest for local dev.
      maxPoolSize: 10,

      // Helps identify your app in Atlas logs/metrics.
      appName: process.env.MONGODB_APP_NAME || "chuchube-llm",
    });

    clientPromise = client.connect().then(() => client!);
  }

  const connected = await clientPromise;
  client = connected;
  return { client: connected, db: connected.db(dbName) };
}

/**
 * Optional helper for graceful shutdown (e.g., in tests or SIGTERM handlers).
 */
export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
  }
  client = null;
  clientPromise = null;
}