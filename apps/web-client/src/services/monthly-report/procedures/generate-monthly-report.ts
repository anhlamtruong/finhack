import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { format } from "date-fns";
import { generateMonthlyStatement } from "@/services/monthly-report/utils/generate-statement";
import { db } from "@/db";

const generateMonthlyReportSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
});

export const generateMonthlyReport = authedProcedure
  .input(generateMonthlyReportSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const month = input.month ?? format(new Date(), "yyyy-MM");
      const secureDb = ctx.secureDb;
      type DbTransaction = Parameters<typeof db.transaction>[0] extends (
        tx: infer T,
      ) => Promise<unknown>
        ? T
        : never;
      const runGenerate = async (dbClient: DbTransaction | typeof db) =>
        generateMonthlyStatement({
          db: dbClient,
          userId: ctx.user.id,
          month,
        });
      const report = secureDb
        ? await secureDb.rls(runGenerate)
        : await runGenerate(db);

      return report;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          `Private Procedure Error - generateMonthlyReport. An unspecified error occurred: ${error}`,
      });
    }
  });
