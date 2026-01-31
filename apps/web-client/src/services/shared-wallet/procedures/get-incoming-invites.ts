import { db } from "@/db";
import { accounts, walletShares } from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";

export const getIncomingInvites = authedProcedure.query(async ({ ctx }) => {
  try {
    const secureDb = ctx.secureDb;
    type DbTransaction = Parameters<typeof db.transaction>[0] extends (
      tx: infer T,
    ) => Promise<unknown> ? T
      : never;

    const runQuery = async (dbClient: DbTransaction | typeof db) => {
      const email = ctx.user.emailAddresses[0]?.emailAddress;
      if (!email) {
        return [];
      }

      return dbClient
        .select({
          id: walletShares.id,
          accountId: accounts.id,
          accountName: accounts.name,
          accountOwnerEmail: accounts.userEmail,
          userEmail: walletShares.userEmail,
          role: walletShares.role,
          contributionSplit: walletShares.contributionSplit,
          status: walletShares.status,
          createdAt: walletShares.createdAt,
        })
        .from(walletShares)
        .innerJoin(accounts, eq(walletShares.accountId, accounts.id))
        .where(
          and(
            eq(walletShares.userEmail, email),
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
        `Private Procedure Error - getIncomingInvites. An unspecified error occurred: ${error}`,
    });
  }
});
