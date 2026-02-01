"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import type { SalesSuggestInput } from "@/services/sales/types";

export const useSalesSuggest = (
  input: SalesSuggestInput,
  options?: { enabled?: boolean }
) => {
  const trpc = useTRPC();
  const { data, isLoading, isFetching } = useQuery(
    trpc.sales.suggest.queryOptions(input, {
      staleTime: 5 * 60 * 1000, // 5 minute cache
      gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
      enabled: options?.enabled ?? true,
    })
  );

  return {
    suggestions: data ?? [],
    isLoading,
    isFetching,
  };
};
