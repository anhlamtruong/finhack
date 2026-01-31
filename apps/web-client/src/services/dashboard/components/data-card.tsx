import { ElementType } from "react";
import { VariantProps, cva } from "class-variance-authority";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn, formatPercentage } from "@/lib/utils";
import CountingOdometer from "@/components/counting-odometer";
import { Skeleton } from "@/components/ui/skeleton";

const boxVariant = cva("rounded-md p-3 shrink-0 transition-colors", {
  variants: {
    variant: {
      default: "bg-primary/10",
      destructive: "bg-destructive/10",
      success: "bg-chart-2/10",
      warning: "bg-chart-4/10",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

const iconVariant = cva("size-6", {
  variants: {
    variant: {
      default: "fill-primary text-primary",
      destructive: "fill-destructive text-destructive",
      success: "fill-chart-2 text-chart-2",
      warning: "fill-chart-4 text-chart-4",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

type BoxVariants = VariantProps<typeof boxVariant>;
type IconVariants = VariantProps<typeof iconVariant>;

interface Props extends BoxVariants, IconVariants {
  title: string;
  value?: number;
  percentageChange?: number;
  icon: ElementType;
  dateRange: string;
  onClick?: () => void;
}

export const DataCard = ({
  title,
  value = 0,
  percentageChange = 0,
  icon: Icon,
  variant,
  dateRange,
  onClick,
}: Props) => {
  return (
    <Card
      className={cn(
        "border bg-card text-card-foreground shadow-xs transition-all",
        onClick ? "cursor-pointer hover:shadow-md" : "hover:shadow-md",
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-x-4 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-xl font-semibold tracking-tight line-clamp-1">
            {title}
          </CardTitle>
          <CardDescription className="text-sm font-medium line-clamp-1">
            {dateRange}
          </CardDescription>
        </div>
        <div className={cn(boxVariant({ variant }))}>
          <Icon className={cn(iconVariant({ variant }))} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-1">
          <CountingOdometer
            value={value}
            decimals={2}
            decimal="."
            prefix="$"
            duration={2000}
            digitHeight={2.25}
            digitClassName="text-3xl font-bold tracking-tight"
          />
        </div>

        <p
          className={cn(
            "text-sm font-medium line-clamp-1 flex items-center gap-1",

            percentageChange > 0
              ? "text-chart-2"
              : percentageChange < 0
                ? "text-destructive"
                : "text-muted-foreground",
          )}
        >
          {formatPercentage(percentageChange || 0, { addPrefix: true })}
          <span className="text-muted-foreground ml-1 font-normal">
            from last period
          </span>
        </p>
      </CardContent>
    </Card>
  );
};

export const DataCardLoading = () => {
  return (
    <Card className="border shadow-xs h-41">
      <CardHeader className="flex flex-row items-center justify-between gap-x-4 pb-2">
        <div className="space-y-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="size-12 rounded-md" />
      </CardHeader>
      <CardContent className="mt-2">
        <Skeleton className="h-10 w-32 mb-4" />
        <Skeleton className="h-4 w-40" />
      </CardContent>
    </Card>
  );
};
