import { db } from "@/db";
import { accounts, walletShares } from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

const updateSplitSchema = z.object({
  accountId: z.string(),
  splits: z.array(
    z.object({
      userId: z.string(),
      contributionSplit: z.number().int().min(0).max(100),
    }),
  ),
});

export const updateWalletSplit = authedProcedure
  .input(updateSplitSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const secureDb = ctx.secureDb;
      type DbTransaction = Parameters<typeof db.transaction>[0] extends (
        tx: infer T,
      ) => Promise<unknown> ? T
        : never;

      const runUpdate = async (dbClient: DbTransaction | typeof db) => {
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

        const ownerShare = await dbClient
          .select({ role: walletShares.role })
          .from(walletShares)
          .where(
            and(
              eq(walletShares.accountId, input.accountId),
              eq(walletShares.userId, ctx.user.id),
              eq(walletShares.status, "accepted"),
            ),
          );

        const canEditSplits = account.userId === ctx.user.id ||
          ownerShare.some(
            (share) => share.role === "owner" || share.role === "editor",
          );
        if (!canEditSplits) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }

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

        const targetTotal = Math.max(0, 100 - pendingTotal);
        const total = input.splits.reduce(
          (sum, item) => sum + item.contributionSplit,
          0,
        );
        if (total !== targetTotal) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Contribution splits must sum to ${targetTotal}.`,
          });
        }

        const userIds = input.splits.map((split) => split.userId);
        const members = await dbClient
          .select({ userId: walletShares.userId })
          .from(walletShares)
          .where(
            and(
              eq(walletShares.accountId, input.accountId),
              inArray(walletShares.userId, userIds),
              eq(walletShares.status, "accepted"),
            ),
          );

        const existingMemberIds = new Set(members.map((m) => m.userId));

        for (const split of input.splits) {
          if (existingMemberIds.has(split.userId)) {
            await dbClient
              .update(walletShares)
              .set({ contributionSplit: split.contributionSplit })
              .where(
                and(
                  eq(walletShares.accountId, input.accountId),
                  eq(walletShares.userId, split.userId),
                ),
              );
          } else if (split.userId === account.userId) {
            await dbClient
              .insert(walletShares)
              .values({
                id: uuidv4(),
                accountId: input.accountId,
                userId: account.userId,
                userEmail: account.userEmail ??
                  ctx.user.emailAddresses[0].emailAddress,
                role: "owner",
                contributionSplit: split.contributionSplit,
                status: "accepted",
              });
          } else {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "All splits must belong to account members.",
            });
          }
        }

        return { status: "success" };
      };

      return secureDb ? await secureDb.rls(runUpdate) : await runUpdate(db);
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          `Private Procedure Error - updateWalletSplit. An unspecified error occurred: ${error}`,
      });
    }
  });
