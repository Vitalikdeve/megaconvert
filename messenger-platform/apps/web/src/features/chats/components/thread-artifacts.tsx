"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  Download,
  Play
} from "lucide-react";

import { ChatBubble, GlassButton, cn } from "@messenger/ui";

import {
  type TimelineDayDivider,
  type TimelineFileMessage,
  type TimelineItem,
  type TimelineVoiceMessage
} from "@/features/chats/showcase-data";
import type { RealtimeMessage } from "@/features/chats/domain/realtime-message";

const springTransition = {
  type: "spring",
  stiffness: 240,
  damping: 24,
  mass: 0.9
} as const;

const reactionOptions = ["👍", "🔥", "🚀", "❤️"];

export const TimelineDivider = ({ label }: { label: string }) => (
  <motion.div
    layout
    className="sticky top-0 z-10 flex justify-center py-2"
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={springTransition}
  >
    <div className="rounded-full border border-white/10 bg-slate-950/24 px-4 py-1.5 text-[11px] uppercase tracking-[0.32em] text-white/52 backdrop-blur-xl">
      {label}
    </div>
  </motion.div>
);

export const FilePreviewMessage = ({ item }: { item: TimelineFileMessage }) => (
  <ChatBubble
    author={item.author}
    timestamp={item.timestamp}
    direction={item.role}
    reactions={item.reactions}
    edited={item.edited}
    status={item.status}
  >
    <p>{item.body}</p>
    <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-white/6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="grid gap-4 p-3 md:grid-cols-[128px_minmax(0,1fr)]">
        <div className="relative flex h-28 flex-col justify-between rounded-[20px] bg-[radial-gradient(circle_at_top_left,rgba(160,232,255,0.36),transparent_48%),linear-gradient(160deg,rgba(82,165,255,0.24),rgba(255,255,255,0.08))] p-3">
          <span className="w-fit rounded-full border border-white/14 bg-black/16 px-2 py-1 text-[10px] uppercase tracking-[0.24em] text-white/64">
            {item.file.extension}
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/52">
              {item.file.kindLabel}
            </p>
            <p className="mt-1 font-display text-lg text-white">{item.file.previewLabel}</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-col justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/40">
              Encrypted File Preview
            </p>
            <p className="mt-2 truncate font-display text-xl text-white">
              {item.file.name}
            </p>
            <p className="mt-2 text-sm leading-6 text-white/58">
              {item.file.size} · preview generated on the client before transport.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <GlassButton
              variant="secondary"
              size="sm"
              icon={<ArrowUpRight className="h-4 w-4" />}
            >
              Open
            </GlassButton>
            <GlassButton
              variant="ghost"
              size="sm"
              icon={<Download className="h-4 w-4" />}
            >
              Save
            </GlassButton>
          </div>
        </div>
      </div>
    </div>
  </ChatBubble>
);

export const VoiceMessage = ({ item }: { item: TimelineVoiceMessage }) => (
  <ChatBubble
    author={item.author}
    timestamp={item.timestamp}
    direction={item.role}
    reactions={item.reactions}
    edited={item.edited}
    status={item.status}
  >
    <div className="flex items-center gap-3 rounded-[26px] border border-white/10 bg-black/12 px-3 py-3">
      <motion.button
        type="button"
        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-white/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.04 }}
        transition={springTransition}
      >
        <Play className="ml-1 h-4 w-4" />
      </motion.button>
      <div className="flex-1">
        <div className="flex h-11 items-end gap-1">
          {item.voice.waveform.map((bar, index) => (
            <motion.span
              key={`${item.id}-${index}`}
              className="voice-wave-bar w-1.5 rounded-full bg-white/76"
              style={{ height: `${bar}px` }}
              animate={{ opacity: [0.42, 1, 0.42] }}
              transition={{
                duration: 1.8,
                repeat: Number.POSITIVE_INFINITY,
                delay: index * 0.05,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.24em] text-white/42">
          <span>{item.voice.listened ? "Played" : "New voice note"}</span>
          <span>{item.voice.duration}</span>
        </div>
      </div>
      <div className="hidden rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/58 md:block">
        {Math.round(item.voice.progress * 100)}%
      </div>
    </div>
  </ChatBubble>
);

export const TypingBubble = ({ label }: { label: string }) => (
  <motion.div
    layout
    className="flex justify-start"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 10 }}
    transition={springTransition}
  >
    <div className="rounded-[28px] border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-2xl shadow-[0_18px_44px_rgba(5,10,24,0.18)]">
      <div className="flex items-center gap-3">
        <span className="text-sm text-white/72">{label}</span>
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((dot) => (
            <motion.span
              key={dot}
              className="h-2 w-2 rounded-full bg-cyan-100/90"
              animate={{ y: [0, -3, 0], opacity: [0.32, 1, 0.32] }}
              transition={{
                duration: 0.9,
                repeat: Number.POSITIVE_INFINITY,
                delay: dot * 0.12,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>
      </div>
    </div>
  </motion.div>
);

export const QuickReactions = ({
  messageId,
  role,
  onReact,
  onEdit
}: {
  messageId: string;
  role: "incoming" | "outgoing";
  onReact: (messageId: string, emoji: string) => void;
  onEdit?: () => void;
}) => (
  <motion.div
    layout
    className={cn(
      "flex flex-wrap gap-2 opacity-0 transition duration-200 group-hover/message:opacity-100",
      role === "outgoing" ? "justify-end" : "justify-start"
    )}
  >
    {reactionOptions.map((emoji) => (
      <motion.button
        key={`${messageId}-${emoji}`}
        type="button"
        className="flex h-9 min-w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 px-3 text-sm text-white/84 backdrop-blur-xl"
        whileTap={{ scale: 0.94 }}
        whileHover={{ y: -1, scale: 1.03 }}
        transition={springTransition}
        onClick={() => onReact(messageId, emoji)}
      >
        {emoji}
      </motion.button>
    ))}
    {onEdit ? (
      <GlassButton variant="ghost" size="sm" onClick={onEdit}>
        Edit
      </GlassButton>
    ) : null}
  </motion.div>
);

export const renderLiveTimelineMessage = ({
  message,
  deliveryLabel,
  onReact,
  onEdit
}: {
  message: RealtimeMessage;
  deliveryLabel: Record<RealtimeMessage["deliveryStatus"], string>;
  onReact: (messageId: string, emoji: string) => void;
  onEdit?: () => void;
}) => (
  <motion.div
    key={message.id}
    layout
    className="group/message space-y-2"
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={springTransition}
  >
    <ChatBubble
      author={message.author}
      timestamp={message.timestamp}
      direction={message.role}
      reactions={[...message.reactions]}
      edited={message.edited}
      status={message.role === "outgoing" ? deliveryLabel[message.deliveryStatus] : undefined}
    >
      {message.body}
    </ChatBubble>
    <QuickReactions
      messageId={message.id}
      role={message.role}
      onReact={onReact}
      onEdit={message.role === "outgoing" ? onEdit : undefined}
    />
  </motion.div>
);

export const renderHistoricalTimelineMessage = ({
  item
}: {
  item: TimelineItem | TimelineDayDivider;
}) => {
  if (item.kind === "day") {
    return <TimelineDivider key={item.id} label={item.label} />;
  }

  if (item.kind === "file") {
    return (
      <motion.div
        key={item.id}
        layout
        className="group/message space-y-2"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springTransition}
      >
        <FilePreviewMessage item={item} />
      </motion.div>
    );
  }

  if (item.kind === "voice") {
    return (
      <motion.div
        key={item.id}
        layout
        className="group/message space-y-2"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springTransition}
      >
        <VoiceMessage item={item} />
      </motion.div>
    );
  }

  return (
    <motion.div
      key={item.id}
      layout
      className="group/message space-y-2"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springTransition}
    >
      <ChatBubble
        author={item.author}
        timestamp={item.timestamp}
        direction={item.role}
        reactions={item.reactions}
        edited={item.edited}
        status={item.status}
      >
        {item.body}
      </ChatBubble>
    </motion.div>
  );
};

export const ThreadTypingPresence = ({ label }: { label: string | null }) => (
  <AnimatePresence>{label ? <TypingBubble label={label} /> : null}</AnimatePresence>
);
