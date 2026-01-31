import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";

export const deleteAccount = authedProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    try {
      const secureDb = ctx.secureDb;
      const [data] = secureDb
        ? await secureDb.rls((tx) =>
          tx
            .delete(accounts)
            .where(
              and(eq(accounts.id, input.id), eq(accounts.userId, ctx.user.id)),
            )
            .returning()
        )
        : await db
          .delete(accounts)
          .where(
            and(eq(accounts.id, input.id), eq(accounts.userId, ctx.user.id)),
          )
          .returning();

      if (!data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Account not found or you do not have permission to delete it.",
        });
      }

      return {
        status: "success",
        data,
        message: "Account deleted successfully",
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      console.error("Delete account error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete account",
      });
    }
  });
