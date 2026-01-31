import { insertTransactionsSchema, transactions } from "@/db/schema";

import { TRPCError } from "@trpc/server";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/db";
import { authedProcedure } from "@/server/init";
import { createSharedTransactionNotifier } from "@/services/notifications/shared-transactions";

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

      if (data) {
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
