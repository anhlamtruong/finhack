import { drizzle } from "npm:drizzle-orm/postgres-js";
import postgres from "npm:postgres";
import * as schema from "./schema.ts";

export const createDbClient = (connectionString: string) => {
  if (!connectionString) {
    throw new Error(
      "Database connection string is missing! Check DB_POOL_URL secret.",
    );
  }
  const client = postgres(connectionString, {
    prepare: false,
    ssl: { rejectUnauthorized: false },
  });
  return drizzle(client, { schema });
};
