"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useOpenCategory } from "./use-open-category"; //
import { useInvalidateCategoryQueries } from "./use-invalidate-category-queries";

export function useEditCategory() {
  const trpc = useTRPC();
  const { onClose } = useOpenCategory();
  const { invalidateAll } = useInvalidateCategoryQueries();

  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();

  const mutation = useMutation(
    trpc.updateCategory.mutationOptions({
      onMutate: () => {
        setError(undefined);
        setSuccess(undefined);
      },
      onSuccess: (data) => {
        toast.success("Category updated");
        setSuccess("Category updated successfully!");
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
