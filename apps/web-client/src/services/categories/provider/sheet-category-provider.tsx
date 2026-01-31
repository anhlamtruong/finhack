"use client";

import { useMountedState } from "react-use";
import { NewCategorySheet } from "../components/new-category-sheet";
import { EditCategorySheet } from "../components/edit-category-sheet";

export const SheetCategoryProvider = () => {
  const isMounted = useMountedState();

  if (!isMounted) return null;
  return (
    <>
      <EditCategorySheet />
      <NewCategorySheet />
    </>
  );
};
