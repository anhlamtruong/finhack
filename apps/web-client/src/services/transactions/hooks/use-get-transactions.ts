"use client";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useGetTransactionsParam } from "./use-transaction-param";

export const useGetTransactions = () => {
  const { from, to, accountId } = useGetTransactionsParam();
  const trpc = useTRPC();
  //TODO: Check if params are needed in the key
  const { data } = useSuspenseQuery(
    trpc.getTransactions.queryOptions({ from, to, accountId })
  );

  return data;
};
