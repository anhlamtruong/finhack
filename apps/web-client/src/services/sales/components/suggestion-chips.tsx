"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type ChipTheme = "women-empower" | "default";

interface SuggestionChipsProps {
  suggestions: string[];
  onSelect: (query: string) => void;
  isLoading?: boolean;
  theme?: ChipTheme;
  onThemeChange?: (theme: ChipTheme) => void;
}

const chipVariants = {
  hidden: { opacity: 0, scale: 0.8, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  }),
  exit: { opacity: 0, scale: 0.8, transition: { duration: 0.2 } },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

function SuggestionChipSkeleton() {
  const widths = [80, 100, 70, 90, 110, 85];
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {widths.map((width, i) => (
        <Skeleton
          key={i}
          className="h-8 rounded-full"
          style={{ width: `${width}px` }}
        />
      ))}
    </div>
  );
}

function ThemeToggle({
  theme,
  onThemeChange,
}: {
  theme: ChipTheme;
  onThemeChange: (theme: ChipTheme) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2 mb-3">
      <span className="text-xs text-muted-foreground">Style:</span>
      <div className="flex gap-1 p-1 bg-muted rounded-full">
        <Button
          size="sm"
          variant="ghost"
          className={cn(
            "h-6 px-3 rounded-full text-xs transition-all",
            theme === "default" && "bg-background shadow-sm text-foreground",
          )}
          onClick={() => onThemeChange("default")}
        >
          Classic
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={cn(
            "h-6 px-3 rounded-full text-xs transition-all gap-1",
            theme === "women-empower" &&
              "bg-linear-to-r from-pink-500 to-purple-500 text-white shadow-sm",
          )}
          onClick={() => onThemeChange("women-empower")}
        >
          <Heart className="h-3 w-3" />
          Empower
        </Button>
      </div>
    </div>
  );
}

export function SuggestionChips({
  suggestions,
  onSelect,
  isLoading = false,
  theme = "women-empower",
  onThemeChange,
}: SuggestionChipsProps) {
  const [internalTheme, setInternalTheme] = useState<ChipTheme>(theme);
  const activeTheme = onThemeChange ? theme : internalTheme;
  const handleThemeChange = onThemeChange ?? setInternalTheme;

  if (isLoading) {
    return (
      <div className="mt-6">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-pink-500 animate-pulse" />
          <span className="text-sm text-muted-foreground">
            Getting personalized suggestions...
          </span>
        </div>
        <SuggestionChipSkeleton />
      </div>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <ThemeToggle theme={activeTheme} onThemeChange={handleThemeChange} />

      <div className="flex items-center justify-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-pink-500" />
        <span className="text-sm text-muted-foreground">Try searching for</span>
      </div>

      <motion.div
        className="flex flex-wrap justify-center gap-2"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <AnimatePresence mode="popLayout">
          {suggestions.map((suggestion, index) => (
            <motion.div
              key={suggestion}
              custom={index}
              variants={chipVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              layout
            >
              <Badge
                variant="secondary"
                className={cn(
                  "cursor-pointer px-4 py-2 text-sm font-medium transition-all",
                  "hover:scale-105 active:scale-95",
                  activeTheme === "women-empower"
                    ? "bg-linear-to-r from-pink-500/10 to-purple-500/10 text-pink-700 dark:text-pink-300 hover:from-pink-500/20 hover:to-purple-500/20 border-pink-200/50 dark:border-pink-800/50"
                    : "hover:bg-secondary/80",
                )}
                onClick={() => onSelect(suggestion)}
              >
                {suggestion}
              </Badge>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export function SuggestionChipsWrapper({
  show,
  ...props
}: SuggestionChipsProps & { show: boolean }) {
  return (
    <AnimatePresence mode="wait">
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
        >
          <SuggestionChips {...props} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
