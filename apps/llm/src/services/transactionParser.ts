// apps/llm/src/services/transactionParser.ts
// Parses transcribed text into structured transaction data using Gemini.

import { geminiJson } from "./gemini.js";
import { formatPrompt } from "../utils/promptFormatter.js";

/**
 * Parsed transaction data from voice input.
 * - `amount` is in dollars (e.g., 12.50)
 * - `category` is a raw string guess (frontend resolves to categoryId)
 * - `date` is ISO 8601 string (defaults to today if not mentioned)
 */
export type ParsedTransaction = {
  amount: number;
  payee: string;
  category: string;
  date: string;
  notes: string;
};

/**
 * Parse transcribed text into a structured transaction object.
 *
 * @param text - The transcribed text from speech-to-text
 * @returns Promise resolving to parsed transaction data
 */
export async function parseTransactionFromText(
  text: string,
): Promise<ParsedTransaction> {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const prompt = formatPrompt({
    role: "Financial transaction parser",
    task: `Extract transaction details from the user's spoken text. Parse amounts, payee names, dates, and any additional notes.`,
    rules: [
      "amount: Extract the monetary amount as a positive number in dollars (e.g., 12.50 for $12.50 or twelve fifty)",
      "payee: Extract the merchant, person, or entity receiving the payment",
      "category: Guess a category based on the payee (e.g., 'Food & Dining', 'Transportation', 'Shopping', 'Entertainment', 'Bills & Utilities', 'Healthcare', 'Income', 'Transfer', 'Other')",
      `date: Extract the date mentioned, or use today's date (${today}) if not specified. Return as ISO 8601 date string (YYYY-MM-DD)`,
      "notes: Include any additional context or details mentioned",
      "If the user mentions 'yesterday', calculate the correct date",
      "If the user says a relative date like 'last Friday', calculate it relative to today",
      "Handle common speech patterns like 'spent', 'paid', 'bought', 'got', 'received'",
      "For income/received money, still return a positive amount (frontend handles direction)",
    ],
    input: {
      transcribedText: text,
      todayDate: today,
    },
    output: {
      amount: 0,
      payee: "",
      category: "",
      date: today,
      notes: "",
    },
  });

  console.log("[transactionParser] Parsing transaction from text", {
    textLength: text.length,
    textPreview: text.slice(0, 100),
    ts: new Date().toISOString(),
  });

  try {
    const result = await geminiJson<ParsedTransaction>({
      system: prompt,
      user: text,
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      temperature: 0.1, // Low temperature for consistent parsing
      timeoutMs: 30000,
    });

    // Validate and sanitize the result
    const parsed: ParsedTransaction = {
      amount: typeof result.amount === "number" && result.amount > 0 
        ? result.amount 
        : 0,
      payee: typeof result.payee === "string" 
        ? result.payee.trim() 
        : "",
      category: typeof result.category === "string" 
        ? result.category.trim() 
        : "Other",
      date: typeof result.date === "string" && result.date.match(/^\d{4}-\d{2}-\d{2}/)
        ? result.date.split("T")[0]
        : today,
      notes: typeof result.notes === "string" 
        ? result.notes.trim() 
        : "",
    };

    console.log("[transactionParser] Parsed transaction", {
      amount: parsed.amount,
      payee: parsed.payee,
      category: parsed.category,
      date: parsed.date,
      ts: new Date().toISOString(),
    });

    return parsed;
  } catch (error: any) {
    console.error("[transactionParser] Failed to parse transaction", {
      error: error?.message || error,
      ts: new Date().toISOString(),
    });

    const wrappedError: any = new Error(
      `Failed to parse transaction: ${error?.message || "Unknown error"}`,
    );
    wrappedError.status = error?.status || 500;
    wrappedError.cause = error;
    throw wrappedError;
  }
}
