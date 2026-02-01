"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CompanionRenderer } from "../companion-renderer";
import type { CompanionProfile } from "../../types/companion";
import type { CompanionAssets } from "@/db/schema";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

/**
 * Draft companion payload used by the wizard preview step.
 */
export type DraftCompanion = CompanionProfile & { assets: CompanionAssets };

/**
 * Props for editing a draft before saving.
 */
type DraftPreviewProps = {
  draft: DraftCompanion;
  isSaving: boolean;
  error?: string | null;
  onChange: (draft: DraftCompanion) => void;
  onConfirm: () => void;
  onBack: () => void;
};

/**
 * Preview step that allows the user to tweak the draft.
 */
export function DraftPreview({
  draft,
  isSaving,
  error,
  onChange,
  onConfirm,
  onBack,
}: DraftPreviewProps) {
  const primaryColor = draft.visuals?.primaryColor ?? "#7c3aed";
  const swatches = [
    { name: "Neon", value: "#22d3ee" },
    { name: "Aurora", value: "#a855f7" },
    { name: "Sunforge", value: "#fbbf24" },
    { name: "Rose", value: "#fb7185" },
    { name: "Lime", value: "#84cc16" },
    { name: "Ember", value: "#f97316" },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr),minmax(0,0.65fr)]">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative"
      >
        <div className="pointer-events-none absolute -inset-6 rounded-4xl bg-linear-to-br from-primary/10 via-transparent to-secondary/10 blur-2xl" />
        <CompanionRenderer profile={draft} showActions={false} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
      >
        <motion.div layoutId="wizard-panel">
          <Card className="relative overflow-hidden border-border/50 bg-card/50 p-6 backdrop-blur-md">
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/15 via-transparent to-secondary/15" />
            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Draft Companion</h3>
                  <p className="text-sm text-muted-foreground">
                    Tweak the name and colors before awakening.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <Label htmlFor="companion-name">Name</Label>
                <Input
                  id="companion-name"
                  value={draft.name}
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      name: event.target.value,
                    })
                  }
                  placeholder="FinHack"
                  className="bg-white/5"
                />
              </div>

              <div className="mt-6 space-y-4">
                <Label htmlFor="primary-color">Primary aura</Label>
                <div className="flex flex-wrap gap-2">
                  {swatches.map((swatch) => (
                    <button
                      key={swatch.value}
                      type="button"
                      onClick={() =>
                        onChange({
                          ...draft,
                          visuals: {
                            ...draft.visuals,
                            primaryColor: swatch.value,
                          },
                        })
                      }
                      className={cn(
                        "relative h-10 w-10 rounded-full border border-white/10 transition",
                        primaryColor === swatch.value
                          ? "scale-105 ring-2 ring-white/50"
                          : "hover:scale-105",
                      )}
                      style={{ backgroundColor: swatch.value }}
                      aria-label={swatch.name}
                    >
                      <span className="absolute inset-0 rounded-full shadow-[0_0_18px_rgba(59,130,246,0.35)]" />
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    id="primary-color"
                    type="color"
                    value={primaryColor}
                    onChange={(event) =>
                      onChange({
                        ...draft,
                        visuals: {
                          ...draft.visuals,
                          primaryColor: event.target.value,
                        },
                      })
                    }
                    className="h-11 w-14 p-1"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(event) =>
                      onChange({
                        ...draft,
                        visuals: {
                          ...draft.visuals,
                          primaryColor: event.target.value,
                        },
                      })
                    }
                    className="font-mono text-sm"
                  />
                </div>
                <motion.div
                  className="h-10 rounded-md border border-border"
                  style={{ backgroundColor: primaryColor }}
                  animate={{ boxShadow: `0 0 18px ${primaryColor}66` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>

              {error ? (
                <div className="mt-5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <div className="mt-6 flex items-center justify-between gap-2">
                <Button variant="ghost" onClick={onBack} disabled={isSaving}>
                  Back
                </Button>
                <Button
                  onClick={onConfirm}
                  disabled={isSaving || !draft.name}
                  className={cn(isSaving && "opacity-80")}
                >
                  {isSaving ? "Awakening..." : "Confirm & Save"}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
