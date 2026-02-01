import { format } from "date-fns";
import { generateMonthlyStatement } from "@/services/monthly-report/utils/generate-statement";
import type { db as dbClient } from "@/db";

type DbTransaction = Parameters<typeof dbClient.transaction>[0] extends (
  tx: infer T,
) => Promise<unknown>
  ? T
  : never;

type RefreshDbClient = typeof dbClient | DbTransaction;

type RefreshMonthlyReportsInput = {
  db: RefreshDbClient;
  userId: string;
  dates: Array<Date | string | null | undefined>;
};

export const refreshMonthlyReportsForDates = async ({
  db,
  userId,
  dates,
}: RefreshMonthlyReportsInput) => {
  const months = new Set<string>();

  for (const value of dates) {
    if (!value) continue;
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) continue;
    months.add(format(date, "yyyy-MM"));
  }

  const results = [];
  for (const month of months) {
    results.push(
      await generateMonthlyStatement({
        db,
        userId,
        month,
      }),
    );
  }

  return results;
};
