"use client";

import { convertAmountFromMiliunits, formatDate } from "@/lib/utils";
import { DataCardLoading } from "./data-card";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useGetTransactionsParam } from "@/services/transactions/hooks/use-transaction-param";
import { Chart } from "./chart";
import { SpendingPieChart } from "./spending-pie-chart";

export const DataCharts = () => {
  const trpc = useTRPC();
  const { from, to, accountId } = useGetTransactionsParam();
  const { data, isLoading, isFetching, isPending } = useSuspenseQuery(
    trpc.getSummary.queryOptions({ from, to, accountId }),
  );

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
      date: formatDate(day.date),
    })),
  };

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
    <div className=" grid grid-cols-1 lg:grid-cols-6 gap-8">
      <div className=" col-span-1 lg:col-span-3 xl:col-span-4">
        <Chart data={formattedData.days} />
      </div>
      <div className="col-span-1 lg:col-span-3 xl:col-span-2">
        <SpendingPieChart data={data?.categories} />
      </div>
    </div>
  );
};
