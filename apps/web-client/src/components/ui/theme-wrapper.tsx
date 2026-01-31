"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useConfig } from "@/hooks/use-config";

interface ThemeWrapperProps extends React.ComponentProps<"div"> {
  defaultTheme?: string;
}

export function ThemeWrapper({
  defaultTheme,
  children,
  className,
}: ThemeWrapperProps) {
  const [config] = useConfig();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      className={cn(
        `theme-${mounted ? config.theme : defaultTheme}`,
        "w-full",
        className
      )}
      style={
        {
          "--radius": `${mounted ? config.radius : 0.5}rem`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
