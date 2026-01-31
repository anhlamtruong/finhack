"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BatteryCharging,
  Droplets,
  Flame,
  Sparkles as SparklesIcon,
  Utensils,
} from "lucide-react";
import { BaseAvatar } from "./avatars/base-avatar";
import { Flies } from "./avatars/particles/Flies";
import { Sparkles } from "./avatars/particles/Sparkles";
import { Zzz } from "./avatars/particles/Zzz";
import { useCompanionEngine } from "../hooks/use-companion-engine";
import type {
  CompanionEngineInput,
  CompanionProfile,
} from "../types/companion";

/**
 * Clamp a value between min and max for UI progress bars.
 */
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Human-friendly stage label.
 */
function formatStage(stage: string) {
  return stage.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Props for the companion status card.
 */
type CompanionRendererProps = CompanionEngineInput & {
  profile: CompanionProfile;
  showActions?: boolean;
};

/**
 * Renders the companion avatar + vitals panel.
 * Uses `useCompanionEngine` to compute mood and stage assets.
 */
export function CompanionRenderer({
  profile,
  showActions = true,
  ...engineInput
}: CompanionRendererProps) {
  const engine = useCompanionEngine({ profile, ...engineInput });
  const { vitals, flags, evolutionStage, stageAsset, level, xp } = engine;

  const hungerValue = vitals.hunger;
  const cleanValue = vitals.cleanliness;
  const energyValue = vitals.energy;

  return (
    <div className="relative grid gap-4 overflow-hidden rounded-3xl border border-border/60 bg-linear-to-br from-slate-900 via-slate-950 to-slate-900 p-6 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.9)] lg:grid-cols-[auto,1fr]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.15),transparent_45%)]" />
      <div className="relative flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="pointer-events-none absolute -inset-6 rounded-full bg-[radial-gradient(circle,rgba(125,211,252,0.25),transparent_60%)] blur-2xl" />
          <BaseAvatar
            asset={stageAsset}
            mood={vitals.mood}
            sleeping={flags.isSleepy}
            className="bg-white/5"
          >
            {flags.isDirty && <Flies />}
            {flags.isSleepy && <Zzz />}
            {!flags.isDirty && !flags.isSleepy && vitals.mood === "happy" && (
              <Sparkles />
            )}
            {flags.isHungry && (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-end justify-center pb-4">
                <div className="flex items-center gap-1 rounded-full bg-amber-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-100 ring-1 ring-amber-400/40">
                  <Flame className="h-3 w-3" />
                  Hungry
                </div>
              </div>
            )}
          </BaseAvatar>
          <div className="pointer-events-none absolute -bottom-6 left-1/2 h-16 w-40 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(148,163,184,0.45),transparent_65%)] blur-xl" />
          <div className="pointer-events-none absolute -bottom-2 left-1/2 h-6 w-28 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.35),transparent_70%)] blur" />
        </div>
        <div className="text-center text-xs uppercase tracking-[0.25em] text-slate-200/80">
          {formatStage(evolutionStage)} Stage
        </div>
      </div>

      <div className="relative space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-tight text-slate-300/80">
              Companion
            </div>
            <div className="text-2xl font-bold text-white">{profile.name}</div>
            <div className="text-xs text-slate-400">
              {profile.archetype ?? "guardian"}
            </div>
          </div>
          <div className="text-right">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-200">
              <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.75)]" />
              Level {level}
            </div>
            <div className="mt-2 text-[11px] text-slate-400">XP {xp}</div>
            <div className="mt-2 h-2 w-28 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-linear-to-r from-amber-300 via-rose-300 to-violet-400 shadow-[0_0_14px_rgba(244,114,182,0.6)]"
                style={{ width: `${clamp((xp % 100) / 100, 0, 1) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <VitalRow
            label="Hunger"
            value={100 - hungerValue}
            color="from-emerald-300 via-emerald-400 to-emerald-500"
            danger={flags.isHungry}
            icon={Utensils}
          />
          <VitalRow
            label="Cleanliness"
            value={cleanValue}
            color="from-sky-300 via-sky-400 to-sky-500"
            danger={flags.isDirty}
            icon={Droplets}
          />
          <VitalRow
            label="Energy"
            value={energyValue}
            color="from-violet-300 via-purple-400 to-fuchsia-500"
            danger={flags.isSleepy}
            icon={BatteryCharging}
          />
        </div>

        {showActions && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="default" onClick={() => engine.feed()}>
              Feed
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => engine.clean()}
            >
              Clean
            </Button>
            <Button size="sm" variant="ghost" onClick={() => engine.energize()}>
              Rest
            </Button>
            <div className="ml-auto flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-[11px] font-semibold text-white">
              <SparklesIcon className="h-3.5 w-3.5" />
              Mood: {vitals.mood}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Props for a single vital row bar.
 */
type VitalRowProps = {
  label: string;
  value: number;
  color: string;
  danger?: boolean;
  icon: typeof Utensils;
};

/**
 * Single bar row showing a vital percentage with a label.
 */
function VitalRow({ label, value, color, danger, icon: Icon }: VitalRowProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5 text-white/80 ring-1 ring-white/10">
            <Icon className="h-3.5 w-3.5" />
          </span>
          {label}
        </span>
        <span className={cn(danger ? "text-amber-300" : "text-slate-400")}>
          {Math.round(value)}%
        </span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full bg-linear-to-r shadow-[0_0_16px_rgba(56,189,248,0.45)]",
            color,
          )}
          style={{ width: `${clamp(value, 0, 100)}%` }}
        />
        <div className="absolute inset-0 rounded-full ring-1 ring-white/10" />
      </div>
    </div>
  );
}
