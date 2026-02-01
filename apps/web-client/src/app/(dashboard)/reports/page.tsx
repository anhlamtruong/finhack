"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComponentLoader } from "@/components/ui/component-loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrentMonthOverviewTable } from "@/services/monthly-report/components/current-month-overview-table";
import { StatementDialog } from "@/services/monthly-report/components/statement-dialog";
import { useGenerateMonthlyReport } from "@/services/monthly-report/hooks/use-generate-monthly-report";
import { useGetMonthlyReports } from "@/services/monthly-report/hooks/use-get-monthly-reports";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { endOfMonth, format, parse, startOfMonth, subMonths } from "date-fns";
import { useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";

const ReportsPage = () => {
  const { data: reports, isLoading } = useGetMonthlyReports();
  const { mutate, isPending } = useGenerateMonthlyReport();
  const trpc = useTRPC();
  const { user } = useUser();
  const currentMonth = format(new Date(), "yyyy-MM");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const monthDate = parse(`${selectedMonth}-01`, "yyyy-MM-dd", new Date());
  const monthStart = format(startOfMonth(monthDate), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(monthDate), "yyyy-MM-dd");
  const { data: categories } = useSuspenseQuery(
    trpc.getCategories.queryOptions(),
  );
  const { data: transactions } = useSuspenseQuery(
    trpc.getTransactions.queryOptions({
      from: monthStart,
      to: monthEnd,
    }),
  );

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, index) => {
        const date = subMonths(new Date(), index);
        return {
          value: format(date, "yyyy-MM"),
          label: format(date, "MMMM yyyy"),
        };
      }),
    [],
  );

  const overviewRows = useMemo(() => {
    const categoryById = new Map(
      categories.map((category) => [category.id, category]),
    );
    const transactionCategories: typeof categories = [];

    for (const transaction of transactions) {
      if (!transaction.categoryId) continue;
      if (categoryById.has(transaction.categoryId)) continue;

      const fallbackCategory = {
        id: transaction.categoryId,
        name: transaction.category?.name ?? "Uncategorized",
        monthlyBudget: transaction.category?.monthlyBudget ?? 0,
        goalType: transaction.category?.goalType ?? "expense",
        userId: "",
        plaidId: null,
      };

      categoryById.set(transaction.categoryId, fallbackCategory);
      transactionCategories.push(fallbackCategory);
    }
    const spentByCategoryId = new Map<string, number>();

    for (const transaction of transactions) {
      if (!transaction.categoryId) continue;
      const category = categoryById.get(transaction.categoryId);
      if (!category) continue;

      const isSaving = category.goalType === "saving";
      const isExpense = category.goalType === "expense";

      if (isExpense && transaction.amount >= 0) {
        continue;
      }

      if (!isSaving && !isExpense) {
        continue;
      }

      const delta = isSaving
        ? transaction.amount
        : Math.abs(transaction.amount);
      const current = spentByCategoryId.get(transaction.categoryId) ?? 0;
      spentByCategoryId.set(transaction.categoryId, current + delta);
    }

    const ownerName = user?.username || user?.firstName || "Owner";

    const sharedOwnerName = ownerName === "Owner" ? "Shared" : ownerName;
    const mergedCategories = [...categories, ...transactionCategories];

    return mergedCategories.map((category) => {
      const spent = spentByCategoryId.get(category.id) ?? 0;
      const variance = (category.monthlyBudget ?? 0) - spent;
      return {
        id: category.id,
        name: category.name,
        monthlyBudget: category.monthlyBudget ?? 0,
        spent,
        variance,
        goalType: category.goalType,
        ownerName: category.userId ? ownerName : sharedOwnerName,
      };
    });
  }, [categories, transactions, user]);

  if (isLoading) {
    return <ComponentLoader></ComponentLoader>;
  }

  return (
    <div className="max-w-7xl mx-auto w-full pb-10 -mt-16 space-y-6">
      <Card className="border-none drop-shadow-sm">
        <CardHeader className="gap-y-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-xl line-clamp-1">
            Current Month Overview
          </CardTitle>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground lg:flex-row lg:items-center">
            <span>Track budget vs actual spending for</span>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-8 w-45 bg-card">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <CurrentMonthOverviewTable data={overviewRows} />
        </CardContent>
      </Card>

      <Card className="border-none drop-shadow-sm">
        <CardHeader className="gap-y-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl line-clamp-1">
              Monthly Reports
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Saved snapshots of past months for quick reference.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => mutate({ month: currentMonth })}
            disabled={isPending}
          >
            Generate Current Month
          </Button>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No reports available yet.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {reports.map((report) => (
                <StatementDialog key={report.id} report={report} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsPage;
