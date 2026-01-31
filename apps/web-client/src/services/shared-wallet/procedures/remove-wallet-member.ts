import { db } from "@/db";
import { accounts, walletShares } from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { distributeSplits } from "../utils/distribute-splits";

const removeMemberSchema = z.object({
  accountId: z.string(),
  userId: z.string(),
});

export const removeWalletMember = authedProcedure
  .input(removeMemberSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const secureDb = ctx.secureDb;
      type DbTransaction = Parameters<typeof db.transaction>[0] extends (
        tx: infer T,
      ) => Promise<unknown>
        ? T
        : never;

      const runRemove = async (dbClient: DbTransaction | typeof db) => {
        const [account] = await dbClient
          .select({ id: accounts.id, userId: accounts.userId })
          .from(accounts)
          .where(eq(accounts.id, input.accountId));

        if (!account) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
        }

        const [currentShare] = await dbClient
          .select({ role: walletShares.role })
          .from(walletShares)
          .where(
            and(
              eq(walletShares.accountId, input.accountId),
              eq(walletShares.userId, ctx.user.id),
              eq(walletShares.status, "accepted"),
            ),
          );

        const canManage = account.userId === ctx.user.id ||
          currentShare?.role === "owner";
        if (!canManage) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        if (input.userId === account.userId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot remove the account owner.",
          });
        }

        const [deleted] = await dbClient
          .delete(walletShares)
          .where(
            and(
              eq(walletShares.accountId, input.accountId),
              eq(walletShares.userId, input.userId),
              eq(walletShares.status, "accepted"),
            ),
          )
          .returning();

        if (!deleted) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Member not found.",
          });
        }

        const acceptedMembers = await dbClient
          .select({ userId: walletShares.userId })
          .from(walletShares)
          .where(
            and(
              eq(walletShares.accountId, input.accountId),
              eq(walletShares.status, "accepted"),
            ),
          );

        const pendingShares = await dbClient
          .select({ contributionSplit: walletShares.contributionSplit })
          .from(walletShares)
          .where(
            and(
              eq(walletShares.accountId, input.accountId),
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
                  eq(walletShares.accountId, input.accountId),
                  eq(walletShares.userId, allocation.userId),
                  eq(walletShares.status, "accepted"),
                ),
              ),
          ),
        );

        return deleted;
      };

      const data = secureDb
        ? await secureDb.rls(runRemove)
        : await runRemove(db);

      return { status: "success", data, message: "Member removed" };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          `Private Procedure Error - removeWalletMember. An unspecified error occurred: ${error}`,
      });
    }
  });
