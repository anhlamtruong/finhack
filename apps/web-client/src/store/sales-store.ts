"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SalesFilters {
  query: string;
  priceMin?: number;
  priceMax?: number;
  womenFocus: boolean;
  onlyAffordable: boolean;
}

interface SalesStore {
  filters: SalesFilters;
  setQuery: (query: string) => void;
  setPriceRange: (min?: number, max?: number) => void;
  setWomenFocus: (womenFocus: boolean) => void;
  setFilters: (filters: Partial<SalesFilters>) => void;
  resetFilters: () => void;
}

const DEFAULT_FILTERS: SalesFilters = {
  query: "",
  priceMin: undefined,
  priceMax: undefined,
  womenFocus: false,
  onlyAffordable: false,
};

export const useSalesStore = create<SalesStore>()(
  persist(
    (set) => ({
      filters: DEFAULT_FILTERS,
      setQuery: (query: string) =>
        set((state) => ({
          filters: { ...state.filters, query },
        })),
      setPriceRange: (priceMin?: number, priceMax?: number) =>
        set((state) => ({
          filters: { ...state.filters, priceMin, priceMax },
        })),
      setWomenFocus: (womenFocus: boolean) =>
        set((state) => ({
          filters: { ...state.filters, womenFocus },
        })),
      setFilters: (newFilters: Partial<SalesFilters>) =>
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
        })),
      resetFilters: () =>
        set({
          filters: DEFAULT_FILTERS,
        }),
    }),
    {
      name: "sales-filters-storage",
    }
  )
);
