"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { PropsWithChildren, ReactNode } from "react";

import { GlassCard } from "./glass-card";
import { cn } from "./lib";

export interface GlassModalProps extends PropsWithChildren {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  footer?: ReactNode;
  className?: string;
}

export const GlassModal = ({
  open,
  title,
  description,
  onClose,
  footer,
  className,
  children
}: GlassModalProps) => (
  <AnimatePresence>
    {open ? (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.button
          aria-label="Close modal"
          className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_35%),rgba(3,6,14,0.55)] backdrop-blur-xl"
          onClick={onClose}
        />

        <GlassCard
          accent="cyan"
          padding="none"
          className={cn("relative z-10 w-full max-w-2xl", className)}
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 240, damping: 24 }}
        >
          <div className="border-b border-white/10 px-6 py-5">
            <p className="font-display text-2xl font-medium text-white">{title}</p>
            {description ? <p className="mt-2 max-w-xl text-sm leading-6 text-white/60">{description}</p> : null}
          </div>
          <div className="px-6 py-6">{children}</div>
          {footer ? <div className="border-t border-white/10 px-6 py-5">{footer}</div> : null}
        </GlassCard>
      </motion.div>
    ) : null}
  </AnimatePresence>
);

