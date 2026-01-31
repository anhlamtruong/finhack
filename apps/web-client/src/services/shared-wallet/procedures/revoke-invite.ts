import { db } from "@/db";
import { accounts, walletShares } from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { distributeSplits } from "../utils/distribute-splits";

export const revokeInvite = authedProcedure
  .input(z.object({ shareId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    try {
      const secureDb = ctx.secureDb;
      type DbTransaction = Parameters<typeof db.transaction>[0] extends (
        tx: infer T,
      ) => Promise<unknown> ? T
        : never;

      const runRevoke = async (dbClient: DbTransaction | typeof db) => {
        const [share] = await dbClient
          .select({
            id: walletShares.id,
            accountId: walletShares.accountId,
            status: walletShares.status,
          })
          .from(walletShares)
          .where(eq(walletShares.id, input.shareId));

        if (!share) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Invite not found",
          });
        }

        if (share.status !== "pending") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Invite is no longer pending",
          });
        }

        const [account] = await dbClient
          .select({ id: accounts.id, userId: accounts.userId })
          .from(accounts)
          .where(eq(accounts.id, share.accountId));

        if (!account || account.userId !== ctx.user.id) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        const [deleted] = await dbClient
          .delete(walletShares)
          .where(
            and(
              eq(walletShares.id, input.shareId),
              eq(walletShares.status, "pending"),
            ),
          )
          .returning();

        const acceptedMembers = await dbClient
          .select({ userId: walletShares.userId })
          .from(walletShares)
          .where(
            and(
              eq(walletShares.accountId, deleted.accountId),
              eq(walletShares.status, "accepted"),
            ),
          );

        const pendingShares = await dbClient
          .select({ contributionSplit: walletShares.contributionSplit })
          .from(walletShares)
          .where(
            and(
              eq(walletShares.accountId, deleted.accountId),
              eq(walletShares.status, "pending"),
            ),
          );

        const pendingTotal = pendingShares.reduce(
          (sum, share) => sum + (share.contributionSplit ?? 0),
          0,
        );

        const remaining = Math.max(0, 100 - pendingTotal);

        const allocations = distributeSplits(
          acceptedMembers.map((member) => member.userId),
          remaining,
        );

        await Promise.all(
          allocations.map((allocation) =>
            dbClient
              .update(walletShares)
              .set({ contributionSplit: allocation.contributionSplit })
              .where(
                and(
                  eq(walletShares.accountId, deleted.accountId),
                  eq(walletShares.userId, allocation.userId),
                  eq(walletShares.status, "accepted"),
                ),
              ),
          ),
        );

        return deleted;
      };

      const data = secureDb
        ? await secureDb.rls(runRevoke)
        : await runRevoke(db);

      return { status: "success", data, message: "Invite revoked" };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          `Private Procedure Error - revokeInvite. An unspecified error occurred: ${error}`,
      });
    }
  });
