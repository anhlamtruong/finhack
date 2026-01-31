"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, convertAmountFromMiliunits, formatCurrency } from "@/lib/utils";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

export type CurrentMonthCategoryRow = {
  id: string;
  name: string;
  monthlyBudget: number;
  spent: number;
  variance: number;
  goalType: string;
  ownerName: string;
};

type ProgressStatus = "good" | "medium" | "bad";

const getPercent = (spent: number, budget: number) => {
  if (budget <= 0) {
    return spent > 0 ? 100 : 0;
  }
  return Math.round((spent / budget) * 100);
};

/**
 * Maps a category's progress % into a UI status used for colors/badges.
 *
 * Rules:
 * - Saving categories: <50% = BAD, 50–89% = MEDIUM, >=90% = GOOD
 * - Expense categories: >90% = BAD, 50–90% = MEDIUM, <50% = GOOD
 */
const getStatus = (goalType: string, percent: number): ProgressStatus => {
  if (goalType === "saving") {
    if (percent < 50) return "bad";
    if (percent < 90) return "medium";
    return "good";
  }

  if (percent > 90) return "bad";
  if (percent >= 50) return "medium";
  return "good";
};

const statusToBadgeVariant = (status: ProgressStatus) => {
  if (status === "bad") return "destructive";
  if (status === "medium") return "secondary";
  return "default";
};

const statusToTextClass = (status: ProgressStatus) =>
  status === "bad"
    ? "text-destructive"
    : status === "medium"
      ? "text-muted-foreground"
      : "text-primary";

const statusToIndicatorClass = (status: ProgressStatus) =>
  status === "bad"
    ? "bg-destructive"
    : status === "medium"
      ? "bg-primary/50"
      : "bg-primary";

export const currentMonthOverviewColumns: ColumnDef<CurrentMonthCategoryRow>[] =
  [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Category
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
    },
    {
      accessorKey: "monthlyBudget",
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Monthly Budget
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const amount = convertAmountFromMiliunits(row.original.monthlyBudget);
        return (
          <div className="text-left font-medium">
            <span
              className={cn(
                "tabular-nums",
                amount < 0 ? "text-destructive" : "text-primary",
              )}
            >
              {formatCurrency(amount)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "spent",
      header: () => <div className="w-full text-left">Actual</div>,
      cell: ({ row }) => {
        const spent = row.original.spent;
        const budget = row.original.monthlyBudget;
        const spentAmount = convertAmountFromMiliunits(spent);
        const budgetAmount = convertAmountFromMiliunits(budget);
        const percent = getPercent(spent, budget);
        const status = getStatus(row.original.goalType, percent);
        const indicatorClass = statusToIndicatorClass(status);

        return (
          <div className="flex flex-col gap-2">
            <span
              className={cn(
                "tabular-nums font-medium",
                statusToTextClass(status),
              )}
            >
              {formatCurrency(spentAmount)}
            </span>
            <Progress
              value={Math.min(100, percent)}
              className="h-2"
              indicatorClassName={indicatorClass}
              aria-label={`Spent ${formatCurrency(spentAmount)} of ${formatCurrency(budgetAmount)}`}
            />
          </div>
        );
      },
    },
    {
      id: "spentPercentage",
      header: () => <div className="w-full text-left">Actual %</div>,
      cell: ({ row }) => {
        const budget = row.original.monthlyBudget;
        const spent = row.original.spent;
        const percent = getPercent(spent, budget);
        const status = getStatus(row.original.goalType, percent);

        return (
          <div className="flex items-center justify-center">
            <Badge variant={statusToBadgeVariant(status)}>{percent}%</Badge>
          </div>
        );
      },
    },
    {
      accessorKey: "variance",
      header: () => <div className="w-full text-left">Variance</div>,
      cell: ({ row }) => {
        const varianceAmount = convertAmountFromMiliunits(
          row.original.variance,
        );
        const percent = getPercent(
          row.original.spent,
          row.original.monthlyBudget,
        );
        const status = getStatus(row.original.goalType, percent);
        return (
          <div className="text-left font-medium">
            <span className={cn("tabular-nums", statusToTextClass(status))}>
              {formatCurrency(varianceAmount)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "goalType",
      header: "Type",
      cell: ({ row }) =>
        row.original.goalType === "expense" ? (
          <Badge variant="destructive">{row.original.goalType}</Badge>
        ) : (
          <Badge>{row.original.goalType}</Badge>
        ),
    },
    {
      accessorKey: "ownerName",
      header: "Owner",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.ownerName}</span>
      ),
    },
  ];
