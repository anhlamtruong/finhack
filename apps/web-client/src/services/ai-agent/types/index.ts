/**
 * Standard response payload for AI summary endpoints.
 */
export type AIAgentResponse = {
  ok: boolean;
  userId: string;
  todayIso: string;
  days: number;
  safeToSpendToday: number;
  caps: {
    rent: number;
    groceries: number;
    shopping: number;
    entertainment: number;
  };
  message: string;
  highlights: string[];
  risks: string[];
  source: string;
  model: string;
};

export * from "./companion";
