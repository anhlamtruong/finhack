import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema"; //
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";

export const deleteCategories = authedProcedure
  .input(
    z.object({
      ids: z.array(z.string()),
    }),
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
            .delete(categories)
            .where(
              and(
                inArray(categories.id, input.ids),
                eq(categories.userId, ctx.user.id),
              ),
            )
            .returning()
        )
        : await db
          .delete(categories)
          .where(
            and(
              inArray(categories.id, input.ids),
              eq(categories.userId, ctx.user.id),
            ),
          )
          .returning();

      return {
        status: "success",
        count: deletedData.length,
        message: `Successfully deleted ${deletedData.length} categories`,
      };
    } catch (error) {
      console.error("Bulk delete error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete categories",
      });
    }
  });
