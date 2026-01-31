import { categories, insertCategoriesSchema } from "@/db/schema";

import { TRPCError } from "@trpc/server";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/db";
import { authedProcedure } from "@/server/init";

export const postCategory = authedProcedure
  .input(
    insertCategoriesSchema.pick({
      name: true,
      monthlyBudget: true,
      goalType: true,
    }),
  )
  .mutation(async ({ ctx, input }) => {
    try {
      const secureDb = ctx.secureDb;
      const [data] = secureDb
        ? await secureDb.rls((tx) =>
          tx
            .insert(categories)
            .values({
              userId: ctx.user.id,
              id: uuidv4(),
              name: input.name,
              monthlyBudget: input.monthlyBudget,
              goalType: input.goalType,
            })
            .returning()
        )
        : await db
          .insert(categories)
          .values({
            userId: ctx.user.id,
            id: uuidv4(),
            name: input.name,
            monthlyBudget: input.monthlyBudget,
            goalType: input.goalType,
          })
          .returning();
      return {
        status: "success",
        data: data,
        message: "Post Category Successfully",
      };
    } catch (error) {
      console.error("❌ Database Error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          `Private Procedure Error - postCategory. An unspecified error occurred: ${error}`,
      });
    }
  });
