"use client";

import { useNewAccount } from "@/services/accounts/hooks/use-new-account";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useDeleteAccounts } from "@/services/accounts/hooks/use-delete-accounts";
import { ShareAccountSheet } from "@/services/shared-wallet/components/share-account-sheet";
import { PendingInvitesCard } from "@/services/shared-wallet/components/pending-invites-card";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Loader2, Plus } from "lucide-react";

import { columns } from "./columns";
import { Suspense } from "react";

const AccountsPage = () => {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-full flex items-center justify-center">
          <Loader2 className="size-6 text-slate-300 animate-spin" />
        </div>
      }
    >
      <AccountsList />
      <ShareAccountSheet />
    </Suspense>
  );
};

export default AccountsPage;

const AccountsList = () => {
  const newAccount = useNewAccount();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.getAccounts.queryOptions());
  const { mutate: deleteAccounts, isPending } = useDeleteAccounts();

  return (
    <div className="max-w-7xl mx-auto w-full pb-10 -mt-16 space-y-6">
      <PendingInvitesCard />
      <Card className=" border-none drop-shadow-sm">
        <CardHeader className=" gap-y-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className=" text-xl line-clamp-1">Accounts Page</CardTitle>
          <Button onClick={newAccount.onOpen} size={"sm"}>
            <Plus className="size-4 mr-2" />
            Add New Account
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable
            onDelete={(rows) => {
              const ids = rows
                .filter((r) => r.original.role === "owner")
                .map((r) => r.original.id);
              deleteAccounts({ ids });
            }}
            defaultFilterKey="name"
            columns={columns}
            data={data}
            disabled={isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
};
