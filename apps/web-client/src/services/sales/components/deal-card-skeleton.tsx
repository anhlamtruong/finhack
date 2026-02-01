import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";

export function DealCardSkeleton() {
  return (
    <Card className="overflow-hidden h-full flex flex-col">
      {/* Image Skeleton */}
      <Skeleton className="aspect-square w-full" />

      <CardHeader className="pb-2 pt-3 px-3 space-y-2">
        {/* Brand */}
        <Skeleton className="h-3 w-16" />
        {/* Title */}
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </CardHeader>

      <CardContent className="flex-1 px-3 pb-2 space-y-2">
        {/* Rating */}
        <Skeleton className="h-3 w-20" />
        {/* Reason */}
        <Skeleton className="h-3 w-full" />
      </CardContent>

      <CardFooter className="flex flex-col items-start gap-1 px-3 pb-3 pt-0">
        {/* Price */}
        <div className="flex items-baseline gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>
        {/* Delivery */}
        <Skeleton className="h-3 w-24" />
      </CardFooter>
    </Card>
  );
}

export function DealCardSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <DealCardSkeleton key={i} />
      ))}
    </div>
  );
}
