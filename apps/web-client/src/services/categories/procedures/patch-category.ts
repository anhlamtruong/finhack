import { db } from "@/db";
import { categories, insertCategoriesSchema } from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const patchCategoriesSchema = z.object({
  id: z.string(),
  name: insertCategoriesSchema.shape.name,
  monthlyBudget: insertCategoriesSchema.shape.monthlyBudget,
  goalType: insertCategoriesSchema.shape.goalType,
});

export const patchCategory = authedProcedure
  .input(patchCategoriesSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const { id, ...values } = input;

      const secureDb = ctx.secureDb;
      const [data] = secureDb
        ? await secureDb.rls((tx) =>
          tx
            .update(categories)
            .set(values)
            .where(
              and(eq(categories.id, id), eq(categories.userId, ctx.user.id)),
            )
            .returning()
        )
        : await db
          .update(categories)
          .set(values)
          .where(
            and(eq(categories.id, id), eq(categories.userId, ctx.user.id)),
          )
          .returning();

      if (!data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Category not found or you do not have permission to update it.",
        });
      }

      return {
        status: "success",
        data: data,
        message: "Category updated successfully",
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      console.error("❌ Database Error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update Category",
      });
    }
  });
