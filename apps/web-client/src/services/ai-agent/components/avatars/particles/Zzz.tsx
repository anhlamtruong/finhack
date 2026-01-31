"use client";

import { motion } from "framer-motion";

/**
 * Text positions for the sleepy Zzz overlay.
 */
const positions = [
  { x: 68, y: 24, size: "text-xs", delay: 0 },
  { x: 74, y: 12, size: "text-sm", delay: 0.25 },
  { x: 80, y: 0, size: "text-base", delay: 0.45 },
];

/**
 * Animated Zzz overlay for sleepy state.
 */
export function Zzz() {
  return (
    <div className="absolute inset-0 z-30 pointer-events-none">
      {positions.map((p, i) => (
        <motion.div
          key={`${p.x}-${p.y}-${i}`}
          className={`absolute ${p.size} font-bold text-indigo-100 drop-shadow`}
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
          animate={{ y: [0, -6, -10], opacity: [0, 1, 0] }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: "easeOut",
            delay: p.delay,
          }}
        >
          z
        </motion.div>
      ))}
    </div>
  );
}
