"use client";

import { motion } from "framer-motion";
import {
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  PhoneOff,
  Video,
  VideoOff
} from "lucide-react";

import { GlassButton, GlassCard, SectionEyebrow } from "@messenger/ui";

import type { CallMedia } from "@messenger/shared";

import { MediaStreamVideo } from "./media-stream-video";

type CallStatus =
  | "idle"
  | "incoming"
  | "requesting-media"
  | "dialing"
  | "connecting"
  | "connected"
  | "ending"
  | "error";

export interface CallConsoleProps {
  status: CallStatus;
  remoteUserLabel: string;
  incomingCallerLabel: string | null;
  callMedia: CallMedia;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isCameraEnabled: boolean;
  isScreenSharing: boolean;
  error: string | null;
  onStartVoiceCall: () => void;
  onStartVideoCall: () => void;
  onAnswer: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
}

const statusLabel: Record<CallStatus, string> = {
  idle: "Ready",
  incoming: "Incoming",
  "requesting-media": "Requesting media",
  dialing: "Dialing",
  connecting: "Connecting",
  connected: "Connected",
  ending: "Ending",
  error: "Attention"
};

export const CallConsole = ({
  status,
  remoteUserLabel,
  incomingCallerLabel,
  callMedia,
  localStream,
  remoteStream,
  isMuted,
  isCameraEnabled,
  isScreenSharing,
  error,
  onStartVoiceCall,
  onStartVideoCall,
  onAnswer,
  onDecline,
  onEnd,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare
}: CallConsoleProps) => {
  const isActive = status !== "idle" && status !== "error" && status !== "incoming";

  return (
    <GlassCard accent={status === "connected" ? "emerald" : "violet"} className="px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <SectionEyebrow>WebRTC Call</SectionEyebrow>
          <h2 className="mt-4 font-display text-2xl font-medium text-white">
            {incomingCallerLabel ?? remoteUserLabel}
          </h2>
        </div>
        <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/72">
          {statusLabel[status]}
        </div>
      </div>

      {status === "idle" || status === "error" ? (
        <div className="mt-5 space-y-4">
          <GlassCard className="p-4">
            <p className="font-display text-xl text-white">1:1 voice, video, and screen sharing</p>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Offer, answer, and ICE candidates are relayed through Socket.io while media travels peer-to-peer over
              WebRTC.
            </p>
            {error ? <p className="mt-3 text-sm text-amber-200">{error}</p> : null}
          </GlassCard>

          <div className="grid gap-3 sm:grid-cols-2">
            <GlassButton variant="secondary" icon={<Phone className="h-4 w-4" />} onClick={onStartVoiceCall}>
              Start voice call
            </GlassButton>
            <GlassButton variant="primary" icon={<Video className="h-4 w-4" />} onClick={onStartVideoCall}>
              Start video call
            </GlassButton>
          </div>
        </div>
      ) : null}

      {status === "incoming" ? (
        <motion.div
          className="mt-5 space-y-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
        >
          <GlassCard accent="cyan" className="p-4">
            <p className="font-display text-xl text-white">{incomingCallerLabel} is calling</p>
            <p className="mt-2 text-sm text-white/62">
              {callMedia === "voice" ? "Voice call" : "Video call"} request ready to answer.
            </p>
          </GlassCard>

          <div className="grid gap-3 sm:grid-cols-2">
            <GlassButton variant="secondary" icon={<Phone className="h-4 w-4" />} onClick={onAnswer}>
              Answer
            </GlassButton>
            <GlassButton variant="ghost" icon={<PhoneOff className="h-4 w-4" />} onClick={onDecline}>
              Decline
            </GlassButton>
          </div>
        </motion.div>
      ) : null}

      {isActive ? (
        <motion.div
          className="mt-5 space-y-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
        >
          <MediaStreamVideo
            stream={remoteStream}
            label={remoteUserLabel}
            className="h-[320px]"
            priority="primary"
          />

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
            <GlassCard className="p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-white/40">Local Preview</p>
                  <p className="mt-1 text-sm text-white/68">
                    {isScreenSharing ? "Sharing screen" : callMedia === "voice" ? "Audio only" : "Camera active"}
                  </p>
                </div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-white/44">
                  {callMedia}
                </div>
              </div>
            </GlassCard>
            <MediaStreamVideo
              stream={localStream}
              label="You"
              muted
              mirrored={!isScreenSharing}
              className="h-[120px]"
              priority="secondary"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <GlassButton
              variant="secondary"
              icon={isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              onClick={onToggleMute}
            >
              {isMuted ? "Unmute" : "Mute"}
            </GlassButton>
            <GlassButton
              variant="secondary"
              icon={isCameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              onClick={onToggleCamera}
            >
              {isCameraEnabled ? "Camera" : "Camera off"}
            </GlassButton>
            <GlassButton
              variant="secondary"
              icon={<MonitorUp className="h-4 w-4" />}
              onClick={onToggleScreenShare}
              active={isScreenSharing}
            >
              {isScreenSharing ? "Stop share" : "Share screen"}
            </GlassButton>
            <GlassButton variant="ghost" icon={<PhoneOff className="h-4 w-4" />} onClick={onEnd}>
              Hang up
            </GlassButton>
          </div>
        </motion.div>
      ) : null}
    </GlassCard>
  );
};
