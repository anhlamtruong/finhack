import { RouterInputs, RouterOutputs } from "@/types/trpc";

export type AccountsGetOutput = RouterOutputs["getAccounts"];
export type AccountOutput = AccountsGetOutput[number];
export type AccountsPostInput = RouterInputs["postAccount"];
export type AccountsPostOutput = RouterOutputs["postAccount"];
export type AccountsPatchInput = RouterInputs["updateAccount"];
export type AccountsPatchOutput = RouterOutputs["updateAccount"];
export type AccountsDeleteInput = RouterInputs["deleteAccounts"];
export type AccountsDeleteOutput = RouterOutputs["deleteAccounts"];
