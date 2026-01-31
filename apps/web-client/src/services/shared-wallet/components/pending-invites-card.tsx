"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { useTRPC } from "@/trpc/client";
import { useAcceptInvite } from "../hooks/use-accept-invite";
import { useDeclineInvite } from "../hooks/use-decline-invite";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const PendingInvitesCard = () => {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery({
    ...trpc.getIncomingInvites.queryOptions(),
  });
  const acceptInvite = useAcceptInvite();
  const declineInvite = useDeclineInvite();
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"accept" | "decline" | null>(
    null,
  );

  const invites = data ?? [];

  const handleAccept = async (shareId: string) => {
    setActionId(shareId);
    setActionType("accept");
    try {
      await acceptInvite.mutateAsync({ shareId });
    } finally {
      setActionId(null);
      setActionType(null);
    }
  };

  const handleDecline = async (shareId: string) => {
    setActionId(shareId);
    setActionType("decline");
    try {
      await declineInvite.mutateAsync({ shareId });
    } finally {
      setActionId(null);
      setActionType(null);
    }
  };

  return (
    <Card className="border-none drop-shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Invitations</CardTitle>
        <CardDescription>
          Pending invites waiting for your response.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading invitations...
          </div>
        ) : invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You have no pending invitations.
          </p>
        ) : (
          <div className="space-y-3">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {(invite.accountName?.[0] ?? "A").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {invite.accountName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Invited by {invite.accountOwnerEmail ?? "account owner"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {invite.role}
                  </Badge>
                  <Badge variant="secondary">{invite.contributionSplit}%</Badge>
                  <Button
                    size="sm"
                    onClick={() => handleAccept(invite.id)}
                    disabled={actionId === invite.id && actionType === "accept"}
                  >
                    {actionId === invite.id && actionType === "accept" && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDecline(invite.id)}
                    disabled={
                      actionId === invite.id && actionType === "decline"
                    }
                  >
                    {actionId === invite.id && actionType === "decline" && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
