/* eslint-disable @typescript-eslint/no-unused-vars */
import { z } from "zod";

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
  const { isOpen, onClose } = useNewTransaction();
  const { mutate: transactionMutation, isPending: transactionIsPending } =
    useCreateTransaction();
  const { mutate: categoryMutation, isPending: categoryIsPending } =
    useCreateCategory();
  const { mutate: accountMutation, isPending: accountIsPending } =
    useCreateAccount();
  const { data: categoriesData, isLoading: categoryIsLoading } =
    useSuspenseQuery(trpc.getCategories.queryOptions());
  const { data: accountsData, isLoading: accountIsLoading } = useSuspenseQuery(
    trpc.getAccounts.queryOptions()
  );

  const categoryOptions = categoriesData ?? [];
  const accountOptions = accountsData ?? [];

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
            disable={isPending}
            onSubmit={onSubmit}
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
