import { accounts, categories, transactions } from "@/db/schema";
import { monthlyReports } from "@/services/monthly-report/schema";
import { v4 as uuidv4 } from "uuid";
import { and, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { endOfMonth, parse } from "date-fns";
import type { MonthlyReportCategoryBreakdown } from "@/services/monthly-report/schema";
import type { db as dbClient } from "@/db";

export type GenerateMonthlyStatementInput = {
  db:
    | typeof dbClient
    | (Parameters<typeof dbClient.transaction>[0] extends (
      tx: infer T,
    ) => Promise<unknown> ? T
      : never);
  userId: string;
  month: string;
};

export const generateMonthlyStatement = async ({
  db,
  userId,
  month,
}: GenerateMonthlyStatementInput) => {
  const startDate = parse(`${month}-01`, "yyyy-MM-dd", new Date());
  const endDate = endOfMonth(startDate);

  const categoryRows = await db
    .select({
      id: categories.id,
      name: categories.name,
      monthlyBudget: categories.monthlyBudget,
      goalType: categories.goalType,
    })
    .from(categories)
    .where(eq(categories.userId, userId));

  const transactionSums = await db
    .select({
      categoryId: transactions.categoryId,
      spent: sql`SUM(
        CASE
          WHEN ${categories.goalType} = 'saving'
            THEN GREATEST(${transactions.amount}, 0)
          ELSE ABS(LEAST(${transactions.amount}, 0))
        END
      )`.mapWith(Number),
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(accounts.userId, userId),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        isNotNull(transactions.categoryId),
      ),
    )
    .groupBy(transactions.categoryId, categories.goalType);

  const spentByCategoryId = new Map<string, number>();
  for (const row of transactionSums) {
    if (row.categoryId) {
      spentByCategoryId.set(row.categoryId, row.spent ?? 0);
    }
  }

  const categoryBreakdown: MonthlyReportCategoryBreakdown[] = categoryRows.map(
    (category) => {
      const spent = spentByCategoryId.get(category.id) ?? 0;
      const budget = category.monthlyBudget ?? 0;
      return {
        categoryId: category.id,
        categoryName: category.name,
        goalType: category.goalType ?? "expense",
        budget,
        spent,
        variance: budget - spent,
      };
    },
  );

  const totalBudget = categoryBreakdown.reduce(
    (total, item) => total + item.budget,
    0,
  );
  const totalSpent = categoryBreakdown.reduce(
    (total, item) => total + item.spent,
    0,
  );

  const [existing] = await db
    .select({ id: monthlyReports.id })
    .from(monthlyReports)
    .where(
      and(eq(monthlyReports.userId, userId), eq(monthlyReports.month, month)),
    )
    .limit(1);

  if (existing?.id) {
    const [updated] = await db
      .update(monthlyReports)
      .set({
        totalBudget,
        totalSpent,
        categoryBreakdown,
        generatedAt: new Date(),
      })
      .where(eq(monthlyReports.id, existing.id))
      .returning();
    return updated;
  }

  const [inserted] = await db
    .insert(monthlyReports)
    .values({
      id: uuidv4(),
      userId,
      month,
      totalBudget,
      totalSpent,
      categoryBreakdown,
    })
    .returning();

  return inserted;
};
