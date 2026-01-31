"use client";

import { useEffect, useMemo, useState } from "react";
import type { CompanionAssets, CompanionVitals } from "@/db/schema";
import type {
  CompanionEngineInput,
  CompanionEngineResult,
  CompanionEvolutionStage,
  CompanionMood,
  CompanionProfile,
  CompanionXpReason,
} from "../types";

/**
 * Clamp a numeric value between min and max.
 */
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Parse a string/Date into a valid Date or null.
 */
function toDate(value?: string | Date | null) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Calculate full days since a date; returns 0 for invalid inputs.
 */
function daysSince(date?: string | Date | null) {
  const d = toDate(date);
  if (!d) return 0;
  const diff = Date.now() - d.getTime();
  return diff > 0 ? Math.floor(diff / (1000 * 60 * 60 * 24)) : 0;
}

/**
 * Convert XP into a level (min 1).
 */
function levelFromXp(xp: number) {
  return Math.max(1, Math.floor(xp / 100) + 1);
}

/**
 * Convert level into evolution stage buckets.
 */
function stageFromLevel(level: number): CompanionEvolutionStage {
  if (level >= 30) return "mythic";
  if (level >= 10) return "adult";
  return "baby";
}

/**
 * XP deltas used by client-side actions (mirrors server map).
 */
const XP_REWARD: Record<CompanionXpReason, number> = {
  login: 10,
  categorize: 5,
  budgetWin: 100,
  pet: 2,
  feed: 5,
  clean: 5,
};

/**
 * Pick a sprite based on stage + mood, with idle fallback.
 */
function pickAsset(
  assets: CompanionAssets | undefined,
  stage: CompanionEvolutionStage,
  mood: CompanionMood,
) {
  if (!assets) return null;
  const stageAssets = assets[stage];
  return stageAssets[mood as keyof typeof stageAssets] ?? stageAssets.idle ??
    null;
}

/**
 * Merge stored profile vitals with derived values and clamp.
 */
function coalesceVitals(
  profile: CompanionProfile,
  derived: CompanionVitals,
): CompanionVitals {
  const hunger = profile.hunger ?? profile.vitals?.hunger ?? derived.hunger;
  const cleanliness = profile.cleanliness ??
    profile.vitals?.cleanliness ?? derived.cleanliness;
  const energy = profile.energy ?? profile.vitals?.energy ?? derived.energy;
  const mood = profile.vitals?.mood ?? derived.mood;

  return {
    hunger: clamp(hunger, 0, 100),
    cleanliness: clamp(cleanliness, 0, 100),
    energy: clamp(energy, 0, 100),
    mood,
    lastDecayAt: profile.vitals?.lastDecayAt ?? null,
  };
}

/**
 * Client-side engine that derives companion mood/vitals + assets.
 *
 * Example usage:
 * const engine = useCompanionEngine({ profile, weeklyBudget });
 * engine.feed(); // updates local hunger + grants xp
 */
export function useCompanionEngine(
  input: CompanionEngineInput,
): CompanionEngineResult {
  const {
    profile,
    monthlySavings = 0,
    savingsGoal = 0,
    uncategorizedCount = profile.dataHygiene?.uncategorized ?? 0,
    weeklyBudget,
    now = new Date(),
  } = input;

  const [xp, setXp] = useState(profile.xp ?? 0);
  const [vitalAdjustments, setVitalAdjustments] = useState({
    hunger: 0,
    cleanliness: 0,
    energy: 0,
  });

  useEffect(() => {
    setXp(profile.xp ?? 0);
  }, [profile.xp]);

  useEffect(() => {
    setVitalAdjustments({ hunger: 0, cleanliness: 0, energy: 0 });
  }, [monthlySavings, savingsGoal, uncategorizedCount, profile.lastLoginAt]);

  // Derived vitals based on financial data + inactivity.
  const derivedVitals = useMemo(() => {
    const deficit = Math.max(0, savingsGoal - monthlySavings);
    const hungerScore = savingsGoal > 0
      ? clamp(Math.round((deficit / savingsGoal) * 100), 0, 100)
      : 0;

    const baseCleanliness = clamp(100 - uncategorizedCount * 10, 0, 100);
    const inactivityDays = daysSince(
      profile.lastLoginAt ?? profile.lastInteractedAt,
    );
    const energyDecay = inactivityDays * 15;
    const energyScore = clamp(100 - energyDecay, 0, 100);

    return {
      hunger: hungerScore,
      cleanliness: baseCleanliness,
      energy: energyScore,
      mood: "neutral" as CompanionMood,
      lastDecayAt: now.toISOString(),
    } satisfies CompanionVitals;
  }, [
    monthlySavings,
    savingsGoal,
    uncategorizedCount,
    profile.lastLoginAt,
    profile.lastInteractedAt,
    now,
  ]);

  // Final vitals merge derived + profile + local adjustments.
  const vitals = useMemo(() => {
    const base = coalesceVitals(profile, derivedVitals);
    const hunger = clamp(base.hunger + vitalAdjustments.hunger, 0, 100);
    const cleanliness = clamp(
      base.cleanliness + vitalAdjustments.cleanliness,
      0,
      100,
    );
    const energy = clamp(base.energy + vitalAdjustments.energy, 0, 100);

    const isHungry = hunger > 40;
    const isDirty = uncategorizedCount > 5 || cleanliness < 70;
    const daysInactive = daysSince(
      profile.lastLoginAt ?? profile.lastInteractedAt,
    );
    const isSleepy = energy < 40 || daysInactive >= 1;

    let mood: CompanionMood = "thriving";
    if (isHungry) mood = "hungry";
    else if (isDirty) mood = "dirty";
    else if (isSleepy) mood = "sleepy";
    else if (weeklyBudget && weeklyBudget.spent <= weeklyBudget.limit) {
      mood = "happy";
    }

    return {
      hunger,
      cleanliness,
      energy,
      mood,
      lastDecayAt: base.lastDecayAt,
    } as CompanionVitals & { mood: CompanionMood };
  }, [
    profile,
    derivedVitals,
    vitalAdjustments,
    uncategorizedCount,
    weeklyBudget,
  ]);

  const level = useMemo(() => levelFromXp(xp), [xp]);
  const evolutionStage = useMemo(
    () => profile.evolutionStage ?? stageFromLevel(level),
    [profile.evolutionStage, level],
  );

  const stageAsset = useMemo(
    () => pickAsset(profile.assets, evolutionStage, vitals.mood),
    [profile.assets, evolutionStage, vitals.mood],
  );

  const grantXp: CompanionEngineResult["grantXp"] = (reason) => {
    const delta = typeof reason === "object" && "custom" in reason
      ? reason.custom
      : XP_REWARD[reason as CompanionXpReason];

    const add = Number.isFinite(delta) ? Number(delta) : 0;
    setXp((current) => current + add);
    return add;
  };

  const feed: CompanionEngineResult["feed"] = (amount = 20) => {
    setVitalAdjustments((prev) => ({
      ...prev,
      hunger: prev.hunger - Math.abs(amount),
    }));
    grantXp("feed");
  };

  const clean: CompanionEngineResult["clean"] = (amount = 15) => {
    setVitalAdjustments((prev) => ({
      ...prev,
      cleanliness: prev.cleanliness + Math.abs(amount),
    }));
    grantXp("clean");
  };

  const energize: CompanionEngineResult["energize"] = (amount = 10) => {
    setVitalAdjustments((prev) => ({
      ...prev,
      energy: prev.energy + Math.abs(amount),
    }));
  };

  return {
    vitals,
    xp,
    level,
    evolutionStage,
    stageAsset,
    flags: {
      isHungry: vitals.hunger > 40,
      isDirty: vitals.cleanliness < 70 || uncategorizedCount > 5,
      isSleepy: vitals.energy < 40,
    },
    derived: {
      uncategorizedCount,
      savingsDeficit: Math.max(0, savingsGoal - monthlySavings),
      daysInactive: daysSince(profile.lastLoginAt ?? profile.lastInteractedAt),
    },
    grantXp,
    feed,
    clean,
    energize,
  };
}
