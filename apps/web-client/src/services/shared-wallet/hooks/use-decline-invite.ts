"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useInvalidateAccountQueries } from "@/services/accounts/hooks/use-invalidate-account-queries";

export function useDeclineInvite() {
  const trpc = useTRPC();
  const { invalidateIncomingInvites } = useInvalidateAccountQueries();

  return useMutation(
    trpc.declineInvite.mutationOptions({
      onSuccess: () => {
        toast.success("Invite declined");
        invalidateIncomingInvites();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to decline invite");
      },
    }),
  );
}
