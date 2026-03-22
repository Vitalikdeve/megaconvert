import type { HTMLAttributes, PropsWithChildren, ReactNode } from "react";

import { GlassCard } from "./glass-card";
import { cn } from "./lib";

export type GlassSidebarProps = PropsWithChildren<
  HTMLAttributes<HTMLElement> & {
    title: string;
    subtitle?: string;
    headerSlot?: ReactNode;
    footer?: ReactNode;
  }
>;

export const GlassSidebar = ({
  title,
  subtitle,
  headerSlot,
  footer,
  className,
  children,
  ...props
}: GlassSidebarProps) => (
  <aside className={cn(className)} {...props}>
    <GlassCard accent="slate" padding="none" className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5">
        <div>
          <p className="font-display text-2xl font-medium text-white">{title}</p>
          {subtitle ? <p className="mt-1 text-sm text-white/56">{subtitle}</p> : null}
        </div>
        {headerSlot}
      </div>
      <div className="flex-1 px-4 py-4">{children}</div>
      {footer ? <div className="border-t border-white/10 px-4 py-4">{footer}</div> : null}
    </GlassCard>
  </aside>
);
