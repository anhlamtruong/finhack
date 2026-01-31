import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { AppRouter } from "../../server/routers/app";

export * from "@/services/accounts/types";
export * from "@/services/shared-wallet/types";
export * from "@/services/categories/types";
export * from "@/services/monthly-report/types";
export * from "@/services/transactions/types";
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
