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
import { useDeleteAccount } from "@/services/accounts/hooks/use-delete-account";
import { useOpenAccount } from "@/services/accounts/hooks/use-open-account";
import { useShareAccount } from "@/services/shared-wallet/hooks/use-share-account";
import { Edit, MoreHorizontal, Share2, Trash } from "lucide-react";
type Props = {
  id: string;
  role: string;
};

export const Actions = ({ id, role }: Props) => {
  const { onOpen } = useOpenAccount();
  const { onOpen: onShare } = useShareAccount();
  const deleteMutation = useDeleteAccount();
  const isOwner = role === "owner";
  const onDelete = () => {
    if (!isOwner) return;
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
          <DropdownMenuItem
            disabled={!isOwner}
            onClick={() => isOwner && onOpen(id)}
          >
            <Edit className="size-4 mr-2" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem disabled={false} onClick={() => onShare(id)}>
            <Share2 className="size-4 mr-2" /> Share Wallet
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!isOwner} onClick={onDelete}>
            <Trash className="size-4 mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
