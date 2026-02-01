"use client";

import { useEffect, useMemo, useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useSalesStore } from "@/store/sales-store";
import type { SalesSearchInput } from "@/services/sales/types";

const DEBOUNCE_MS = 400;

export const useSalesSearch = () => {
  const trpc = useTRPC();
  const { filters, setFilters, resetFilters } = useSalesStore();
  const [localQuery, setLocalQuery] = useState(() => filters.query);

  const setFiltersWithQuery = (next: Partial<SalesSearchInput>) => {
    if (typeof next.query === "string") {
      setLocalQuery(next.query);
    }
    setFilters(next);
  };

  const resetFiltersWithQuery = () => {
    resetFilters();
    setLocalQuery("");
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localQuery !== filters.query) {
        setFilters({ query: localQuery });
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [filters.query, localQuery, setFilters]);

  const input: SalesSearchInput = useMemo(
    () => ({
      query: filters.query.trim(),
      priceMin: filters.priceMin,
      priceMax: filters.priceMax,
      womenFocus: filters.womenFocus || undefined,
      withReasons: true,
      reasonsMax: 5,
    }),
    [filters]
  );

  const shouldSearch = Boolean(input.query);
  const showSuggestions = !localQuery.trim();

  const { data, isLoading, isFetching } = useQuery(
    trpc.sales.search.queryOptions(input, {
      staleTime: 5 * 60 * 1000,
      enabled: shouldSearch,
    })
  );

  return {
    data: shouldSearch ? data?.items ?? [] : [],
    querySent: shouldSearch ? data?.querySent ?? input.query : "",
    resultCount: shouldSearch ? data?.count ?? data?.items?.length ?? 0 : 0,
    isLoading,
    isFetching,
    filters,
    localQuery,
    setLocalQuery,
    setFilters: setFiltersWithQuery,
    resetFilters: resetFiltersWithQuery,
    showSuggestions,
  };
};
