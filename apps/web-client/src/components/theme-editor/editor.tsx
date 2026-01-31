"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEditorStore } from "@/store/editor-store";
import { Sliders } from "lucide-react";
import React from "react";
import ThemePreviewPanel from "./theme-preview-panel";
import ThemeControlPanel from "./theme-control-panel";
import { cn } from "@/lib/utils";

export default function Editor({ className = "" }: { className?: string }) {
  const themeState = useEditorStore((state) => state.themeState);
  const setThemeState = useEditorStore((state) => state.setThemeState);
  const isMobile = useIsMobile();

  const styles = themeState.styles;

  const handleStyleChange = React.useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newStyles: any) => {
      const prev = useEditorStore.getState().themeState;
      setThemeState({ ...prev, styles: newStyles });
    },
    [setThemeState]
  );

  if (isMobile) {
    return (
      <div
        className={cn(
          "relative isolate flex flex-1 overflow-hidden",
          className
        )}
      >
        <div className="size-full flex-1 overflow-hidden">
          <Tabs defaultValue="controls" className="h-full">
            <TabsList className="w-full rounded-none">
              <TabsTrigger value="controls" className="flex-1">
                <Sliders className="mr-2 h-4 w-4" />
                Controls
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex-1">
                Preview
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value="controls"
              className="mt-0 h-[calc(100%-2.5rem)]"
            >
              <div className="flex h-full flex-col">
                <ThemeControlPanel
                  styles={styles}
                  onChange={handleStyleChange}
                  currentMode={themeState.currentMode}
                />
              </div>
            </TabsContent>
            <TabsContent value="preview" className="mt-0 h-[calc(100%-2.5rem)]">
              <div className="flex h-full flex-col">
                <ThemePreviewPanel
                  styles={styles}
                  currentMode={themeState.currentMode}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        className,
        "relative isolate flex flex-1 overflow-hidden h-screen"
      )}
    >
      <div className="size-full">
        <ResizablePanelGroup orientation="horizontal" className="isolate">
          <ResizablePanel
            defaultSize="30%"
            minSize="20%"
            maxSize="40%"
            className="z-1 min-w-[max(20%,22rem)] border-r"
          >
            <div className="relative isolate flex h-full flex-1 flex-col bg-background">
              <ThemeControlPanel
                styles={styles}
                onChange={handleStyleChange}
                currentMode={themeState.currentMode}
              />
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize="70%">
            <div className="flex h-full flex-col bg-muted/30">
              <div className="flex min-h-0 flex-1 flex-col">
                <ThemePreviewPanel
                  styles={styles}
                  currentMode={themeState.currentMode}
                />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
