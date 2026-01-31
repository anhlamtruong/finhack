"use client";

// 1. React & Standard Libraries
import { useState } from "react";

// 2. Third-party Libraries
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";

// 3. Core/Infrastructure (TRPC, DB)
import { useTRPC } from "@/trpc/client";
import { transactions as transactionsSchema } from "@/db/schema";

// 4. Services & Hooks
import { useNewTransaction } from "@/services/transactions/hooks/use-new-transaction";
import { useDeleteTransactions } from "@/services/transactions/hooks/use-delete-transactions";
import { useGetTransactionsParam } from "@/services/transactions/hooks/use-transaction-param";
import { useSelectAccount } from "@/services/accounts/hooks/use-select-account";

// 5. UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";

// 6. Local/Relative Imports
import { columns } from "./columns";
import { UploadButton } from "./upload-button";
import { ImportCard } from "./import-card";
import { useCreateTransactions } from "@/services/transactions/hooks/use-create-transactions";
import { convertAmountToMiliunits } from "@/lib/utils";

enum VARIANTS {
  LIST = "LIST",
  IMPORT = "IMPORT",
}

const INITIAL_IMPORT_RESULTS = {
  data: [],
  errors: [],
  meta: {},
};

const TransactionsPage = () => {
  const [AccountDialog, confirm] = useSelectAccount();
  const [variant, setVariant] = useState<VARIANTS>(VARIANTS.LIST);
  const [importResults, setImportResults] = useState(INITIAL_IMPORT_RESULTS);

  const { mutate: mutateTransactions } = useCreateTransactions();
  const { onOpen } = useNewTransaction();
  const { mutate: deleteTransactions, isPending } = useDeleteTransactions();
  const { from, to, accountId } = useGetTransactionsParam();

  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.getTransactions.queryOptions({ from, to, accountId }),
  );

  const onUpload = (results: typeof INITIAL_IMPORT_RESULTS) => {
    setImportResults(results);
    setVariant(VARIANTS.IMPORT);
  };

  const onCancelImport = () => {
    setImportResults(INITIAL_IMPORT_RESULTS);
    setVariant(VARIANTS.LIST);
  };

  const onSubmitImport = async (
    values: (typeof transactionsSchema.$inferInsert)[],
  ) => {
    const accountId = await confirm();

    if (!accountId) {
      return toast.error("Please select an account to continue");
    }

    const data = values.map((value) => ({
      ...value,
      accountId: accountId as string,
      amount: convertAmountToMiliunits(value.amount),
      paidByUserId: value.paidByUserId ?? undefined,
      settlementToUserId: value.settlementToUserId ?? undefined,
      isSettlement: value.isSettlement ?? undefined,
      categoryId: value.categoryId ?? undefined,
      notes: value.notes ?? undefined,
    }));
    mutateTransactions(data, {
      onSuccess: () => {
        onCancelImport();
      },
    });
  };

  if (variant === VARIANTS.IMPORT) {
    return (
      <>
        <AccountDialog />
        <ImportCard
          data={importResults.data}
          onCancel={onCancelImport}
          onSubmit={onSubmitImport}
        />
      </>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full pb-10 -mt-16">
      <Card className="border-none drop-shadow-sm">
        <CardHeader className="gap-y-2 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-xl line-clamp-1">
            Transactions History
          </CardTitle>
          <div className="flex items-center gap-x-2">
            <Button onClick={onOpen} size={"sm"}>
              <Plus className="size-4 mr-2" />
              Add New Transaction
            </Button>
            <UploadButton onUpload={onUpload} />
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            defaultFilterKey="payee"
            onDelete={(rows) => {
              const ids = rows.map((r) => r.original.id);
              deleteTransactions({ ids });
            }}
            columns={columns}
            data={data}
            disabled={isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default TransactionsPage;
