import { insertTransactionsSchema, transactions } from "@/db/schema";

import { TRPCError } from "@trpc/server";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/db";
import { authedProcedure } from "@/server/init";
import { createSharedTransactionNotifier } from "@/services/notifications/shared-transactions";
import { createUncategorizedTransactionNotifier } from "@/services/notifications/uncategorized-transactions";
import { refreshMonthlyReportsForDates } from "@/services/monthly-report/utils/refresh-monthly-reports";

export const postTransaction = authedProcedure
  .input(insertTransactionsSchema.omit({ id: true }))
  .mutation(async ({ ctx, input }) => {
    try {
      const secureDb = ctx.secureDb;
      const paidByUserId = input.paidByUserId ?? ctx.user.id;
      const isSettlement = input.isSettlement ?? false;
      const settlementToUserId = input.settlementToUserId ?? undefined;
      const [data] = secureDb
        ? await secureDb.rls((tx) =>
          tx
            .insert(transactions)
            .values({
              id: uuidv4(),
              date: input.date ?? new Date(),
              amount: input.amount,
              payee: input.payee,
              accountId: input.accountId,
              notes: input.notes,
              categoryId: input.categoryId,
              paidByUserId,
              settlementToUserId,
              isSettlement,
            })
            .returning()
        )
        : await db
          .insert(transactions)
          .values({
            id: uuidv4(),
            date: input.date ?? new Date(),
            amount: input.amount,
            payee: input.payee,
            accountId: input.accountId,
            notes: input.notes,
            categoryId: input.categoryId,
            paidByUserId,
            settlementToUserId,
            isSettlement,
          })
          .returning();

      const runNotify = createSharedTransactionNotifier({
        ctx,
        rows: data ? [data] : [],
      });
      const runUncategorizedNotify = createUncategorizedTransactionNotifier({
        ctx,
        rows: data ? [data] : [],
      });

      if (data) {
        if (secureDb) {
          await secureDb.rls(async (tx) => {
            await runNotify(tx);
            await runUncategorizedNotify(tx);
          });
        } else {
          await db.transaction(async (tx) => {
            await runNotify(tx);
            await runUncategorizedNotify(tx);
          });
        }
      }

      const reportDates = [data?.date ?? input.date ?? new Date()];

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
        message: "Post Transaction Successfully",
      };
    } catch (error) {
      console.error("❌ Database Error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          `Private Procedure Error - postTransactions. An unspecified error occurred: ${error}`,
      });
    }
  });
