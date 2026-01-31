"use client";

import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowUpDown } from "lucide-react";
import { CategoryOutput } from "@/types/trpc";
import { Actions } from "./actions";
import { Badge } from "@/components/ui/badge";
import { cn, convertAmountFromMiliunits, formatCurrency } from "@/lib/utils";
import { useUser } from "@clerk/nextjs";

const OwnerCell = () => {
  const { user, isLoaded } = useUser();
  if (!isLoaded) {
    return <span className="text-muted-foreground">Loading...</span>;
  }

  const ownerName = user?.username || user?.firstName || "Owner";
  return <span className="font-medium">{ownerName}</span>;
};

export const columns: ColumnDef<CategoryOutput>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  },
  {
    accessorKey: "monthlyBudget",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Monthly Budget
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const amount = convertAmountFromMiliunits(row.original.monthlyBudget);

      return (
        <div className="text-left font-medium">
          <span
            className={cn(
              "tabular-nums",
              amount < 0 ? "text-destructive" : "text-primary",
            )}
          >
            {formatCurrency(amount)}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "goalType",
    header: "Type",
    cell: ({ row }) =>
      row.original.goalType === "expense" ? (
        <Badge variant={"destructive"}>{row.original.goalType}</Badge>
      ) : (
        <Badge>{row.original.goalType}</Badge>
      ),
  },
  {
    id: "owner",
    header: "Owner",
    cell: () => <OwnerCell />,
  },
  {
    id: "actions",
    cell: ({ row }) => <Actions id={row.original.id} />,
  },
];
