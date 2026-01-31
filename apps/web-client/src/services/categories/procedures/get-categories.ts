import { categories } from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

export const getCategories = authedProcedure.query(async ({ ctx }) => {
  try {
    const secureDb = ctx.secureDb;
    const db = ctx.db;
    const data = secureDb
      ? await secureDb.rls((tx) =>
        tx.select({
          id: categories.id,
          name: categories.name,
          monthlyBudget: categories.monthlyBudget,
          goalType: categories.goalType,
          userId: categories.userId,
        })
          .from(categories)
          .where(eq(categories.userId, ctx.user.id))
      )
      : await db
        .select({
          id: categories.id,
          name: categories.name,
          monthlyBudget: categories.monthlyBudget,
          goalType: categories.goalType,
          userId: categories.userId,
        })
        .from(categories)
        .where(eq(categories.userId, ctx.user.id));

    return data;
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        `Private Procedure Error - getCategories. An unspecified error occurred: ${error}`,
    });
  }
});
