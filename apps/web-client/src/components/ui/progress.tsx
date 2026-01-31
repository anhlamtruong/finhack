"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: number;
  indicatorClassName?: string;
};

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, indicatorClassName, ...props }, ref) => (
    <div
      ref={ref}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      {...props}
    >
      <div
        className={cn(
          "h-full w-full flex-1 rounded-full bg-primary transition-all",
          indicatorClassName,
        )}
        style={{ transform: `translateX(-${100 - value}%)` }}
      />
    </div>
  ),
);

Progress.displayName = "Progress";
