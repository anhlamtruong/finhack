"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { AirplaneIcon } from "@/components/ui/animated-icon/airplane";
import { AtomIcon } from "@/components/ui/animated-icon/atom";
import { AudioLinesIcon } from "@/components/ui/animated-icon/audio-lines";
import { BananaIcon } from "@/components/ui/animated-icon/banana";
import { BatteryChargingIcon } from "@/components/ui/animated-icon/battery-charging";
import { BlocksIcon } from "@/components/ui/animated-icon/blocks";
import { CartIcon } from "@/components/ui/animated-icon/cart";
import { ChartSplineIcon } from "@/components/ui/animated-icon/chart-spline";
import { CloudRainWindIcon } from "@/components/ui/animated-icon/cloud-rain-wind";
import { CloudSunIcon } from "@/components/ui/animated-icon/cloud-sun";
import { CoffeeIcon } from "@/components/ui/animated-icon/coffee";
import { CookingPotIcon } from "@/components/ui/animated-icon/cooking-pot";
import { FlaskIcon } from "@/components/ui/animated-icon/flask";
import { PartyPopperIcon } from "@/components/ui/animated-icon/party-popper";
import { RockingChairIcon } from "@/components/ui/animated-icon/rocking-chair";
import { ShipIcon } from "@/components/ui/animated-icon/ship";
import { SparklesIcon } from "@/components/ui/animated-icon/sparkles";
import { TelescopeIcon } from "@/components/ui/animated-icon/telescope";
import { TornadoIcon } from "@/components/ui/animated-icon/tornado";
import { TruckIcon } from "@/components/ui/animated-icon/truck";
import { WashingMachineIcon } from "@/components/ui/animated-icon/washing-machine";
import { WrenchIcon } from "@/components/ui/animated-icon/wrench";

/**
 * Rotation list for loading copy + icon pairs.
 */
const ICON_ITEMS = [
  { icon: AirplaneIcon, text: "Plotting a skybound sprite path..." },
  { icon: AtomIcon, text: "Stabilizing pixel particles..." },
  { icon: AudioLinesIcon, text: "Tuning the companion rhythm..." },
  { icon: BananaIcon, text: "Fueling the baby form with charm..." },
  { icon: BatteryChargingIcon, text: "Charging the adventure core..." },
  { icon: BlocksIcon, text: "Stacking pixel tiles into place..." },
  { icon: CartIcon, text: "Packing your financial toolkit..." },
  { icon: ChartSplineIcon, text: "Sculpting the growth curve..." },
  { icon: CloudRainWindIcon, text: "Painting a stormy mood layer..." },
  { icon: CloudSunIcon, text: "Warming the color palette..." },
  { icon: CoffeeIcon, text: "Brewing a cozy idle loop..." },
  { icon: CookingPotIcon, text: "Simmering the sprite recipe..." },
  { icon: FlaskIcon, text: "Mixing a retro sparkle aura..." },
  { icon: PartyPopperIcon, text: "Priming the celebration sparkle..." },
  { icon: RockingChairIcon, text: "Rocking the sleepy animation..." },
  { icon: ShipIcon, text: "Launching the dream trip voyage..." },
  { icon: SparklesIcon, text: "Stitching pixel threads into magic..." },
  { icon: TelescopeIcon, text: "Focusing on your savings horizon..." },
  { icon: TornadoIcon, text: "Swirling up bold contrast..." },
  { icon: TruckIcon, text: "Delivering sprite frames..." },
  { icon: WashingMachineIcon, text: "Polishing the final loops..." },
  { icon: WrenchIcon, text: "Calibrating the companion rig..." },
];

/**
 * Shuffle array with Fisher–Yates.
 */
function shuffle<T>(items: T[]) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Props for the loading step panel.
 */
type LoadingStepProps = {
  onDismiss: () => void;
};

/**
 * Loading step shown while the draft is being generated.
 */
export function LoadingStep({ onDismiss }: LoadingStepProps) {
  const [index, setIndex] = useState(0);
  const items = useMemo(() => shuffle(ICON_ITEMS), []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((idx) => (idx + 1) % items.length);
    }, 4000);
    return () => window.clearInterval(id);
  }, [items.length]);

  const current = items[index] ?? items[0];
  const Icon = current?.icon ?? SparklesIcon;

  return (
    <Card className="p-10 flex flex-col items-center justify-center gap-4 border-border/60 bg-card/90 text-center">
      <div className="text-lg font-semibold">Materializing...</div>
      <p className="text-sm text-muted-foreground max-w-md">
        Summoning a Wizard takes some time, please be patient.
      </p>
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex items-center gap-3"
      >
        <motion.div
          animate={{ rotate: [0, 6, -6, 0], scale: [1, 1.05, 1] }}
          transition={{ duration: 2.2, repeat: Infinity }}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/5 text-primary"
        >
          <Icon className="h-6 w-6" size={24} />
        </motion.div>
        <p className="text-sm text-muted-foreground">{current?.text}</p>
      </motion.div>
      <Button variant="ghost" onClick={onDismiss}>
        Dismiss
      </Button>
    </Card>
  );
}
