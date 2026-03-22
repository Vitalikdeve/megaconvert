import { motion, type HTMLMotionProps } from "framer-motion";
import type { PropsWithChildren, ReactNode } from "react";

import { cn } from "./lib";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const variantClassName: Record<ButtonVariant, string> = {
  primary:
    "border-white/30 bg-white text-slate-950 shadow-[0_12px_30px_rgba(255,255,255,0.18),inset_0_1px_0_rgba(255,255,255,0.8)] hover:bg-white/92",
  secondary:
    "border-white/16 bg-white/[0.1] text-white shadow-[0_12px_28px_rgba(8,12,24,0.22),inset_0_1px_0_rgba(255,255,255,0.16)] hover:bg-white/[0.16]",
  ghost: "border-white/10 bg-black/10 text-white/80 hover:border-white/18 hover:bg-white/[0.08]"
};

const sizeClassName: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-[15px]",
  icon: "h-11 w-11 justify-center p-0"
};

export type GlassButtonProps = PropsWithChildren<
  HTMLMotionProps<"button"> & {
    icon?: ReactNode;
    trailingIcon?: ReactNode;
    variant?: ButtonVariant;
    size?: ButtonSize;
    active?: boolean;
  }
>;

export const GlassButton = ({
  icon,
  trailingIcon,
  variant = "secondary",
  size = "md",
  active = false,
  className,
  children,
  type = "button",
  ...props
}: GlassButtonProps) => (
  <motion.button
    type={type}
    className={cn(
      "group/button relative inline-flex items-center gap-2 rounded-full border font-medium tracking-[-0.01em] backdrop-blur-2xl transition-[background-color,border-color,box-shadow,color] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70 disabled:cursor-not-allowed disabled:opacity-50",
      variantClassName[variant],
      sizeClassName[size],
      active && "border-cyan-200/30 bg-cyan-200/14 text-white shadow-[0_16px_34px_rgba(91,208,255,0.16)]",
      className
    )}
    whileHover={{ y: -2, scale: 1.01 }}
    whileTap={{ scale: 0.985 }}
    transition={{ type: "spring", stiffness: 320, damping: 22, mass: 0.7 }}
    {...props}
  >
    <span className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.03)_55%,transparent)] opacity-80" />
    {icon ? <span className="relative z-10">{icon}</span> : null}
    {children ? <span className="relative z-10">{children}</span> : null}
    {trailingIcon ? <span className="relative z-10">{trailingIcon}</span> : null}
  </motion.button>
);
