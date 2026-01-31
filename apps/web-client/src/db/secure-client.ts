import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

type SecureDbOptions = {
  token?: string | null;
};

export async function getSecureDb(options: SecureDbOptions = {}) {
  const token = options.token ??
    (await (await auth()).getToken({ template: "supabase" }));

  if (!token) {
    throw new Error("Unauthorized: No Clerk Supabase token found");
  }

  type DbTransaction = Parameters<typeof db.transaction>[0] extends (
    tx: infer T,
  ) => Promise<unknown> ? T
    : never;

  return {
    rls: async <T>(
      queryCallback: (tx: DbTransaction) => Promise<T>,
    ): Promise<T> => {
      return await db.transaction(async (tx) => {
        try {
          await tx.execute(
            sql`select set_config('request.jwt.claims', ${token}, true)`,
          );

          return await queryCallback(tx);
        } finally {
          await tx.execute(
            sql`select set_config('request.jwt.claims', NULL, true)`,
          );
        }
      });
    },
  };
}
