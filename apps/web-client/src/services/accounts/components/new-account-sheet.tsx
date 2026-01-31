import { z } from "zod";
import { useNewAccount } from "../hooks/use-new-account";
import { AccountForm } from "./account-form";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { insertAccountSchema } from "@/db/schema";

import { useCreateAccount } from "../hooks/use-create-account";

const formSchema = insertAccountSchema.pick({
  name: true,
});

type FormValues = z.input<typeof formSchema>;

export const NewAccountSheet = () => {
  const { isOpen, onClose } = useNewAccount();
  const { mutate, isPending } = useCreateAccount();
  const onSubmit = (values: FormValues) => {
    mutate(values);
  };
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="custom" className="space-y-4">
        <SheetHeader>
          <SheetTitle>New Account</SheetTitle>
          <SheetDescription>
            Create a new account to track your transactions.
          </SheetDescription>
        </SheetHeader>
        <AccountForm
          disable={isPending}
          defaultValues={{ name: "" }}
          onSubmit={onSubmit}
        />
      </SheetContent>
    </Sheet>
  );
};
