/* eslint-disable @typescript-eslint/no-unused-vars */
import { z } from "zod";
import { useNewCategory } from "../hooks/use-new-category";
import { CategoryForm } from "./category-form";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { insertCategoriesSchema } from "@/db/schema";

import { useCreateCategory } from "../hooks/use-create-category";

const apiSchema = insertCategoriesSchema.pick({
  name: true,
  monthlyBudget: true,
  goalType: true,
});

type ApiFormValues = z.input<typeof apiSchema>;

export const NewCategorySheet = () => {
  const { isOpen, onClose } = useNewCategory();
  const { mutate, isPending } = useCreateCategory();
  const onSubmit = (values: ApiFormValues) => {
    mutate(values);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="custom" className="space-y-4">
        <SheetHeader>
          <SheetTitle>New Category</SheetTitle>
          <SheetDescription>
            Create a new Category to track your transactions.
          </SheetDescription>
        </SheetHeader>
        <CategoryForm
          disable={isPending}
          defaultValues={{
            name: "",
            goalType: "expense",
            monthlyBudget: "",
          }}
          onSubmit={onSubmit}
        />
      </SheetContent>
    </Sheet>
  );
};
