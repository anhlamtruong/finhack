"use client";

import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowUpDown } from "lucide-react";
import { AccountOutput } from "@/types/trpc";
import { Actions } from "./actions";
import { useUser } from "@clerk/nextjs";

const OwnerCell = () => {
  const { user, isLoaded } = useUser();
  if (!isLoaded) {
    return <span className="text-muted-foreground">Loading...</span>;
  }

  const ownerName = user?.username || user?.firstName || "Owner";
  return <span className="font-medium">{ownerName}</span>;
};

export const columns: ColumnDef<AccountOutput>[] = [
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
    cell: ({ row }) => {
      const isOwner = row.original.role === "owner";
      return (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          disabled={!isOwner}
        />
      );
    },
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
    id: "owner",
    header: "Owner",
    cell: () => <OwnerCell />,
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <Actions id={row.original.id} role={row.original.role} />
    ),
  },
];
