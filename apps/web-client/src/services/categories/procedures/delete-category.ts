import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";

export const deleteCategory = authedProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    try {
      const secureDb = ctx.secureDb;
      const [data] = secureDb
        ? await secureDb.rls((tx) =>
          tx
            .delete(categories)
            .where(
              and(
                eq(categories.id, input.id),
                eq(categories.userId, ctx.user.id),
              ),
            )
            .returning()
        )
        : await db
          .delete(categories)
          .where(
            and(
              eq(categories.id, input.id),
              eq(categories.userId, ctx.user.id),
            ),
          )
          .returning();

      if (!data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Categories not found or you do not have permission to delete it.",
        });
      }

      return {
        status: "success",
        data,
        message: "Category deleted successfully",
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      console.error("Delete Category error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete category",
      });
    }
  });
