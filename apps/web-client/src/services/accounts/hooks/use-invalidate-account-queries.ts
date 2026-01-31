"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export const useInvalidateAccountQueries = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidateList = () =>
    queryClient.invalidateQueries(trpc.getAccounts.queryFilter());

  const invalidateSummary = () =>
    queryClient.invalidateQueries(trpc.getSummary.queryFilter());

  const invalidateWalletMembers = (accountId: string) =>
    queryClient.invalidateQueries(
      trpc.getWalletMembers.queryFilter({ accountId }),
    );

  const invalidateWalletSplitSummary = () =>
    queryClient.invalidateQueries(trpc.getWalletSplitSummary.queryFilter());

  const invalidateTransactions = () =>
    queryClient.invalidateQueries(trpc.getTransactions.queryFilter());

  const invalidateAccount = (id: string) =>
    queryClient.invalidateQueries(trpc.getAccount.queryFilter({ id }));

  const invalidateIncomingInvites = () =>
    queryClient.invalidateQueries(trpc.getIncomingInvites.queryFilter());

  const invalidateAccountInvites = (accountId: string) =>
    queryClient.invalidateQueries(
      trpc.getAccountInvites.queryFilter({ accountId }),
    );

  const invalidateAll = (accountId?: string) => {
    invalidateList();
    invalidateSummary();
    invalidateTransactions();
    invalidateIncomingInvites();
    if (accountId) {
      invalidateAccount(accountId);
      invalidateAccountInvites(accountId);
      invalidateWalletMembers(accountId);
    }
    invalidateWalletSplitSummary();
  };

  return {
    invalidateList,
    invalidateSummary,
    invalidateTransactions,
    invalidateAccount,
    invalidateWalletMembers,
    invalidateWalletSplitSummary,
    invalidateIncomingInvites,
    invalidateAccountInvites,
    invalidateAll,
  };
};
