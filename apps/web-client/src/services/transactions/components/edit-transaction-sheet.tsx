/* eslint-disable @typescript-eslint/no-unused-vars */
import { z } from "zod";
import { TransactionForm } from "./transaction-form";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  insertAccountSchema,
  insertCategoriesSchema,
  insertTransactionsSchema,
} from "@/db/schema";

import { useOpenTransaction } from "../hooks/use-open-transaction";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { ComponentLoader } from "@/components/ui/component-loader";
import { useEditTransaction } from "../hooks/use-edit-transaction";
import { useDeleteTransaction } from "../hooks/use-delete-transaction";
import { useCreateCategory } from "@/services/categories/hooks/use-create-category";
import { useCreateAccount } from "@/services/accounts/hooks/use-create-account";
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

export const EditTransactionSheet = () => {
  const { isOpen, onClose, id } = useOpenTransaction();

  const trpc = useTRPC();
  const { data, isLoading: transactionIsLoading } = useQuery({
    ...trpc.getTransaction.queryOptions({ id: id }),
    enabled: !!id,
  });

  const { mutate: transactionMutation, isPending: transactionIsPending } =
    useEditTransaction();
  const deleteMutation = useDeleteTransaction();
  const onDelete = () => {
    deleteMutation.mutate({ id });
  };

  const { mutate: categoryMutation, isPending: categoryIsPending } =
    useCreateCategory();
  const { mutate: accountMutation, isPending: accountIsPending } =
    useCreateAccount();
  const { data: categoriesData, isLoading: categoryIsLoading } =
    useSuspenseQuery(trpc.getCategories.queryOptions());

  const { data: accountsData, isLoading: accountIsLoading } = useSuspenseQuery(
    trpc.getAccounts.queryOptions(),
  );

  const onCreateCategory = (values: CategoryFormValues) => {
    categoryMutation(values);
  };
  const onCreateAccount = (values: AccountFormValues) => {
    accountMutation(values);
  };

  const onSubmit = (values: FormValues) => {
    transactionMutation({ ...values, id: id });
  };
  const isPending =
    deleteMutation.isPending ||
    transactionIsPending ||
    categoryIsPending ||
    accountIsPending;
  const isLoading =
    categoryIsLoading || accountIsLoading || transactionIsLoading;

  const defaultValue = data
    ? {
        accountId: data.accountId,
        categoryId: data.categoryId,
        amount: convertAmountFromMiliunits(data.amount).toString(),
        date: data.date ? new Date(data.date) : new Date(),
        payee: data.payee,
        notes: data.notes,
        paidByUserId: data.paidByUserId ?? undefined,
        isSettlement: data.isSettlement ?? false,
      }
    : {
        accountId: "",
        categoryId: "",
        amount: "",
        date: new Date(),
        payee: "",
        notes: "",
        paidByUserId: undefined,
        isSettlement: false,
      };
  const categoryOptions = categoriesData ?? [];
  const accountOptions = accountsData ?? [];

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="custom" className="space-y-4">
        <SheetHeader>
          <SheetTitle>Edit transaction</SheetTitle>
          <SheetDescription>Edit an existing transaction.</SheetDescription>
        </SheetHeader>
        {isLoading ? (
          <ComponentLoader
            variant="spinner"
            text="Loading transaction data..."
          />
        ) : (
          <TransactionForm
            id={id}
            onSubmit={onSubmit}
            disable={isPending}
            defaultValues={defaultValue}
            onDelete={onDelete}
            categoryOptions={categoryOptions}
            onCreateCategory={onCreateCategory}
            accountOptions={accountOptions}
            onCreateAccount={onCreateAccount}
          />
        )}
      </SheetContent>
    </Sheet>
  );
};
