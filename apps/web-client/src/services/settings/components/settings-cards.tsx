"use client";

import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { PlaidConnect } from "@/services/plaid/components/plaid-connect";
import { PlaidDisconnect } from "@/services/plaid/components/plaid-disconnect";
import { useGetConnectBank } from "@/services/plaid/hooks/use-get-connected-bank";

type Props = {
  id?: string;
};
export const SettingsCard = ({}: Props) => {
  const { data: connectedBank } = useGetConnectBank();
  return (
    <Card className=" border-none drop-shadow-sm">
      <CardHeader>
        <CardTitle className=" text-xl line-clamp-1">Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <Separator />
        <div className=" flex flex-col gap-y-2 lg:flex-row items-center py-4">
          <p className=" text-sm font-medium w-full lg:w-66"> Bank Account</p>
          <div className=" w-full flex items-center justify-between">
            <div
              className={cn(
                "text-sm truncate flex items-center",
                !connectedBank && "text-muted-foreground",
              )}
            >
              {connectedBank
                ? "Bank account connected"
                : "No bank account connected"}
            </div>
            {connectedBank ? <PlaidDisconnect /> : <PlaidConnect />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
