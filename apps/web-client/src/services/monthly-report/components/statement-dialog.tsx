"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useTRPC } from "@/trpc/client";
import { exportStatementPdf } from "@/services/monthly-report/utils/export-statement-pdf";
import { useSuspenseQuery } from "@tanstack/react-query";
import { endOfMonth, format, parse, startOfMonth } from "date-fns";
import { toast } from "sonner";
import {
  cn,
  convertAmountFromMiliunits,
  formatCurrency,
  formatDate,
} from "@/lib/utils";
import type { MonthlyReportOutput } from "@/services/monthly-report/types";
import { StatementCard } from "@/services/monthly-report/components/statement-card";
import { filterReportCategories } from "@/services/monthly-report/utils/filter-report-categories";

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

const isTransactionRelevant = (goalType: string, amount: number) => {
  if (goalType === "saving") return amount > 0;
  return amount < 0;
};

const formatMonthLabel = (month: string) => {
  const [year, monthValue] = month.split("-");
  return `${monthValue}/${year}`;
};

type StatementDialogProps = {
  report: MonthlyReportOutput;
};

export const StatementDialog = ({ report }: StatementDialogProps) => {
  const trpc = useTRPC();
  const monthDate = parse(`${report.month}-01`, "yyyy-MM-dd", new Date());
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

  const categoryTypeById = new Map(
    categories.map((category) => [category.id, category.goalType]),
  );

  const filteredCategories = filterReportCategories(report, transactions);

  const transactionsByCategory = (categoryId: string, goalType: string) =>
    transactions.filter(
      (transaction) =>
        transaction.categoryId === categoryId &&
        isTransactionRelevant(goalType, transaction.amount),
    );

  const totalBudget = convertAmountFromMiliunits(report.totalBudget);
  const totalSpent = convertAmountFromMiliunits(report.totalSpent);

  const onExportPdf = () => {
    const element = document.querySelector(
      "[data-statement-export]",
    ) as HTMLElement | null;
    if (!element) return;
    const ok = exportStatementPdf(
      element,
      `${formatMonthLabel(report.month)} statement`,
    );
    if (!ok) {
      toast.error("Popup blocked. Allow popups to export PDF.");
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
        >
          <StatementCard report={report} />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl! w-[95vw] p-0">
        <DialogHeader className="px-6 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <DialogTitle>
                {formatMonthLabel(report.month)} details
              </DialogTitle>
              <DialogDescription>
                Monthly breakdown by category with transactions.
              </DialogDescription>
            </div>
            <Button size="sm" variant="secondary" onClick={onExportPdf}>
              Export PDF
            </Button>
          </div>
        </DialogHeader>
        <ScrollArea className="max-h-[75vh] px-6 pb-6" data-statement-export>
          <div className="space-y-6">
            <div className="text-sm text-muted-foreground">
              {formatCurrency(totalSpent)} spent / {formatCurrency(totalBudget)}
            </div>

            {filteredCategories.map((item) => {
              const goalType =
                categoryTypeById.get(item.categoryId) ?? "expense";
              const percent = getPercent(item.spent, item.budget);
              const status = getStatus(goalType, percent);
              const categoryTransactions = transactionsByCategory(
                item.categoryId,
                goalType,
              );

              return (
                <div
                  key={item.categoryId}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="truncate text-base font-semibold">
                        {item.categoryName}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {categoryTransactions.length} transactions
                      </p>
                    </div>
                    <Badge variant={statusToBadgeVariant(status)}>
                      {percent}%
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-5 text-sm">
                    <div>
                      <p className="text-muted-foreground">Budget</p>
                      <p className="font-medium">
                        {formatCurrency(
                          convertAmountFromMiliunits(item.budget),
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Actual</p>
                      <p
                        className={cn("font-medium", statusToTextClass(status))}
                      >
                        {formatCurrency(convertAmountFromMiliunits(item.spent))}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Variance</p>
                      <p
                        className={cn("font-medium", statusToTextClass(status))}
                      >
                        {formatCurrency(
                          convertAmountFromMiliunits(item.variance),
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Type</p>
                      <Badge
                        variant={
                          goalType === "expense" ? "destructive" : "default"
                        }
                      >
                        {goalType}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Actual %</p>
                      <p className="font-medium">{percent}%</p>
                    </div>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-md border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Payee</TableHead>
                          <TableHead>Account</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categoryTransactions.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              className="text-center text-sm text-muted-foreground"
                            >
                              No transactions for this category.
                            </TableCell>
                          </TableRow>
                        ) : (
                          categoryTransactions.map((transaction) => (
                            <TableRow key={transaction.id}>
                              <TableCell>
                                {formatDate(transaction.date)}
                              </TableCell>
                              <TableCell className="max-w-50 truncate">
                                {transaction.payee}
                              </TableCell>
                              <TableCell className="max-w-40 truncate">
                                {transaction.account}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatCurrency(
                                  convertAmountFromMiliunits(
                                    Math.abs(transaction.amount),
                                  ),
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
