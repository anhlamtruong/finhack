import { RouterInputs, RouterOutputs } from "@/types/trpc";

export type MonthlyReportsGetOutput = RouterOutputs["getMonthlyReports"];
export type MonthlyReportOutput = MonthlyReportsGetOutput[number];
export type GenerateMonthlyReportInput = RouterInputs["generateMonthlyReport"];
export type GenerateMonthlyReportOutput = RouterOutputs["generateMonthlyReport"];
