"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useGetTransactionsParam } from "./use-transaction-param";

export const useInvalidateTransactionQueries = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { from, to, accountId } = useGetTransactionsParam();

  const invalidateList = () =>
    queryClient.invalidateQueries(
      trpc.getTransactions.queryFilter({ from, to, accountId }),
    );

  const invalidateSummary = () =>
    queryClient.invalidateQueries(
      trpc.getSummary.queryFilter({ from, to, accountId }),
    );

  const invalidateMonthlyReports = () =>
    queryClient.invalidateQueries(trpc.getMonthlyReports.queryFilter());

  const invalidateTransactions = () =>
    queryClient.invalidateQueries(trpc.getTransactions.queryFilter());
  const invalidateTransaction = (id: string) =>
    queryClient.invalidateQueries(trpc.getTransaction.queryFilter({ id }));

  const invalidateWalletSplitSummary = () =>
    queryClient.invalidateQueries(trpc.getWalletSplitSummary.queryFilter());

  const invalidateAll = (transactionId?: string) => {
    invalidateList();
    invalidateSummary();
    invalidateTransactions()
    invalidateMonthlyReports();
    if (transactionId) {
      invalidateTransaction(transactionId);
    }
    invalidateWalletSplitSummary();
  };

  return {
    invalidateList,
    invalidateSummary,
    invalidateMonthlyReports,
    invalidateTransaction,
    invalidateTransactions,
    invalidateAll,
    invalidateWalletSplitSummary,
  };
};
