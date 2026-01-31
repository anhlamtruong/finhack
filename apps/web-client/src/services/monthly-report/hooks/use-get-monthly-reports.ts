"use client";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";

export const useGetMonthlyReports = () => {
  const trpc = useTRPC();
  const { data, isLoading } = useSuspenseQuery(
    trpc.getMonthlyReports.queryOptions(undefined, {
      staleTime: 10 * 60 * 1000,
    }),
  );

  return { data, isLoading };
};
