import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import axios from "axios";
import { convertAmountFromMiliunits } from "@/lib/utils";

/**
 * Fetch a short AI-generated financial summary for the current user.
 * Uses the LLM service's transaction coach endpoint.
 */
export const getAiSummary = authedProcedure
  .query(async ({ ctx }) => {
    try {
      const { id } = ctx.user;
      const llmBase = process.env.LLM_URL;

      if (!llmBase) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "LLM_URL is not configured.",
        });
      }
      const llmURL = `${llmBase}/v1/transactions/coach-from-history`;
      const response = await axios.post(
        llmURL,
        {
          userId: id,
          days: 30,
          tone: "friendly",
        },
        { timeout: 15000 },
      );

      const payload = response.data ?? {};
      const toAmount = (value: unknown) => {
        const numeric = Number(value ?? 0);
        return Number.isFinite(numeric)
          ? convertAmountFromMiliunits(numeric)
          : 0;
      };
      const safeToSpendToday = toAmount(payload.safeToSpendToday);
      const highlights = Array.isArray(payload.highlights)
        ? payload.highlights
        : [];
      const risks = Array.isArray(payload.risks) ? payload.risks : [];
      const caps = payload.caps && typeof payload.caps === "object"
        ? {
            rent: toAmount(payload.caps.rent),
            groceries: toAmount(payload.caps.groceries),
            shopping: toAmount(payload.caps.shopping),
            entertainment: toAmount(payload.caps.entertainment),
          }
        : undefined;
      console.log(payload);
      return {
        status: "success",
        data: {
          ...payload,
          safeToSpendToday,
          highlights,
          risks,
          ...(caps ? { caps } : {}),
        },
        message: "Transaction updated successfully",
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          `Private Procedure Error - getAiSummary. An unspecified error occurred: ${error}`,
      });
    }
  });
