"use client";

import { motion } from "framer-motion";

/**
 * Sparkle points for the happy mood overlay.
 */
const sparks = [
  { x: 18, y: 22, delay: 0 },
  { x: 76, y: 30, delay: 0.2 },
  { x: 40, y: 70, delay: 0.4 },
  { x: 68, y: 78, delay: 0.6 },
];

/**
 * Animated sparkles overlay for happy mood.
 */
export function Sparkles() {
  return (
    <div className="absolute inset-0 z-20">
      {sparks.map((s, i) => (
        <motion.div
          key={`${s.x}-${s.y}-${i}`}
          className="absolute h-2 w-2 rounded-full bg-amber-200 shadow-[0_0_8px_rgba(255,255,255,0.7)]"
          style={{ left: `${s.x}%`, top: `${s.y}%` }}
          animate={{ scale: [0.6, 1.4, 0.6], opacity: [0, 1, 0] }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: s.delay,
          }}
        />
      ))}
    </div>
  );
}
