"use client";

import type { ReactNode, TextareaHTMLAttributes } from "react";

import { GlassButton } from "./glass-button";
import { GlassCard } from "./glass-card";
import { cn } from "./lib";

export interface MessageInputProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit?: () => void;
  topSlot?: ReactNode;
  leftActions?: ReactNode;
  rightActions?: ReactNode;
  hint?: string;
  submitLabel?: string;
  submitIcon?: ReactNode;
}

export const MessageInput = ({
  value,
  onValueChange,
  onSubmit,
  topSlot,
  leftActions,
  rightActions,
  hint,
  submitLabel = "Send",
  submitIcon,
  className,
  placeholder,
  rows = 3,
  disabled,
  ...props
}: MessageInputProps) => (
  <GlassCard accent="slate" className={cn("rounded-[30px] p-3", className)}>
    {topSlot ? <div className="border-b border-white/10 px-2 pb-3">{topSlot}</div> : null}
    <div className={cn("flex flex-col gap-3 md:flex-row md:items-end", topSlot ? "pt-3" : "")}>
      {leftActions ? <div className="flex items-center gap-2 px-1">{leftActions}</div> : null}
      <label className="flex-1">
        <span className="sr-only">Message draft</span>
        <textarea
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          rows={rows}
          disabled={disabled}
          className="min-h-[84px] w-full resize-none bg-transparent px-3 py-2 text-sm leading-7 text-white outline-none placeholder:text-white/32 disabled:opacity-60"
          placeholder={placeholder}
          {...props}
        />
      </label>
      <div className="flex items-center gap-2">
        {rightActions}
        <GlassButton
          variant="primary"
          size="lg"
          onClick={onSubmit}
          disabled={disabled}
          icon={submitIcon}
          className="min-w-[138px] justify-center"
        >
          {submitLabel}
        </GlassButton>
      </div>
    </div>
    {hint ? (
      <p className="px-3 pt-1 text-[11px] uppercase tracking-[0.22em] text-white/36">
        {hint}
      </p>
    ) : null}
  </GlassCard>
);
