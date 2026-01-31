"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BaseAvatar } from "./avatars/base-avatar";
import { useActiveCompanion } from "@/services/ai-agent/provider/companion-provider";
import type {
  CompanionEvolutionStage,
  CompanionMood,
  CompanionProfile,
} from "@/services/ai-agent/types";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * Default micro-copy used when the user hovers the companion.
 * Deterministic per page + mood to avoid flicker.
 */
const moodBubbles: Record<CompanionMood, string[]> = {
  thriving: ["We’re unstoppable today.", "Let’s keep the streak alive."],
  happy: ["You’re doing amazing!", "I love this momentum."],
  hungry: ["I’m hungry!", "Feed me a small win."],
  dirty: ["I feel messy…", "Let’s clean up our plan."],
  sleepy: ["Need a recharge.", "Let’s take it slow."],
  neutral: ["Ready when you are.", "What’s our next move?"],
  evolving: ["Something new is forming…", "I’m leveling up."],
};

/**
 * Maps the companion's evolution stage to a visual asset.
 * Falls back to the baby stage when the stage is missing.
 */
function pickAsset(companion: CompanionProfile) {
  const assets = companion.assets;
  if (!assets) return null;
  const stage = (companion.evolutionStage ?? "baby") as keyof typeof assets;
  return assets[stage]?.idle ?? null;
}

/**
 * Floating HUD that renders the companion avatar + a contextual insight bubble.
 *
 * User flow:
 * 1) Fetch active companion from provider.
 * 2) Render avatar and hover bubble.
 * 3) If page context changed, show the Analyze button.
 * 4) On Analyze, call the companion interaction endpoint and show a reply.
 */
export function FloatingCompanionHUD() {
  const trpc = useTRPC();
  const { activeCompanion, isLoading, pageContext } = useActiveCompanion();
  const [insight, setInsight] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [lastInsight, setLastInsight] = useState<string | null>(null);
  const [pressTimer, setPressTimer] = useState<number | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [report, setReport] = useState<{
    summary: string;
    highlights: string[];
    risks: string[];
    suggests: string[];
  } | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Sends a lightweight “pet/analyze” interaction to the backend.
  const interactMutation = useMutation(
    trpc.companionInteract.mutationOptions({
      onMutate: () => {
        setInsight("Thinking...");
        setIsHolding(false);
      },
      onSuccess: (response) => {
        const summaryPayload = response?.data?.summaryPayload;
        if (summaryPayload?.summary) {
          setReport({
            summary: summaryPayload.summary,
            highlights: summaryPayload.highlights ?? [],
            risks: summaryPayload.risks ?? [],
            suggests: summaryPayload.suggests ?? [],
          });
        } else {
          setReport(null);
        }
        const reply = response?.data?.reply;
        const next = summaryPayload?.summary
          ? `${summaryPayload.summary} Tap for the full report.`
          : reply || "I’m here with you. Let’s keep going.";
        setLastInsight(next);
        setInsight(next);
        setShowHint(false);
        setIsReportOpen(false);
      },
      onError: () => {
        setInsight("I couldn’t read this page yet.");
        setIsHolding(false);
        setReport(null);
        setIsReportOpen(false);
      },
    }),
  );

  // Resolve mood from vitals first, then fallback to legacy mood field.
  const mood = (activeCompanion?.vitals?.mood ??
    (activeCompanion as { mood?: CompanionMood })?.mood ??
    "neutral") as CompanionMood;

  // Stable key that changes when the route or query params change.
  const contextKey = useMemo(
    () => `${pageContext.path}?${JSON.stringify(pageContext.params)}`,
    [pageContext],
  );

  // Deterministic hover text based on mood + page context.
  const hoverMessage = useMemo(() => {
    const pool = moodBubbles[mood] ?? moodBubbles.neutral;
    if (pool.length === 0) return "";
    const hashSource = `${mood}-${contextKey}`;
    let hash = 0;
    for (let i = 0; i < hashSource.length; i += 1) {
      hash = (hash * 31 + hashSource.charCodeAt(i)) % 2147483647;
    }
    const index = Math.abs(hash) % pool.length;
    return pool[index] ?? "";
  }, [mood, contextKey]);

  // Always allow analyze on the current page/context.
  const showAnalyze = Boolean(contextKey);

  // Prefer insight when present; otherwise show hover copy or usage hint.
  const bubbleText =
    insight ??
    (showHint && showAnalyze
      ? "Hold me to analyze this page. Tap to view the last insight."
      : isHovered
        ? hoverMessage
        : null);

  // Auto-clear insight after a short delay.
  useEffect(() => {
    if (!insight || insight === "Thinking...") return;
    const timer = window.setTimeout(() => setInsight(null), 10000);
    return () => window.clearTimeout(timer);
  }, [insight]);

  useEffect(() => {
    if (!showAnalyze) return;
    const timer = window.setTimeout(() => setShowHint(false), 8000);
    return () => window.clearTimeout(timer);
  }, [showAnalyze]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(pointer: coarse)");
    const handleChange = () => setIsTouchDevice(media.matches);
    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  const triggerAnalyze = () => {
    if (!activeCompanion || interactMutation.isPending) return;
    interactMutation.mutate({
      action: "pet",
      companionId: activeCompanion.id,
      message: "Analyze the current page.",
      pageContext: {
        path: pageContext.path,
        params: pageContext.params,
      },
    });
  };

  const handlePointerDown = () => {
    if (!showAnalyze || interactMutation.isPending) return;
    if (pressTimer) window.clearTimeout(pressTimer);
    setIsHolding(true);
    const timer = window.setTimeout(() => {
      triggerAnalyze();
      setPressTimer(null);
    }, 550);
    setPressTimer(timer);
  };

  const handlePointerUp = () => {
    if (pressTimer) {
      window.clearTimeout(pressTimer);
      setPressTimer(null);
    }
    setIsHolding(false);
  };

  const handleClick = () => {
    if (report) {
      setIsReportOpen((prev) => !prev);
      return;
    }
    if (insight) return;
    if (lastInsight) {
      setInsight(lastInsight);
      return;
    }
    if (showAnalyze) setShowHint(true);
  };

  if (isLoading || !activeCompanion) return null;

  // Normalize shape to match CompanionProfile typing expectations.
  const companionProfile: CompanionProfile = {
    ...activeCompanion,
    evolutionStage: activeCompanion.evolutionStage as
      | CompanionEvolutionStage
      | undefined,
    dataHygiene: activeCompanion.dataHygiene ?? undefined,
  };

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50">
      <motion.div
        drag={!isTouchDevice}
        dragElastic={isTouchDevice ? 0 : 0.2}
        dragConstraints={{ left: -1000, right: 0, top: -500, bottom: 0 }}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        whileHover={{}}
        transition={{ type: "spring", stiffness: 180, damping: 18 }}
        style={{ touchAction: "manipulation" }}
        className={
          isHolding
            ? "pointer-events-auto relative cursor-wait"
            : "pointer-events-auto relative active:cursor-grabbing"
        }
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchEnd={handlePointerUp}
        onTouchCancel={handlePointerUp}
        onClick={handleClick}
      >
        <div className="absolute -inset-3 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.2),transparent_70%)] blur-2xl" />
        {insight === "Thinking..." || interactMutation.isPending ? (
          <motion.div className="pointer-events-none absolute inset-1 z-20 overflow-hidden rounded-3xl">
            <motion.div
              className="absolute -left-1/2 top-0 h-full w-1/2 bg-linear-to-r from-transparent via-sky-400/35 to-transparent"
              animate={{ x: ["-60%", "160%"] }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </motion.div>
        ) : null}
        {showAnalyze && isHolding && !interactMutation.isPending ? (
          <motion.div
            className="pointer-events-none absolute -inset-1 rounded-full border border-sky-400/50"
            animate={{
              boxShadow: [
                "0 0 0 rgba(56,189,248,0)",
                "0 0 24px rgba(56,189,248,0.6)",
                "0 0 0 rgba(56,189,248,0)",
              ],
            }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : null}
        <BaseAvatar
          asset={pickAsset(companionProfile)}
          mood={mood}
          floating={false}
          className="h-24 w-24"
        />

        <AnimatePresence>
          {bubbleText ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className={
                insight === "Thinking..."
                  ? "absolute -right-2 bottom-28 max-w-60 rounded-2xl border border-sky-400/30 bg-slate-900/95 px-3 py-2 text-xs text-white shadow-xl"
                  : "absolute -right-2 bottom-28 max-w-60 rounded-2xl border border-white/10 bg-slate-900/90 px-3 py-2 text-xs text-white shadow-xl"
              }
            >
              {insight === "Thinking..." ? (
                <span className="flex items-center gap-2 text-sky-100">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
                  </span>
                  Thinking...
                </span>
              ) : (
                bubbleText
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {isReportOpen && report ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute -right-2 bottom-36 w-[min(22rem,85vw)] max-h-[55vh] overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 p-4 text-xs text-white shadow-2xl"
            >
              <ScrollArea>
                <div className="text-[11px] uppercase tracking-wide text-slate-400">
                  Summary report
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-100">
                  {report.summary}
                </div>
                <div className="mt-3 space-y-3 overflow-y-auto pr-1 max-h-[40vh]">
                  {report.highlights.length > 0 && (
                    <div>
                      <div className="mb-1 text-[11px] font-semibold uppercase text-emerald-300">
                        Highlights
                      </div>
                      <ul className="space-y-1 text-slate-200">
                        {report.highlights.map((item, index) => (
                          <li
                            key={`report-highlight-${index}`}
                            className="flex gap-2"
                          >
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {report.risks.length > 0 && (
                    <div>
                      <div className="mb-1 text-[11px] font-semibold uppercase text-rose-300">
                        Risks
                      </div>
                      <ul className="space-y-1 text-slate-200">
                        {report.risks.map((item, index) => (
                          <li
                            key={`report-risk-${index}`}
                            className="flex gap-2"
                          >
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-300" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {report.suggests.length > 0 && (
                    <div>
                      <div className="mb-1 text-[11px] font-semibold uppercase text-sky-300">
                        Suggestions
                      </div>
                      <ul className="space-y-1 text-slate-200">
                        {report.suggests.map((item, index) => (
                          <li
                            key={`report-suggest-${index}`}
                            className="flex gap-2"
                          >
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-300" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="mt-3 text-[11px] text-slate-400">
                Tap the hub to close.
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
