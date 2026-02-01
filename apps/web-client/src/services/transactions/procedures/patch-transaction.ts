import { db } from "@/db";
import { accounts, insertTransactionsSchema, transactions } from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { refreshMonthlyReportsForDates } from "@/services/monthly-report/utils/refresh-monthly-reports";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";

export const patchTransaction = authedProcedure
  .input(insertTransactionsSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const { id, ...values } = input;
      const secureDb = ctx.secureDb;
      type DbTransaction = Parameters<typeof db.transaction>[0] extends (
        tx: infer T,
      ) => Promise<unknown> ? T
        : never;
      const runUpdate = async (dbClient: DbTransaction | typeof db) => {
        const [existing] = await dbClient
          .select({ id: transactions.id, date: transactions.date })
          .from(transactions)
          .innerJoin(accounts, eq(transactions.accountId, accounts.id))
          .where(
            and(eq(transactions.id, id), eq(accounts.userId, ctx.user.id)),
          )
          .limit(1);
        const transactionsToUpdate = dbClient
          .$with("transactions_to_update")
          .as(
            dbClient
              .select({ id: transactions.id })
              .from(transactions)
              .innerJoin(accounts, eq(transactions.accountId, accounts.id))
              .where(
                and(eq(transactions.id, id), eq(accounts.userId, ctx.user.id)),
              ),
          );
        const [data] = await dbClient
          .with(transactionsToUpdate)
          .update(transactions)
          .set(values)
          .where(
            inArray(
              transactions.id,
              sql`(select id from ${transactionsToUpdate})`,
            ),
          )
          .returning();
        return { data, existingDate: existing?.date };
      };
      const result = secureDb
        ? await secureDb.rls(runUpdate)
        : await runUpdate(db);
      const data = result?.data;

      if (!data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Transaction not found or you do not have permission to update it.",
        });
      }

      const reportDates = [result?.existingDate, data?.date];

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
        data: data,
        message: "Transaction updated successfully",
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      console.error("❌ Database Error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update Transaction",
      });
    }
  });
