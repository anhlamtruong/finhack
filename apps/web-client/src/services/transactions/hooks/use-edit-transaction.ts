"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useOpenTransaction } from "./use-open-transaction"; //
import { useInvalidateTransactionQueries } from "./use-invalidate-transaction-queries";

export function useEditTransaction() {
  const trpc = useTRPC();
  const { onClose } = useOpenTransaction();
  const { invalidateAll } = useInvalidateTransactionQueries();

  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();

  const mutation = useMutation(
    trpc.patchTransaction.mutationOptions({
      onMutate: () => {
        setError(undefined);
        setSuccess(undefined);
      },
      onSuccess: (data) => {
        toast.success("Transaction updated");
        setSuccess("Transaction updated successfully!");
        invalidateAll(data?.data?.id);

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
    errorMsg: error,
    successMsg: success,
  };
}
