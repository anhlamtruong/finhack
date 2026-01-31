import { z } from "zod";
import { inArray, and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema"; //
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";

export const deleteAccounts = authedProcedure
  .input(
    z.object({
      ids: z.array(z.string()),
    })
  )
  .mutation(async ({ ctx, input }) => {
    try {
      if (input.ids.length === 0) {
        return { count: 0, message: "No items selected" };
      }

      // Perform bulk delete
      const secureDb = ctx.secureDb;
      const deletedData = secureDb
        ? await secureDb.rls((tx) =>
            tx
              .delete(accounts)
              .where(
                and(
                  inArray(accounts.id, input.ids),
                  eq(accounts.userId, ctx.user.id),
                ),
              )
              .returning(),
          )
        : await db
            .delete(accounts)
            .where(
              and(inArray(accounts.id, input.ids), eq(accounts.userId, ctx.user.id))
            )
            .returning();

      return {
        status: "success",
        count: deletedData.length,
        message: `Successfully deleted ${deletedData.length} accounts`,
      };
    } catch (error) {
      console.error("Bulk delete error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete accounts",
      });
    }
  });
