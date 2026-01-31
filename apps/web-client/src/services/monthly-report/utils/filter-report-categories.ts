import type { MonthlyReportOutput } from "@/services/monthly-report/types";
import type { TransactionOutput } from "@/services/transactions/types";

/**
 * Filters report categories to those that appear in the month.
 * A category is included if it has at least one transaction in the month
 * or if its budget/spent values are non-zero.
 */
export const filterReportCategories = (
  report: MonthlyReportOutput,
  transactions: TransactionOutput[],
) => {
  const categoryIdsWithActivity = new Set(
    transactions
      .map((transaction) => transaction.categoryId)
      .filter(Boolean) as string[],
  );

  return report.categoryBreakdown.filter(
    (item) =>
      categoryIdsWithActivity.has(item.categoryId) ||
      item.budget !== 0 ||
      item.spent !== 0,
  );
};
