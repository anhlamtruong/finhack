"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useState } from "react";
import { useInvalidateAccountQueries } from "./use-invalidate-account-queries";

export function useDeleteAccounts() {
  const trpc = useTRPC();
  const { invalidateAll } = useInvalidateAccountQueries();
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();

  const mutation = useMutation(
    trpc.deleteAccounts.mutationOptions({
      onMutate: () => {
        setError(undefined);
        setSuccess(undefined);
      },
      onSuccess: () => {
        toast.success("Accounts Deleted");
        setSuccess("Accounts Deleted successfully!");
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
