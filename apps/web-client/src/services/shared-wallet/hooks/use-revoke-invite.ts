"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useInvalidateAccountQueries } from "@/services/accounts/hooks/use-invalidate-account-queries";

export function useRevokeInvite(accountId?: string) {
  const trpc = useTRPC();
  const { invalidateAccountInvites } = useInvalidateAccountQueries();

  return useMutation(
    trpc.revokeInvite.mutationOptions({
      onSuccess: () => {
        toast.success("Invite revoked");
        if (accountId) {
          invalidateAccountInvites(accountId);
        }
      },
      onError: (error) => {
        toast.error(error.message || "Failed to revoke invite");
      },
    }),
  );
}
