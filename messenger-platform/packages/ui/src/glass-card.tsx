import { motion, type HTMLMotionProps } from "framer-motion";
import type { PropsWithChildren, ReactNode } from "react";

import { cn } from "./lib";

type GlassAccent = "cyan" | "violet" | "emerald" | "slate";
type GlassPadding = "none" | "sm" | "md" | "lg";

const accentClassName: Record<GlassAccent, string> = {
  cyan: "from-cyan-200/18 via-sky-200/10 to-transparent",
  violet: "from-violet-200/18 via-fuchsia-200/10 to-transparent",
  emerald: "from-emerald-200/18 via-teal-200/10 to-transparent",
  slate: "from-white/16 via-white/8 to-transparent"
};

const paddingClassName: Record<GlassPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6"
};

export type GlassCardProps = PropsWithChildren<
  HTMLMotionProps<"div"> & {
    accent?: GlassAccent;
    padding?: GlassPadding;
    interactive?: boolean;
    chrome?: ReactNode;
  }
>;

export const GlassCard = ({
  accent = "slate",
  padding = "md",
  interactive = false,
  chrome,
  className,
  children,
  ...props
}: GlassCardProps) => (
  <motion.div
    className={cn(
      "group/liquid relative overflow-hidden rounded-[32px] border border-white/14 bg-white/[0.08] shadow-[0_10px_30px_rgba(8,12,24,0.18),0_24px_80px_rgba(3,10,24,0.34),inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-[28px]",
      interactive && "transition-colors duration-300 hover:border-white/22 hover:bg-white/[0.11]",
      paddingClassName[padding],
      className
    )}
    whileHover={interactive ? { y: -4, scale: 1.01 } : undefined}
    transition={{ type: "spring", stiffness: 220, damping: 24, mass: 0.9 }}
    {...props}
  >
    <div className="pointer-events-none absolute inset-0">
      <div
        className={cn(
          "absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.22),transparent_42%)] opacity-90",
          `bg-gradient-to-br ${accentClassName[accent]}`
        )}
      />
      <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(255,255,255,0.24),rgba(255,255,255,0.06)_55%,transparent)] opacity-70" />
      <div className="absolute -right-16 top-8 h-28 w-40 rotate-[18deg] rounded-full bg-white/12 blur-2xl transition duration-500 group-hover/liquid:bg-white/18" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
    </div>
    {chrome ? <div className="pointer-events-none absolute inset-0">{chrome}</div> : null}
    <div className="relative">{children}</div>
  </motion.div>
);

