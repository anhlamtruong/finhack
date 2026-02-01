"use client";

import { useState, useCallback } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Deal, SalesFeedbackInput } from "@/services/sales/types";

type SalesFeedbackContext = {
  query?: string;
  budgetMax?: number;
};

export const useSalesFeedback = (context?: SalesFeedbackContext) => {
  const trpc = useTRPC();

  // Track dismissed deals for optimistic UI
  const [dismissedDealIds, setDismissedDealIds] = useState<Set<string>>(
    new Set()
  );

  const mutation = useMutation(
    trpc.sales.recordFeedback.mutationOptions({
      onSuccess: (_, variables) => {
        if (variables.type === "dismiss") {
          toast.success("Thanks for your feedback!");
        } else if (variables.type === "save") {
          toast.success("Deal saved!");
        }
      },
      onError: (error, variables) => {
        // Rollback optimistic update on error
        if (variables.type === "dismiss") {
          setDismissedDealIds((prev) => {
            const next = new Set(prev);
            next.delete(variables.dealId);
            return next;
          });
        }
        toast.error("Failed to record feedback");
        console.error("Feedback error:", error);
      },
    })
  );

  const recordFeedback = useCallback(
    (input: SalesFeedbackInput) => {
      // Optimistic update for dismiss
      if (input.type === "dismiss") {
        setDismissedDealIds((prev) => new Set(prev).add(input.dealId));
      }

      mutation.mutate(input);
    },
    [mutation]
  );

  const recordClick = useCallback(
    (deal: Deal) => {
      recordFeedback({
        dealId: deal.id || deal.url,
        type: "click",
        query: context?.query,
        budgetMax: context?.budgetMax,
        itemTitle: deal.title,
      });
    },
    [recordFeedback, context?.query, context?.budgetMax]
  );

  const recordSave = useCallback(
    (deal: Deal) => {
      recordFeedback({
        dealId: deal.id || deal.url,
        type: "save",
        query: context?.query,
        budgetMax: context?.budgetMax,
        itemTitle: deal.title,
      });
    },
    [recordFeedback, context?.query, context?.budgetMax]
  );

  const recordDismiss = useCallback(
    (deal: Deal) => {
      recordFeedback({
        dealId: deal.id || deal.url,
        type: "dismiss",
        query: context?.query,
        budgetMax: context?.budgetMax,
        itemTitle: deal.title,
      });
    },
    [recordFeedback, context?.query, context?.budgetMax]
  );

  const isDismissed = useCallback(
    (dealId: string) => dismissedDealIds.has(dealId),
    [dismissedDealIds]
  );

  return {
    recordFeedback,
    recordClick,
    recordSave,
    recordDismiss,
    isDismissed,
    dismissedDealIds,
    isLoading: mutation.isPending,
  };
};
