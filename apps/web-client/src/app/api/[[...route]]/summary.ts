 
import { db } from "@/db";
import { accounts, categories, transactions } from "@/db/schema";
import { calculatePercentageChange, fillMissingDays } from "@/lib/utils";
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { zValidator } from "@hono/zod-validator";
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
import { Hono } from "hono";
import { z } from "zod";
const app = new Hono().get(
  "/",
  clerkMiddleware(),
  zValidator(
    "query",
    z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      accountId: z.string().optional(),
    }),
  ),
  async (c) => {
    try {
      const auth = getAuth(c);
      const { from, to, accountId } = c.req.valid("query");

      if (!auth?.userId) {
        return c.json(
          {
            error: "Unauthorized",
            message: "You are not logged in.",
          },
          401,
        );
      }

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

      async function fetchFinancialData(
        userId: string,
        startDate: Date,
        endDate: Date,
      ) {
        return await db
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
      }

      const [currentPeriod] = await fetchFinancialData(
        auth.userId,
        startDate,
        endDate,
      );
      const [lastPeriod] = await fetchFinancialData(
        auth.userId,
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

      const category = await db
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
            eq(accounts.userId, auth.userId),
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

      const activeDays = await db
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
            eq(accounts.userId, auth.userId),
            gte(transactions.date, startDate),
            lte(transactions.date, endDate),
          ),
        )
        .groupBy(transactions.date)
        .orderBy(transactions.date);

      const days = fillMissingDays(activeDays, startDate, endDate);
      return c.json({
        data: {
          remainingAmount: currentPeriod.remaining,
          remainingChange,
          incomeAmount: currentPeriod.income,
          incomeChange,
          expensesAmount: currentPeriod.expenses,
          expensesChange,
          categories: finalCategories,
          days,
        },
      });
    } catch (error) {
      console.error("API_ERROR_SUMMARY", error);
      return c.json(
        {
          error: "Internal Server Error",
          message: "Failed to fetch financial data api/summary",
        },
        500,
      );
    }
  },
);

export default app;
