"use client";

import { useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useUser } from "@clerk/nextjs";
import { useShareAccount } from "../hooks/use-share-account";
import { useInviteAccount } from "../hooks/use-invite-account";
import { useRevokeInvite } from "../hooks/use-revoke-invite";
import { InviteUserToAccountInput } from "../types";
import { MemberAccounting } from "./member-accounting";
import { PendingInvitesSection } from "./pending-invites-section";
import { MemberSplitEditor } from "./member-split-editor";

const formSchema = z.object({
  userEmail: z.email(),
  contributionSplit: z.coerce.number().int().min(0).max(100),
  role: z.enum(["owner", "editor", "viewer"]).default("viewer"),
});

type FormValues = z.infer<typeof formSchema>;

export const ShareAccountSheet = () => {
  const { id, isOpen, onClose } = useShareAccount();
  const { user } = useUser();
  const trpc = useTRPC();
  const { mutate, isPending } = useInviteAccount();
  const revokeInvite = useRevokeInvite(id ?? undefined);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const { data: membersData, isLoading: isMembersLoading } = useQuery({
    ...trpc.getWalletMembers.queryOptions({ accountId: id ?? "" }),
    enabled: !!id && isOpen,
  });
  const { data: invitesData, isLoading: isInvitesLoading } = useQuery({
    ...trpc.getAccountInvites.queryOptions({ accountId: id ?? "" }),
    enabled: !!id && isOpen,
  });
  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      userEmail: "",
      contributionSplit: 50,
      role: "viewer",
    },
  });

  const onSubmit = (values: FormValues) => {
    mutate({ ...values, accountId: id } as InviteUserToAccountInput);
    form.reset();
  };

  const members = useMemo(() => membersData ?? [], [membersData]);
  const invites = invitesData ?? [];
  const pendingTotal = invites.reduce(
    (sum, invite) => sum + (invite.contributionSplit ?? 0),
    0,
  );
  const splitTarget = Math.max(0, 100 - pendingTotal);

  const canInvite = useMemo(() => {
    if (!user?.id || isMembersLoading) return false;
    const current = members.find((member) => member.userId === user.id);
    return current?.role === "owner" || current?.role === "editor";
  }, [isMembersLoading, members, user?.id]);

  const canRemoveMembers = useMemo(() => {
    if (!user?.id || isMembersLoading) return false;
    const current = members.find((member) => member.userId === user.id);
    return current?.role === "owner";
  }, [isMembersLoading, members, user?.id]);

  const inviteDisabled = isPending || !canInvite || isMembersLoading;

  const handleRevoke = async (shareId: string) => {
    setRevokingId(shareId);
    try {
      await revokeInvite.mutateAsync({ shareId });
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="custom" className="space-y-4">
        <SheetHeader>
          <SheetTitle>Share Wallet</SheetTitle>
          <SheetDescription>
            Invite a user to collaborate on this account.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 p-4"
          >
            <FormField
              name="userEmail"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="partner@email.com"
                      disabled={inviteDisabled}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              name="contributionSplit"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Split Percentage</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      min={0}
                      max={100}
                      placeholder="50"
                      disabled={inviteDisabled}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              name="role"
              control={form.control}
              render={({ field }) => {
                const roleId = "invite-role";
                return (
                  <FormItem>
                    <FormLabel htmlFor={roleId}>Role</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={inviteDisabled}
                        name={field.name}
                      >
                        <SelectTrigger id={roleId}>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {/*TODO-MINH: add tooltips or info to make sure what user should do*/}
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="owner">Owner</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </FormItem>
                );
              }}
            />
            <Button type="submit" className="w-full" disabled={inviteDisabled}>
              {isPending && (
                <Loader2 className="size-4 animate-spin text-primary-foreground" />
              )}
              {isPending ? "Sending..." : "Send Invite"}
            </Button>
            {!canInvite && !isMembersLoading && (
              <p className="text-xs text-muted-foreground">
                Only owners or editors can invite users.
              </p>
            )}
          </form>
        </Form>
        <Separator />
        <div className="space-y-6 p-4">
          <MemberAccounting
            accountId={id ?? undefined}
            members={members}
            isLoading={isMembersLoading}
            canRemove={canRemoveMembers}
            currentUserId={user?.id}
          />
          {id && (
            <MemberSplitEditor
              accountId={id}
              members={members}
              isLoading={isMembersLoading}
              totalTarget={splitTarget}
            />
          )}
          <PendingInvitesSection
            invites={invites}
            isLoading={isInvitesLoading}
            revokingId={revokingId}
            onRevoke={handleRevoke}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};
