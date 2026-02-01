import { db } from "@/db";
import { accounts, transactions } from "@/db/schema";
import { convertAmountFromMiliunits } from "@/lib/utils";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import {
  differenceInDays,
  endOfDay,
  endOfMonth,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { and, eq, gte, lte, sql, sum } from "drizzle-orm";

export const getSalesBudget = authedProcedure.query(async ({ ctx }) => {
  const userId = ctx.user.id;
  const secureDb = ctx.secureDb;

  type DbTransaction = Parameters<typeof db.transaction>[0] extends (
    tx: infer T
  ) => Promise<unknown>
    ? T
    : never;

  try {
    const now = new Date();
    const startDate = startOfDay(startOfMonth(now));
    const endDate = endOfDay(endOfMonth(now));
    const daysLeftInMonth = differenceInDays(endDate, now) + 1;
    const totalDaysInMonth = differenceInDays(endDate, startDate) + 1;

    const runBudgetQuery = async (dbClient: DbTransaction | typeof db) => {
      // Fetch current month financial data
      const [monthData] = await dbClient
        .select({
          income:
            sql`SUM(CASE WHEN ${transactions.amount} >= 0 THEN ${transactions.amount} ELSE 0 END)`.mapWith(
              Number
            ),
          expenses:
            sql`SUM(CASE WHEN ${transactions.amount} < 0 THEN ABS(${transactions.amount}) ELSE 0 END)`.mapWith(
              Number
            ),
          remaining: sum(transactions.amount).mapWith(Number),
        })
        .from(transactions)
        .innerJoin(accounts, eq(transactions.accountId, accounts.id))
        .where(
          and(
            eq(accounts.userId, userId),
            gte(transactions.date, startDate),
            lte(transactions.date, endDate)
          )
        );

      const income = convertAmountFromMiliunits(monthData?.income ?? 0);
      const spent = convertAmountFromMiliunits(monthData?.expenses ?? 0);
      const remaining = convertAmountFromMiliunits(monthData?.remaining ?? 0);

      // Calculate safe to spend per day
      const safeToSpend =
        daysLeftInMonth > 0 && remaining > 0
          ? Math.round((remaining / daysLeftInMonth) * 100) / 100
          : 0;

      // Calculate budget progress percentage
      const spentPercent =
        income > 0 ? Math.round((spent / income) * 100) : 0;

      return {
        remaining,
        spent,
        income,
        safeToSpend,
        daysLeftInMonth,
        totalDaysInMonth,
        spentPercent: Math.min(100, spentPercent),
        lastUpdated: new Date().toISOString(),
      };
    };

    return secureDb
      ? await secureDb.rls(runBudgetQuery)
      : await runBudgetQuery(db);
  } catch (error) {
    console.error("SALES_BUDGET_ERROR", error);

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch budget data",
    });
  }
});
