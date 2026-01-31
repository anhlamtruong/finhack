"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useGetTransactionsParam } from "@/services/report/hooks/use-get-transactions-param";
import { convertAmountFromMiliunits, formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";

export const SettleUpCard = () => {
  const trpc = useTRPC();
  const { from, to, accountId } = useGetTransactionsParam();
  const { user } = useUser();

  const { data } = useQuery({
    ...trpc.getWalletSplitSummary.queryOptions({ accountId, from, to }),
    enabled: !!accountId,
  });

  const settleMutation = useMutation(
    trpc.postTransaction.mutationOptions({
      onSuccess: () => {
        toast.success("Settlement recorded");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to record settlement");
      },
    }),
  );

  if (!data || !data.isShared) {
    return null;
  }

  const totalSpent = convertAmountFromMiliunits(data.totalSpent);
  const currentMember = data.members.find(
    (member) => member.userId === user?.id,
  );
  const owesAmount = currentMember ? currentMember.owed : 0;
  const shouldSettle = owesAmount < 0;
  const settlementAmount = Math.abs(owesAmount);
  const settlementRecipient = data.members
    .filter((member) => member.owed > 0)
    .sort((a, b) => b.owed - a.owed)[0];
  const settlementPaid =
    data.transactions
      ?.filter((tx) => tx.isSettlement && tx.paidByUserId === user?.id)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0) ?? 0;

  return (
    <Card className="border bg-card text-card-foreground shadow-xs">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Settle Up</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="size-4 text-muted-foreground cursor-pointer" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="space-y-2 text-sm">
                  <p>
                    This card explains your shared wallet balance using four
                    simple terms:
                  </p>
                  <div className="space-y-1">
                    <div className="flex items-start gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Spent
                      </Badge>
                      <span>What a member actually paid.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Share
                      </Badge>
                      <span>The member’s portion based on the split.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Net balance
                      </Badge>
                      <span>
                        Spent minus Share. Positive means “Gets,” negative means
                        “Owes.”
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Settlements Paid
                      </Badge>
                      <span>
                        Paybacks between members. These reduce the balance but
                        don’t change split totals.
                      </span>
                    </div>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="text-sm text-muted-foreground">
          Total Group Spent: {formatCurrency(totalSpent)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentMember && (
          <div className="rounded-md border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">You spent</div>
                <div className="text-lg font-semibold">
                  {formatCurrency(
                    convertAmountFromMiliunits(currentMember.paid),
                  )}
                </div>
              </div>
              <Badge
                variant={currentMember.owed >= 0 ? "secondary" : "destructive"}
                className="text-xs"
              >
                {currentMember.owed >= 0 ? "You get" : "You owe"}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              Your share:{" "}
              {formatCurrency(convertAmountFromMiliunits(currentMember.share))}
            </div>
            <div className="text-sm text-muted-foreground">
              Net balance:{" "}
              <span
                className={
                  currentMember.owed >= 0 ? "text-emerald-600" : "text-rose-600"
                }
              >
                {formatCurrency(convertAmountFromMiliunits(currentMember.owed))}
              </span>
            </div>
            {settlementPaid > 0 && (
              <div className="text-xs text-muted-foreground">
                Settlements paid:{" "}
                {formatCurrency(convertAmountFromMiliunits(settlementPaid))}
              </div>
            )}
          </div>
        )}
        <div className="space-y-3">
          <div className="text-sm font-medium">Related transactions</div>
          {data.transactions?.length ? (
            <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
              {data.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex flex-col gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{tx.payee}</span>
                      {tx.isSettlement && (
                        <Badge variant="secondary" className="text-xs">
                          Settlement
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(tx.date, "MMM dd, yyyy")} ·{" "}
                      {tx.paidByEmail ?? "Unknown"}
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
        <div className="space-y-3">
          <div className="text-sm font-medium">Member balances</div>
          <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
            {data.members.map((member) => (
              <div
                key={member.userId}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{member.userEmail}</div>
                  <div className="text-xs text-muted-foreground">
                    Spent{" "}
                    {formatCurrency(convertAmountFromMiliunits(member.paid))} ·
                    Share{" "}
                    {formatCurrency(convertAmountFromMiliunits(member.share))}
                  </div>
                  {data.transactions?.length ? (
                    <div className="text-xs text-muted-foreground">
                      Settlements Paid:{" "}
                      {formatCurrency(
                        convertAmountFromMiliunits(
                          data.transactions
                            .filter(
                              (tx) =>
                                tx.isSettlement &&
                                tx.paidByUserId === member.userId,
                            )
                            .reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
                        ),
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={member.owed >= 0 ? "secondary" : "destructive"}
                    className="text-xs"
                  >
                    {member.owed >= 0 ? "Gets" : "Owes"}
                  </Badge>
                  <span
                    className={`tabular-nums ${
                      member.owed >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {formatCurrency(convertAmountFromMiliunits(member.owed))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        {shouldSettle && accountId && settlementRecipient?.userId && (
          <Button
            variant="outline"
            onClick={() =>
              settleMutation.mutate({
                accountId,
                amount: settlementAmount,
                payee: "Settlement",
                notes: "Settle up",
                date: new Date(),
                paidByUserId: user?.id,
                settlementToUserId: settlementRecipient.userId,
                isSettlement: true,
              })
            }
          >
            Settle Up
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
