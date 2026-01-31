import { db } from "@/db";
import { categories, selectCategoriesSchema } from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

export const getCategory = authedProcedure
  .input(selectCategoriesSchema.pick({ id: true }))
  .query(async ({ ctx, input }) => {
    try {
      const secureDb = ctx.secureDb;
      const [data] = secureDb
        ? await secureDb.rls((tx) =>
          tx
            .select({
              id: categories.id,
              name: categories.name,
              goalType: categories.goalType,
              monthlyBudget: categories.monthlyBudget,
            })
            .from(categories)
            .where(
              and(
                eq(categories.userId, ctx.user.id),
                eq(categories.id, input.id),
              ),
            )
        )
        : await db
          .select({
            id: categories.id,
            name: categories.name,
            goalType: categories.goalType,
            monthlyBudget: categories.monthlyBudget,
          })
          .from(categories)
          .where(
            and(
              eq(categories.userId, ctx.user.id),
              eq(categories.id, input.id),
            ),
          );
      if (!data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            `Private Procedure Error - getCategory. Could not find the category.`,
        });
      }
      return data;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          `Private Procedure Error - getCategory. An unspecified error occurred: ${error}`,
      });
    }
  });
