"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export const useInvalidatePlaidQueries = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidateConnectedBank = () =>
    queryClient.invalidateQueries({ queryKey: ["connected-bank"] });

  const invalidateAccounts = () =>
    queryClient.invalidateQueries(trpc.getAccounts.queryFilter());

  const invalidateCategories = () =>
    queryClient.invalidateQueries(trpc.getCategories.queryFilter());

  const invalidateTransactions = () =>
    queryClient.invalidateQueries(trpc.getTransactions.queryFilter());

  const invalidateSummary = () =>
    queryClient.invalidateQueries(trpc.getSummary.queryFilter());

  const invalidateAll = () => {
    invalidateConnectedBank();
    invalidateAccounts();
    invalidateCategories();
    invalidateTransactions();
    invalidateSummary();
  };

  return {
    invalidateConnectedBank,
    invalidateAccounts,
    invalidateCategories,
    invalidateTransactions,
    invalidateSummary,
    invalidateAll,
  };
};
