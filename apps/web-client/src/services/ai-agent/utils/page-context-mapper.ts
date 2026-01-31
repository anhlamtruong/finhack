import { db } from "@/db";
import {
  accounts,
  categories,
  monthlyReports,
  transactions,
  walletShares,
} from "@/db/schema";
import { and, desc, eq, gte, lte, sql, sum } from "drizzle-orm";
import { parse, subDays } from "date-fns";
import { convertAmountFromMiliunits } from "@/lib/utils";

/**
 * Minimal routing context used to fetch summaries for the LLM.
 */
type PageContext = {
  path: string;
  params?: Record<string, unknown>;
};

/**
 * Parse a date in yyyy-MM-dd format.
 */
function parseDate(value?: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  return parse(value, "yyyy-MM-dd", new Date());
}

/**
 * Fetch a data snapshot for the current page to enrich LLM context.
 * Returns lightweight summaries only (not full datasets).
 */
export async function fetchPageContextData(
  userId: string,
  context: PageContext,
) {
  const params = context.params ?? {};

  if (context.path === "/dashboard") {
    const defaultTo = new Date();
    const defaultFrom = subDays(defaultTo, 30);
    const startDate = parseDate(params.from) ?? defaultFrom;
    const endDate = parseDate(params.to) ?? defaultTo;

    const [totals] = await db
      .select({
        income:
          sql`SUM(CASE WHEN ${transactions.amount} >= 0 THEN ${transactions.amount} ELSE 0 END)`
            .mapWith(Number),
        expenses:
          sql`SUM(CASE WHEN ${transactions.amount} < 0 THEN ${transactions.amount} ELSE 0 END)`
            .mapWith(Number),
        remaining: sum(transactions.amount).mapWith(Number),
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(
        and(
          eq(accounts.userId, userId),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate),
        ),
      );

    const [topCategory] = await db
      .select({
        name: categories.name,
        value: sql`SUM(ABS(${transactions.amount}))`.mapWith(Number),
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(accounts.userId, userId),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate),
        ),
      )
      .groupBy(categories.name)
      .orderBy(desc(sql`SUM(ABS(${transactions.amount}))`))
      .limit(1);

    return {
      range: { from: startDate.toISOString(), to: endDate.toISOString() },
      totals: {
        income: convertAmountFromMiliunits(Number(totals?.income ?? 0)),
        expenses: convertAmountFromMiliunits(Number(totals?.expenses ?? 0)),
        remaining: convertAmountFromMiliunits(Number(totals?.remaining ?? 0)),
      },
      topCategory: topCategory
        ? {
            name: topCategory.name,
            value: convertAmountFromMiliunits(Number(topCategory.value ?? 0)),
          }
        : null,
    };
  }

  if (context.path.includes("/transactions")) {
    const defaultTo = new Date();
    const defaultFrom = subDays(defaultTo, 30);
    const startDate = params.from
      ? parse(String(params.from), "yyyy-MM-dd", new Date())
      : defaultFrom;
    const endDate = params.to
      ? parse(String(params.to), "yyyy-MM-dd", new Date())
      : defaultTo;
    const accountId = params.accountId ? String(params.accountId) : undefined;

    const rows = await db
      .select({
        id: transactions.id,
        category: {
          name: categories.name,
          monthlyBudget: categories.monthlyBudget,
          goalType: categories.goalType,
        },
        categoryId: transactions.categoryId,
        payee: transactions.payee,
        date: transactions.date,
        amount: transactions.amount,
        notes: transactions.notes,
        paidByUserId: transactions.paidByUserId,
        paidByEmail: walletShares.userEmail,
        isSettlement: transactions.isSettlement,
        account: accounts.name,
        accountId: transactions.accountId,
        accountOwnerId: accounts.userId,
        accountOwnerEmail: accounts.userEmail,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(
        walletShares,
        and(
          eq(walletShares.accountId, transactions.accountId),
          eq(walletShares.userId, transactions.paidByUserId),
          eq(walletShares.status, "accepted"),
        ),
      )
      .where(
        and(
          accountId ? eq(transactions.accountId, accountId) : undefined,
          eq(accounts.userId, userId),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate),
        ),
      )
      .orderBy(desc(transactions.date));

    return rows.map((row) => ({
      ...row,
      amount: convertAmountFromMiliunits(Number(row.amount ?? 0)),
      category: row.category
        ? {
            ...row.category,
            monthlyBudget: convertAmountFromMiliunits(
              Number(row.category.monthlyBudget ?? 0),
            ),
          }
        : null,
    }));
  }

  if (context.path.includes("/accounts")) {
    const owned = await db
      .select({
        id: accounts.id,
        name: accounts.name,
        userId: accounts.userId,
        isShared: sql<boolean>`false`,
        contributionSplit: sql<number>`100`,
        role: sql<string>`'owner'`,
      })
      .from(accounts)
      .where(eq(accounts.userId, userId));

    const shared = await db
      .select({
        id: accounts.id,
        name: accounts.name,
        userId: accounts.userId,
        isShared: sql<boolean>`true`,
        contributionSplit: walletShares.contributionSplit,
        role: walletShares.role,
      })
      .from(accounts)
      .innerJoin(walletShares, eq(accounts.id, walletShares.accountId))
      .where(
        and(
          eq(walletShares.userId, userId),
          eq(walletShares.status, "accepted"),
        ),
      );

    const merged = new Map<string, (typeof owned)[number]>();
    for (const account of [...owned, ...shared]) {
      const existing = merged.get(account.id);
      if (!existing || account.isShared) {
        merged.set(account.id, account);
      }
    }

    return Array.from(merged.values());
  }

  if (context.path.includes("/reports")) {
    const reports = await db
      .select({
        month: monthlyReports.month,
        totalBudget: monthlyReports.totalBudget,
        totalSpent: monthlyReports.totalSpent,
        categoryBreakdown: monthlyReports.categoryBreakdown,
        generatedAt: monthlyReports.generatedAt,
      })
      .from(monthlyReports)
      .where(eq(monthlyReports.userId, userId))
      .orderBy(desc(monthlyReports.month));

    return reports.map((report) => ({
      month: report.month,
      totalBudget: convertAmountFromMiliunits(Number(report.totalBudget ?? 0)),
      totalSpent: convertAmountFromMiliunits(Number(report.totalSpent ?? 0)),
      categoryBreakdown: Array.isArray(report.categoryBreakdown)
        ? report.categoryBreakdown.map((item) => ({
            ...item,
            spent: convertAmountFromMiliunits(Number(item.spent ?? 0)),
            budget: convertAmountFromMiliunits(Number(item.budget ?? 0)),
            variance: convertAmountFromMiliunits(Number(item.variance ?? 0)),
          }))
        : report.categoryBreakdown,
      generatedAt: report.generatedAt,
    }));
  }

  return null;
}