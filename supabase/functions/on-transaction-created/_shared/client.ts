// supabase/functions/_shared/client.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

export const createDbClient = (connectionString: string) => {
  if (!connectionString) {
    throw new Error(
      " Database connection string is missing! Check DB_POOL_URL secret.",
    );
  }
  const client = postgres(connectionString, {
    prepare: false,
    ssl: { rejectUnauthorized: false },
  });
  return drizzle(client, { schema });
};
