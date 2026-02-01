"use client";

import { memo } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExternalLink,
  Star,
  ThumbsDown,
  Bookmark,
  Truck,
  Tag,
  CheckCircle2,
  AlertCircle,
  Zap,
  Package,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Deal } from "@/services/sales/types";

interface DealCardProps {
  deal: Deal;
  isDismissed?: boolean;
  monthlyRemaining?: number;
  onDismiss?: (deal: Deal) => void;
  onSave?: (deal: Deal) => void;
  onClick?: (deal: Deal) => void;
}

export const DealCard = memo(function DealCard({
  deal,
  isDismissed = false,
  monthlyRemaining,
  onDismiss,
  onSave,
  onClick,
}: DealCardProps) {
  const handleCardClick = () => {
    onClick?.(deal);
    window.open(deal.url, "_blank", "noopener,noreferrer");
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDismiss?.(deal);
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSave?.(deal);
  };

  // Compute affordability if not provided by backend
  const isAffordable =
    deal.isAffordable ??
    (monthlyRemaining !== undefined &&
    deal.price !== null &&
    deal.price !== undefined
      ? deal.price <= monthlyRemaining
      : undefined);

  // Compute savings if not provided
  const savingsAmount =
    deal.savingsAmount ??
    (deal.originalPrice && deal.price
      ? Math.round((deal.originalPrice - deal.price) * 100) / 100
      : null);

  const savingsPercent =
    deal.savingsPercent ??
    (deal.originalPrice && deal.price && deal.originalPrice > 0
      ? Math.round(
          ((deal.originalPrice - deal.price) / deal.originalPrice) * 100,
        )
      : null);

  const freeShipping =
    deal.freeShipping ??
    (deal.delivery?.toLowerCase().includes("free") ||
      deal.delivery?.includes("$0"));

  const primeEligible =
    deal.primeEligible ??
    (deal.delivery?.toLowerCase().includes("prime") ||
      deal.tag?.toLowerCase().includes("prime"));

  return (
    <AnimatePresence mode="popLayout">
      {!isDismissed && (
        <motion.div
          layout
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
          transition={{ duration: 0.3 }}
        >
          <Card
            className={cn(
              "group relative overflow-hidden cursor-pointer transition-all duration-300",
              "hover:shadow-lg hover:scale-[1.02] hover:border-primary/30",
              "h-full flex flex-col",
              isAffordable === false && "opacity-75",
            )}
            onClick={handleCardClick}
          >
            {/* Image Section - 3:2 aspect ratio for density */}
            <div className="relative aspect-3/2 w-full overflow-hidden bg-muted">
              {deal.image ? (
                <Image
                  src={deal.image}
                  alt={deal.title}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-pink-100 to-purple-100">
                  <Tag className="h-12 w-12 text-muted-foreground/50" />
                </div>
              )}

              {/* Top Left Badges Stack */}
              <div className="absolute left-2 top-2 flex flex-col gap-1">
                {/* Savings Percent Badge */}
                {savingsPercent && savingsPercent > 0 && (
                  <Badge className="bg-linear-to-r from-emerald-500 to-teal-500 text-white border-0 text-xs font-bold">
                    -{savingsPercent}%
                  </Badge>
                )}
                {/* Affordability Badge */}
                {isAffordable !== undefined && (
                  <Badge
                    className={cn(
                      "border-0 text-xs",
                      isAffordable
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
                    )}
                  >
                    {isAffordable ? (
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                    ) : (
                      <AlertCircle className="h-3 w-3 mr-1" />
                    )}
                    {isAffordable ? "Within budget" : "Over budget"}
                  </Badge>
                )}
              </div>

              {/* Top Right Badges */}
              <div className="absolute right-2 top-2 flex flex-col gap-1 items-end">
                {primeEligible && (
                  <Badge className="bg-blue-600 text-white border-0 text-xs">
                    <Zap className="h-3 w-3 mr-1" />
                    Prime
                  </Badge>
                )}
                {freeShipping && !primeEligible && (
                  <Badge className="bg-purple-500/90 text-white border-0 text-xs">
                    <Package className="h-3 w-3 mr-1" />
                    Free Ship
                  </Badge>
                )}
                {deal.tag && !primeEligible && (
                  <Badge className="bg-purple-500/90 text-white border-0 text-xs">
                    {deal.tag}
                  </Badge>
                )}
              </div>

              {/* Action Buttons Overlay */}
              <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 bg-white/90 backdrop-blur-sm hover:bg-white"
                  onClick={handleSave}
                >
                  <Bookmark className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 bg-white/90 backdrop-blur-sm hover:bg-rose-100"
                  onClick={handleDismiss}
                >
                  <ThumbsDown className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <CardHeader className="pb-1 pt-2 px-3">
              {/* Brand + Rating Row */}
              <div className="flex items-center justify-between">
                {deal.brand && (
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
                    {deal.brand}
                  </p>
                )}
                {deal.rating !== null && deal.rating !== undefined && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs font-medium">{deal.rating}</span>
                    {deal.reviews !== null && deal.reviews !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        (
                        {deal.reviews >= 1000
                          ? `${(deal.reviews / 1000).toFixed(1)}k`
                          : deal.reviews}
                        )
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Title */}
              <h3 className="font-semibold text-sm line-clamp-2 leading-tight mt-1">
                {deal.title}
              </h3>
            </CardHeader>

            <CardContent className="flex-1 px-3 pb-1 pt-0">
              {/* Value Score Bar */}
              {deal.valueScore !== null && deal.valueScore !== undefined && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-muted-foreground">Value</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-linear-to-r from-pink-500 to-purple-500 rounded-full"
                      style={{ width: `${deal.valueScore * 10}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium">
                    {deal.valueScore}/10
                  </span>
                </div>
              )}

              {/* Reason/AI recommendation */}
              {deal.reason && (
                <p className="text-xs text-muted-foreground line-clamp-2 italic">
                  ✨ {deal.reason}
                </p>
              )}
            </CardContent>

            <CardFooter className="flex flex-col items-start gap-1 px-3 pb-2 pt-0">
              {/* Pricing Row */}
              <div className="flex items-center justify-between w-full">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-primary">
                    {deal.priceText ||
                      (deal.price && `$${deal.price.toFixed(2)}`)}
                  </span>
                  {deal.originalPriceText && (
                    <span className="text-xs text-muted-foreground line-through">
                      {deal.originalPriceText}
                    </span>
                  )}
                </div>
                {/* Savings Amount */}
                {savingsAmount && savingsAmount > 0 && (
                  <Badge
                    variant="outline"
                    className="text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700 text-xs"
                  >
                    Save ${savingsAmount.toFixed(0)}
                  </Badge>
                )}
              </div>

              {/* Compact Meta Row */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground w-full">
                {deal.delivery && (
                  <div className="flex items-center gap-1 truncate">
                    <Truck className="h-3 w-3 shrink-0" />
                    <span className="truncate">{deal.delivery}</span>
                  </div>
                )}
                {deal.source && (
                  <div className="flex items-center gap-1 truncate">
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span className="truncate">{deal.source}</span>
                  </div>
                )}
              </div>
            </CardFooter>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
