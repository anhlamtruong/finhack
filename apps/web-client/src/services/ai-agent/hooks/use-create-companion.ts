"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useState } from "react";
import { useInvalidateCompanionQueries } from "./use-invalidate-companion-queries";

/**
 * Optional callbacks for create-companion mutation lifecycle.
 */
type UseCreateCompanionOptions = {
  onSuccess?: () => void;
  onError?: (error: { message?: string }) => void;
};

/**
 * Hook to create companions and refresh companion queries on success.
 */
export function useCreateCompanion(options?: UseCreateCompanionOptions) {
  const trpc = useTRPC();
  const { invalidateList } = useInvalidateCompanionQueries();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation(
    trpc.createCompanion.mutationOptions({
      onMutate: () => {
        setError(null);
      },
      onSuccess: () => {
        toast.success("Companion awakened!");
        invalidateList();
        options?.onSuccess?.();
      },
      onError: (err) => {
        const message = err.message || "Failed to create companion";
        setError(message);
        toast.error(message);
        options?.onError?.(err);
      },
    }),
  );

  return {
    ...mutation,
    error,
  };
}
