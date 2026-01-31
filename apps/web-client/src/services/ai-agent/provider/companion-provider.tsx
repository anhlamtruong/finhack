"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import type { RouterOutputs } from "@/types/trpc";
import { usePathname, useSearchParams } from "next/navigation";

type CompanionsOutput = RouterOutputs["getCompanions"];
type CompanionRow = CompanionsOutput[number];

/**
 * Provider value for companion selection + routing context.
 */
type CompanionContextValue = {
  companions: CompanionsOutput;
  activeCompanion: CompanionRow | null;
  isLoading: boolean;
  pageContext: { path: string; params: Record<string, string> };
  setActiveCompanionId: (id: string) => void;
};

const CompanionContext = createContext<CompanionContextValue | null>(null);

/**
 * Loads companions for the authenticated user and exposes the active one.
 */
export function CompanionProvider({ children }: { children: React.ReactNode }) {
  const trpc = useTRPC();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data, isLoading } = useQuery({
    ...trpc.getCompanions.queryOptions(),
    staleTime: 1000 * 60,
  });
  const companions = data ?? [];
  const [activeCompanionId, setActiveCompanionId] = useState<string | null>(
    null,
  );
  const [pageContext, setPageContext] = useState<{
    path: string;
    params: Record<string, string>;
  }>({ path: "", params: {} });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params: Record<string, string> = {};
      searchParams?.forEach((value, key) => {
        params[key] = value;
      });
      setPageContext({ path: pathname ?? "", params });
    }, 200);

    return () => window.clearTimeout(timer);
  }, [pathname, searchParams]);

  const effectiveActiveCompanionId = useMemo(() => {
    if (!activeCompanionId) {
      return companions[0]?.id ?? null;
    }

    const exists = companions.some(
      (companion) => companion.id === activeCompanionId,
    );
    return exists ? activeCompanionId : (companions[0]?.id ?? null);
  }, [activeCompanionId, companions]);

  const activeCompanion = useMemo(() => {
    if (!effectiveActiveCompanionId) return null;
    return (
      companions.find(
        (companion) => companion.id === effectiveActiveCompanionId,
      ) ?? null
    );
  }, [effectiveActiveCompanionId, companions]);

  const value = useMemo(
    () => ({
      companions,
      activeCompanion,
      isLoading,
      pageContext,
      setActiveCompanionId: (id: string) => setActiveCompanionId(id),
    }),
    [activeCompanion, companions, isLoading, pageContext],
  );

  return (
    <CompanionContext.Provider value={value}>
      {children}
    </CompanionContext.Provider>
  );
}

/**
 * Access the active companion and page context.
 */
export function useActiveCompanion() {
  const context = useContext(CompanionContext);
  if (!context) {
    throw new Error("useActiveCompanion must be used within CompanionProvider");
  }
  return context;
}
