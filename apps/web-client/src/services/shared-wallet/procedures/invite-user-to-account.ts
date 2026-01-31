import { db } from "@/db";
import { accounts, walletShares } from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { clerkClient } from "@clerk/nextjs/server";
import { distributeSplits } from "../utils/distribute-splits";

const inviteSchema = z.object({
  accountId: z.string(),
  userEmail: z.email(),
  role: z.enum(["owner", "editor", "viewer"]).default("viewer"),
  contributionSplit: z.number().int().min(0).max(100).default(50),
});

export const inviteUserToAccount = authedProcedure
  .input(inviteSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const secureDb = ctx.secureDb;
      type DbTransaction = Parameters<typeof db.transaction>[0] extends (
        tx: infer T,
      ) => Promise<unknown>
        ? T
        : never;

      const runInvite = async (dbClient: DbTransaction | typeof db) => {
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
            message: "Account not found.",
          });
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

        const isOwner = account.userId === ctx.user.id;
        const canInvite = isOwner || currentShare?.role === "owner" ||
          currentShare?.role === "editor";

        if (!canInvite) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Only owners or editors can invite users.",
          });
        }

        const user = await clerkClient();
        const users = await user.users.getUserList({
          emailAddress: [input.userEmail],
          limit: 1,
        });

        const invitedUser = users.data[0];

        if (!invitedUser) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "User not found for this email.",
          });
        }

        const [ownerShare] = await dbClient
          .select({ id: walletShares.id })
          .from(walletShares)
          .where(
            and(
              eq(walletShares.accountId, input.accountId),
              eq(walletShares.userId, account.userId),
              eq(walletShares.role, "owner"),
            ),
          );

        if (isOwner && !ownerShare) {
          await dbClient.insert(walletShares).values({
            id: uuidv4(),
            accountId: input.accountId,
            userId: ctx.user.id,
            userEmail: account.userEmail ??
              ctx.user.emailAddresses[0].emailAddress,
            role: "owner",
            contributionSplit: 100,
            status: "accepted",
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

        const remaining = 100 - input.contributionSplit - pendingTotal;
        if (remaining < 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Contribution splits exceed 100%.",
          });
        }
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

        const [existing] = await dbClient
          .select({ id: walletShares.id, status: walletShares.status })
          .from(walletShares)
          .where(
            and(
              eq(walletShares.accountId, input.accountId),
              eq(walletShares.userId, invitedUser.id),
            ),
          );

        if (existing) {
          if (existing.status === "pending" || existing.status === "accepted") {
            throw new TRPCError({
              code: "CONFLICT",
              message: "User already invited to this account.",
            });
          }

          const [share] = await dbClient
            .update(walletShares)
            .set({
              userEmail: input.userEmail,
              role: input.role,
              contributionSplit: input.contributionSplit,
              status: "pending",
            })
            .where(eq(walletShares.id, existing.id))
            .returning();

          return share;
        }

        const [share] = await dbClient
          .insert(walletShares)
          .values({
            id: uuidv4(),
            accountId: input.accountId,
            userId: invitedUser.id,
            userEmail: input.userEmail,
            role: input.role,
            contributionSplit: input.contributionSplit,
            status: "pending",
          })
          .returning();

        return share;
      };

      const data = secureDb
        ? await secureDb.rls(runInvite)
        : await runInvite(db);
      return {
        status: "success",
        data,
        message: "Invitation sent",
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          `Private Procedure Error - inviteUserToAccount. An unspecified error occurred: ${error}`,
      });
    }
  });
