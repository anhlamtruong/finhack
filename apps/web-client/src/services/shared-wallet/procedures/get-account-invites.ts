import { db } from "@/db";
import { accounts, walletShares } from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

export const getAccountInvites = authedProcedure
  .input(z.object({ accountId: z.string() }))
  .query(async ({ ctx, input }) => {
    try {
      const secureDb = ctx.secureDb;
      type DbTransaction = Parameters<typeof db.transaction>[0] extends (
        tx: infer T,
      ) => Promise<unknown> ? T
        : never;

      const runQuery = async (dbClient: DbTransaction | typeof db) => {
        const [account] = await dbClient
          .select({ id: accounts.id, userId: accounts.userId })
          .from(accounts)
          .where(eq(accounts.id, input.accountId));

        if (!account) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Account not found",
          });
        }

        if (account.userId !== ctx.user.id) {
          return [];
        }

        return dbClient
          .select({
            id: walletShares.id,
            userEmail: walletShares.userEmail,
            role: walletShares.role,
            contributionSplit: walletShares.contributionSplit,
            status: walletShares.status,
            createdAt: walletShares.createdAt,
          })
          .from(walletShares)
          .where(
            and(
              eq(walletShares.accountId, input.accountId),
              eq(walletShares.status, "pending"),
            ),
          )
          .orderBy(desc(walletShares.createdAt));
      };

      return secureDb ? await secureDb.rls(runQuery) : await runQuery(db);
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          `Private Procedure Error - getAccountInvites. An unspecified error occurred: ${error}`,
      });
    }
  });
