"use client";
import { JSX, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useCreateAccount } from "./use-create-account";
import { CustomSelect } from "@/components/custom-select";

export const useSelectAccount = (): [
  () => JSX.Element,
  () => Promise<unknown>,
] => {
  const trpc = useTRPC();
  const { data, isLoading } = useSuspenseQuery(trpc.getAccounts.queryOptions());
  const { mutate, isPending } = useCreateAccount();
  const selectValue = useRef<string | undefined>(undefined);
  const [promise, setPromise] = useState<{
    resolve: (value: string | undefined) => void;
  } | null>(null);

  const onCreateAccount = (name: string) => mutate({ name });
  const accountOptions = (data ?? []).map((account) => ({
    value: account.id,
    label: account.name,
  }));

  const confirm = () =>
    new Promise((resolve) => {
      setPromise({ resolve });
    });

  const handleClose = () => {
    setPromise(null);
  };

  const handleConfirm = () => {
    if (promise) {
      promise.resolve(selectValue.current);
      handleClose();
    }
  };

  const handleCancel = () => {
    if (promise) {
      promise.resolve(undefined);
      handleClose();
    }
  };

  const ConfirmationDialog = () => {
    return (
      <Dialog open={!!promise} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select an account</DialogTitle>
            <DialogDescription>
              Please select an account to continue.
            </DialogDescription>
          </DialogHeader>
          <CustomSelect
            placeholder="Select an account"
            options={accountOptions}
            onChange={(value) => (selectValue.current = value)}
            onCreate={onCreateAccount}
            disabled={isLoading || isPending}
          />
          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleConfirm}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return [ConfirmationDialog, confirm];
};
