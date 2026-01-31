"use client";

import { useMountedState } from "react-use";
import { NewAccountSheet } from "../components/new-account-sheet";
import { EditAccountSheet } from "../components/edit-account-sheet";

export const SheetAccountProvider = () => {
  const isMounted = useMountedState();

  if (!isMounted) return null;
  return (
    <>
      <EditAccountSheet />
      <NewAccountSheet />
    </>
  );
};
