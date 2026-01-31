import { db } from "@/db";
import { accounts, insertAccountSchema } from "@/db/schema";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const patchAccountSchema = z.object({
  id: z.string(),
  name: insertAccountSchema.shape.name,
});

export const patchAccount = authedProcedure
  .input(patchAccountSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const { id, ...values } = input;

      const secureDb = ctx.secureDb;
      const [data] = secureDb
        ? await secureDb.rls((tx) =>
          tx
            .update(accounts)
            .set(values)
            .where(and(eq(accounts.id, id), eq(accounts.userId, ctx.user.id)))
            .returning()
        )
        : await db
          .update(accounts)
          .set(values)
          .where(and(eq(accounts.id, id), eq(accounts.userId, ctx.user.id)))
          .returning();

      if (!data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Account not found or you do not have permission to update it.",
        });
      }

      return {
        status: "success",
        data: data,
        message: "Account updated successfully",
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      console.error("❌ Database Error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update account",
      });
    }
  });
