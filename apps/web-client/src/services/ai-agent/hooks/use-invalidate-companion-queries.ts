"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export const useInvalidateCompanionQueries = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidateList = () =>
    queryClient.invalidateQueries(trpc.getCompanions.queryFilter());

  const invalidateCompanion = (id: string) =>
    queryClient.invalidateQueries(trpc.getCompanion.queryFilter({ id }));

  return {
    invalidateList,
    invalidateCompanion,
  };
};