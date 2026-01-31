"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useState } from "react";
import { useInvalidateCategoryQueries } from "./use-invalidate-category-queries";

export function useDeleteCategories() {
  const trpc = useTRPC();
  const { invalidateList, invalidateSummary } = useInvalidateCategoryQueries();
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();

  const mutation = useMutation(
    trpc.deleteCategories.mutationOptions({
      onMutate: () => {
        setError(undefined);
        setSuccess(undefined);
      },
      onSuccess: () => {
        toast.success("Categories Deleted");
        setSuccess("Categories Deleted successfully!");
        invalidateList();
        invalidateSummary();
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
