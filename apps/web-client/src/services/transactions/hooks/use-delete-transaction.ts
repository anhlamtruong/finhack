"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useOpenTransaction } from "./use-open-transaction";
import { useInvalidateTransactionQueries } from "./use-invalidate-transaction-queries";

export function useDeleteTransaction() {
  const trpc = useTRPC();
  const { onClose, isOpen } = useOpenTransaction();
  const { invalidateAll } = useInvalidateTransactionQueries();
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();

  const mutation = useMutation(
    trpc.deleteTransaction.mutationOptions({
      onMutate: () => {
        setError(undefined);
        setSuccess(undefined);
      },
      onSuccess: (data) => {
        toast.success("Transaction deleted");
        setSuccess("Transaction deleted successfully!");
        invalidateAll(data?.data?.id);

        if (isOpen) {
          onClose();
        }
      },
      onError: (error) => {
        setError(error.message || "Failed to delete Transaction");
        toast.error(error.message);
      },
    }),
  );

  return {
    ...mutation,
    errorMsg: error,
    successMsg: success,
  };
}
