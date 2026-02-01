"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { useTRPC } from "@/trpc/client";
import { useInvalidateTransactionQueries } from "@/services/transactions/hooks/use-invalidate-transaction-queries";
import { convertAmountFromMiliunits, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const TransactionsDetailPage = () => {
  const params = useParams();
  const transactionId =
    typeof params?.id === "string" ? params.id : (params?.id?.[0] ?? "");

  const trpc = useTRPC();
  const { invalidateAll, invalidateTransaction } =
    useInvalidateTransactionQueries();

  const { data: transaction, isLoading } = useQuery({
    ...trpc.getTransaction.queryOptions({ id: transactionId }),
    enabled: Boolean(transactionId),
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    ...trpc.getCategories.queryOptions(),
  });

  const [search, setSearch] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [amountConfirmed, setAmountConfirmed] = useState(false);

  const resolvedCategoryId =
    activeCategoryId ?? transaction?.categoryId ?? null;

  const updateMutation = useMutation(
    trpc.patchTransaction.mutationOptions({
      onSuccess: (data) => {
        toast.success("Category updated");
        invalidateTransaction(data?.data?.id ?? transactionId);
        invalidateAll();
      },
      onError: (error) => {
        toast.error(error.message || "Update failed");
        setActiveCategoryId(null);
      },
    }),
  );

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return categories;
    return categories.filter((category) =>
      category.name.toLowerCase().includes(query),
    );
  }, [categories, search]);

  const handleSelectCategory = (categoryId: string) => {
    if (!transaction || updateMutation.isPending) return;
    if (categoryId === resolvedCategoryId) return;

    setActiveCategoryId(categoryId);
    updateMutation.mutate({
      id: transaction.id,
      accountId: transaction.accountId,
      categoryId,
      date: transaction.date ? new Date(transaction.date) : new Date(),
      amount: transaction.amount,
      payee: transaction.payee,
      notes: transaction.notes ?? undefined,
      paidByUserId: transaction.paidByUserId ?? undefined,
      settlementToUserId: transaction.settlementToUserId ?? undefined,
      isSettlement: transaction.isSettlement ?? false,
    });
  };

  if (!transactionId) {
    return null;
  }

  if (isLoading || !transaction) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6 pb-12">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const amount = formatCurrency(
    convertAmountFromMiliunits(Math.abs(transaction.amount)),
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12 -mt-16">
      <Card className="border-none drop-shadow-sm">
        <CardHeader className="gap-y-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Transaction
            </p>
            <CardTitle className="text-2xl font-semibold text-foreground">
              Confirm amount & choose a category
            </CardTitle>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/transactions">Back to transactions</Link>
          </Button>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-linear-to-r from-emerald-500/10 via-sky-500/10 to-violet-500/10 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-lg font-semibold text-foreground">
                  {transaction.payee}
                </span>
                {transaction.category?.name ? (
                  <Badge variant="secondary">{transaction.category.name}</Badge>
                ) : (
                  <Badge variant="destructive">Uncategorized</Badge>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Account:{" "}
                <span className="text-foreground">{transaction.account}</span>
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Amount
              </p>
              <p className="mt-1 text-3xl font-semibold text-emerald-600">
                {amount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Double-check the total before you proceed.
              </p>
              <Button
                type="button"
                className="mt-4"
                size="sm"
                variant={amountConfirmed ? "secondary" : "default"}
                onClick={() => setAmountConfirmed(true)}
              >
                {amountConfirmed ? "Amount confirmed" : "Confirm amount"}
              </Button>
            </div>

            {transaction.notes ? (
              <div className="rounded-xl border border-border/60 bg-background p-4 text-sm text-muted-foreground">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Notes
                </p>
                <p className="mt-2 text-foreground/80">{transaction.notes}</p>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-border/60 bg-background p-5">
            <p className="text-sm font-medium">Pick a category</p>
            <p className="text-xs text-muted-foreground">
              One click to apply. Search if you have a lot of categories.
            </p>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search categories..."
              className="mt-3"
            />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {categoriesLoading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton
                      key={`category-skeleton-${index}`}
                      className="h-11"
                    />
                  ))
                : filteredCategories.map((category) => {
                    const isActive = resolvedCategoryId === category.id;
                    return (
                      <motion.button
                        key={category.id}
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSelectCategory(category.id)}
                        disabled={updateMutation.isPending}
                        className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : "border-border bg-background text-foreground hover:border-emerald-300"
                        }`}
                      >
                        <span className="truncate">{category.name}</span>
                        {isActive ? (
                          <span className="text-xs text-emerald-600">
                            Selected
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            One click
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
            </div>
            {!categoriesLoading && !filteredCategories.length ? (
              <div className="mt-4 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                No categories match that search.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TransactionsDetailPage;
