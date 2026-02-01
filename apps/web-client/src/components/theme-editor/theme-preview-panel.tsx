"use client";

import { HorizontalScrollArea } from "@/components/horizontal-scroll-area";
import { ThemeToggle } from "./theme-toggle-v2";
import { TooltipWrapper } from "@/components/tooltip-wrapper";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
// import { useDialogActions } from "@/hooks/use-dialog-actions";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { useThemeInspector } from "@/hooks/inspector/use-theme-inspector";
import { cn } from "@/lib/utils";
import { ThemeEditorPreviewProps } from "@/types/theme";
import {
  Inspect,
  LayoutDashboard,
  Maximize,
  Minimize,
  MoreVertical,
} from "lucide-react";
import Link from "next/link";
import { useQueryState } from "nuqs";
import { lazy } from "react";
import InspectorOverlay from "./inspector-overlay";
import ColorPreview from "./theme-preview/color-preview";
import ExamplesPreviewContainer from "./theme-preview/examples-preview-container";
import TabsTriggerPill from "./theme-preview/tabs-trigger-pill";

const DemoCards = lazy(() => import("@/components/examples/cards"));
const DemoMail = lazy(() => import("@/components/examples/mail"));
const DemoDashboard = lazy(() => import("@/components/examples/dashboard"));
const DemoPricing = lazy(() => import("@/components/examples/pricing/pricing"));
const TypographyDemo = lazy(
  () => import("@/components/examples/typography/typography-demo")
);
const MusicDemo = lazy(() => import("@/components/examples/music/index"));

const ThemePreviewPanel = ({
  styles,
  currentMode,
}: ThemeEditorPreviewProps) => {
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const [activeTab, setActiveTab] = useQueryState("p", {
    defaultValue: "cards",
  });

  const {
    rootRef,
    inspector,
    inspectorEnabled,
    handleMouseMove,
    handleMouseLeave,
    toggleInspector,
  } = useThemeInspector();

  if (!styles || !styles[currentMode]) {
    return null;
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  return (
    <>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          isFullscreen && "bg-background fixed inset-0 z-50"
        )}
      >
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <HorizontalScrollArea className="mt-2 mb-1 flex w-full items-center justify-between px-4">
            <TabsList className="bg-background gap-4 text-muted-foreground inline-flex w-fit items-center justify-center rounded-full px-0">
              <TabsTriggerPill value="cards">Cards</TabsTriggerPill>

              <div className="hidden md:flex gap-4">
                <TabsTriggerPill value="dashboard">Dashboard</TabsTriggerPill>
                <TabsTriggerPill value="mail">Mail</TabsTriggerPill>
              </div>
              <TabsTriggerPill value="pricing">Pricing</TabsTriggerPill>
              <TabsTriggerPill value="music">Music</TabsTriggerPill>
              <TabsTriggerPill value="colors">Color Palette</TabsTriggerPill>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <TooltipWrapper label="More previews" asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical />
                    </Button>
                  </TooltipWrapper>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => handleTabChange("typography")}
                  >
                    Typography
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TabsList>

            <div className="flex items-center gap-0.5">
              {isFullscreen && (
                <ThemeToggle
                  variant="ghost"
                  size="icon"
                  className="group size-8 hover:[&>svg]:scale-120 hover:[&>svg]:transition-all"
                />
              )}

              <TooltipWrapper label="Back to FinHack Dashboard" asChild>
                <Link href="/dashboard">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="group h-8 px-2 md:px-3 text-muted-foreground hover:text-foreground"
                  >
                    <LayoutDashboard className="size-4 transition-all group-hover:scale-110 md:mr-2" />
                    <span className="hidden md:inline font-medium">
                      Dashboard
                    </span>
                  </Button>
                </Link>
              </TooltipWrapper>

              <TooltipWrapper label="Toggle Inspector" asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleInspector}
                  className={cn(
                    "group size-8",
                    inspectorEnabled &&
                      "bg-accent text-accent-foreground w-auto"
                  )}
                >
                  <Inspect className="transition-all group-hover:scale-120" />
                  {inspectorEnabled && (
                    <span className="text-xs tracking-wide uppercase">on</span>
                  )}
                </Button>
              </TooltipWrapper>
              <TooltipWrapper
                label={isFullscreen ? "Exit full screen" : "Full screen"}
                className="hidden md:inline-flex"
                asChild
              >
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleFullscreen}
                  className="group size-8"
                >
                  {isFullscreen ? (
                    <Minimize className="transition-all group-hover:scale-120" />
                  ) : (
                    <Maximize className="transition-all group-hover:scale-120" />
                  )}
                </Button>
              </TooltipWrapper>
            </div>
          </HorizontalScrollArea>

          <section className="relative size-full overflow-hidden p-4 pt-1">
            <div
              className="relative isolate size-full overflow-hidden rounded-lg border"
              ref={rootRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <TabsContent value="cards" className="m-0 size-full">
                <ExamplesPreviewContainer className="size-full">
                  <ScrollArea className="size-full">
                    <DemoCards />
                  </ScrollArea>
                </ExamplesPreviewContainer>
              </TabsContent>

              <TabsContent value="music" className="@container m-0 size-full">
                <ExamplesPreviewContainer className="size-full">
                  <MusicDemo />
                </ExamplesPreviewContainer>
              </TabsContent>

              <TabsContent
                value="dashboard"
                className="@container m-0 size-full"
              >
                <ExamplesPreviewContainer className="size-full">
                  <ScrollArea className="size-full">
                    <div className="size-full min-w-350">
                      <DemoDashboard />
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </ExamplesPreviewContainer>
              </TabsContent>

              <TabsContent
                value="pricing"
                className="@container mt-0 h-full space-y-6"
              >
                <ExamplesPreviewContainer className="size-full">
                  <div className="absolute top-4 right-4 z-10">
                    <Link
                      href="https://shadcnblocks.com?utm_source=tweakcn&utm_medium=theme-editor-preview"
                      target="_blank"
                    >
                      <Button
                        variant="outline"
                        className="group h-12 shadow-sm"
                      >
                        <div className="flex items-center gap-2">
                          <div className="text-left">
                            <div className="font-bold">Shadcnblocks.com</div>
                            <div className="text-muted-foreground group-hover:text-accent-foreground text-xs transition-colors">
                              600+ extra shadcn blocks
                            </div>
                          </div>
                        </div>
                      </Button>
                    </Link>
                  </div>
                  <ScrollArea className="size-full">
                    <DemoPricing />
                  </ScrollArea>
                </ExamplesPreviewContainer>
              </TabsContent>

              <TabsContent value="mail" className="@container m-0 size-full">
                <ExamplesPreviewContainer className="size-full">
                  <ScrollArea className="size-full">
                    <div className="size-full min-w-325">
                      <DemoMail />
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </ExamplesPreviewContainer>
              </TabsContent>

              <TabsContent value="typography" className="m-0 size-full">
                <ExamplesPreviewContainer className="size-full">
                  <ScrollArea className="size-full">
                    <TypographyDemo />
                  </ScrollArea>
                </ExamplesPreviewContainer>
              </TabsContent>

              <TabsContent value="colors" className="m-0 size-full">
                <ScrollArea className="size-full">
                  <div className="p-4">
                    <ColorPreview styles={styles} currentMode={currentMode} />
                  </div>
                </ScrollArea>
              </TabsContent>
            </div>
          </section>
        </Tabs>
      </div>

      <InspectorOverlay
        inspector={inspector}
        enabled={inspectorEnabled}
        rootRef={rootRef}
      />
    </>
  );
};

export default ThemePreviewPanel;
