import { db } from "@/db";
import { accounts, walletShares } from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

export const getWalletMembers = authedProcedure
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

        const shares = await dbClient
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

        const hasOwner = shares.some((row) => row.userId === account.userId);
        const sharesTotal = shares.reduce(
          (sum, row) => sum + (row.contributionSplit ?? 0),
          0,
        );
        const ownerSplit = Math.max(0, 100 - sharesTotal);

        const members = hasOwner ? shares : [
          {
            userId: account.userId,
            userEmail: account.userEmail ?? "",
            role: "owner",
            contributionSplit: ownerSplit,
            status: "accepted",
          },
          ...shares,
        ];

        return members;
      };

      return secureDb ? await secureDb.rls(runQuery) : await runQuery(db);
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          `Private Procedure Error - getWalletMembers. An unspecified error occurred: ${error}`,
      });
    }
  });
