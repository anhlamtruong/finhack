"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useShareAccount } from "./use-share-account";
import { useInvalidateAccountQueries } from "@/services/accounts/hooks/use-invalidate-account-queries";

export function useInviteAccount() {
  const trpc = useTRPC();
  const { onClose, id } = useShareAccount();
  const { invalidateAll } = useInvalidateAccountQueries();

  const mutation = useMutation(
    trpc.inviteUserToAccount.mutationOptions({
      onSuccess: () => {
        toast.success("Invitation sent");
        invalidateAll(id);
        onClose();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to send invite");
      },
    }),
  );

  return mutation;
}
