"use client";

import { motion } from "framer-motion";

const orbClassNames = [
  "left-[8%] top-[4%] h-56 w-56 bg-cyan-300/20",
  "right-[8%] top-[18%] h-72 w-72 bg-sky-300/14",
  "bottom-[8%] left-[22%] h-80 w-80 bg-violet-300/14"
] as const;

export const LiquidOrbs = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden">
    {orbClassNames.map((className, index) => (
      <motion.div
        key={className}
        className={`absolute rounded-full blur-3xl ${className}`}
        animate={{
          y: [0, 20 + index * 12, 0],
          x: [0, index % 2 === 0 ? 18 : -18, 0],
          scale: [1, 1.08, 1]
        }}
        transition={{
          duration: 8 + index * 1.8,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut"
        }}
      />
    ))}
  </div>
);

