"use client";

import { useState } from "react";
import { Filter, X, RotateCcw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { SalesFilters } from "@/store/sales-store";

interface SalesFiltersProps {
  filters: SalesFilters;
  onFiltersChange: (filters: Partial<SalesFilters>) => void;
  onReset: () => void;
  monthlyRemaining?: number;
}

const PRICE_MIN = 0;
const PRICE_MAX = 500;

function FiltersContent({
  filters,
  onFiltersChange,
  onReset,
  monthlyRemaining,
}: SalesFiltersProps) {
  const [priceRange, setPriceRange] = useState<[number, number]>([
    filters.priceMin ?? PRICE_MIN,
    filters.priceMax ?? PRICE_MAX,
  ]);

  const handlePriceChange = (value: number[]) => {
    setPriceRange([value[0], value[1]]);
  };

  const handlePriceCommit = () => {
    onFiltersChange({
      priceMin: priceRange[0] === PRICE_MIN ? undefined : priceRange[0],
      priceMax: priceRange[1] === PRICE_MAX ? undefined : priceRange[1],
    });
  };

  const hasActiveFilters =
    filters.womenFocus ||
    filters.onlyAffordable ||
    filters.priceMin !== undefined ||
    filters.priceMax !== undefined;

  return (
    <div className="space-y-6">
      {/* Reset Button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={onReset}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset all filters
        </Button>
      )}

      {/* Women-Owned Focus Toggle */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Special Focus</Label>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="women-focus" className="text-sm font-medium">
              Women-Owned Businesses
            </Label>
            <p className="text-xs text-muted-foreground">
              Prioritize deals from women-owned brands
            </p>
          </div>
          <Switch
            id="women-focus"
            checked={filters.womenFocus}
            onCheckedChange={(checked) =>
              onFiltersChange({ womenFocus: checked })
            }
            className={cn(
              filters.womenFocus &&
                "data-[state=checked]:bg-linear-to-r data-[state=checked]:from-pink-500 data-[state=checked]:to-purple-500",
            )}
          />
        </div>
      </div>

      {/* Only Affordable Toggle */}
      {monthlyRemaining !== undefined && monthlyRemaining > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Budget Control</Label>
          <div className="flex items-center justify-between rounded-lg border p-3 bg-emerald-50/50 dark:bg-emerald-900/10">
            <div className="space-y-0.5">
              <Label
                htmlFor="only-affordable"
                className="text-sm font-medium flex items-center gap-2"
              >
                <Wallet className="h-4 w-4 text-emerald-600" />
                Only Show Affordable
              </Label>
              <p className="text-xs text-muted-foreground">
                Show deals under $
                {monthlyRemaining.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
            <Switch
              id="only-affordable"
              checked={filters.onlyAffordable}
              onCheckedChange={(checked) =>
                onFiltersChange({ onlyAffordable: checked })
              }
              className={cn(
                filters.onlyAffordable &&
                  "data-[state=checked]:bg-linear-to-r data-[state=checked]:from-emerald-500 data-[state=checked]:to-teal-500",
              )}
            />
          </div>
        </div>
      )}

      {/* Price Range */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Price Range</Label>
          <span className="text-sm text-muted-foreground">
            ${priceRange[0]} - ${priceRange[1]}
            {priceRange[1] === PRICE_MAX && "+"}
          </span>
        </div>
        <Slider
          value={priceRange}
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={10}
          onValueChange={handlePriceChange}
          onValueCommit={handlePriceCommit}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>${PRICE_MIN}</span>
          <span>${PRICE_MAX}+</span>
        </div>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">
            Active Filters
          </Label>
          <div className="flex flex-wrap gap-2">
            {filters.womenFocus && (
              <Badge
                variant="secondary"
                className="bg-linear-to-r from-pink-500/10 to-purple-500/10 text-pink-700 dark:text-pink-300"
              >
                Women-Owned
                <button
                  className="ml-1 hover:text-foreground"
                  onClick={() => onFiltersChange({ womenFocus: false })}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.onlyAffordable && (
              <Badge
                variant="secondary"
                className="bg-linear-to-r from-emerald-500/10 to-teal-500/10 text-emerald-700 dark:text-emerald-300"
              >
                <Wallet className="h-3 w-3 mr-1" />
                Affordable Only
                <button
                  className="ml-1 hover:text-foreground"
                  onClick={() => onFiltersChange({ onlyAffordable: false })}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {(filters.priceMin !== undefined ||
              filters.priceMax !== undefined) && (
              <Badge variant="secondary">
                ${filters.priceMin ?? PRICE_MIN} - $
                {filters.priceMax ?? PRICE_MAX}
                {(filters.priceMax ?? PRICE_MAX) === PRICE_MAX && "+"}
                <button
                  className="ml-1 hover:text-foreground"
                  onClick={() =>
                    onFiltersChange({
                      priceMin: undefined,
                      priceMax: undefined,
                    })
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Desktop Sidebar
export function SalesFiltersSidebar(props: SalesFiltersProps) {
  return (
    <aside className="hidden lg:block w-72 shrink-0 sticky top-24">
      <div className="rounded-xl border bg-card p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filters
        </h2>
        <FiltersContent {...props} />
      </div>
    </aside>
  );
}

// Mobile Sheet
export function SalesFiltersSheet(props: SalesFiltersProps) {
  const [open, setOpen] = useState(false);

  const hasActiveFilters =
    props.filters.womenFocus ||
    props.filters.onlyAffordable ||
    props.filters.priceMin !== undefined ||
    props.filters.priceMax !== undefined;

  const activeFilterCount =
    (props.filters.womenFocus ? 1 : 0) +
    (props.filters.onlyAffordable ? 1 : 0) +
    (props.filters.priceMin !== undefined ||
    props.filters.priceMax !== undefined
      ? 1
      : 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="lg"
          className="lg:hidden fixed bottom-6 right-6 z-40 rounded-full shadow-lg h-14 w-14 p-0"
          variant={hasActiveFilters ? "default" : "secondary"}
        >
          <Filter className="h-5 w-5" />
          {hasActiveFilters && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-[10px] text-white">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </SheetTitle>
        </SheetHeader>
        <FiltersContent {...props} />
      </SheetContent>
    </Sheet>
  );
}

export { FiltersContent as SalesFiltersContent };
