import { db } from "@/db";
import { accounts, selectAccountSchema } from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

export const getAccount = authedProcedure
  .input(selectAccountSchema.pick({ id: true }))
  .query(async ({ ctx, input }) => {
    try {
      const secureDb = ctx.secureDb;
      const [data] = secureDb
        ? await secureDb.rls((tx) =>
          tx
            .select({
              id: accounts.id,
              name: accounts.name,
            })
            .from(accounts)
            .where(
              and(eq(accounts.userId, ctx.user.id), eq(accounts.id, input.id)),
            )
        )
        : await db
          .select({
            id: accounts.id,
            name: accounts.name,
          })
          .from(accounts)
          .where(
            and(eq(accounts.userId, ctx.user.id), eq(accounts.id, input.id)),
          );
      if (!data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            `Private Procedure Error - getAccount. Could not find the account.`,
        });
      }
      return data;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          `Private Procedure Error - getAccount. An unspecified error occurred: ${error}`,
      });
    }
  });
