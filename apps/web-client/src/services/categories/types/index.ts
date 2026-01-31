import { RouterOutputs, RouterInputs } from "@/types/trpc";

export type CategoriesGetOutput = RouterOutputs["getCategories"];
export type CategoryOutput = CategoriesGetOutput[number];
export type CategoriesPostInput = RouterInputs["postCategory"];
export type CategoriesPostOutput = RouterOutputs["postCategory"];
export type CategoriesPatchInput = RouterInputs["updateCategory"];
export type CategoriesPatchOutput = RouterOutputs["updateCategory"];
export type CategoriesDeleteInput = RouterInputs["deleteCategories"];
export type CategoriesDeleteOutput = RouterOutputs["deleteCategories"];
