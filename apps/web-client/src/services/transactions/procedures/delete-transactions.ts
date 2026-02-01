import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, transactions } from "@/db/schema"; //
import { authedProcedure } from "@/server/init";
import { refreshMonthlyReportsForDates } from "@/services/monthly-report/utils/refresh-monthly-reports";
import { TRPCError } from "@trpc/server";

export const deleteTransactions = authedProcedure
  .input(
    z.object({
      ids: z.array(z.string()),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    try {
      if (input.ids.length === 0) {
        return { count: 0, message: "No items selected" };
      }
      const secureDb = ctx.secureDb;
      type DbTransaction = Parameters<typeof db.transaction>[0] extends (
        tx: infer T,
      ) => Promise<unknown> ? T
        : never;
      const runDelete = async (dbClient: DbTransaction | typeof db) => {
        const transactionsToDelete = dbClient
          .$with("transactions_to_delete")
          .as(
            dbClient
              .select({ id: transactions.id })
              .from(transactions)
              .innerJoin(accounts, eq(transactions.accountId, accounts.id))
              .where(
                and(
                  inArray(transactions.id, input.ids),
                  eq(accounts.userId, ctx.user.id),
                ),
              ),
          );
        return await dbClient
          .with(transactionsToDelete)
          .delete(transactions)
          .where(
            inArray(
              transactions.id,
              sql`(select id from ${transactionsToDelete})`,
            ),
          )
          .returning({ id: transactions.id, date: transactions.date });
      };
      const deletedData = secureDb
        ? await secureDb.rls(runDelete)
        : await runDelete(db);

      const reportDates = deletedData.map((row) => row.date);
      if (reportDates.length) {
        if (secureDb) {
          await secureDb.rls((tx) =>
            refreshMonthlyReportsForDates({
              db: tx,
              userId: ctx.user.id,
              dates: reportDates,
            }),
          );
        } else {
          await refreshMonthlyReportsForDates({
            db,
            userId: ctx.user.id,
            dates: reportDates,
          });
        }
      }

      return {
        status: "success",
        count: deletedData.length,
        message: `Successfully deleted ${deletedData.length} transactions`,
      };
    } catch (error) {
      console.error("Bulk delete error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete transactions",
      });
    }
  });
