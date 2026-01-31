"use client";

import { Loader2 } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type PendingInvite = {
  id: string;
  userEmail: string | null;
  role: string | null;
  contributionSplit: number | null;
};

type Props = {
  invites: PendingInvite[];
  isLoading?: boolean;
  revokingId?: string | null;
  onRevoke: (shareId: string) => void;
};

export const PendingInvitesSection = ({
  invites,
  isLoading,
  revokingId,
  onRevoke,
}: Props) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Pending invites</h3>
        <Badge variant="secondary">{invites.length}</Badge>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading invites...
        </div>
      ) : invites.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No pending invites for this account.
        </p>
      ) : (
        <div className="space-y-2">
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>
                    {(invite.userEmail?.[0] ?? "?").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {invite.userEmail ?? "Unknown user"}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="capitalize">
                      {invite.role ?? "viewer"}
                    </span>
                    <span>•</span>
                    <span>{invite.contributionSplit ?? 0}% split</span>
                  </div>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onRevoke(invite.id)}
                disabled={revokingId === invite.id}
              >
                {revokingId === invite.id && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
