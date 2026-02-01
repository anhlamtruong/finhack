import { authedProcedure } from "@/server/init";
import axios from "axios";
import { z } from "zod";

const suggestSchema = z.object({
  goal: z.string().optional(),
  budgetMax: z.number().optional(),
  womenFocus: z.boolean().optional(),
});

export const suggestSales = authedProcedure
  .input(suggestSchema)
  .query(async ({ input }) => {
    const llmBase = process.env.LLM_URL;
    if (!llmBase) {
      return [];
    }

    try {
      const response = await axios.post(
        `${llmBase}/v1/sales/suggest`,
        {
          goal: input.goal ?? "unknown",
          budgetMax: input.budgetMax,
          womenFocus: input.womenFocus,
        },
        {
          timeout: 5000,
        },
      );

      return Array.isArray(response.data?.suggestions)
        ? response.data.suggestions
        : [];
    } catch {
      return [];
    }
  });
