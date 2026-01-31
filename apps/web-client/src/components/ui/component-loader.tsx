import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Loading } from "@/components/loading";

interface ComponentLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The visual style of the loader.
   * @default "spinner"
   */
  variant?: "spinner" | "dots" | "overlay";
  /**
   * Optional text to display below the loader
   */
  text?: string;
  /**
   * Controls the size of the spinner/icon.
   */
  size?: "sm" | "default" | "lg" | "xl";
}

export function ComponentLoader({
  variant = "spinner",
  text,
  className,
  size = "default",
  children,
  ...props
}: ComponentLoaderProps) {
  // 1. Overlay Variant (Great for forms/tables that are updating)
  if (variant === "overlay") {
    return (
      <div className={cn("relative isolate", className)} {...props}>
        {/* The content being loaded over */}
        <div className="opacity-50 pointer-events-none transition-opacity duration-300">
          {children}
        </div>

        {/* The Glassy Overlay */}
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/20 backdrop-blur-[2px] animate-in fade-in duration-300">
          <div className="bg-background/80 shadow-sm border rounded-full p-3 mb-2">
            <Loader2 className="animate-spin text-primary size-5" />
          </div>
          {text && (
            <p className="text-xs font-medium text-muted-foreground bg-background/80 px-2 py-1 rounded-md">
              {text}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Size mapping
  const sizeClasses = {
    sm: "size-4",
    default: "size-6",
    lg: "size-10",
    xl: "size-14",
  };

  // 2. Standard Variants (Spinner & Dots)
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center w-full min-h-37.5 gap-3 text-muted-foreground animate-in fade-in zoom-in-95 duration-300",
        className
      )}
      {...props}
    >
      {variant === "spinner" && (
        <Loader2
          className={cn("animate-spin text-primary", sizeClasses[size])}
        />
      )}

      {variant === "dots" && (
        <Loading className="min-h-0" /> // Re-using your existing dots
      )}

      {text && (
        <p
          className={cn("font-medium animate-pulse", {
            "text-xs": size === "sm",
            "text-sm": size === "default",
            "text-base": size === "lg",
          })}
        >
          {text}
        </p>
      )}
    </div>
  );
}
