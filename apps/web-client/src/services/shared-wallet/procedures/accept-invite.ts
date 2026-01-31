import { db } from "@/db";
import { walletShares } from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

export const acceptInvite = authedProcedure
  .input(z.object({ shareId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    try {
      const secureDb = ctx.secureDb;
      type DbTransaction = Parameters<typeof db.transaction>[0] extends (
        tx: infer T,
      ) => Promise<unknown> ? T
        : never;

      const runAccept = async (dbClient: DbTransaction | typeof db) => {
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
        if (share.userEmail !== email) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        const [updated] = await dbClient
          .update(walletShares)
          .set({ status: "accepted", userId: ctx.user.id })
          .where(
            and(
              eq(walletShares.id, input.shareId),
              eq(walletShares.userEmail, email),
            ),
          )
          .returning();

        return updated;
      };

      const data = secureDb
        ? await secureDb.rls(runAccept)
        : await runAccept(db);
      return {
        status: "success",
        data,
        message: "Invite accepted",
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          `Private Procedure Error - acceptInvite. An unspecified error occurred: ${error}`,
      });
    }
  });
