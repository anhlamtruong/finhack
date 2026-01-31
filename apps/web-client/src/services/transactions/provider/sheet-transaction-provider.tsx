"use client";

import { useMountedState } from "react-use";
import { NewTransactionSheet } from "../components/new-transaction-sheet";
import { EditTransactionSheet } from "../components/edit-transaction-sheet";

export const SheetTransactionsProvider = () => {
  const isMounted = useMountedState();

  if (!isMounted) return null;
  return (
    <>
      <EditTransactionSheet />
      <NewTransactionSheet />
    </>
  );
};
