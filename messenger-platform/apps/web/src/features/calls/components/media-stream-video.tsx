"use client";

import { UserRound } from "lucide-react";
import { useEffect, useRef } from "react";

import { cn } from "@messenger/ui";

export interface MediaStreamVideoProps {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
  mirrored?: boolean;
  className?: string;
  priority?: "primary" | "secondary";
}

export const MediaStreamVideo = ({
  stream,
  label,
  muted = false,
  mirrored = false,
  className,
  priority = "primary"
}: MediaStreamVideoProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hasVideo = Boolean(stream && stream.getVideoTracks().length > 0);

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }

    videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] shadow-[0_18px_48px_rgba(3,8,20,0.28)]",
        priority === "primary" ? "min-h-[320px]" : "min-h-[150px]",
        className
      )}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={cn(
            "h-full w-full object-cover",
            mirrored && "scale-x-[-1]"
          )}
        />
      ) : (
        <div className="flex h-full min-h-[inherit] flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_top,rgba(128,226,255,0.18),transparent_34%),rgba(7,12,24,0.45)] text-white/76">
          <UserRound className="h-10 w-10 text-white/64" />
          <span className="font-display text-lg">{label}</span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-[linear-gradient(180deg,transparent,rgba(3,8,20,0.72))] px-4 py-4 text-sm text-white/80">
        <span>{label}</span>
        <span className="text-[11px] uppercase tracking-[0.22em] text-white/46">
          {hasVideo ? "live" : "audio"}
        </span>
      </div>
    </div>
  );
};
