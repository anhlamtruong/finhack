import { authedProcedure } from "@/server/init";
import axios from "axios";
import { z } from "zod";

const feedbackSchema = z.object({
  dealId: z.string().min(1, "Deal id is required"),
  type: z.enum(["click", "save", "dismiss"]),
  query: z.string().optional(),
  itemTitle: z.string().optional(),
  budgetMax: z.number().optional(),
});

export const recordSalesFeedback = authedProcedure
  .input(feedbackSchema)
  .mutation(async ({ ctx, input }) => {
    const llmBase = process.env.LLM_URL;
    if (!llmBase) {
      return { ok: false, stored: false };
    }

    const action = input.type === "dismiss" ? "hide" : input.type;

    try {
      const response = await axios.post(
        `${llmBase}/v1/sales/feedback`,
        {
          userId: ctx.user.id,
          action,
          itemUrl: input.dealId,
          itemTitle: input.itemTitle,
          query: input.query,
          budgetMax: input.budgetMax,
          reason: input.type,
        },
        {
          timeout: 5000,
        },
      );

      return {
        ok: Boolean(response.data?.ok ?? true),
        stored: Boolean(response.data?.stored ?? false),
      };
    } catch {
      return { ok: false, stored: false };
    }
  });
