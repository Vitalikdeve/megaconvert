import { motion } from "framer-motion";
import type { PropsWithChildren } from "react";

import { cn } from "./lib";

export interface ChatBubbleProps extends PropsWithChildren {
  author: string;
  timestamp: string;
  direction?: "incoming" | "outgoing";
  reactions?: string[];
  edited?: boolean;
  status?: string;
  className?: string;
}

export const ChatBubble = ({
  author,
  timestamp,
  direction = "incoming",
  reactions = [],
  edited = false,
  status,
  className,
  children
}: ChatBubbleProps) => (
  <motion.div
    layout
    className={cn(
      "group/bubble relative max-w-[84%] overflow-hidden rounded-[32px] border px-5 py-4 backdrop-blur-2xl shadow-[0_18px_38px_rgba(4,10,24,0.18),0_30px_90px_rgba(4,10,24,0.24)]",
      direction === "outgoing"
        ? "ml-auto border-cyan-200/28 bg-[linear-gradient(180deg,rgba(98,220,255,0.2),rgba(255,255,255,0.08))]"
        : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.06))]",
      className
    )}
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -2, scale: 1.004 }}
    transition={{ type: "spring", stiffness: 240, damping: 24, mass: 0.9 }}
  >
    <div className="pointer-events-none absolute inset-0 rounded-[32px] bg-[linear-gradient(145deg,rgba(255,255,255,0.18),transparent_42%)] opacity-70" />
    <div className="pointer-events-none absolute -right-8 top-4 h-20 w-28 rounded-full bg-white/14 blur-2xl transition duration-500 group-hover/bubble:bg-white/18" />
    <div className="relative">
      <div className="flex items-center justify-between gap-4">
        <span className="font-display text-base text-white/92">{author}</span>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/34">
          {status ? <span>{status}</span> : null}
          <span>{timestamp}</span>
        </div>
      </div>
      <div className="mt-3 text-sm leading-7 text-white/82 md:text-[15px]">{children}</div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {edited ? (
          <span className="rounded-full border border-white/10 bg-black/14 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/44">
            Edited
          </span>
        ) : null}
        {reactions.map((reaction) => (
          <span
            key={reaction}
            className="rounded-full border border-white/10 bg-black/14 px-3 py-1 text-sm text-white/84 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
          >
            {reaction}
          </span>
        ))}
      </div>
    </div>
  </motion.div>
);
