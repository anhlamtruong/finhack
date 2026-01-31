"use client";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { convertAmountFromMiliunits, formatCurrency } from "@/lib/utils";
import { TransactionOutput } from "@/services/transactions/types";
import { format } from "date-fns";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "income" | "expense";
  dateRangeLabel: string;
  transactions: TransactionOutput[];
};

export const TransactionDetailsDialog = ({
  open,
  onOpenChange,
  type,
  dateRangeLabel,
  transactions,
}: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {type === "income" ? "Income" : "Expenses"} transactions
          </DialogTitle>
          <DialogDescription>{dateRangeLabel}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-2">
          <div className="space-y-3">
            {transactions.length ? (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex flex-col gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{tx.payee}</span>
                        {tx.category?.name ? (
                          <Badge variant="secondary" className="text-xs">
                            {tx.category.name}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(tx.date, "MMM dd, yyyy")} · {tx.account}
                      </div>
                    </div>
                    <div
                      className={`tabular-nums font-medium ${
                        tx.amount < 0 ? "text-rose-600" : "text-emerald-600"
                      }`}
                    >
                      {formatCurrency(convertAmountFromMiliunits(tx.amount))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                No transactions in this range.
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
