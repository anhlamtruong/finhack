import { accounts, insertAccountSchema, walletShares } from "@/db/schema";

import { TRPCError } from "@trpc/server";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/db";
import { authedProcedure } from "@/server/init";

export const postAccount = authedProcedure
  .input(insertAccountSchema.pick({ name: true }))
  .mutation(async ({ ctx, input }) => {
    try {
      const secureDb = ctx.secureDb;
      type DbTransaction = Parameters<typeof db.transaction>[0] extends (
        tx: infer T,
      ) => Promise<unknown> ? T
        : never;

      const createAccount = async (dbClient: DbTransaction | typeof db) => {
        const [created] = await dbClient
          .insert(accounts)
          .values({
            userId: ctx.user.id,
            id: uuidv4(),
            name: input.name,
            userEmail: ctx.user.emailAddresses[0].emailAddress,
          })
          .returning();

        await dbClient.insert(walletShares).values({
          id: uuidv4(),
          accountId: created.id,
          userId: ctx.user.id,
          userEmail: ctx.user.emailAddresses[0].emailAddress,
          role: "owner",
          contributionSplit: 100,
          status: "accepted",
        });

        return created;
      };

      const data = secureDb
        ? await secureDb.rls((tx) => createAccount(tx))
        : await createAccount(db);
      return {
        status: "success",
        data: data,
        message: "Post Account Successfully",
      };
    } catch (error) {
      console.error("❌ Database Error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          `Private Procedure Error - postAccount. An unspecified error occurred: ${error}`,
      });
    }
  });
