import { db } from "@/db";
import { accounts, walletShares } from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";

export const getAccounts = authedProcedure.query(async ({ ctx }) => {
  try {
    const secureDb = ctx.secureDb;
    type DbTransaction = Parameters<typeof db.transaction>[0] extends (
      tx: infer T,
    ) => Promise<unknown>
      ? T
      : never;
    const runSelect = async (dbClient: DbTransaction | typeof db) => {
      const owned = await dbClient
        .select({
          id: accounts.id,
          name: accounts.name,
          userId: accounts.userId,
          isShared: sql<boolean>`false`,
          contributionSplit: sql<number>`100`,
          role: sql<string>`'owner'`,
        })
        .from(accounts)
        .where(eq(accounts.userId, ctx.user.id));

      const shared = await dbClient
        .select({
          id: accounts.id,
          name: accounts.name,
          userId: accounts.userId,
          isShared: sql<boolean>`true`,
          contributionSplit: walletShares.contributionSplit,
          role: walletShares.role,
        })
        .from(accounts)
        .innerJoin(walletShares, eq(accounts.id, walletShares.accountId))
        .where(
          and(
            eq(walletShares.userId, ctx.user.id),
            eq(walletShares.status, "accepted"),
          ),
        );

      const merged = new Map<string, (typeof owned)[number]>();
      for (const account of [...owned, ...shared]) {
        const existing = merged.get(account.id);
        if (!existing || account.isShared) {
          merged.set(account.id, account);
        }
      }
      return Array.from(merged.values());
    };

    const data = secureDb
      ? await secureDb.rls(runSelect)
      : await runSelect(db);
    return data;
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        `Private Procedure Error - getAccounts. An unspecified error occurred: ${error}`,
    });
  }
});
