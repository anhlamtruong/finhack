import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Basic card wrapper for companion pages.
 */
type CompanionLayoutCardProps = {
  title?: string;
  description?: string;
  className?: string;
  children: ReactNode;
};

/**
 * Layout card with optional title + description.
 */
export function CompanionLayoutCard({
  title,
  description,
  className,
  children,
}: CompanionLayoutCardProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden p-6 md:p-8 space-y-4 pb-10 -mt-16 border-border/70 bg-card/90 shadow-xl",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/10 via-transparent to-secondary/10" />
      {(title || description) && (
        <div className="relative space-y-1">
          {title ? <h1 className="text-2xl font-semibold">{title}</h1> : null}
          {description ? (
            <p className="text-muted-foreground">{description}</p>
          ) : null}
        </div>
      )}
      <div className="relative">{children}</div>
    </Card>
  );
}
