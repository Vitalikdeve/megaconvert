import { cn } from "./lib";

export const StatusDot = ({ className }: { className?: string }) => (
  <span
    className={cn(
      "inline-block h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,255,214,0.72)]",
      className
    )}
  />
);

