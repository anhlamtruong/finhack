import { db } from "@/db";
import { companions } from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

/**
 * Fetch a single companion by id for the current user.
 */
export const getCompanion = authedProcedure
  .input(z.object({ id: z.string().min(1) }))
  .query(async ({ ctx, input }) => {
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
          .where(
            and(
              eq(companions.id, input.id),
              eq(companions.userId, ctx.user.id),
            ),
          )
          .limit(1);

      const rows = secureDb ? await secureDb.rls(query) : await query(db);
      const companion = rows[0];

      if (!companion) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Companion not found" });
      }

      return companion;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          `Private Procedure Error - getCompanion. An unspecified error occurred: ${error}`,
      });
    }
  });
