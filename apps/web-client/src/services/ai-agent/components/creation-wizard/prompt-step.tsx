"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Props for the prompt input step.
 */
type PromptStepProps = {
  prompt: string;
  error?: string | null;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
};

/**
 * Prompt entry UI for draft generation.
 */
export function PromptStep({
  prompt,
  error,
  onPromptChange,
  onGenerate,
}: PromptStepProps) {
  return (
    <motion.div layoutId="wizard-panel">
      <Card className="relative overflow-hidden border-border/60 bg-card/60 p-8 backdrop-blur-md">
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/15 via-transparent to-secondary/15" />
        <div className="relative space-y-6">
          <div>
            <h3 className="text-lg font-semibold">Describe your companion</h3>
            <p className="text-sm text-muted-foreground">
              Share the vibe, personality, and financial energy you want.
            </p>
          </div>
          <div className="flex justify-center">
            <Textarea
              rows={6}
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              placeholder="A brave turtle who cheers me on as I save for my dream trip..."
              className="w-full max-w-2xl resize-none rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-base shadow-[0_0_30px_rgba(59,130,246,0.15)] focus-visible:ring-2 focus-visible:ring-primary/60"
            />
          </div>
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <Input
              className="max-w-xs bg-white/5"
              value={prompt.split(" ").slice(0, 6).join(" ")}
              placeholder="Soul summary"
              readOnly
            />
            <div className="relative">
              <motion.span
                className="pointer-events-none absolute -left-6 -top-4 text-primary"
                animate={{ opacity: [0.4, 1, 0.4], scale: [0.9, 1.1, 0.9] }}
                transition={{ duration: 2.4, repeat: Number.POSITIVE_INFINITY }}
              >
                <Sparkles className="h-5 w-5" />
              </motion.span>
              <Button onClick={onGenerate} disabled={!prompt.trim()}>
                Generate Draft
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
