import { db } from "@/db";
import { walletShares } from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { distributeSplits } from "../utils/distribute-splits";

export const declineInvite = authedProcedure
  .input(z.object({ shareId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    try {
      const secureDb = ctx.secureDb;
      type DbTransaction = Parameters<typeof db.transaction>[0] extends (
        tx: infer T,
      ) => Promise<unknown> ? T
        : never;

      const runDecline = async (dbClient: DbTransaction | typeof db) => {
        const [share] = await dbClient
          .select({
            id: walletShares.id,
            userEmail: walletShares.userEmail,
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

        const email = ctx.user.emailAddresses[0]?.emailAddress;
        if (!email || share.userEmail !== email) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        if (share.status !== "pending") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Invite is no longer pending",
          });
        }

        const [deleted] = await dbClient
          .delete(walletShares)
          .where(
            and(
              eq(walletShares.id, input.shareId),
              eq(walletShares.userEmail, email),
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

        return deleted;
      };

      const data = secureDb
        ? await secureDb.rls(runDecline)
        : await runDecline(db);

      return { status: "success", data, message: "Invite declined" };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          `Private Procedure Error - declineInvite. An unspecified error occurred: ${error}`,
      });
    }
  });
