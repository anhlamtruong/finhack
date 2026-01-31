"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Props for the completion step.
 */
type DoneStepProps = {
  onRestart: () => void;
};

/**
 * Final step shown after successful companion creation.
 */
export function DoneStep({ onRestart }: DoneStepProps) {
  return (
    <Card className="p-10 flex flex-col items-center justify-center gap-3 text-center border-border/60 bg-card/90">
      <div className="text-2xl font-semibold">Your companion is ready!</div>
      <p className="text-sm text-muted-foreground">
        You can now visit your dashboard to interact with them.
      </p>
      <Button onClick={onRestart}>Summon another</Button>
    </Card>
  );
}
