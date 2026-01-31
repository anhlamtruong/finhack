"use client";

import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BaseAvatar } from "@/services/ai-agent/components/avatars/base-avatar";
import type { CompanionMood } from "@/services/ai-agent/types";
import type { RouterOutputs } from "@/types/trpc";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Star } from "lucide-react";

type CompanionsOutput = RouterOutputs["getCompanions"];
type CompanionRow = CompanionsOutput[number];

/**
 * Pick a default idle asset for list cards.
 */
function pickAsset(companion: CompanionRow) {
  const assets = companion.assets;
  if (!assets) {
    return null;
  }
  const stage = (companion.evolutionStage ?? "baby") as keyof typeof assets;
  return assets[stage]?.idle ?? null;
}

/**
 * Resolve mood for the list card.
 */
function pickMood(companion: CompanionRow): CompanionMood {
  return (companion.vitals?.mood ??
    companion.mood ??
    "neutral") as CompanionMood;
}

/**
 * List view for all companions owned by the current user.
 */
export function CompanionsList() {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.getCompanions.queryOptions());

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button asChild className="shadow-sm">
          <Link href="/companions/new">Summon a companion</Link>
        </Button>
      </div>
      {data.length === 0 ? (
        <Card className="relative overflow-hidden border-dashed bg-card/40 backdrop-blur-md">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_55%)]" />
          <CardHeader>
            <CardTitle>No companions yet</CardTitle>
            <CardDescription>
              Summon your first companion to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="relative flex h-40 w-40 items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-primary/30 bg-primary/10 shadow-[0_0_40px_rgba(59,130,246,0.35)]" />
                <div className="absolute inset-6 rounded-full border border-dashed border-white/40" />
                <Sparkles className="relative h-10 w-10 text-primary" />
                <Star className="absolute right-8 top-10 h-4 w-4 text-amber-300" />
                <Star className="absolute left-10 bottom-10 h-3 w-3 text-fuchsia-300" />
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  Your companions will appear here once created.
                </div>
                <Button asChild className="shadow-sm">
                  <Link href="/companions/new">Summon a companion</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <AnimatePresence>
          <motion.div
            className="grid gap-5 md:grid-cols-2"
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: {
                transition: {
                  staggerChildren: 0.08,
                },
              },
            }}
          >
            {data.map((companion) => {
              const asset = pickAsset(companion);
              const mood = pickMood(companion);
              const haloColor = "#7c3aed";

              return (
                <motion.div
                  key={companion.id}
                  variants={{
                    hidden: { opacity: 0, y: 14 },
                    show: { opacity: 1, y: 0 },
                  }}
                >
                  <Card className="group relative overflow-hidden border-border/50 bg-card/40 backdrop-blur-md transition hover:-translate-y-0.5 hover:shadow-[0_25px_45px_-35px_rgba(59,130,246,0.6)]">
                    <div className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100">
                      <div className="absolute -inset-0.5 rounded-2xl bg-linear-to-r from-primary/30 via-transparent to-secondary/30" />
                    </div>
                    <CardContent className="relative flex flex-col gap-4 pt-6">
                      <div className="flex items-center gap-4">
                        {/* Avatar Container: Fixed size, proper containment */}
                        <div className="relative h-24 w-24 shrink-0 rounded-2xl bg-muted/30 p-2">
                          <div
                            className="pointer-events-none absolute -inset-2 rounded-full opacity-70 blur-xl"
                            style={{
                              background: `radial-gradient(circle, ${haloColor}55, transparent 70%)`,
                            }}
                          />
                          <div className="relative h-full w-full overflow-hidden rounded-xl">
                            <BaseAvatar
                              asset={asset}
                              mood={mood}
                              floating={false}
                              // Force the avatar to fit nicely inside the small card slot
                              className="h-full w-full border-none bg-transparent shadow-none [&_img]:object-contain"
                            />
                          </div>
                        </div>

                        {/* Text Content */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="text-lg font-semibold truncate">
                            {companion.name}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {companion.archetype ?? "guardian"}
                          </div>
                          <div className="text-xs font-medium text-muted-foreground/80">
                            Stage: {companion.evolutionStage ?? "baby"}
                          </div>
                        </div>

                        <Button asChild variant="ghost" className="shrink-0">
                          <Link href={`/companions/${companion.id}`}>View</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
