"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useNewAccount } from "./use-new-account";
import { useState } from "react";
import { useInvalidateAccountQueries } from "./use-invalidate-account-queries";

export function useCreateAccount() {
  const trpc = useTRPC();
  const { onClose } = useNewAccount();
  const { invalidateList, invalidateSummary } = useInvalidateAccountQueries();
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();

  const mutation = useMutation(
    trpc.postAccount.mutationOptions({
      onMutate: () => {
        setError(undefined);
        setSuccess(undefined);
      },
      onSuccess: () => {
        toast.success("Account created");

        setSuccess("Account created successfully!");
        invalidateList();
        invalidateSummary();
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
