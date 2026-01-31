import { insertTransactionsSchema, transactions } from "@/db/schema";

import { TRPCError } from "@trpc/server";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/db";
import { authedProcedure } from "@/server/init";
import { createSharedTransactionNotifier } from "@/services/notifications/shared-transactions";

export const postTransactions = authedProcedure
  .input(insertTransactionsSchema.omit({ id: true }).array())
  .mutation(async ({ ctx, input }) => {
    try {
      const secureDb = ctx.secureDb;
      const data = secureDb
        ? await secureDb.rls((tx) =>
          tx
            .insert(transactions)
            .values(
              input.map((value) => ({
                id: uuidv4(),
                date: value.date ?? new Date(),
                amount: value.amount,
                payee: value.payee,
                accountId: value.accountId,
                notes: value.notes,
                categoryId: value.categoryId,
                paidByUserId: value.paidByUserId ?? ctx.user.id,
                settlementToUserId: value.settlementToUserId,
                isSettlement: value.isSettlement ?? false,
              })),
            )
            .returning()
        )
        : await db
          .insert(transactions)
          .values(
            input.map((value) => ({
              id: uuidv4(),
              date: value.date ?? new Date(),
              amount: value.amount,
              payee: value.payee,
              accountId: value.accountId,
              notes: value.notes,
              categoryId: value.categoryId,
              paidByUserId: value.paidByUserId ?? ctx.user.id,
              settlementToUserId: value.settlementToUserId,
              isSettlement: value.isSettlement ?? false,
            })),
          )
          .returning();

      const runNotify = createSharedTransactionNotifier({
        ctx,
        rows: data ?? [],
      });

      if (data.length) {
        if (secureDb) {
          await secureDb.rls(runNotify);
        } else {
          await db.transaction(async (tx) => runNotify(tx));
        }
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
