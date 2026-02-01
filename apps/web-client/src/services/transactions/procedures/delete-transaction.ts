import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, transactions } from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { refreshMonthlyReportsForDates } from "@/services/monthly-report/utils/refresh-monthly-reports";
import { TRPCError } from "@trpc/server";

export const deleteTransaction = authedProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    try {
      const id = input.id;
      const secureDb = ctx.secureDb;
      type DbTransaction = Parameters<typeof db.transaction>[0] extends (
        tx: infer T,
      ) => Promise<unknown>
        ? T
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
                  eq(transactions.id, id),
                  eq(accounts.userId, ctx.user.id),
                ),
              ),
          );
        const [data] = await dbClient
          .with(transactionsToDelete)
          .delete(transactions)
          .where(
            inArray(
              transactions.id,
              sql`(select id from ${transactionsToDelete})`,
            ),
          )
          .returning();
        return data;
      };
      const data = secureDb
        ? await secureDb.rls(runDelete)
        : await runDelete(db);

      if (!data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Transaction not found or you do not have permission to delete it.",
        });
      }

      const reportDates = [data?.date];
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

      return {
        status: "success",
        data,
        message: "Transaction deleted successfully",
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      console.error("Delete Transaction error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete transaction",
      });
    }
  });
