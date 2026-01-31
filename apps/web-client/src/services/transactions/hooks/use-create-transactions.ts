"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useNewTransaction } from "./use-new-transaction";
import { useState } from "react";
import { useInvalidateTransactionQueries } from "./use-invalidate-transaction-queries";

export function useCreateTransactions() {
  const trpc = useTRPC();
  const { onClose } = useNewTransaction();
  const { invalidateAll } = useInvalidateTransactionQueries();
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();

  const mutation = useMutation(
    trpc.postTransactions.mutationOptions({
      onMutate: () => {
        setError(undefined);
        setSuccess(undefined);
      },
      onSuccess: () => {
        toast.success("Transactions created");

        setSuccess("Transactions created successfully!");
        invalidateAll();
        onClose();
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
