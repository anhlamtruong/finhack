/* eslint-disable @typescript-eslint/no-unused-vars */
import { z } from "zod";
import { CategoryForm } from "./category-form";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { insertCategoriesSchema } from "@/db/schema";

import { useOpenCategory } from "../hooks/use-open-category";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { ComponentLoader } from "@/components/ui/component-loader";
import { useEditCategory } from "../hooks/use-edit-category";
import { useDeleteCategory } from "../hooks/use-delete-category";
import { convertAmountFromMiliunits } from "@/lib/utils";

const apiSchema = insertCategoriesSchema.pick({
  name: true,
  monthlyBudget: true,
  goalType: true,
});

type ApiFormValues = z.input<typeof apiSchema>;

export const EditCategorySheet = () => {
  const { isOpen, onClose, id } = useOpenCategory();
  const trpc = useTRPC();
  const { data, isLoading } = useQuery({
    ...trpc.getCategory.queryOptions({ id: id }),
    enabled: !!id,
  });
  const { mutate, isPending } = useEditCategory();
  const deleteMutation = useDeleteCategory();
  const onDelete = () => {
    deleteMutation.mutate({ id });
  };
  const onSubmit = (values: ApiFormValues) => {
    mutate({ ...values, id: id });
  };
  const isFetching = isLoading || isPending;

  const defaultValues = data
    ? {
        name: data.name,

        goalType: (data.goalType as "expense" | "saving") ?? "expense",

        monthlyBudget: String(
          convertAmountFromMiliunits(data.monthlyBudget || 0),
        ),
      }
    : {
        name: "",
        goalType: "expense" as const,
        monthlyBudget: "0",
      };
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="custom" className="space-y-4">
        <SheetHeader>
          <SheetTitle>Edit Category</SheetTitle>
          <SheetDescription>Edit an existing Category.</SheetDescription>
        </SheetHeader>
        {isLoading ? (
          <ComponentLoader variant="spinner" text="Loading Category data..." />
        ) : (
          <CategoryForm
            id={id}
            onSubmit={onSubmit}
            disable={isFetching}
            defaultValues={defaultValues}
            onDelete={onDelete}
          />
        )}
      </SheetContent>
    </Sheet>
  );
};
