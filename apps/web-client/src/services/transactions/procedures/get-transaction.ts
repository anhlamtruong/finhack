import { db } from "@/db";
import {
  accounts,
  categories,
  selectTransactionsSchema,
  transactions,
} from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

export const getTransaction = authedProcedure
  .input(selectTransactionsSchema.pick({ id: true }))
  .query(async ({ ctx, input }) => {
    try {
      const secureDb = ctx.secureDb;
      const [data] = secureDb
        ? await secureDb.rls((tx) =>
          tx
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
                isSettlement: transactions.isSettlement,
              account: accounts.name,
              accountId: transactions.accountId,
            })
            .from(transactions)
            .innerJoin(accounts, eq(transactions.accountId, accounts.id))
            .leftJoin(categories, eq(transactions.categoryId, categories.id))
            .where(
              and(
                eq(accounts.userId, ctx.user.id),
                eq(transactions.id, input.id),
              ),
            )
        )
        : await db
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
              isSettlement: transactions.isSettlement,
            account: accounts.name,
            accountId: transactions.accountId,
          })
          .from(transactions)
          .innerJoin(accounts, eq(transactions.accountId, accounts.id))
          .leftJoin(categories, eq(transactions.categoryId, categories.id))
          .where(
            and(
              eq(accounts.userId, ctx.user.id),
              eq(transactions.id, input.id),
            ),
          );

      if (!data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            `Private Procedure Error - getTransaction. Could not find the Transaction.`,
        });
      }
      return data;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          `Private Procedure Error - getTransaction. An unspecified error occurred: ${error}`,
      });
    }
  });
