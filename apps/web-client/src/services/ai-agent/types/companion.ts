import {
  CompanionAssets,
  CompanionPersonality,
  CompanionVitals,
} from "@/db/schema";

export type CompanionEvolutionStage = "baby" | "adult" | "mythic";

export type CompanionVisuals = {
  primaryColor?: string;
  accentColor?: string;
  accessory?: string;
};

export type CompanionProfile = {
  id?: string;
  userId?: string;
  name: string;
  archetype?: string;
  prompt?: string | null;
  personality?: CompanionPersonality;
  assets?: CompanionAssets;
  visuals?: CompanionVisuals;
  evolutionStage?: CompanionEvolutionStage;
  level?: number;
  xp?: number;
  vitals?: CompanionVitals;
  hunger?: number;
  cleanliness?: number;
  energy?: number;
  lastInteractedAt?: string | Date | null;
  lastLoginAt?: string | Date | null;
  dataHygiene?: { uncategorized?: number; lastRefreshAt?: string | null };
};

export type CompanionXpReason =
  | "login"
  | "categorize"
  | "budgetWin"
  | "pet"
  | "feed"
  | "clean";

export type CompanionMood =
  | "thriving"
  | "hungry"
  | "dirty"
  | "sleepy"
  | "neutral"
  | "evolving"
  | "happy";

export type CompanionEngineInput = {
  profile: CompanionProfile;
  monthlySavings?: number;
  savingsGoal?: number;
  uncategorizedCount?: number;
  weeklyBudget?: { spent: number; limit: number };
  safeToSpend?: number;
  now?: Date;
};

export type CompanionEngineResult = {
  vitals: CompanionVitals & { mood: CompanionMood };
  xp: number;
  level: number;
  evolutionStage: CompanionEvolutionStage;
  stageAsset?: string | null;
  flags: { isHungry: boolean; isDirty: boolean; isSleepy: boolean };
  derived: {
    uncategorizedCount: number;
    savingsDeficit: number;
    daysInactive: number;
  };
  grantXp: (
    reason: CompanionXpReason | { custom: number; reason: string },
  ) => number;
  feed: (amount?: number) => void;
  clean: (amount?: number) => void;
  energize: (amount?: number) => void;
};
