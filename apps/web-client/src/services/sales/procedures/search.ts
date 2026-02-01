import { authedProcedure } from "@/server/init";
import axios from "axios";
import { z } from "zod";

export const searchSales = authedProcedure
  .input(
    z.object({
      query: z.string().min(1, "Query is required"),
      priceMin: z.number().optional(),
      priceMax: z.number().optional(),
      womenFocus: z.boolean().optional(),
      withReasons: z.boolean().optional(),
      reasonsMax: z.number().optional(),
    }),
  )
  .query(async ({ input }) => {
    const llmBase = process.env.LLM_URL;
    if (!llmBase) {
      return { items: [], querySent: input.query };
    }

    try {
      const response = await axios.post(
        `${llmBase}/v1/sales/search`,
        {
          query: input.query,
          priceMin: input.priceMin,
          priceMax: input.priceMax,
          womenFocus: input.womenFocus,
          withReasons: input.withReasons,
          reasonsMax: input.reasonsMax,
        },
        {
          timeout: 8000,
        },
      );

      return {
        items: Array.isArray(response.data?.items) ? response.data.items : [],
        querySent: response.data?.querySent ?? response.data?.queryUsed ??
          input.query,
        womenFocus: response.data?.womenFocus,
        count: response.data?.count,
      };
    } catch {
      return { items: [], querySent: input.query };
    }
  });
