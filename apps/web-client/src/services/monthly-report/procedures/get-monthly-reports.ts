import { monthlyReports } from "@/services/monthly-report/schema";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";

export const getMonthlyReports = authedProcedure.query(async ({ ctx }) => {
  try {
    const secureDb = ctx.secureDb;
    const data = secureDb
      ? await secureDb.rls((tx) =>
        tx
          .select({
            id: monthlyReports.id,
            userId: monthlyReports.userId,
            month: monthlyReports.month,
            totalBudget: monthlyReports.totalBudget,
            totalSpent: monthlyReports.totalSpent,
            categoryBreakdown: monthlyReports.categoryBreakdown,
            generatedAt: monthlyReports.generatedAt,
          })
          .from(monthlyReports)
          .where(eq(monthlyReports.userId, ctx.user.id))
          .orderBy(desc(monthlyReports.month))
      )
      : await db
        .select({
          id: monthlyReports.id,
          userId: monthlyReports.userId,
          month: monthlyReports.month,
          totalBudget: monthlyReports.totalBudget,
          totalSpent: monthlyReports.totalSpent,
          categoryBreakdown: monthlyReports.categoryBreakdown,
          generatedAt: monthlyReports.generatedAt,
        })
        .from(monthlyReports)
        .where(eq(monthlyReports.userId, ctx.user.id))
        .orderBy(desc(monthlyReports.month));

    return data;
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        `Private Procedure Error - getMonthlyReports. An unspecified error occurred: ${error}`,
    });
  }
});
