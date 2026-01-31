"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useOpenCategory } from "./use-open-category";
import { useInvalidateCategoryQueries } from "./use-invalidate-category-queries";

export function useDeleteCategory() {
  const trpc = useTRPC();
  const { onClose, isOpen } = useOpenCategory();
  const { invalidateAll } = useInvalidateCategoryQueries();

  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();

  const mutation = useMutation(
    trpc.deleteCategory.mutationOptions({
      onMutate: () => {
        setError(undefined);
        setSuccess(undefined);
      },
      onSuccess: (data) => {
        toast.success("Category deleted");
        setSuccess("Category deleted successfully!");
        invalidateAll(data?.data?.id);

        if (isOpen) {
          onClose();
        }
      },
      onError: (error) => {
        setError(error.message || "Failed to delete Category");
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
