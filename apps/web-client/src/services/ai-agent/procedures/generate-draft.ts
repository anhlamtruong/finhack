import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";
import axios from "axios";
import { z } from "zod";

/**
 * Ask the LLM service to generate a draft companion (persona + assets).
 * Returns a draft payload used by the creation wizard.
 */
export const generateDraft = authedProcedure
  .input(z.object({ prompt: z.string().min(1, "Prompt is required") }))
  .mutation(async ({ ctx, input }) => {
    const llmBase = process.env.LLM_URL;
    if (!llmBase) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "LLM_URL is not configured",
      });
    }

    try {
      const url = `${llmBase}/v1/companion/generate`;
      const response = await axios.post(
        url,
        { userId: ctx.user.id, prompt: input.prompt },
      );
      console.log(JSON.stringify(response.data?.companion));

      if (!response.data?.ok) {
        throw new Error(response.data?.error ?? "LLM generation failed");
      }

      return {
        status: "success",
        data: response.data?.companion ?? response.data,
        message: "Draft generated",
      } as const;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `generateDraft failed: ${String(error)}`,
      });
    }
  });
