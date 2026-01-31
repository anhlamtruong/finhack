"use client";

// import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandInput,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/store/editor-store";
import { useThemePresetStore } from "@/store/theme-preset-store";
// import { ThemePreset } from "@/types/theme";
import { getPresetThemeStyles } from "@/lib/theme-preset-helper";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Shuffle,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ThemeToggle } from "./theme-toggle-v2"; // Ensure this path is correct
import { TooltipWrapper } from "@/components/tooltip-wrapper";
import { defaultThemeState } from "@/config/theme";
interface ThemePresetSelectProps extends React.ComponentProps<typeof Button> {
  withCycleThemes?: boolean;
}

interface ColorBoxProps {
  color: string;
}

const ColorBox: React.FC<ColorBoxProps> = ({ color }) => (
  <div
    className="border-muted h-3 w-3 rounded-sm border"
    style={{ backgroundColor: color }}
  />
);

interface ThemeColorsProps {
  presetName: string;
  mode: "light" | "dark";
}

const ThemeColors: React.FC<ThemeColorsProps> = ({ presetName, mode }) => {
  const styles = getPresetThemeStyles(presetName)[mode];
  return (
    <div className="flex gap-0.5">
      <ColorBox color={styles.primary} />
      <ColorBox color={styles.accent} />
      <ColorBox color={styles.secondary} />
      <ColorBox color={styles.border} />
    </div>
  );
};

const ThemeControls = () => {
  const applyThemePreset = useEditorStore((store) => store.applyThemePreset);
  const presets = useThemePresetStore((store) => store.getAllPresets());

  const presetNames = useMemo(
    () => ["default", ...Object.keys(presets)],
    [presets]
  );

  const randomize = useCallback(() => {
    const random = Math.floor(Math.random() * presetNames.length);
    applyThemePreset(presetNames[random]);
  }, [presetNames, applyThemePreset]);

  return (
    <div className="flex gap-1">
      <ThemeToggle variant="ghost" size="icon" className="size-6 p-1" />

      <TooltipWrapper label="Random theme" asChild>
        <Button
          variant="ghost"
          size="sm"
          className="size-6 p-1"
          onClick={randomize}
        >
          <Shuffle className="h-3.5 w-3.5" />
        </Button>
      </TooltipWrapper>
    </div>
  );
};

interface ThemeCycleButtonProps extends React.ComponentProps<typeof Button> {
  direction: "prev" | "next";
}

const ThemeCycleButton: React.FC<ThemeCycleButtonProps> = ({
  direction,
  onClick,
  className,
  ...props
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className={cn("aspect-square h-full shrink-0", className)}
        onClick={onClick}
        {...props}
      >
        {direction === "prev" ? (
          <ArrowLeft className="h-4 w-4" />
        ) : (
          <ArrowRight className="h-4 w-4" />
        )}
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      {direction === "prev" ? "Previous theme" : "Next theme"}
    </TooltipContent>
  </Tooltip>
);

interface ThemePresetCycleControlsProps
  extends React.ComponentProps<typeof Button> {
  filteredPresets: string[];
  currentPresetName: string;
  className?: string;
}

const ThemePresetCycleControls: React.FC<ThemePresetCycleControlsProps> = ({
  filteredPresets,
  currentPresetName,
  className,
  ...props
}) => {
  const applyThemePreset = useEditorStore((store) => store.applyThemePreset);

  const currentIndex =
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    useMemo(
      () => filteredPresets.indexOf(currentPresetName || "default"),
      [filteredPresets, currentPresetName]
    ) ?? 0;

  const cycleTheme = useCallback(
    (direction: "prev" | "next") => {
      const newIndex =
        direction === "next"
          ? (currentIndex + 1) % filteredPresets.length
          : (currentIndex - 1 + filteredPresets.length) %
            filteredPresets.length;
      applyThemePreset(filteredPresets[newIndex]);
    },
    [currentIndex, filteredPresets, applyThemePreset]
  );
  return (
    <>
      <Separator orientation="vertical" className="min-h-8" />

      <ThemeCycleButton
        direction="prev"
        size="icon"
        className={cn("aspect-square min-h-8 w-auto", className)}
        onClick={() => cycleTheme("prev")}
        {...props}
      />

      <Separator orientation="vertical" className="min-h-8" />

      <ThemeCycleButton
        direction="next"
        size="icon"
        className={cn("aspect-square min-h-8 w-auto", className)}
        onClick={() => cycleTheme("next")}
        {...props}
      />
    </>
  );
};

const ThemePresetSelect: React.FC<ThemePresetSelectProps> = ({
  withCycleThemes = true,
  className,
  ...props
}) => {
  const [mounted, setMounted] = useState(false);

  const storedThemeState = useEditorStore((store) => store.themeState);
  const applyThemePreset = useEditorStore((store) => store.applyThemePreset);

  const themeState = mounted ? storedThemeState : defaultThemeState;

  const currentPreset = themeState.preset;
  const mode = themeState.currentMode;

  const presets = useThemePresetStore((store) => store.getAllPresets());
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const presetNames = useMemo(
    () => ["default", ...Object.keys(presets)],
    [presets]
  );
  const currentPresetName = presetNames?.find((name) => name === currentPreset);

  const filteredPresets = useMemo(() => {
    return search.trim() === ""
      ? presetNames
      : presetNames.filter((name) => {
          if (name === "default") {
            return "default".toLowerCase().includes(search.toLowerCase());
          }
          return presets[name]?.label
            ?.toLowerCase()
            .includes(search.toLowerCase());
        });
  }, [presetNames, search, presets]);

  return (
    <div className="flex w-full items-center">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "group relative w-full justify-between md:min-w-56",
              className
            )}
            {...props}
          >
            <div className="flex w-full items-center gap-3 overflow-hidden">
              <div className="flex gap-0.5">
                <ColorBox color={themeState.styles[mode].primary} />
                <ColorBox color={themeState.styles[mode].accent} />
                <ColorBox color={themeState.styles[mode].secondary} />
                <ColorBox color={themeState.styles[mode].border} />
              </div>

              <span className="truncate text-left font-medium capitalize">
                {presets[currentPresetName || "default"]?.label || "default"}
              </span>
            </div>
            <ChevronDown className="size-4 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-75 p-0" align="center">
          <Command className="h-100 w-full">
            <div className="flex w-full items-center border-b px-3">
              <CommandInput
                placeholder="Search themes..."
                value={search}
                onValueChange={setSearch}
                className="h-9 border-0 focus:ring-0"
              />
            </div>

            <div className="flex items-center justify-between px-3 py-2">
              <div className="text-muted-foreground text-sm">
                {filteredPresets.length} theme
                {filteredPresets.length !== 1 ? "s" : ""}
              </div>
              <ThemeControls />
            </div>

            <Separator />

            <ScrollArea className="h-125 max-h-[70vh]">
              <CommandList>
                <CommandEmpty>No themes found.</CommandEmpty>
                <CommandGroup heading="Presets">
                  {filteredPresets.map((presetName, index) => (
                    <CommandItem
                      key={`${presetName}-${index}`}
                      value={`${presetName}-${index}`}
                      onSelect={() => {
                        applyThemePreset(presetName);
                        setSearch("");
                        setOpen(false);
                      }}
                      className="data-highlighted:bg-secondary/50 flex items-center gap-2 py-2 cursor-pointer"
                    >
                      <ThemeColors presetName={presetName} mode={mode} />
                      <div className="flex flex-1 items-center gap-2">
                        <span className="text-sm font-medium capitalize">
                          {presets[presetName]?.label || presetName}
                        </span>
                      </div>
                      {presetName === currentPresetName && (
                        <Check className="h-4 w-4 shrink-0 opacity-70" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </ScrollArea>
          </Command>
        </PopoverContent>
      </Popover>

      {withCycleThemes && (
        <ThemePresetCycleControls
          filteredPresets={filteredPresets}
          currentPresetName={currentPresetName || "default"}
          className={className}
          disabled={props.disabled}
        />
      )}
    </div>
  );
};

export default ThemePresetSelect;
