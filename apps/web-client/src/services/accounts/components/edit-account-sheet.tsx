import { z } from "zod";
import { AccountForm } from "./account-form";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { insertAccountSchema } from "@/db/schema";

import { useOpenAccount } from "../hooks/use-open-account";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { ComponentLoader } from "@/components/ui/component-loader";
import { useEditAccount } from "../hooks/use-edit-account";
import { useDeleteAccount } from "../hooks/use-delete-account";

const formSchema = insertAccountSchema.pick({
  name: true,
});

type FormValues = z.input<typeof formSchema>;

export const EditAccountSheet = () => {
  const { isOpen, onClose, id } = useOpenAccount();
  const trpc = useTRPC();
  const { data, isLoading } = useQuery({
    ...trpc.getAccount.queryOptions({ id: id }),
    enabled: !!id,
  });
  const { mutate, isPending } = useEditAccount();
  const deleteMutation = useDeleteAccount();
  const onDelete = () => {
    deleteMutation.mutate({ id });
  };
  const onSubmit = (values: FormValues) => {
    mutate({ ...values, id: id });
  };
  const isFetching = isLoading || isPending;
  const defaultValue = !!data ? { name: data.name } : { name: "" };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="custom" className="space-y-4">
        <SheetHeader>
          <SheetTitle>Edit Account</SheetTitle>
          <SheetDescription>Edit an existing account.</SheetDescription>
        </SheetHeader>
        {isLoading ? (
          <ComponentLoader variant="spinner" text="Loading account data..." />
        ) : (
          <AccountForm
            id={id}
            onSubmit={onSubmit}
            disable={isFetching}
            defaultValues={defaultValue}
            onDelete={onDelete}
          />
        )}
      </SheetContent>
    </Sheet>
  );
};
