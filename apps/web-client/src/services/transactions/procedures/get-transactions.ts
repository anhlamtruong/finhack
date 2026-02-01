import { db } from "@/db";
import { accounts, categories, transactions, walletShares } from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import { endOfDay, endOfMonth, parse, startOfDay, startOfMonth } from "date-fns";
import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import { z } from "zod";

export const getTransactions = authedProcedure
  .input(
    z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      accountId: z.string().optional(),
    }),
  )
  .query(async ({ ctx, input }) => {
    try {
      const { from, to, accountId } = input;

      const defaultTo = endOfMonth(new Date());
      const defaultFrom = startOfMonth(defaultTo);

      const startDate = from
        ? startOfDay(parse(from, "yyyy-MM-dd", new Date()))
        : defaultFrom;

      const endDate = to
        ? endOfDay(parse(to, "yyyy-MM-dd", new Date()))
        : defaultTo;

      const secureDb = ctx.secureDb;
      const data = secureDb
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
                or(
                  eq(accounts.userId, ctx.user.id),
                  sql`exists (
                    select 1 from wallet_shares ws
                    where ws.account_id = ${accounts.id}
                      and ws.user_id = ${ctx.user.id}
                      and ws.status = 'accepted'
                  )`,
                ),
                gte(transactions.date, startDate),
                lte(transactions.date, endDate),
              ),
            )
            .orderBy(desc(transactions.date))
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
              or(
                eq(accounts.userId, ctx.user.id),
                sql`exists (
                  select 1 from wallet_shares ws
                  where ws.account_id = ${accounts.id}
                    and ws.user_id = ${ctx.user.id}
                    and ws.status = 'accepted'
                )`,
              ),
              gte(transactions.date, startDate),
              lte(transactions.date, endDate),
            ),
          )
          .orderBy(desc(transactions.date));
      return data;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          `Private Procedure Error - getTransactions. An unspecified error occurred: ${error}`,
      });
    }
  });
