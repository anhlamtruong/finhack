import { db } from "@/db";
import { companions } from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";

/**
 * Fetch all companions for the current user.
 * Uses RLS-enabled secure DB when available.
 */
export const getCompanions = authedProcedure.query(async ({ ctx }) => {
  try {
    const secureDb = ctx.secureDb;
    type DbTransaction = Parameters<typeof db.transaction>[0] extends (
      tx: infer T,
    ) => Promise<unknown>
      ? T
      : never;
    const query = (client: DbTransaction | typeof db) =>
      client
        .select()
        .from(companions)
        .where(eq(companions.userId, ctx.user.id))
        .orderBy(desc(companions.updatedAt));

    return secureDb ? await secureDb.rls(query) : await query(db);
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        `Private Procedure Error - getCompanions. An unspecified error occurred: ${error}`,
    });
  }
});
