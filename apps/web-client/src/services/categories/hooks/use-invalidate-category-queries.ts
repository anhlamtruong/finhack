"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export const useInvalidateCategoryQueries = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidateList = () =>
    queryClient.invalidateQueries(trpc.getCategories.queryFilter());

  const invalidateSummary = () =>
    queryClient.invalidateQueries(trpc.getSummary.queryFilter());

  const invalidateTransactions = () =>
    queryClient.invalidateQueries(trpc.getTransactions.queryFilter());

  const invalidateCategory = (id: string) =>
    queryClient.invalidateQueries(trpc.getCategory.queryFilter({ id }));

  const invalidateAll = (categoryId?: string) => {
    invalidateList();
    invalidateSummary();
    invalidateTransactions();
    if (categoryId) {
      invalidateCategory(categoryId);
    }
  };

  return {
    invalidateList,
    invalidateSummary,
    invalidateTransactions,
    invalidateCategory,
    invalidateAll,
  };
};
