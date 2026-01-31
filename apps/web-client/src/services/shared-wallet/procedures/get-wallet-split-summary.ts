import { db } from "@/db";
import { accounts, transactions, walletShares } from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { parse, subDays } from "date-fns";
import { z } from "zod";
import { calculateSplit } from "../utils/calculate-split";

const splitSummarySchema = z.object({
  accountId: z.string(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const getWalletSplitSummary = authedProcedure
  .input(splitSummarySchema)
  .query(async ({ ctx, input }) => {
    try {
      const secureDb = ctx.secureDb;
      type DbTransaction = Parameters<typeof db.transaction>[0] extends (
        tx: infer T,
      ) => Promise<unknown> ? T
        : never;

      const runQuery = async (dbClient: DbTransaction | typeof db) => {
        const [account] = await dbClient
          .select({
            id: accounts.id,
            userId: accounts.userId,
            userEmail: accounts.userEmail,
          })
          .from(accounts)
          .where(eq(accounts.id, input.accountId));

        if (!account) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Account not found",
          });
        }

        const [share] = await dbClient
          .select({ id: walletShares.id })
          .from(walletShares)
          .where(
            and(
              eq(walletShares.accountId, input.accountId),
              eq(walletShares.userId, ctx.user.id),
              eq(walletShares.status, "accepted"),
            ),
          );

        const isOwner = account.userId === ctx.user.id;
        if (!isOwner && !share) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        const defaultTo = new Date();
        const defaultFrom = subDays(defaultTo, 30);
        const startDate = input.from
          ? parse(input.from, "yyyy-MM-dd", new Date())
          : defaultFrom;
        const endDate = input.to
          ? parse(input.to, "yyyy-MM-dd", new Date())
          : defaultTo;

        const acceptedShares = await dbClient
          .select({
            userId: walletShares.userId,
            userEmail: walletShares.userEmail,
            role: walletShares.role,
            contributionSplit: walletShares.contributionSplit,
            status: walletShares.status,
          })
          .from(walletShares)
          .where(
            and(
              eq(walletShares.accountId, input.accountId),
              eq(walletShares.status, "accepted"),
            ),
          );

        const hasOwner = acceptedShares.some((row) =>
          row.userId === account.userId
        );
        const sharesTotal = acceptedShares.reduce(
          (sum, row) => sum + (row.contributionSplit ?? 0),
          0,
        );
        const ownerSplit = Math.max(0, 100 - sharesTotal);

        const members = hasOwner ? acceptedShares : [
          {
            userId: account.userId,
            userEmail: account.userEmail ?? "",
            role: "owner",
            contributionSplit: ownerSplit,
            status: "accepted",
          },
          ...acceptedShares,
        ];

        if (members.length <= 1) {
          return { isShared: false, totalSpent: 0, members: [] };
        }

        const txs = await dbClient
          .select({
            amount: transactions.amount,
            paidByUserId: transactions.paidByUserId,
            settlementToUserId: transactions.settlementToUserId,
            isSettlement: transactions.isSettlement,
          })
          .from(transactions)
          .where(
            and(
              eq(transactions.accountId, input.accountId),
              gte(transactions.date, startDate),
              lte(transactions.date, endDate),
            ),
          );

        const transactionList = await dbClient
          .select({
            id: transactions.id,
            payee: transactions.payee,
            amount: transactions.amount,
            date: transactions.date,
            paidByUserId: transactions.paidByUserId,
            settlementToUserId: transactions.settlementToUserId,
            paidByEmail: walletShares.userEmail,
            isSettlement: transactions.isSettlement,
          })
          .from(transactions)
          .leftJoin(
            walletShares,
            and(
              eq(walletShares.accountId, transactions.accountId),
              eq(walletShares.userId, transactions.paidByUserId),
            ),
          )
          .where(
            and(
              eq(transactions.accountId, input.accountId),
              gte(transactions.date, startDate),
              lte(transactions.date, endDate),
            ),
          )
          .orderBy(transactions.date);

        const splitInputs = txs
          .filter((tx) => tx.paidByUserId)
          .map((tx) => ({
            ...tx,
            paidByUserId: tx.paidByUserId as string,
          }));

        const split = calculateSplit(splitInputs, members);
        return {
          isShared: true,
          totalSpent: split.totalSpent,
          members: split.members,
          transactions: transactionList,
        };
      };

      return secureDb ? await secureDb.rls(runQuery) : await runQuery(db);
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          `Private Procedure Error - getWalletSplitSummary. An unspecified error occurred: ${error}`,
      });
    }
  });
