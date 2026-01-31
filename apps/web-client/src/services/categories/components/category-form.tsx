/* eslint-disable @typescript-eslint/no-unused-vars */
import { z } from "zod";
import { Trash } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { insertCategoriesSchema } from "../schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AmountInput } from "@/components/amount-input";
import { convertAmountToMiliunits } from "@/lib/utils";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  monthlyBudget: z.string(),
  goalType: z.enum(["expense", "saving"]),
});
const apiSchema = insertCategoriesSchema.pick({
  name: true,
  monthlyBudget: true,
  goalType: true,
});

type ApiFormValues = z.input<typeof apiSchema>;
type FormValues = z.infer<typeof formSchema>;

type Props = {
  id?: string;
  defaultValues?: FormValues;
  onSubmit: (values: ApiFormValues) => void;
  onDelete?: () => void;
  disable?: boolean;
};

export const CategoryForm = ({
  id,
  defaultValues,
  onSubmit,
  onDelete,
  disable = false,
}: Props) => {
  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: defaultValues || {
      name: "",
      monthlyBudget: "",
      goalType: "expense",
    },
  });

  const handleSubmit = (values: FormValues) => {
    const amountInMilliunits = convertAmountToMiliunits(
      parseFloat(values.monthlyBudget),
    );

    onSubmit({
      name: values.name,
      goalType: values.goalType,
      monthlyBudget: amountInMilliunits,
    });
  };
  const handleDelete = () => {
    onDelete?.();
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-4 p-4"
      >
        <FormField
          name="name"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  disabled={disable}
                  placeholder="e.g. Grocery, Travel, ..."
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          name="monthlyBudget"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Monthly Budget ($)</FormLabel>
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
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name="goalType"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Goal Type</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                disabled={disable}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a goal type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="saving">Saving</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className="w-full" disabled={disable}>
          {id ? "Save changes" : "Create Category"}
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
                Delete Category
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete
                  this Category.
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
