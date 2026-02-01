"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { DraftPreview, type DraftCompanion } from "./draft-preview";
import { PromptStep } from "./prompt-step";
import { LoadingStep } from "./loading-step";
import { SavingStep } from "./saving-step";
import { DoneStep } from "./done-step";
import { useCreateCompanion } from "@/services/ai-agent/hooks/use-create-companion";
import type { CompanionAssets, CompanionVitals } from "@/db/schema";

/**
 * Placeholder assets used before draft generation completes.
 */
const DEFAULT_ASSETS: CompanionAssets = {
  baby: { idle: null, happy: null, sleepy: null, hungry: null },
  adult: { idle: null, happy: null, sleepy: null, hungry: null },
  mythic: { idle: null, happy: null, sleepy: null, hungry: null },
};

/**
 * Default vitals for a freshly created companion.
 */
const DEFAULT_VITALS: CompanionVitals = {
  hunger: 0,
  cleanliness: 100,
  energy: 100,
  mood: "neutral",
  lastDecayAt: null,
};

/**
 * Wizard step state machine.
 */
type WizardStep = "prompt" | "loading" | "preview" | "saving" | "done";

/**
 * Multi-step wizard that generates a draft and persists a new companion.
 */
export function WizardContainer() {
  const trpc = useTRPC();
  const [step, setStep] = useState<WizardStep>("prompt");
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState<DraftCompanion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const generateDraft = useMutation(
    trpc.generateDraft.mutationOptions({
      onMutate: () => {
        setDismissed(false);
        setError(null);
        setStep("loading");
      },
      onSuccess: (response) => {
        if (dismissed) return;
        const raw = response?.data ?? {};
        const draftProfile: DraftCompanion = {
          name: raw.name ?? "FinHack",
          archetype: raw.archetype ?? "guardian",
          prompt: raw.prompt ?? prompt,
          personality: raw.personality ?? { tone: "supportive", backstory: "" },
          assets: raw.assets ?? DEFAULT_ASSETS,
          visuals: {
            primaryColor: raw.visuals?.primaryColor ?? "#7c3aed",
            accentColor: raw.visuals?.accentColor,
            accessory: raw.visuals?.accessory,
          },
          evolutionStage: raw.evolutionStage ?? "baby",
          level: raw.level ?? 1,
          xp: raw.xp ?? 0,
          vitals: raw.vitals ?? DEFAULT_VITALS,
          dataHygiene: raw.dataHygiene ?? { uncategorized: 0 },
        };
        setDraft(draftProfile);
        setStep("preview");
      },
      onError: (err: { message?: string }) => {
        if (dismissed) return;
        const message = err.message || "Failed to generate draft";
        setError(message);
        toast.error(message);
        setStep("prompt");
      },
    }),
  );

  const createCompanion = useCreateCompanion({
    onSuccess: () => {
      setStep("done");
    },
    onError: (err) => {
      setError(err.message || "Failed to create companion");
      setStep("preview");
    },
  });

  const progressLabel = useMemo(() => {
    switch (step) {
      case "prompt":
        return "Step 1 • Soul Prompt";
      case "loading":
        return "Step 2 • Materialization";
      case "preview":
        return "Step 3 • Preview";
      case "saving":
        return "Step 4 • Awakening";
      case "done":
        return "Companion Ready";
      default:
        return "";
    }
  }, [step]);

  const handleGenerate = () => {
    if (!prompt.trim()) {
      setError("Please describe your financial spirit animal.");
      return;
    }
    generateDraft.mutate({ prompt: prompt.trim() });
  };

  const handleConfirm = () => {
    if (!draft) return;
    setStep("saving");
    setError(null);

    createCompanion.mutate({
      name: draft.name,
      archetype: draft.archetype ?? "guardian",
      prompt: draft.prompt ?? prompt,
      assets: draft.assets ?? DEFAULT_ASSETS,
      personality: draft.personality,
      visuals: draft.visuals,
      evolutionStage: draft.evolutionStage,
      level: draft.level,
      xp: draft.xp,
      vitals: draft.vitals ?? DEFAULT_VITALS,
      dataHygiene: draft.dataHygiene,
    });
  };

  const handleDismissLoading = () => {
    setDismissed(true);
    generateDraft.reset();
    setError(null);
    setStep("prompt");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{progressLabel}</p>
          <h2 className="text-2xl font-semibold">Summoning Wizard</h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-4 w-4" />
          Soul Forge
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === "prompt" && (
          <motion.div
            key="prompt"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <PromptStep
              prompt={prompt}
              error={error}
              onPromptChange={setPrompt}
              onGenerate={handleGenerate}
            />
          </motion.div>
        )}

        {step === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <LoadingStep onDismiss={handleDismissLoading} />
          </motion.div>
        )}

        {step === "preview" && draft && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <DraftPreview
              draft={draft}
              isSaving={createCompanion.isPending}
              error={error}
              onChange={(nextDraft) => setDraft(nextDraft)}
              onConfirm={handleConfirm}
              onBack={() => setStep("prompt")}
            />
          </motion.div>
        )}

        {step === "saving" && (
          <motion.div
            key="saving"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <SavingStep />
          </motion.div>
        )}

        {step === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <DoneStep onRestart={() => setStep("prompt")} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
