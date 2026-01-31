"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useInvalidateAccountQueries } from "@/services/accounts/hooks/use-invalidate-account-queries";

export function useAcceptInvite() {
  const trpc = useTRPC();
  const { invalidateIncomingInvites, invalidateAll } =
    useInvalidateAccountQueries();

  return useMutation(
    trpc.acceptInvite.mutationOptions({
      onSuccess: () => {
        toast.success("Invite accepted");
        invalidateIncomingInvites();
        invalidateAll();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to accept invite");
      },
    }),
  );
}
