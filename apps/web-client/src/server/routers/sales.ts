import { createTRPCRouter } from "../init";
import {
  searchSales,
  recordSalesFeedback,
  suggestSales,
  getSalesBudget,
} from "@/services/sales/procedures";

export const salesRouter = createTRPCRouter({
  search: searchSales,
  recordFeedback: recordSalesFeedback,
  suggest: suggestSales,
  getBudget: getSalesBudget,
});
