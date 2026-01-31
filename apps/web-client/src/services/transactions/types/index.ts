import { RouterOutputs, RouterInputs } from "@/types/trpc";

export type TransactionsGetOutput = RouterOutputs["getTransactions"];
export type TransactionOutput = TransactionsGetOutput[number];
export type TransactionsPostInput = RouterInputs["postTransaction"];
export type TransactionsPostOutput = RouterOutputs["postTransaction"];
export type TransactionsPatchInput = RouterInputs["patchTransaction"];
export type TransactionsPatchOutput = RouterOutputs["patchTransaction"];
export type TransactionsDeleteInput = RouterInputs["deleteTransactions"];
export type TransactionsDeleteOutput = RouterOutputs["deleteTransactions"];
