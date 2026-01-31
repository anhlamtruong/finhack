"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CompanionRenderer } from "@/services/ai-agent/components/companion-renderer";
import { useActiveCompanion } from "@/services/ai-agent/provider/companion-provider";
import type {
  CompanionEvolutionStage,
  CompanionProfile,
} from "@/services/ai-agent/types";

/**
 * Welcome card shown on the dashboard with summary + companion preview.
 */
export const AIAgentWelcome = () => {
  const trpc = useTRPC();
  const { activeCompanion, isLoading } = useActiveCompanion();

  const renderWithBoldCurrency = (text: string): ReactNode => {
    const currencyMatcher = /\$[\d,]+(?:\.\d{2})?/g;
    const matches = text.match(currencyMatcher);
    if (!matches) return text;
    const parts = text.split(currencyMatcher);
    const nodes: ReactNode[] = [];
    parts.forEach((part, index) => {
      if (part) {
        nodes.push(<span key={`text-${index}`}>{part}</span>);
      }
      const match = matches[index];
      if (match) {
        nodes.push(
          <span
            key={`currency-${index}`}
            className="font-semibold text-foreground"
          >
            {match}
          </span>,
        );
      }
    });
    return nodes;
  };

  const summaryQuery = useQuery({
    ...trpc.getAiSummary.queryOptions(),
    enabled: Boolean(activeCompanion),
    staleTime: 1000 * 60 * 10,
  });

  if (isLoading) {
    return (
      <Card className="relative overflow-hidden border-border/70 bg-card/95 p-6">
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/10 via-transparent to-secondary/10" />
        <div className="relative text-sm text-muted-foreground">
          Preparing your companion...
        </div>
      </Card>
    );
  }

  if (!activeCompanion) {
    return (
      <Card className="relative overflow-hidden border-border/70 bg-card/95 p-6">
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/10 via-transparent to-secondary/10" />
        <div className="relative flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-semibold">
                Summon your Financial Spirit
              </div>
              <div className="text-sm text-muted-foreground">
                Awaken a companion to guide your daily money rituals.
              </div>
            </div>
          </div>
          <Button asChild className="w-fit">
            <Link href="/companions/new">Summon now</Link>
          </Button>
        </div>
      </Card>
    );
  }

  const summary = summaryQuery.data?.data;
  const message =
    summary?.message ?? "You're on track today. Keep the pace steady.";
  const highlights = summary?.highlights ?? [];
  const risks = summary?.risks ?? [];
  const suggestedActions = summary?.suggestedActions ?? [];

  const companionProfile: CompanionProfile = {
    ...activeCompanion,
    evolutionStage: activeCompanion.evolutionStage as
      | CompanionEvolutionStage
      | undefined,
    dataHygiene: activeCompanion.dataHygiene ?? undefined,
  };

  return (
    <Card className="relative overflow-hidden border-border/70 bg-card/95 p-6 shadow-sm">
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/10 via-transparent to-secondary/10" />
      <div className="relative grid gap-6 md:grid-cols-[minmax(0,1fr),minmax(0,260px)]">
        <div className="space-y-5">
          <div>
            <div className="text-sm uppercase tracking-wide text-muted-foreground">
              Daily Briefing
            </div>
            <div className="text-xl font-semibold">
              Hello, {activeCompanion.name}
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/40 p-4 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.6)]">
            {summaryQuery.isLoading ? (
              <div className="space-y-3">
                <div className="h-4 w-4/5 animate-pulse rounded-full bg-muted" />
                <div className="h-4 w-3/5 animate-pulse rounded-full bg-muted" />
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="h-5 w-24 animate-pulse rounded-full bg-muted" />
                  <span className="h-5 w-20 animate-pulse rounded-full bg-muted" />
                  <span className="h-5 w-24 animate-pulse rounded-full bg-muted" />
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">{message}</p>
                {(highlights.length > 0 ||
                  risks.length > 0 ||
                  suggestedActions.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {highlights.length > 0 && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-300">
                        {highlights.length} highlights
                      </span>
                    )}
                    {risks.length > 0 && (
                      <span className="rounded-full bg-rose-500/10 px-2 py-0.5 font-semibold text-rose-300">
                        {risks.length} risks
                      </span>
                    )}
                    {suggestedActions.length > 0 && (
                      <span className="rounded-full bg-sky-500/10 px-2 py-0.5 font-semibold text-sky-300">
                        {suggestedActions.length} actions
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {summaryQuery.isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border/50 bg-background/30 p-4">
                <div className="mb-3 h-3 w-24 animate-pulse rounded-full bg-muted" />
                <div className="space-y-2">
                  <div className="h-3 w-4/5 animate-pulse rounded-full bg-muted" />
                  <div className="h-3 w-3/5 animate-pulse rounded-full bg-muted" />
                  <div className="h-3 w-2/3 animate-pulse rounded-full bg-muted" />
                </div>
              </div>
              <div className="rounded-2xl border border-border/50 bg-background/30 p-4">
                <div className="mb-3 h-3 w-16 animate-pulse rounded-full bg-muted" />
                <div className="space-y-2">
                  <div className="h-3 w-5/6 animate-pulse rounded-full bg-muted" />
                  <div className="h-3 w-3/4 animate-pulse rounded-full bg-muted" />
                  <div className="h-3 w-2/3 animate-pulse rounded-full bg-muted" />
                </div>
              </div>
              <div className="rounded-2xl border border-border/50 bg-background/30 p-4 md:col-span-2">
                <div className="mb-3 h-3 w-36 animate-pulse rounded-full bg-muted" />
                <div className="space-y-2">
                  <div className="h-3 w-4/5 animate-pulse rounded-full bg-muted" />
                  <div className="h-3 w-3/5 animate-pulse rounded-full bg-muted" />
                  <div className="h-3 w-2/3 animate-pulse rounded-full bg-muted" />
                </div>
              </div>
            </div>
          ) : (
            (highlights.length > 0 ||
              risks.length > 0 ||
              suggestedActions.length > 0) && (
              <div className="grid gap-4 text-sm text-muted-foreground md:grid-cols-2">
                {highlights.length > 0 && (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="mb-2 text-xs font-semibold uppercase text-emerald-300">
                      Highlights
                    </div>
                    <ul className="space-y-2">
                      {highlights.map((item: string, index: number) => (
                        <li key={`highlight-${index}`} className="flex gap-2">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
                          <span>{renderWithBoldCurrency(item)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {risks.length > 0 && (
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
                    <div className="mb-2 text-xs font-semibold uppercase text-rose-300">
                      Risks
                    </div>
                    <ul className="space-y-2">
                      {risks.map((item: string, index: number) => (
                        <li key={`risk-${index}`} className="flex gap-2">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-300" />
                          <span>{renderWithBoldCurrency(item)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {suggestedActions.length > 0 && (
                  <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4 md:col-span-2">
                    <div className="mb-2 text-xs font-semibold uppercase text-sky-300">
                      Suggested Actions
                    </div>
                    <ul className="space-y-2">
                      {suggestedActions.map((item: string, index: number) => (
                        <li key={`action-${index}`} className="flex gap-2">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-300" />
                          <span>{renderWithBoldCurrency(item)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          )}

          <div className="flex items-center gap-3">
            <Button type="button" onClick={() => console.log("Open Chat")}>
              Chat
            </Button>
            <Button asChild variant="ghost">
              <Link href="/companions">Manage companions</Link>
            </Button>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="w-full max-w-xs scale-90 origin-top-right">
            <CompanionRenderer profile={companionProfile} showActions={false} />
          </div>
        </div>
      </div>
    </Card>
  );
};
