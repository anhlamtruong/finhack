"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Search, Sparkles, ShoppingBag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DealCard } from "@/services/sales/components/deal-card";
import { DealCardSkeletonGrid } from "@/services/sales/components/deal-card-skeleton";
import {
  SalesFiltersSidebar,
  SalesFiltersSheet,
} from "@/services/sales/components/sales-filters";
import {
  SuggestionChipsWrapper,
  type ChipTheme,
} from "@/services/sales/components/suggestion-chips";
import { BudgetBanner } from "@/services/sales/components/budget-banner";
import { useSalesSearch } from "@/services/sales/hooks/use-sales-search";
import { useSalesSuggest } from "@/services/sales/hooks/use-sales-suggest";
import { useSalesFeedback } from "@/services/sales/hooks/use-sales-feedback";
import { useSalesBudget } from "@/services/sales/hooks/use-sales-budget";
import type { Deal } from "@/services/sales/types";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function SalesContent() {
  const {
    data,
    isLoading,
    isFetching,
    filters,
    localQuery,
    setLocalQuery,
    setFilters,
    resetFilters,
    querySent,
    showSuggestions,
  } = useSalesSearch();

  // Fetch budget data
  const {
    remaining: monthlyRemaining,
    spent,
    income,
    safeToSpend,
    daysLeftInMonth,
    spentPercent,
    isLoading: isBudgetLoading,
  } = useSalesBudget();

  // Use useSalesSuggest when input is empty
  const { suggestions, isLoading: isSuggestionsLoading } = useSalesSuggest(
    {
      goal: "shopping",
      budgetMax: monthlyRemaining || filters.priceMax,
      womenFocus: filters.womenFocus || undefined,
    },
    { enabled: showSuggestions },
  );

  const [chipTheme, setChipTheme] = useState<ChipTheme>("women-empower");

  const { recordClick, recordSave, recordDismiss, isDismissed } =
    useSalesFeedback({
      query: filters.query,
      budgetMax: monthlyRemaining || filters.priceMax,
    });

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastUrlRef = useRef<string>("");
  const initializedFromUrlRef = useRef(false);

  // Filter out dismissed deals and apply onlyAffordable filter
  const visibleDeals = (data as Deal[]).filter((deal: Deal) => {
    if (isDismissed(deal.id || deal.url)) return false;
    if (filters.onlyAffordable && monthlyRemaining > 0) {
      const dealPrice = deal.price ?? 0;
      if (dealPrice > monthlyRemaining) return false;
    }
    return true;
  });

  const topDeals = useMemo(
    () =>
      visibleDeals.slice(0, 3).map((deal) => ({
        title: deal.title,
        price: deal.price ?? null,
        priceText: deal.priceText ?? null,
        source: deal.source ?? null,
      })),
    [visibleDeals],
  );

  useEffect(() => {
    if (initializedFromUrlRef.current) return;
    const urlQuery = searchParams?.get("q");
    if (urlQuery && !localQuery.trim()) {
      setLocalQuery(urlQuery);
    }
    initializedFromUrlRef.current = true;
  }, [localQuery, searchParams, setLocalQuery]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString());
    const trimmedQuery = localQuery.trim();

    if (trimmedQuery) {
      params.set("q", trimmedQuery);
    } else {
      params.delete("q");
    }

    if (trimmedQuery && topDeals.length > 0) {
      params.set("topDeals", JSON.stringify(topDeals));
    } else {
      params.delete("topDeals");
    }

    const nextUrl = params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname;

    if (nextUrl !== lastUrlRef.current) {
      lastUrlRef.current = nextUrl;
      router.replace(nextUrl, { scroll: false });
    }
  }, [localQuery, pathname, router, searchParams, topDeals]);

  return (
    <div className="max-w-7xl mx-auto w-full px-4 pb-10 -mt-12">
      <Card className="border-none drop-shadow-sm">
        <CardHeader className="gap-y-2">
          <CardTitle className="text-xl line-clamp-1">Sales</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Budget Banner */}
          <BudgetBanner
            remaining={monthlyRemaining}
            spent={spent}
            income={income}
            safeToSpend={safeToSpend}
            daysLeftInMonth={daysLeftInMonth}
            spentPercent={spentPercent}
            isLoading={isBudgetLoading}
          />

          {/* Hero Search Section */}
          <section className="py-8 lg:py-12">
            <div className="text-center mb-8">
              <h1 className="text-3xl lg:text-4xl font-bold bg-linear-to-r from-pink-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-3">
                Empowering Sales
              </h1>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Discover amazing deals curated just for you. Support women-owned
                businesses and find the best products at unbeatable prices.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search for deals, brands, or products..."
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                className="pl-12 pr-4 h-14 text-lg rounded-full border-2 focus-visible:ring-pink-500/20 focus-visible:border-pink-500"
              />
              {isFetching && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <Sparkles className="h-5 w-5 text-pink-500 animate-pulse" />
                </div>
              )}
            </div>

            {/* Suggestion Chips - shown when search is empty */}
            <SuggestionChipsWrapper
              show={showSuggestions}
              suggestions={suggestions as string[]}
              onSelect={(query) => setLocalQuery(query)}
              isLoading={isSuggestionsLoading}
              theme={chipTheme}
              onThemeChange={setChipTheme}
            />

            {/* Quick Stats */}
            {data.length > 0 && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                Found{" "}
                <span className="font-semibold text-foreground">
                  {visibleDeals.length}
                </span>{" "}
                deals
                {filters.womenFocus && " from women-owned businesses"}
              </p>
            )}
            {querySent && querySent !== filters.query && (
              <p className="text-center text-xs text-muted-foreground mt-2">
                Search adjusted to:{" "}
                <span className="font-medium">{querySent}</span>
              </p>
            )}
          </section>

          {/* Main Content with Sidebar */}
          <div className="flex gap-8">
            {/* Desktop Sidebar */}
            <SalesFiltersSidebar
              filters={filters}
              onFiltersChange={setFilters}
              onReset={resetFilters}
              monthlyRemaining={monthlyRemaining}
            />

            {/* Deals Grid */}
            <main className="flex-1 min-w-0">
              {isLoading ? (
                <DealCardSkeletonGrid count={8} />
              ) : visibleDeals.length === 0 ? (
                <EmptyState query={localQuery} onReset={resetFilters} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
                  {visibleDeals.map((deal) => (
                    <DealCard
                      key={deal.id || deal.url}
                      deal={deal}
                      isDismissed={isDismissed(deal.id || deal.url)}
                      monthlyRemaining={monthlyRemaining}
                      onClick={recordClick}
                      onSave={recordSave}
                      onDismiss={recordDismiss}
                    />
                  ))}
                </div>
              )}
            </main>
          </div>

          {/* Mobile Filter Sheet */}
          <SalesFiltersSheet
            filters={filters}
            onFiltersChange={setFilters}
            onReset={resetFilters}
            monthlyRemaining={monthlyRemaining}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({
  query,
  onReset,
}: {
  query: string;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Image
        src="/sales/shopping-cart.svg"
        alt="No deals found"
        width={200}
        height={200}
        className="mb-6 opacity-80"
      />
      <h3 className="text-xl font-semibold mb-2">No deals found</h3>
      <p className="text-muted-foreground max-w-md mb-6">
        {query
          ? `We couldn't find any deals matching "${query}". Try adjusting your search or filters.`
          : "Start searching to discover amazing deals!"}
      </p>
      {query && (
        <button
          onClick={onReset}
          className="text-pink-600 hover:text-pink-700 font-medium underline underline-offset-4"
        >
          Clear search and filters
        </button>
      )}
    </div>
  );
}

export default function SalesPage() {
  return (
    <Suspense fallback={<SalesPageSkeleton />}>
      <SalesContent />
    </Suspense>
  );
}

function SalesPageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto w-full px-4 pb-10">
      {/* Hero skeleton */}
      <section className="py-8 lg:py-12">
        <div className="text-center mb-8">
          <div className="h-10 w-64 bg-muted rounded-lg mx-auto mb-3 animate-pulse" />
          <div className="h-5 w-96 max-w-full bg-muted rounded mx-auto animate-pulse" />
        </div>
        <div className="max-w-2xl mx-auto h-14 bg-muted rounded-full animate-pulse" />
      </section>

      <div className="flex gap-8">
        {/* Sidebar skeleton */}
        <aside className="hidden lg:block w-72 shrink-0">
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="h-6 w-20 bg-muted rounded animate-pulse" />
            <div className="h-20 bg-muted rounded animate-pulse" />
            <div className="h-16 bg-muted rounded animate-pulse" />
          </div>
        </aside>

        {/* Grid skeleton */}
        <main className="flex-1 min-w-0">
          <DealCardSkeletonGrid count={8} />
        </main>
      </div>
    </div>
  );
}
