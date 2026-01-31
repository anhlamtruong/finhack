"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { WalletShareMember } from "../types";
import { useUpdateWalletSplit } from "../hooks/use-update-wallet-split";

const normalize = (value: number) => Math.max(0, Math.min(100, value));

type Props = {
  accountId: string;
  members: WalletShareMember[];
  isLoading?: boolean;
  totalTarget?: number;
};

export const MemberSplitEditor = ({
  accountId,
  members,
  isLoading,
  totalTarget = 100,
}: Props) => {
  const { user } = useUser();
  const updateSplit = useUpdateWalletSplit(accountId);
  const [splits, setSplits] = useState<Record<string, number>>({});

  useEffect(() => {
    const next: Record<string, number> = {};
    for (const member of members) {
      next[member.userId] = member.contributionSplit ?? 0;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSplits(next);
  }, [members]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const canEdit = useMemo(() => {
    if (!user?.id) return false;
    const current = members.find((member) => member.userId === user.id);
    return current?.role === "owner" || current?.role === "editor";
  }, [members, user?.id]);

  const total = useMemo(
    () => Object.values(splits).reduce((sum, value) => sum + value, 0),
    [splits],
  );

  const hasChanges = useMemo(() => {
    return members.some(
      (member) => splits[member.userId] !== member.contributionSplit,
    );
  }, [members, splits]);

  const canSave = canEdit && hasChanges && total === totalTarget && !isLoading;

  const handleChange = (userId: string, value: string) => {
    const parsed = Number(value);
    setSplits((prev) => ({
      ...prev,
      [userId]: Number.isNaN(parsed) ? 0 : normalize(parsed),
    }));
  };

  const handleSave = () => {
    updateSplit.mutate({
      accountId,
      splits: members.map((member) => ({
        userId: member.userId,
        contributionSplit: splits[member.userId] ?? 0,
      })),
    });
  };

  if (!members.length && !isLoading) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Split editor</h3>
          <p className="text-xs text-muted-foreground">
            Update contribution splits. Total must equal {totalTarget}.
          </p>
        </div>
        <Badge variant={total === totalTarget ? "secondary" : "destructive"}>
          Total {total}%
        </Badge>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading splits...
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.userId}
              className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium truncate">
                  {member.userEmail}
                </span>
                <span className="text-xs text-muted-foreground capitalize">
                  {member.role}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {(() => {
                  const currentValue = splits[member.userId] ?? 0;
                  const remaining = Math.max(
                    0,
                    totalTarget - (total - currentValue),
                  );
                  return (
                    <Input
                      id={`split-${member.userId}`}
                      name={`split-${member.userId}`}
                      type="number"
                      placeholder={`${remaining}`}
                      min={0}
                      max={100}
                      value={currentValue}
                      onChange={(event) =>
                        handleChange(member.userId, event.target.value)
                      }
                      disabled={!canEdit || updateSplit.isPending}
                      className="w-24 text-right sm:w-28"
                    />
                  );
                })()}
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {!canEdit ? (
          <p className="text-xs text-muted-foreground">
            Only owners or editors can edit splits.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Save is enabled only when total equals {totalTarget}.
          </p>
        )}
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!canSave || updateSplit.isPending}
        >
          {updateSplit.isPending && <Loader2 className="size-4 animate-spin" />}
          <Save className="size-4" />
          Save splits
        </Button>
      </div>
    </div>
  );
};
