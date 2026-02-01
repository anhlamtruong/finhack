"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

export const useSalesBudget = () => {
  const trpc = useTRPC();

  const { data, isLoading, error, refetch } = useQuery({
    ...trpc.sales.getBudget.queryOptions(),
    staleTime: 2 * 60 * 1000, // 2 minute cache
    refetchOnWindowFocus: true,
  });

  return {
    remaining: data?.remaining ?? 0,
    spent: data?.spent ?? 0,
    income: data?.income ?? 0,
    safeToSpend: data?.safeToSpend ?? 0,
    daysLeftInMonth: data?.daysLeftInMonth ?? 0,
    totalDaysInMonth: data?.totalDaysInMonth ?? 30,
    spentPercent: data?.spentPercent ?? 0,
    lastUpdated: data?.lastUpdated,
    isLoading,
    error,
    refetch,
  };
};
        