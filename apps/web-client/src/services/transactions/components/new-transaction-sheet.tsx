/* eslint-disable @typescript-eslint/no-unused-vars */
import { z } from "zod";
import { useMemo } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TransactionForm } from "./transaction-form";

import {
  insertAccountSchema,
  insertCategoriesSchema,
  insertTransactionsSchema,
} from "@/db/schema";

import { useCreateTransaction } from "../hooks/use-create-transaction";
import { useCreateCategory } from "@/services/categories/hooks/use-create-category";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useCreateAccount } from "@/services/accounts/hooks/use-create-account";
import { useNewTransaction } from "../hooks/use-new-transaction";
import { ComponentLoader } from "@/components/ui/component-loader";
import { convertAmountFromMiliunits } from "@/lib/utils";

const formSchema = insertTransactionsSchema.omit({
  id: true,
});

type FormValues = z.input<typeof formSchema>;

const categoryFormSchema = insertCategoriesSchema.pick({
  name: true,
  monthlyBudget: true,
  goalType: true,
});

type CategoryFormValues = z.input<typeof categoryFormSchema>;

const accountFormSchema = insertAccountSchema.pick({
  name: true,
});

type AccountFormValues = z.input<typeof accountFormSchema>;

export const NewTransactionSheet = () => {
  const trpc = useTRPC();
  const { isOpen, onClose, initialValues } = useNewTransaction();
  const { mutate: transactionMutation, isPending: transactionIsPending } =
    useCreateTransaction();
  const { mutate: categoryMutation, isPending: categoryIsPending } =
    useCreateCategory();
  const { mutate: accountMutation, isPending: accountIsPending } =
    useCreateAccount();
  const { data: categoriesData, isLoading: categoryIsLoading } =
    useSuspenseQuery(trpc.getCategories.queryOptions());
  const { data: accountsData, isLoading: accountIsLoading } = useSuspenseQuery(
    trpc.getAccounts.queryOptions(),
  );

  const categoryOptions = categoriesData ?? [];
  const accountOptions = accountsData ?? [];

  // Resolve category string from voice input to categoryId
  const resolvedCategoryId = useMemo(() => {
    if (!initialValues?.category || !categoryOptions.length) return undefined;

    const categoryName = initialValues.category.toLowerCase();

    // Try exact match first
    const exactMatch = categoryOptions.find(
      (c) => c.name.toLowerCase() === categoryName,
    );
    if (exactMatch) return exactMatch.id;

    // Try partial match
    const partialMatch = categoryOptions.find(
      (c) =>
        c.name.toLowerCase().includes(categoryName) ||
        categoryName.includes(c.name.toLowerCase()),
    );
    return partialMatch?.id;
  }, [initialValues?.category, categoryOptions]);

  // Compute default values for the form from voice input
  const defaultValues = useMemo(() => {
    if (!initialValues) return undefined;

    return {
      date: initialValues.date ?? new Date(),
      accountId: initialValues.accountId ?? "",
      categoryId: resolvedCategoryId ?? initialValues.categoryId ?? null,
      payee: initialValues.payee ?? "",
      // Convert miliunits back to display amount (dollars)
      amount: initialValues.amount
        ? String(convertAmountFromMiliunits(initialValues.amount))
        : "",
      notes: initialValues.notes ?? null,
      paidByUserId: undefined,
      isSettlement: false,
      settlementToUserId: undefined,
    };
  }, [initialValues, resolvedCategoryId]);

  const onCreateCategory = (values: CategoryFormValues) => {
    categoryMutation(values);
  };
  const onCreateAccount = (values: AccountFormValues) => {
    accountMutation(values);
  };
  const onSubmit = (values: FormValues) => {
    transactionMutation(values);
  };
  const isPending =
    transactionIsPending || categoryIsPending || accountIsPending;
  const isLoading = categoryIsLoading || accountIsLoading;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="custom" className="space-y-2 pt-4">
        <SheetHeader>
          <SheetTitle>New Transaction</SheetTitle>
          <SheetDescription>Create a new transaction.</SheetDescription>
        </SheetHeader>
        {isLoading ? (
          <ComponentLoader variant="spinner" text="Loading data..." />
        ) : (
          <TransactionForm
            key={initialValues ? JSON.stringify(initialValues) : "new"}
            disable={isPending}
            onSubmit={onSubmit}
            defaultValues={defaultValues}
            categoryOptions={categoryOptions}
            accountOptions={accountOptions}
            onCreateCategory={onCreateCategory}
            onCreateAccount={onCreateAccount}
          />
        )}
      </SheetContent>
    </Sheet>
  );
};
