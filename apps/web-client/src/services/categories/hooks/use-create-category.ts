"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useNewCategory } from "./use-new-category";
import { useState } from "react";
import { useInvalidateCategoryQueries } from "./use-invalidate-category-queries";

export function useCreateCategory() {
  const trpc = useTRPC();
  const { onClose } = useNewCategory();
  const { invalidateList, invalidateSummary } = useInvalidateCategoryQueries();
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();

  const mutation = useMutation(
    trpc.postCategory.mutationOptions({
      onMutate: () => {
        setError(undefined);
        setSuccess(undefined);
      },
      onSuccess: () => {
        toast.success("Category created");

        setSuccess("Category created successfully!");
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
