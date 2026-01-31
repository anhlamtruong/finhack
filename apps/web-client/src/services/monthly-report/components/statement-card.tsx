"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn, convertAmountFromMiliunits, formatCurrency } from "@/lib/utils";
import type { MonthlyReportOutput } from "@/services/monthly-report/types";

const formatMonthLabel = (month: string) => {
  const [year, monthValue] = month.split("-");
  return `${monthValue}/${year}`;
};

const getPercent = (spent: number, budget: number) => {
  if (budget <= 0) {
    return spent > 0 ? 100 : 0;
  }
  return Math.round((spent / budget) * 100);
};

type ProgressStatus = "good" | "medium" | "bad";

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

const statusToProgressClass = (status: ProgressStatus) => {
  if (status === "bad") return "bg-destructive";
  if (status === "medium") return "bg-muted-foreground";
  return "bg-primary";
};

const statusToAmountClass = (status: ProgressStatus) => {
  if (status === "bad") return "text-destructive";
  if (status === "medium") return "text-muted-foreground";
  return "text-primary";
};

export const StatementCard = ({ report }: { report: MonthlyReportOutput }) => {
  const totalBudget = convertAmountFromMiliunits(report.totalBudget);
  const totalSpent = convertAmountFromMiliunits(report.totalSpent);
  const breakdown = [...report.categoryBreakdown]
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);

  return (
    <Card className="border-none shadow-sm transition hover:shadow-md cursor-pointer">
      <CardHeader className="gap-2">
        <CardTitle className="text-lg font-semibold">
          {formatMonthLabel(report.month)}
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          {formatCurrency(totalSpent)} spent / {formatCurrency(totalBudget)}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {breakdown.map((item) => {
          const percent = Math.min(100, getPercent(item.spent, item.budget));
          const status = getStatus(item.goalType ?? "expense", percent);
          return (
            <div key={item.categoryId} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate">{item.categoryName}</span>
                <span
                  className={cn("tabular-nums", statusToAmountClass(status))}
                >
                  {formatCurrency(convertAmountFromMiliunits(item.spent))}
                </span>
              </div>
              <Progress
                value={percent}
                className="h-2"
                indicatorClassName={statusToProgressClass(status)}
                aria-label={`${item.categoryName} spent ${formatCurrency(convertAmountFromMiliunits(item.spent))}`}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
