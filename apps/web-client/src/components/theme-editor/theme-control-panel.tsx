"use client";

import { AlertCircle } from "lucide-react";
import React from "react";

import ColorPicker from "@/components/theme-editor/color-picker";
import ControlSection from "@/components/theme-editor/control-section";
import { FontPicker } from "@/components/theme-editor/font-picker";
import HslAdjustmentControls from "@/components/theme-editor/hsl-adjustment-controls";
import ShadowControl from "@/components/theme-editor/shadow-control";
import { SliderWithInput } from "@/components/theme-editor/slider-with-input";
import ThemePresetSelect from "@/components/theme-editor/theme-preset-select";
import TabsTriggerPill from "@/components/theme-editor/theme-preview/tabs-trigger-pill";
import { HorizontalScrollArea } from "@/components/horizontal-scroll-area";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
import { COMMON_STYLES, defaultThemeState } from "@/config/theme";
import {
  useControlsTabFromUrl,
  type ControlTab,
} from "@/hooks/use-controls-tab-from-url";
import { useEditorStore } from "@/store/editor-store";
import { type FontInfo } from "@/types/fonts";
import { ThemeStyles, ThemeStyleProps } from "@/types/theme";
import { buildFontFamily } from "@/lib/fonts";
import { getAppliedThemeFont } from "@/lib/theme-fonts";

interface ThemeControlPanelProps {
  styles: ThemeStyles;
  currentMode: "light" | "dark";
  onChange: (styles: ThemeStyles) => void;
}

const ThemeControlPanel = ({
  styles,
  currentMode,
  onChange,
}: ThemeControlPanelProps) => {
  const { themeState } = useEditorStore();
  const { tab, handleSetTab } = useControlsTabFromUrl();

  // Merge current styles with defaults to ensure all keys exist
  const currentStyles = React.useMemo(
    () => ({
      ...defaultThemeState.styles[currentMode],
      ...styles?.[currentMode],
    }),
    [currentMode, styles]
  );

  const updateStyle = React.useCallback(
    <K extends keyof typeof currentStyles>(
      key: K,
      value: (typeof currentStyles)[K]
    ) => {
      // apply common styles (like radius) to both light and dark modes
      if (COMMON_STYLES.includes(key as string)) {
        onChange({
          ...styles,
          light: { ...styles.light, [key]: value },
          dark: { ...styles.dark, [key]: value },
        });
        return;
      }

      // apply specific styles (like colors) only to the current mode
      onChange({
        ...styles,
        [currentMode]: {
          ...styles[currentMode],
          [key]: value,
        },
      });
    },
    [onChange, styles, currentMode]
  );

  // Parse radius for the slider
  const radius = parseFloat(currentStyles.radius?.replace("rem", "") || "0.5");

  return (
    <>
      <div className="border-b">
        <ThemePresetSelect className="h-14 rounded-none" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col space-y-4">
        <Tabs
          value={tab || "colors"}
          onValueChange={(v) => handleSetTab(v as ControlTab)}
          className="flex min-h-0 w-full flex-1 flex-col"
        >
          <HorizontalScrollArea className="mt-2 mb-1 px-4">
            <TabsList className="bg-background text-muted-foreground inline-flex w-fit items-center justify-center rounded-full px-0">
              <TabsTriggerPill value="colors">Colors</TabsTriggerPill>
              <TabsTriggerPill value="typography">Typography</TabsTriggerPill>
              <TabsTriggerPill value="other">Other</TabsTriggerPill>
            </TabsList>
          </HorizontalScrollArea>

          <TabsContent
            value="colors"
            className="mt-1 size-full overflow-hidden"
          >
            <ScrollArea className="h-full px-4">
              <ControlSection title="Primary Colors" expanded>
                <ColorPicker
                  name="primary"
                  color={currentStyles.primary}
                  onChange={(color) => updateStyle("primary", color)}
                  label="Primary"
                />
                <ColorPicker
                  name="primary-foreground"
                  color={currentStyles["primary-foreground"]}
                  onChange={(color) => updateStyle("primary-foreground", color)}
                  label="Primary Foreground"
                />
              </ControlSection>

              <ControlSection title="Secondary Colors" expanded>
                <ColorPicker
                  name="secondary"
                  color={currentStyles.secondary}
                  onChange={(color) => updateStyle("secondary", color)}
                  label="Secondary"
                />
                <ColorPicker
                  name="secondary-foreground"
                  color={currentStyles["secondary-foreground"]}
                  onChange={(color) =>
                    updateStyle("secondary-foreground", color)
                  }
                  label="Secondary Foreground"
                />
              </ControlSection>

              <ControlSection title="Accent Colors">
                <ColorPicker
                  name="accent"
                  color={currentStyles.accent}
                  onChange={(color) => updateStyle("accent", color)}
                  label="Accent"
                />
                <ColorPicker
                  name="accent-foreground"
                  color={currentStyles["accent-foreground"]}
                  onChange={(color) => updateStyle("accent-foreground", color)}
                  label="Accent Foreground"
                />
              </ControlSection>

              <ControlSection title="Base Colors">
                <ColorPicker
                  name="background"
                  color={currentStyles.background}
                  onChange={(color) => updateStyle("background", color)}
                  label="Background"
                />
                <ColorPicker
                  name="foreground"
                  color={currentStyles.foreground}
                  onChange={(color) => updateStyle("foreground", color)}
                  label="Foreground"
                />
              </ControlSection>

              <ControlSection title="Card Colors">
                <ColorPicker
                  name="card"
                  color={currentStyles.card}
                  onChange={(color) => updateStyle("card", color)}
                  label="Card Background"
                />
                <ColorPicker
                  name="card-foreground"
                  color={currentStyles["card-foreground"]}
                  onChange={(color) => updateStyle("card-foreground", color)}
                  label="Card Foreground"
                />
              </ControlSection>

              <ControlSection title="Popover Colors">
                <ColorPicker
                  name="popover"
                  color={currentStyles.popover}
                  onChange={(color) => updateStyle("popover", color)}
                  label="Popover Background"
                />
                <ColorPicker
                  name="popover-foreground"
                  color={currentStyles["popover-foreground"]}
                  onChange={(color) => updateStyle("popover-foreground", color)}
                  label="Popover Foreground"
                />
              </ControlSection>

              <ControlSection title="Muted Colors">
                <ColorPicker
                  name="muted"
                  color={currentStyles.muted}
                  onChange={(color) => updateStyle("muted", color)}
                  label="Muted"
                />
                <ColorPicker
                  name="muted-foreground"
                  color={currentStyles["muted-foreground"]}
                  onChange={(color) => updateStyle("muted-foreground", color)}
                  label="Muted Foreground"
                />
              </ControlSection>

              <ControlSection title="Destructive Colors">
                <ColorPicker
                  name="destructive"
                  color={currentStyles.destructive}
                  onChange={(color) => updateStyle("destructive", color)}
                  label="Destructive"
                />
                <ColorPicker
                  name="destructive-foreground"
                  color={currentStyles["destructive-foreground"]}
                  onChange={(color) =>
                    updateStyle("destructive-foreground", color)
                  }
                  label="Destructive Foreground"
                />
              </ControlSection>

              <ControlSection title="Border & Input Colors">
                <ColorPicker
                  name="border"
                  color={currentStyles.border}
                  onChange={(color) => updateStyle("border", color)}
                  label="Border"
                />
                <ColorPicker
                  name="input"
                  color={currentStyles.input}
                  onChange={(color) => updateStyle("input", color)}
                  label="Input"
                />
                <ColorPicker
                  name="ring"
                  color={currentStyles.ring}
                  onChange={(color) => updateStyle("ring", color)}
                  label="Ring"
                />
              </ControlSection>
            </ScrollArea>
          </TabsContent>

          <TabsContent
            value="typography"
            className="mt-1 size-full overflow-hidden"
          >
            <ScrollArea className="h-full px-4">
              <div className="bg-muted/50 mb-4 flex items-start gap-2.5 rounded-md border p-3">
                <AlertCircle className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
                <div className="text-muted-foreground text-sm">
                  <p>
                    To use custom fonts, embed them in your project. <br />
                    See{" "}
                    <a
                      href="https://tailwindcss.com/docs/font-family"
                      target="_blank"
                      className="hover:text-muted-foreground/90 underline underline-offset-2"
                      rel="noreferrer"
                    >
                      Tailwind docs
                    </a>{" "}
                    for details.
                  </p>
                </div>
              </div>

              <ControlSection title="Font Family" expanded className="p-3">
                <div className="mb-4">
                  <Label htmlFor="font-sans" className="mb-1.5 block text-xs">
                    Sans-Serif Font
                  </Label>
                  <FontPicker
                    value={
                      getAppliedThemeFont(themeState, "font-sans") || undefined
                    }
                    category="sans-serif"
                    placeholder="Choose a sans-serif font..."
                    onSelect={(font: FontInfo) => {
                      const fontFamily = buildFontFamily(
                        font.family,
                        font.category
                      );
                      updateStyle("font-sans", fontFamily);
                    }}
                  />
                </div>
                <div className="mb-4">
                  <Label htmlFor="font-serif" className="mb-1.5 block text-xs">
                    Serif Font
                  </Label>
                  <FontPicker
                    value={
                      getAppliedThemeFont(themeState, "font-serif") || undefined
                    }
                    category="serif"
                    placeholder="Choose a serif font..."
                    onSelect={(font: FontInfo) => {
                      const fontFamily = buildFontFamily(
                        font.family,
                        font.category
                      );
                      updateStyle("font-serif", fontFamily);
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="font-mono" className="mb-1.5 block text-xs">
                    Monospace Font
                  </Label>
                  <FontPicker
                    value={
                      getAppliedThemeFont(themeState, "font-mono") || undefined
                    }
                    category="monospace"
                    placeholder="Choose a monospace font..."
                    onSelect={(font: FontInfo) => {
                      const fontFamily = buildFontFamily(
                        font.family,
                        font.category
                      );
                      updateStyle("font-mono", fontFamily);
                    }}
                  />
                </div>
              </ControlSection>
              <ControlSection title="Letter Spacing" expanded>
                <SliderWithInput
                  value={parseFloat(
                    currentStyles["letter-spacing"]?.replace("em", "")
                  )}
                  onChange={(value) =>
                    updateStyle("letter-spacing", `${value}em`)
                  }
                  min={-0.5}
                  max={0.5}
                  step={0.025}
                  unit="em"
                  label="Letter Spacing"
                />
              </ControlSection>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="other" className="mt-1 size-full overflow-hidden">
            <ScrollArea className="h-full px-4">
              <ControlSection title="HSL Adjustments" expanded>
                <HslAdjustmentControls />
              </ControlSection>

              <ControlSection title="Radius" expanded>
                <SliderWithInput
                  value={radius}
                  onChange={(value) => updateStyle("radius", `${value}rem`)}
                  min={0}
                  max={2}
                  step={0.1}
                  unit="rem"
                  label="Radius"
                />
              </ControlSection>

              <ControlSection title="Shadow">
                <ShadowControl
                  shadowColor={currentStyles["shadow-color"] || "0deg 0% 0%"}
                  shadowOpacity={parseFloat(
                    currentStyles["shadow-opacity"] || "0"
                  )}
                  shadowBlur={parseFloat(
                    currentStyles["shadow-blur"]?.replace("px", "") || "0"
                  )}
                  shadowSpread={parseFloat(
                    currentStyles["shadow-spread"]?.replace("px", "") || "0"
                  )}
                  shadowOffsetX={parseFloat(
                    currentStyles["shadow-offset-x"]?.replace("px", "") || "0"
                  )}
                  shadowOffsetY={parseFloat(
                    currentStyles["shadow-offset-y"]?.replace("px", "") || "0"
                  )}
                  onChange={(key, value) => {
                    if (key === "shadow-color") {
                      updateStyle(key, value as string);
                    } else if (key === "shadow-opacity") {
                      updateStyle(key, value.toString());
                    } else {
                      updateStyle(key as keyof ThemeStyleProps, `${value}px`);
                    }
                  }}
                />
              </ControlSection>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default ThemeControlPanel;
