"use client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteTransaction } from "@/services/transactions/hooks/use-delete-transaction";

import { useOpenTransaction } from "@/services/transactions/hooks/use-open-transaction";
import { Edit, MoreHorizontal, Trash } from "lucide-react";
type Props = {
  id: string;
};

export const Actions = ({ id }: Props) => {
  const { onOpen } = useOpenTransaction();
  const deleteMutation = useDeleteTransaction();
  const onDelete = () => {
    deleteMutation.mutate({ id });
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={"ghost"} className="size-8 p-0">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>More Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={false} onClick={() => onOpen(id)}>
            <Edit className="size-4 mr-2" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem disabled={false} onClick={onDelete}>
            <Trash className="size-4 mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
