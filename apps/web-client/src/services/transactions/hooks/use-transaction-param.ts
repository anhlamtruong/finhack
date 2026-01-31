"use client";
import { useSearchParams } from "next/navigation";

export const useGetTransactionsParam = () => {
  const params = useSearchParams();
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const accountId = params.get("accountId") || "";

  return { from, to, accountId };
};
