import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createDbClient } from "./_shared/client.ts";
import {
  accounts,
  categories,
  monthlyReports,
  transactions,
} from "./_shared/schema.ts";
import { and, eq, gte, isNotNull, lte, sql } from "npm:drizzle-orm";

const connectionString = Deno.env.get("DB_URL") ??
  Deno.env.get("SUPABASE_DB_POOL_URL") ??
  Deno.env.get("DB_POOL_URL");
const connectionStringSource = Deno.env.get("DB_URL")
  ? "SUPABASE_DB_URL"
  : Deno.env.get("SUPABASE_DB_POOL_URL")
  ? "SUPABASE_DB_POOL_URL"
  : "DB_POOL_URL";
if (!connectionString) {
  throw new Error(
    "Missing database connection string. Set SUPABASE_DB_URL or DB_POOL_URL.",
  );
}
const db = createDbClient(connectionString);
console.log(`generate-monthly-statements using ${connectionStringSource}`);

const formatMonth = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const getPreviousMonthRange = () => {
  const now = new Date();
  const previousMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  const startDate = new Date(
    Date.UTC(previousMonth.getUTCFullYear(), previousMonth.getUTCMonth(), 1),
  );
  const endDate = new Date(
    Date.UTC(
      previousMonth.getUTCFullYear(),
      previousMonth.getUTCMonth() + 1,
      0,
    ),
  );
  return { month: formatMonth(previousMonth), startDate, endDate };
};

Deno.serve(async () => {
  try {
    const { month, startDate, endDate } = getPreviousMonthRange();
    const users = await db
      .selectDistinct({ userId: accounts.userId })
      .from(accounts);

    for (const user of users) {
      const userId = user.userId;
      if (!userId) continue;

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

      const categoryBreakdown = categoryRows.map((category) => {
        const spent = spentByCategoryId.get(category.id) ?? 0;
        const budget = category.monthlyBudget ?? 0;
        return {
          categoryId: category.id,
          categoryName: category.name,
          budget,
          spent,
          variance: budget - spent,
        };
      });

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
          and(
            eq(monthlyReports.userId, userId),
            eq(monthlyReports.month, month),
          ),
        )
        .limit(1);

      if (existing?.id) {
        await db
          .update(monthlyReports)
          .set({
            totalBudget,
            totalSpent,
            categoryBreakdown,
            generatedAt: new Date(),
          })
          .where(eq(monthlyReports.id, existing.id));
      } else {
        await db.insert(monthlyReports).values({
          id: crypto.randomUUID(),
          userId,
          month,
          totalBudget,
          totalSpent,
          categoryBreakdown,
        });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, month, processed: users.length }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("generate-monthly-statements error:", message);
    console.error("generate-monthly-statements error details:", error);
    if (error && typeof error === "object") {
      const maybeError = error as Record<string, unknown>;
      if ("code" in maybeError) {
        console.error("db error code:", maybeError.code);
      }
      if ("detail" in maybeError) {
        console.error("db error detail:", maybeError.detail);
      }
      if ("hint" in maybeError) {
        console.error("db error hint:", maybeError.hint);
      }
    }
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
