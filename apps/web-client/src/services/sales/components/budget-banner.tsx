"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Wallet, TrendingDown, Calendar, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface BudgetBannerProps {
  remaining: number;
  spent: number;
  income: number;
  safeToSpend: number;
  daysLeftInMonth: number;
  spentPercent: number;
  isLoading?: boolean;
}

export const BudgetBanner = memo(function BudgetBanner({
  remaining,
  spent,
  income,
  safeToSpend,
  daysLeftInMonth,
  spentPercent,
  isLoading = false,
}: BudgetBannerProps) {
  if (isLoading) {
    return <BudgetBannerSkeleton />;
  }

  const isHealthy = spentPercent < 80;
  const isWarning = spentPercent >= 80 && spentPercent < 95;
  const isCritical = spentPercent >= 95;

  const progressColor = isCritical
    ? "from-red-500 to-red-600"
    : isWarning
      ? "from-amber-500 to-orange-500"
      : "from-emerald-500 to-teal-500";

  const textColor = isCritical
    ? "text-red-600 dark:text-red-400"
    : isWarning
      ? "text-amber-600 dark:text-amber-400"
      : "text-emerald-600 dark:text-emerald-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-6 rounded-xl border bg-card p-4 shadow-sm"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left: Main Budget Info */}
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full",
              isHealthy && "bg-emerald-100 dark:bg-emerald-900/30",
              isWarning && "bg-amber-100 dark:bg-amber-900/30",
              isCritical && "bg-red-100 dark:bg-red-900/30",
            )}
          >
            <Wallet className={cn("h-5 w-5", textColor)} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Monthly Budget Left</p>
            <p className={cn("text-2xl font-bold", textColor)}>
              $
              {remaining.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
        </div>

        {/* Right: Stats */}
        <div className="flex items-center gap-6">
          {/* Daily Safe to Spend */}
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-pink-500" />
            <div>
              <p className="text-xs text-muted-foreground">Safe per day</p>
              <p className="text-sm font-semibold">
                $
                {safeToSpend.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
          </div>

          {/* Days Left */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-purple-500" />
            <div>
              <p className="text-xs text-muted-foreground">Days left</p>
              <p className="text-sm font-semibold">{daysLeftInMonth}</p>
            </div>
          </div>

          {/* Spent */}
          <div className="hidden sm:flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Spent</p>
              <p className="text-sm font-semibold">
                ${spent.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>{Math.round(spentPercent)}% of budget used</span>
          <span>
            ${spent.toLocaleString(undefined, { maximumFractionDigits: 0 })} / $
            {income.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(spentPercent, 100)}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={cn("h-full rounded-full bg-linear-to-r", progressColor)}
          />
        </div>
      </div>
    </motion.div>
  );
});

function BudgetBannerSkeleton() {
  return (
    <div className="mb-6 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-20" />
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-12" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-8" />
          </div>
          <div className="hidden sm:block space-y-1">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-1">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    </div>
  );
}

export { BudgetBannerSkeleton };
