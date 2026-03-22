import type { PropsWithChildren } from "react";

import { cn } from "./lib";

export const SectionEyebrow = ({
  children,
  className
}: PropsWithChildren<{ className?: string }>) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.32em] text-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl",
      className
    )}
  >
    {children}
  </span>
);

