/* eslint-disable @typescript-eslint/no-unused-vars */
import { z } from "zod";
import { Loader2, Trash } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { insertTransactionsSchema } from "../schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  AccountsGetOutput,
  AccountsPostInput,
  CategoriesGetOutput,
  CategoriesPostInput,
} from "@/types/trpc";
import { CustomSelect } from "@/components/custom-select";
import { DatePicker } from "@/components/ui/date-picker";
import { AmountInput } from "@/components/amount-input";
import { ComponentLoader } from "@/components/ui/component-loader";
import { convertAmountToMiliunits } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import { Checkbox } from "@/components/ui/checkbox";

const formSchema = z.object({
  date: z.coerce.date(),
  accountId: z.string(),
  categoryId: z.string().nullable().optional(),
  payee: z.string(),
  amount: z.string(),
  notes: z.string().nullable().optional(),
  paidByUserId: z.string().optional(),
  isSettlement: z.boolean().optional(),
  settlementToUserId: z.string().optional(),
});

const apiSchema = insertTransactionsSchema.omit({
  id: true,
});

type FormValues = z.infer<typeof formSchema>;
type ApiFormValues = z.input<typeof apiSchema>;

type Props = {
  id?: string;
  defaultValues?: FormValues;
  onSubmit: (values: ApiFormValues) => void;
  onDelete?: () => void;
  disable?: boolean;
  accountOptions: AccountsGetOutput;
  categoryOptions: CategoriesGetOutput;
  onCreateCategory: (input: CategoriesPostInput) => void;
  onCreateAccount: (input: AccountsPostInput) => void;
};

export const TransactionForm = ({
  id,
  defaultValues,
  onSubmit,
  onDelete,
  disable = false,
  accountOptions,
  categoryOptions,
  onCreateCategory,
  onCreateAccount,
}: Props) => {
  const trpc = useTRPC();
  const { user } = useUser();
  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: defaultValues || {
      date: new Date(),
      accountId: "",
      payee: "",
      amount: "",
      paidByUserId: user?.id,
      isSettlement: false,
      settlementToUserId: undefined,
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const accountId = form.watch("accountId");
  const isSettlement = form.watch("isSettlement");
  const paidByUserId = form.watch("paidByUserId");

  const { data: memberData } = useQuery({
    ...trpc.getWalletMembers.queryOptions({ accountId }),
    enabled: !!accountId,
  });
  const members = accountId ? (memberData ?? []) : [];
  const isSharedAccount = members.length > 1;

  const handleSubmit = (values: FormValues) => {
    const amount = parseFloat(values.amount);
    const amountInMiliunits = convertAmountToMiliunits(amount);
    onSubmit({
      ...values,
      amount: amountInMiliunits,
      paidByUserId: values.paidByUserId ?? user?.id,
      isSettlement: values.isSettlement ?? false,
      settlementToUserId: values.settlementToUserId,
    });
  };
  const handleDelete = () => {
    onDelete?.();
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-6 p-4"
      >
        <FormField
          name="date"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <DatePicker
                  value={field.value}
                  onChange={field.onChange}
                  disabled={disable}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          name="amount"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount</FormLabel>
              <FormControl>
                <AmountInput
                  {...field}
                  value={String(field.value)}
                  disabled={disable}
                  placeholder="0.00"
                  onChange={(val) => {
                    field.onChange(val);
                  }}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          name="accountId"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-x-2">
                Account
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-4 text-muted-foreground cursor-pointer" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Select the bank account for this transaction</p>
                  </TooltipContent>
                </Tooltip>
              </FormLabel>
              <FormControl>
                <CustomSelect
                  placeholder="Select an account or create an account by typing"
                  options={accountOptions.map((option) => {
                    return { value: option.id, label: option.name };
                  })}
                  onCreate={(name) => onCreateAccount({ name })}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={disable}
                />
              </FormControl>
            </FormItem>
          )}
        />
        {isSharedAccount && (
          <FormField
            name="paidByUserId"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Paid By</FormLabel>
                <FormControl>
                  <CustomSelect
                    placeholder="Select who paid"
                    options={members.map((member) => ({
                      value: member.userId,
                      label: member.userEmail || member.userId,
                    }))}
                    value={field.value ?? user?.id}
                    onChange={field.onChange}
                    disabled={disable}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        )}
        {isSharedAccount && isSettlement && (
          <FormField
            name="settlementToUserId"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Paid To</FormLabel>
                <FormControl>
                  <CustomSelect
                    placeholder="Select who received the payment"
                    options={members
                      .filter((member) => member.userId !== paidByUserId)
                      .map((member) => ({
                        value: member.userId,
                        label: member.userEmail || member.userId,
                      }))}
                    value={field.value}
                    onChange={field.onChange}
                    disabled={disable}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        )}
        <FormField
          name="categoryId"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-x-2">
                Category
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-4 text-muted-foreground cursor-pointer" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Creating category will have a default budget of{" "}
                      <strong>$0</strong> and type of <strong>expense</strong>.
                    </p>
                    <p>You can update them in categories section.</p>
                  </TooltipContent>
                </Tooltip>
              </FormLabel>
              <FormControl>
                <CustomSelect
                  placeholder="Select an category or create an category by typing"
                  options={categoryOptions.map((option) => {
                    return { value: option.id, label: option.name };
                  })}
                  onCreate={(name) => onCreateCategory({ name })}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={disable}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          name="payee"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-x-2">
                Payee
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-4 text-muted-foreground cursor-pointer" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>The place that you paid your money $</p>
                  </TooltipContent>
                </Tooltip>
              </FormLabel>
              <FormControl>
                <Input
                  disabled={disable}
                  placeholder="Add a payee"
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          name="notes"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  disabled={disable}
                  placeholder="Optional notes"
                />
              </FormControl>
            </FormItem>
          )}
        />
        {isSharedAccount && (
          <FormField
            name="isSettlement"
            control={form.control}
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <FormLabel className="flex items-center gap-2">
                    Settlement
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="size-4 text-muted-foreground cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <div className="space-y-2 text-sm">
                            <p>
                              Use this for paybacks between members. Settlement
                              transactions are{" "}
                              <span className="text-emerald-600">
                                {" "}
                                excluded{" "}
                              </span>
                              from split totals and notifications.
                            </p>
                            <div className="space-y-1">
                              <p className="font-medium">Example</p>
                              <p>
                                Alice paid $100 for groceries (regular
                                transaction). Bob owes{" "}
                                <span className="text-rose-600">$50</span>.
                              </p>
                              <p>
                                When Bob pays Alice $50 back, mark that payment
                                as
                                <span className="text-emerald-600">
                                  {" "}
                                  Settlement{" "}
                                </span>
                                so it clears the debt without changing spending
                                totals.
                              </p>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Mark this transaction as a settle-up payment.
                  </p>
                </div>
                <FormControl>
                  <Checkbox
                    checked={field.value ?? false}
                    onCheckedChange={(value) => field.onChange(!!value)}
                    disabled={disable}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        )}
        <Button className="w-full" disabled={disable}>
          {disable && (
            <Loader2
              className={"animate-spin text-primary-foreground size-4"}
            />
          )}
          {id ? "Save changes" : "Create Transaction"}
        </Button>
        {!!id && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                disabled={disable}
                className="w-full"
                variant={"outline"}
              >
                <Trash className="size-4 mr-2" />
                Delete Transaction
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete
                  this Transaction.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  Continue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </form>
    </Form>
  );
};
