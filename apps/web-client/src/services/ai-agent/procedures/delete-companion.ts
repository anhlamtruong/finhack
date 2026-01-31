import { db } from "@/db";
import { companions } from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

/**
 * Delete a companion owned by the current user.
 */
export const deleteCompanion = authedProcedure
  .input(z.object({ id: z.string().min(1) }))
  .mutation(async ({ ctx, input }) => {
    try {
      const secureDb = ctx.secureDb;
      type DbTransaction = Parameters<typeof db.transaction>[0] extends (
        tx: infer T,
      ) => Promise<unknown>
        ? T
        : never;
      const query = (client: DbTransaction | typeof db) =>
        client
          .delete(companions)
          .where(
            and(
              eq(companions.id, input.id),
              eq(companions.userId, ctx.user.id),
            ),
          )
          .returning();

      const rows = secureDb ? await secureDb.rls(query) : await query(db);
      const deleted = rows[0];

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Companion not found" });
      }

      return deleted;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          `Private Procedure Error - deleteCompanion. An unspecified error occurred: ${error}`,
      });
    }
  });
