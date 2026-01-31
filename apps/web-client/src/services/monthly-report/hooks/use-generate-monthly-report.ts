"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const useGenerateMonthlyReport = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    trpc.generateMonthlyReport.mutationOptions({
      onSuccess: () => {
        toast.success("Monthly report generated");
        queryClient.invalidateQueries(trpc.getMonthlyReports.queryFilter());
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate monthly report");
      },
    }),
  );

  return mutation;
};
