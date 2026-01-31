"use client";

import { convertAmountFromMiliunits, formatDateRange } from "@/lib/utils";
import { useGetTransactionsParam } from "@/services/report/hooks/use-get-transactions-param";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PiggyBank, TrendingDown, TrendingUp } from "lucide-react";
import { DataCard, DataCardLoading } from "./data-card";
import { SettleUpCard } from "./settle-up-card";
import { TransactionDetailsDialog } from "./transaction-details-dialog";

type Props = {
  id?: string;
};

export const DataGrid = ({}: Props) => {
  const { from, to, accountId } = useGetTransactionsParam();
  const trpc = useTRPC();
  const [detailType, setDetailType] = useState<"income" | "expense" | null>(
    null,
  );
  const { data, isLoading, isFetching, isPending } = useSuspenseQuery(
    trpc.getSummary.queryOptions({ from, to, accountId }),
  );
  const { data: transactionsData } = useSuspenseQuery(
    trpc.getTransactions.queryOptions({ from, to, accountId }),
  );
  const filteredTransactions = useMemo(() => {
    if (!detailType) return [];
    return transactionsData.filter((tx) => {
      if (tx.isSettlement) return false;
      return detailType === "income" ? tx.amount > 0 : tx.amount < 0;
    });
  }, [detailType, transactionsData]);
  const formattedData = {
    ...data,
    incomeAmount: convertAmountFromMiliunits(data.incomeAmount),
    expenseAmount: convertAmountFromMiliunits(data.expensesAmount),
    remainingAmount: convertAmountFromMiliunits(data.remainingAmount),
    categories: data.categories.map((category) => ({
      ...category,
      value: convertAmountFromMiliunits(category.value),
    })),
    days: data.days.map((day) => ({
      ...day,
      income: convertAmountFromMiliunits(day.income),
      expenses: convertAmountFromMiliunits(day.expenses),
    })),
  };
  const dateRangeLabel = formatDateRange({ to, from });

  if (isLoading || isFetching || isPending) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-2 mb-8">
        <DataCardLoading />
        <DataCardLoading />
        <DataCardLoading />
      </div>
    );
  }
  return (
    <div className="space-y-6 pb-2 mb-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <DataCard
          title="Remaining"
          value={formattedData.remainingAmount}
          percentageChange={formattedData.remainingChange}
          icon={PiggyBank}
          variant={
            formattedData.remainingChange > 0 ? "success" : "destructive"
          }
          dateRange={dateRangeLabel}
        />
        <DataCard
          title="Income"
          value={formattedData.incomeAmount}
          percentageChange={formattedData.incomeChange}
          icon={TrendingUp}
          variant="success"
          dateRange={dateRangeLabel}
          onClick={() => setDetailType("income")}
        />
        <DataCard
          title="Expenses"
          value={formattedData.expenseAmount}
          percentageChange={formattedData.expensesChange}
          icon={TrendingDown}
          variant="destructive"
          dateRange={dateRangeLabel}
          onClick={() => setDetailType("expense")}
        />
      </div>
      <SettleUpCard />
      {detailType && (
        <TransactionDetailsDialog
          open={!!detailType}
          onOpenChange={(open) => setDetailType(open ? detailType : null)}
          type={detailType}
          dateRangeLabel={dateRangeLabel}
          transactions={filteredTransactions}
        />
      )}
    </div>
  );
};
