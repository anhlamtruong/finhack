// apps/web-client/src/services/transactions/procedures/parse-voice.ts
// tRPC procedure to parse voice recordings into transaction data.

import { z } from "zod";
import { authedProcedure } from "@/server/init";
import { TRPCError } from "@trpc/server";

// Input schema for the voice parsing procedure
const parseVoiceInputSchema = z.object({
  audioBase64: z.string().min(1, "Audio data is required"),
  mimeType: z.string().min(1, "MIME type is required"),
});

// Output schema matching the parsed transaction
const parsedTransactionSchema = z.object({
  amount: z.number(), // Amount in miliunits (cents × 10)
  payee: z.string(),
  category: z.string(), // Raw category string, frontend resolves to categoryId
  date: z.coerce.date(),
  notes: z.string(),
  transcription: z.string(), // Original transcribed text
});

export type ParsedVoiceTransaction = z.infer<typeof parsedTransactionSchema>;

/**
 * Convert dollars to miliunits (internal storage format).
 * $12.50 → 12500 miliunits
 */
function dollarsToMiliunits(dollars: number): number {
  return Math.round(dollars * 1000);
}

export const parseVoice = authedProcedure
  .input(parseVoiceInputSchema)
  .output(parsedTransactionSchema)
  .mutation(async ({ input }) => {
    const { audioBase64, mimeType } = input;

    // Get LLM service URL from environment
    const llmBaseUrl = process.env.LLM_BASE_URL || "http://127.0.0.1:8080";
    const endpoint = `${llmBaseUrl}/v1/audio/transcribe-and-parse`;

    try {
      // Convert base64 to Buffer
      const audioBuffer = Buffer.from(audioBase64, "base64");

      // Create FormData for multipart upload
      const formData = new FormData();
      const audioBlob = new Blob([audioBuffer], { type: mimeType });

      // Determine file extension from MIME type
      const extMap: Record<string, string> = {
        "audio/mpeg": "mp3",
        "audio/mp3": "mp3",
        "audio/wav": "wav",
        "audio/webm": "webm",
        "audio/ogg": "ogg",
      };
      const ext = extMap[mimeType] || "webm";
      
      formData.append("audio", audioBlob, `recording.${ext}`);

      console.log("[parseVoice] Sending audio to LLM service", {
        endpoint,
        mimeType,
        bufferSize: audioBuffer.length,
        ts: new Date().toISOString(),
      });

      // Send to LLM service
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("[parseVoice] LLM service error", {
          status: response.status,
          body: errorBody,
        });

        throw new TRPCError({
          code: response.status === 400 ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR",
          message: `Voice processing failed: ${errorBody}`,
        });
      }

      const result = await response.json() as {
        ok: boolean;
        data?: {
          amount: number;
          payee: string;
          category: string;
          date: string;
          notes: string;
        };
        transcription?: string;
        error?: string;
      };

      if (!result.ok || !result.data) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to parse voice recording",
        });
      }

      // Convert amount from dollars to miliunits
      const amountInMiliunits = dollarsToMiliunits(result.data.amount);

      console.log("[parseVoice] Successfully parsed voice", {
        originalAmount: result.data.amount,
        amountInMiliunits,
        payee: result.data.payee,
        category: result.data.category,
        ts: new Date().toISOString(),
      });

      return {
        amount: amountInMiliunits,
        payee: result.data.payee,
        category: result.data.category,
        date: new Date(result.data.date),
        notes: result.data.notes,
        transcription: result.transcription || "",
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      console.error("[parseVoice] Unexpected error", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to process voice recording",
      });
    }
  });
