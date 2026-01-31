"use client";

import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

/**
 * Saving step shown while assets and companion data are persisted.
 */
export function SavingStep() {
  return (
    <Card className="p-10 flex flex-col items-center justify-center gap-3 border-border/60 bg-card/90">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
      >
        <Loader2 className="h-7 w-7" />
      </motion.div>
      <div className="text-lg font-semibold">Awakening your companion...</div>
      <p className="text-sm text-muted-foreground">
        Uploading assets and sealing the bond.
      </p>
    </Card>
  );
}
