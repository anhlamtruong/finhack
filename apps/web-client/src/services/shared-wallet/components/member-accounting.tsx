"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useRemoveWalletMember } from "../hooks/use-remove-wallet-member";
import type { WalletShareMember } from "../types";

type Props = {
  accountId?: string;
  members: WalletShareMember[];
  isLoading?: boolean;
  canRemove?: boolean;
  currentUserId?: string;
};

export const MemberAccounting = ({
  accountId,
  members,
  isLoading,
  canRemove = false,
  currentUserId,
}: Props) => {
  const removeMember = useRemoveWalletMember(accountId);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemove = async (userId: string) => {
    if (!accountId) return;
    setRemovingId(userId);
    try {
      await removeMember.mutateAsync({ accountId, userId });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Members</h3>
        <Badge variant="secondary">{members.length}</Badge>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading members...
        </div>
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground">No members yet.</p>
      ) : (
        <div className="space-y-2">
          {members.map((member) => {
            const initials = (member.userEmail?.[0] ?? "?").toUpperCase();
            const canRemoveMember =
              !!accountId &&
              canRemove &&
              member.userId !== currentUserId &&
              member.status === "accepted";
            const isRemoving = removingId === member.userId;
            return (
              <div
                key={member.userId}
                className="flex flex-col gap-3 rounded-lg border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium truncate">
                      {member.userEmail}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground capitalize">
                        {member.role}
                      </span>
                      {member.status !== "accepted" && (
                        <Badge variant="secondary" className="text-xs">
                          {member.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <Badge variant="outline" className="min-w-16 text-center">
                    {member.contributionSplit}%
                  </Badge>
                  {canRemoveMember && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={isRemoving}
                        >
                          {isRemoving ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            "Remove"
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove member</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will revoke the member&apos;s access and
                            redistribute the splits across remaining members.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemove(member.userId)}
                            disabled={isRemoving}
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
