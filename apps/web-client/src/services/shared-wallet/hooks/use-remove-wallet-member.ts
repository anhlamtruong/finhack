"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useInvalidateAccountQueries } from "@/services/accounts/hooks/use-invalidate-account-queries";

export function useRemoveWalletMember(accountId?: string) {
  const trpc = useTRPC();
  const { invalidateAll, invalidateWalletMembers, invalidateWalletSplitSummary } =
    useInvalidateAccountQueries();

  return useMutation(
    trpc.removeWalletMember.mutationOptions({
      onSuccess: () => {
        toast.success("Member removed");
        if (accountId) {
          invalidateWalletMembers(accountId);
        }
        invalidateWalletSplitSummary();
        invalidateAll(accountId);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to remove member");
      },
    }),
  );
}
