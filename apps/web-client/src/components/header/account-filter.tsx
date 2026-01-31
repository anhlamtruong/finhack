"use client";

import qs from "query-string";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Props = { id?: string };

const AccountFilter = ({}: Props) => {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const accountId = params.get("accountId") || "all";
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const trpc = useTRPC();

  const { data: accounts, isLoading: isLoadingAccounts } = useSuspenseQuery(
    trpc.getAccounts.queryOptions()
  );

  const { isLoading, isFetching, isPending } = useSuspenseQuery(
    trpc.getSummary.queryOptions({ from, to, accountId })
  );

  const isLoadingSummary = isLoading || isFetching || isPending;

  const onChange = (newValue: string) => {
    const query = qs.stringify(
      {
        accountId: newValue === "all" ? "" : newValue,
        from,
        to,
      },
      { skipNull: true, skipEmptyString: true }
    );
    router.push(`${pathname}?${query}`);
  };

  if (isLoadingAccounts) {
    return <Skeleton className="h-9 w-40 bg-white/10 rounded-full" />;
  }

  return (
    <Select
      value={accountId}
      onValueChange={onChange}
      disabled={isLoadingSummary}
    >
      <SelectTrigger
        className="
          lg:w-auto w-full h-9 px-4 
          rounded-full font-medium 
          bg-white/10 hover:bg-white hover:text-primary
          border border-white/10 
          backdrop-blur-md 
          text-white outline-none 
          focus:ring-2 focus:ring-white/30 focus:ring-offset-0 
          transition-all duration-200 
          flex items-center gap-x-2
        "
      >
        <Wallet className="size-4 opacity-70" />
        <SelectValue placeholder="Filter by account" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All accounts</SelectItem>
        {accounts?.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            {account.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default AccountFilter;
