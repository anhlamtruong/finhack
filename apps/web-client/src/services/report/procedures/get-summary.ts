import { db } from "@/db";
import { accounts, categories, transactions } from "@/db/schema";
import { calculatePercentageChange, fillMissingDays } from "@/lib/utils";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import {
  differenceInDays,
  endOfDay,
  endOfMonth,
  parse,
  startOfDay,
  startOfMonth,
  subDays,
} from "date-fns";
import { and, desc, eq, gte, lt, lte, sql, sum } from "drizzle-orm";
import { z } from "zod";

const summarySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  accountId: z.string().optional(),
});

export const getSummary = authedProcedure
  .input(summarySchema)
  .query(async ({ input, ctx }) => {
    const { from, to, accountId } = input;
    // In tRPC (authedProcedure), the user is guaranteed to be in ctx.user
    const userId = ctx.user.id;
    const secureDb = ctx.secureDb;
    type DbTransaction = Parameters<typeof db.transaction>[0] extends (
      tx: infer T,
    ) => Promise<unknown> ? T
      : never;

    try {
      const defaultTo = endOfMonth(new Date());
      const defaultFrom = startOfMonth(defaultTo);
      const startDate = from
        ? startOfDay(parse(from, "yyyy-MM-dd", new Date()))
        : defaultFrom;
      const endDate = to
        ? endOfDay(parse(to, "yyyy-MM-dd", new Date()))
        : defaultTo;

      const periodLength = differenceInDays(endDate, startDate) + 1;
      const lastPeriodStart = subDays(startDate, periodLength);
      const lastPeriodEnd = subDays(endDate, periodLength);

      const runSummary = async (dbClient: DbTransaction | typeof db) => {
        const fetchFinancialData = async (
          userId: string,
          startDate: Date,
          endDate: Date,
        ) => {
          return await dbClient
            .select({
              income:
                sql`SUM(CASE WHEN ${transactions.amount} >= 0 THEN ${transactions.amount} ELSE 0 END)`
                  .mapWith(
                    Number,
                  ),
              expenses:
                sql`SUM(CASE WHEN ${transactions.amount} < 0 THEN ${transactions.amount} ELSE 0 END)`
                  .mapWith(
                    Number,
                  ),
              remaining: sum(transactions.amount).mapWith(Number),
            })
            .from(transactions)
            .innerJoin(accounts, eq(transactions.accountId, accounts.id))
            .where(
              and(
                accountId ? eq(transactions.accountId, accountId) : undefined,
                eq(accounts.userId, userId),
                gte(transactions.date, startDate),
                lte(transactions.date, endDate),
              ),
            );
        };

        const [currentPeriod] = await fetchFinancialData(
          userId,
          startDate,
          endDate,
        );
        const [lastPeriod] = await fetchFinancialData(
          userId,
          lastPeriodStart,
          lastPeriodEnd,
        );

        const incomeChange = calculatePercentageChange(
          currentPeriod.income,
          lastPeriod.income,
        );
        const expensesChange = calculatePercentageChange(
          currentPeriod.expenses,
          lastPeriod.expenses,
        );
        const remainingChange = calculatePercentageChange(
          currentPeriod.remaining,
          lastPeriod.remaining,
        );

        const category = await dbClient
          .select({
            name: categories.name,
            value: sql`SUM(ABS(${transactions.amount}))`.mapWith(Number),
          })
          .from(transactions)
          .innerJoin(accounts, eq(transactions.accountId, accounts.id))
          .innerJoin(categories, eq(transactions.categoryId, categories.id))
          .where(
            and(
              accountId ? eq(transactions.accountId, accountId) : undefined,
              eq(accounts.userId, userId),
              lt(transactions.amount, 0),
              gte(transactions.date, startDate),
              lte(transactions.date, endDate),
            ),
          )
          .groupBy(categories.name)
          .orderBy(desc(sql`SUM(ABS(${transactions.amount}))`));

        const topCategories = category.slice(0, 3);
        const otherCategories = category.slice(3);
        const otherSum = otherCategories.reduce(
          (sum, current) => sum + current.value,
          0,
        );

        const finalCategories = topCategories;
        if (otherCategories.length > 0) {
          finalCategories.push({
            name: "Other",
            value: otherSum,
          });
        }

        const activeDays = await dbClient
          .select({
            date: transactions.date,
            income:
              sql`SUM(CASE WHEN ${transactions.amount} >= 0 THEN ${transactions.amount} ELSE 0 END)`
                .mapWith(
                  Number,
                ),
            expenses:
              sql`SUM(CASE WHEN ${transactions.amount} < 0 THEN ${transactions.amount} ELSE 0 END)`
                .mapWith(
                  Number,
                ),
          })
          .from(transactions)
          .innerJoin(accounts, eq(transactions.accountId, accounts.id))
          .where(
            and(
              accountId ? eq(transactions.accountId, accountId) : undefined,
              eq(accounts.userId, userId),
              gte(transactions.date, startDate),
              lte(transactions.date, endDate),
            ),
          )
          .groupBy(transactions.date)
          .orderBy(transactions.date);

        const days = fillMissingDays(activeDays, startDate, endDate);

        return {
          remainingAmount: currentPeriod.remaining,
          remainingChange,
          incomeAmount: currentPeriod.income,
          incomeChange,
          expensesAmount: currentPeriod.expenses,
          expensesChange,
          categories: finalCategories,
          days,
        };
      };

      return secureDb ? await secureDb.rls(runSummary) : await runSummary(db);
    } catch (error) {
      console.error("SUMMARY_ERROR", error);

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch summary data",
      });
    }
  });
