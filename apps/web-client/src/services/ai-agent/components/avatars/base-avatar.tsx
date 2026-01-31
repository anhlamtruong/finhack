"use client";

import { cn } from "@/lib/utils";
import { easeInOut, motion, type Variants } from "framer-motion";
import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import type { CompanionMood } from "../../types";

/**
 * Motion variants for floating/resting avatar.
 */
const containerVariants: Variants = {
  float: {
    y: [0, -6, 0],
    transition: { duration: 3, repeat: Infinity, ease: easeInOut },
  },
  rest: { y: 0 },
};

/**
 * Subtle breathing animation for idle avatars.
 */
const breathing = {
  scale: [1, 1.015, 1],
  transition: { duration: 4, repeat: Infinity, ease: easeInOut },
};

/**
 * Gradient rings used for each mood.
 */
const moodRing: Record<CompanionMood, string> = {
  thriving: "from-emerald-400 to-emerald-600",
  happy: "from-sky-400 to-blue-500",
  hungry: "from-amber-400 to-orange-500",
  dirty: "from-slate-500 to-slate-700",
  sleepy: "from-indigo-400 to-purple-500",
  neutral: "from-slate-300 to-slate-500",
  evolving: "from-fuchsia-400 to-violet-600",
};

/**
 * Props for the companion avatar frame.
 */
type BaseAvatarProps = {
  asset?: string | React.ReactNode | null;
  mood: CompanionMood;
  sleeping?: boolean;
  floating?: boolean;
  className?: string;
  children?: React.ReactNode;
};

/**
 * Image layer with loading + error fallback states.
 */
function AssetLayer({ src, sleeping }: { src: string; sleeping?: boolean }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  const isLoading = status === "loading";
  const hasError = status === "error";

  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl bg-white/30 shadow-inner">
      {!hasError && (
        <motion.img
          key={src}
          src={src}
          alt="companion"
          className="h-full w-full rounded-3xl object-cover"
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          animate={sleeping ? { opacity: 0.8 } : breathing}
        />
      )}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-black/30">
          <Loader2 className="h-5 w-5 animate-spin text-white" />
        </div>
      )}
      {hasError && (
        <div className="flex h-full w-full items-center justify-center rounded-3xl bg-linear-to-br from-slate-800 to-slate-900 text-white">
          <span className="text-lg font-semibold">CC</span>
        </div>
      )}
    </div>
  );
}

/**
 * Primary avatar renderer for companion assets.
 */
export function BaseAvatar({
  asset,
  mood,
  sleeping,
  floating = true,
  className,
  children,
}: BaseAvatarProps) {
  const ring = moodRing[mood] ?? moodRing.neutral;

  const content = React.useMemo(() => {
    if (React.isValidElement(asset)) return asset;
    if (typeof asset === "string" && asset.trim().length > 0) {
      return <AssetLayer key={asset} src={asset} sleeping={sleeping} />;
    }

    return (
      <motion.div
        className="flex h-full w-full items-center justify-center rounded-3xl bg-linear-to-br from-slate-800 to-slate-900 text-white"
        animate={sleeping ? { opacity: 0.8 } : breathing}
      >
        <span className="text-lg font-semibold">CC</span>
      </motion.div>
    );
  }, [asset, sleeping]);

  return (
    <motion.div
      className={cn(
        "relative aspect-square w-40 rounded-[28px] border border-white/5 bg-linear-to-br p-2 shadow-2xl",
        "after:absolute after:inset-0.75 after:rounded-[22px] after:bg-black/20",
        className,
      )}
      variants={containerVariants}
      animate={floating ? "float" : "rest"}
      initial="rest"
    >
      <div
        className={cn(
          "relative h-full w-full overflow-hidden rounded-[20px] border bg-linear-to-br",
          `from-transparent via-white/5 to-white/0`,
        )}
      >
        <div
          className={cn(
            "absolute -inset-1 rounded-2xl opacity-60 blur-2xl",
            `bg-linear-to-br ${ring}`,
          )}
        />

        <div className="relative z-10 h-full w-full rounded-[20px] ring-2 ring-white/10">
          {content}
        </div>

        {sleeping && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-end p-4 text-white/80">
            <div className="text-xs font-semibold tracking-wide">zzz</div>
          </div>
        )}

        {children && (
          <div className="pointer-events-none absolute inset-0 z-30">
            {children}
          </div>
        )}
      </div>
    </motion.div>
  );
}
