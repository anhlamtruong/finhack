"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useOpenAccount } from "./use-open-account";
import { useInvalidateAccountQueries } from "./use-invalidate-account-queries";

export function useDeleteAccount() {
  const trpc = useTRPC();
  const { onClose, isOpen } = useOpenAccount();
  const { invalidateAll } = useInvalidateAccountQueries();

  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();

  const mutation = useMutation(
    trpc.deleteAccount.mutationOptions({
      onMutate: () => {
        setError(undefined);
        setSuccess(undefined);
      },
      onSuccess: (data) => {
        toast.success("Account deleted");
        setSuccess("Account deleted successfully!");
        invalidateAll(data?.data?.id);

        if (isOpen) {
          onClose();
        }
      },
      onError: (error) => {
        setError(error.message || "Failed to delete account");
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
