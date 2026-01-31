"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useState } from "react";
import { useInvalidateTransactionQueries } from "./use-invalidate-transaction-queries";

export function useDeleteTransactions() {
  const trpc = useTRPC();
  const { invalidateAll } = useInvalidateTransactionQueries();
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();

  const mutation = useMutation(
    trpc.deleteTransactions.mutationOptions({
      onMutate: () => {
        setError(undefined);
        setSuccess(undefined);
      },
      onSuccess: () => {
        toast.success("Transactions Deleted");
        setSuccess("Transactions Deleted successfully!");
        invalidateAll();
      },
      onError: (error) => {
        setError(error.message || "Something went wrong");
        toast.error(error.message);
      },
    }),
  );

  return {
    ...mutation,
    error,
    success,
  };
}
