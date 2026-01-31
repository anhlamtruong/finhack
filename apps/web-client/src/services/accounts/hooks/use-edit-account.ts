"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useOpenAccount } from "./use-open-account"; //
import { useInvalidateAccountQueries } from "./use-invalidate-account-queries";

export function useEditAccount() {
  const trpc = useTRPC();
  const { onClose } = useOpenAccount();
  const { invalidateAll } = useInvalidateAccountQueries();

  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();

  const mutation = useMutation(
    trpc.updateAccount.mutationOptions({
      onMutate: () => {
        setError(undefined);
        setSuccess(undefined);
      },
      onSuccess: (data) => {
        toast.success("Account updated");
        setSuccess("Account updated successfully!");
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
