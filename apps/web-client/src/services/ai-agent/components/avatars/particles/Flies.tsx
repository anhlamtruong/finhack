"use client";

import { motion } from "framer-motion";

/**
 * Particle points for the "dirty" flies effect.
 */
const points = [
  { x: 12, y: 18 },
  { x: 72, y: 6 },
  { x: 48, y: 68 },
  { x: 20, y: 82 },
  { x: 84, y: 52 },
];

/**
 * Animated flies overlay when the companion is dirty.
 */
export function Flies() {
  return (
    <div className="absolute inset-0 z-20">
      {points.map((p, i) => (
        <motion.div
          key={`${p.x}-${p.y}-${i}`}
          className="absolute h-2 w-2 rounded-full bg-slate-500/90"
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
          animate={{
            x: [0, i % 2 === 0 ? 6 : -6, 0],
            y: [0, i % 3 === 0 ? -8 : 8, 0],
            opacity: [0.7, 1, 0.6],
          }}
          transition={{
            duration: 2.4 + i * 0.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
