"use client";

import { motion } from "framer-motion";
import {
  Bell,
  Camera,
  CircleAlert,
  CirclePlus,
  FolderUp,
  LogOut,
  LockKeyhole,
  MessageSquareMore,
  Mic,
  MoonStar,
  PhoneCall,
  Search,
  SendHorizonal,
  Settings2,
  SmilePlus,
  Sparkles,
  UserRound,
  UserRoundPlus,
  Video,
  Volume2
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  GlassButton,
  GlassCard,
  GlassModal,
  MessageInput,
  SectionEyebrow,
  StatusDot,
  cn
} from "@messenger/ui";

import { CallConsole } from "@/features/calls/components/call-console";
import { useWebRtcCall } from "@/features/calls/use-webrtc-call";
import {
  draftAttachments,
  chatFolders,
  chatListItems,
  sharedPreviewItems,
  timelineHistory,
  workspaceDestinations
} from "@/features/chats/showcase-data";
import {
  ThreadTypingPresence,
  renderHistoricalTimelineMessage,
  renderLiveTimelineMessage
} from "@/features/chats/components/thread-artifacts";
import type { RealtimeMessage } from "@/features/chats/domain/realtime-message";
import { useRealtimeMessenger } from "@/features/chats/use-realtime-messenger";
import { EncryptedUploadPanel } from "@/features/uploads/components/encrypted-upload-panel";
import { useAuthSession } from "@/features/auth/use-auth-session";

import { LiquidOrbs } from "./liquid-orbs";

const socketLabel = {
  connecting: "Syncing relay",
  online: "Realtime ready",
  offline: "Local preview"
} as const;

const deliveryLabel = {
  sending: "Sending",
  sent: "Sent",
  delivered: "Delivered",
  failed: "Failed"
} as const;

const historyPageSize = 2;

const destinationIcons = {
  messages: MessageSquareMore,
  calls: PhoneCall,
  vault: FolderUp,
  people: UserRound,
  settings: Settings2
} as const;

const tintClassName = {
  cyan: "border-cyan-200/18 bg-cyan-200/10 text-cyan-50",
  violet: "border-violet-200/18 bg-violet-200/10 text-violet-50",
  emerald: "border-emerald-200/18 bg-emerald-200/10 text-emerald-50"
} as const;

const springTransition = {
  type: "spring",
  stiffness: 220,
  damping: 24,
  mass: 0.9
} as const;

export const MessengerExperience = () => {
  const [isNewThreadModalOpen, setIsNewThreadModalOpen] = useState(false);
  const [isFilesModalOpen, setIsFilesModalOpen] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [credentials, setCredentials] = useState({
    username: "",
    password: ""
  });
  const [editingMessage, setEditingMessage] = useState<RealtimeMessage | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(
    Math.min(historyPageSize + 2, timelineHistory.length)
  );
  const [historyLoading, setHistoryLoading] = useState(false);

  const {
    session,
    isSubmitting: isAuthSubmitting,
    error: authError,
    login,
    register,
    logout
  } = useAuthSession();

  const currentUserId = session?.userId ?? session?.username ?? "you";
  const currentDeviceId = session?.deviceId ?? "web-1";
  const callPeerUserId = "nina";
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const initialScrollCompleteRef = useRef(false);
  const pendingPrependHeightRef = useRef<number | null>(null);
  const previousLiveMessageCountRef = useRef(0);

  const {
    connectionState,
    draft,
    error,
    messages,
    setDraft,
    sendMessage,
    reactToMessage,
    editMessage,
    typingLabel
  } = useRealtimeMessenger({
    conversationId: "vision-labs",
    currentUserId,
    currentDeviceId,
    authToken: session?.token,
    peerUserId: session?.userId ?? currentUserId
  });

  const {
    status: callStatus,
    callMedia,
    localStream,
    remoteStream,
    incomingCall,
    remoteUserLabel,
    incomingCallerLabel,
    isMuted,
    isCameraEnabled,
    isScreenSharing,
    error: callError,
    startVoiceCall,
    startVideoCall,
    answerIncomingCall,
    declineIncomingCall,
    endCall,
    toggleMute,
    toggleCamera,
    toggleScreenShare
  } = useWebRtcCall({
    conversationId: "vision-labs",
    currentUserId,
    authToken: session?.token
  });

  const activeConversation = chatListItems.find((item) => item.active) ?? chatListItems[0];
  const canLoadOlderHistory = visibleHistoryCount < timelineHistory.length;

  const historyItems = useMemo(
    () => timelineHistory.slice(Math.max(0, timelineHistory.length - visibleHistoryCount)),
    [visibleHistoryCount]
  );

  const openEditModal = (message: RealtimeMessage) => {
    setEditingMessage(message);
    setEditingBody(message.body);
  };

  const submitEdit = () => {
    if (!editingMessage) {
      return;
    }

    editMessage(editingMessage.id, editingBody);
    setEditingMessage(null);
    setEditingBody("");
  };

  const submitAuth = async () => {
    const nextCredentials = {
      username: credentials.username.trim(),
      password: credentials.password
    };

    if (!nextCredentials.username || !nextCredentials.password) {
      return;
    }

    try {
      if (authMode === "login") {
        await login(nextCredentials);
      } else {
        await register(nextCredentials);
      }
    } catch {
      return;
    }

    setIsAuthModalOpen(false);
  };

  const loadOlderHistory = () => {
    if (!canLoadOlderHistory || historyLoading) {
      return;
    }

    const viewport = scrollViewportRef.current;

    if (viewport) {
      pendingPrependHeightRef.current = viewport.scrollHeight;
    }

    setHistoryLoading(true);
    setVisibleHistoryCount((current) =>
      Math.min(current + historyPageSize, timelineHistory.length)
    );
  };

  useLayoutEffect(() => {
    const viewport = scrollViewportRef.current;

    if (!viewport) {
      return;
    }

    if (!initialScrollCompleteRef.current) {
      viewport.scrollTop = viewport.scrollHeight;
      initialScrollCompleteRef.current = true;
      previousLiveMessageCountRef.current = messages.length;
      return;
    }

    if (pendingPrependHeightRef.current !== null) {
      const heightDelta = viewport.scrollHeight - pendingPrependHeightRef.current;
      viewport.scrollTop += heightDelta;
      pendingPrependHeightRef.current = null;
      setHistoryLoading(false);
    }
  }, [messages.length, visibleHistoryCount]);

  useEffect(() => {
    if (callStatus !== "idle" || incomingCall) {
      setIsCallModalOpen(true);
    }
  }, [callStatus, incomingCall]);

  useEffect(() => {
    const viewport = scrollViewportRef.current;

    if (!viewport || !initialScrollCompleteRef.current) {
      return;
    }

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    const nearBottom = distanceFromBottom < 180;
    const newLiveMessageArrived = messages.length > previousLiveMessageCountRef.current;

    if ((nearBottom && newLiveMessageArrived) || (nearBottom && typingLabel)) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
    }

    previousLiveMessageCountRef.current = messages.length;
  }, [messages.length, typingLabel]);

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-5 md:px-6 md:py-6 xl:px-8">
      <LiquidOrbs />

      <div className="relative mx-auto max-w-[1680px]">
        <motion.div
          className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springTransition}
        >
          <div>
            <SectionEyebrow>Private Messenger Workspace</SectionEyebrow>
            <div className="mt-2 flex items-center gap-2 text-sm text-white/66">
              <StatusDot className={cn(connectionState === "online" ? "bg-emerald-300" : "bg-amber-200")} />
              <span>{socketLabel[connectionState]}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <GlassButton
              variant="secondary"
              size="sm"
              icon={<UserRoundPlus className="h-4 w-4" />}
              onClick={() => setIsAuthModalOpen(true)}
            >
              {session?.username ?? "Connect"}
            </GlassButton>
            <GlassButton variant="secondary" size="sm" icon={<MoonStar className="h-4 w-4" />}>
              Focus mode
            </GlassButton>
            <GlassButton
              variant="primary"
              size="sm"
              icon={<CirclePlus className="h-4 w-4" />}
              onClick={() => setIsNewThreadModalOpen(true)}
            >
              New thread
            </GlassButton>
          </div>
        </motion.div>

        <div className="grid min-h-[calc(100vh-6.5rem)] gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
          <motion.aside
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...springTransition, delay: 0.06 }}
          >
            <GlassCard padding="none" className="h-full overflow-hidden">
              <div className="grid h-full min-h-[calc(100vh-6.5rem)] grid-cols-[88px_minmax(0,1fr)]">
                <div className="flex flex-col items-center justify-between border-r border-white/10 px-3 py-4">
                  <div className="space-y-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-white/12 bg-white/14 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                      <Sparkles className="h-5 w-5 text-cyan-50" />
                    </div>

                    {workspaceDestinations.map((destination) => {
                      const Icon = destinationIcons[destination.id];

                      return (
                        <motion.button
                          key={destination.id}
                          type="button"
                          className={cn(
                            "relative flex h-14 w-14 items-center justify-center rounded-[20px] border text-white/72 backdrop-blur-2xl",
                            destination.active
                              ? "border-cyan-200/22 bg-cyan-200/12 text-white shadow-[0_18px_34px_rgba(25,120,196,0.2)]"
                              : "border-white/8 bg-white/8"
                          )}
                          whileTap={{ scale: 0.94 }}
                          whileHover={{ y: -2, scale: 1.03 }}
                          transition={springTransition}
                        >
                          <Icon className="h-5 w-5" />
                          {destination.badge ? (
                            <span className="absolute -right-1 -top-1 rounded-full border border-white/12 bg-cyan-100/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-950">
                              {destination.badge}
                            </span>
                          ) : null}
                        </motion.button>
                      );
                    })}
                  </div>

                  <motion.button
                    type="button"
                    className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-white/10 text-white/78 backdrop-blur-2xl"
                    whileTap={{ scale: 0.94 }}
                    whileHover={{ y: -2, scale: 1.03 }}
                    transition={springTransition}
                  >
                    <Bell className="h-5 w-5" />
                  </motion.button>
                </div>

                <div className="flex min-h-0 flex-col">
                  <div className="border-b border-white/10 px-5 py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-display text-3xl text-white">Chats</p>
                        <p className="mt-1 text-sm text-white/56">
                          Telegram density with a premium liquid shell.
                        </p>
                      </div>
                      <GlassButton
                        variant="ghost"
                        size="icon"
                        icon={<CirclePlus className="h-4 w-4" />}
                        onClick={() => setIsNewThreadModalOpen(true)}
                      />
                    </div>

                    <label className="glass-input mt-5 flex items-center gap-3 rounded-full px-4 py-3 text-white/54">
                      <Search className="h-4 w-4" />
                      <input
                        className="w-full bg-transparent outline-none placeholder:text-white/40"
                        placeholder="Search messages or people"
                      />
                    </label>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {chatFolders.map((folder) => (
                        <motion.button
                          key={folder.id}
                          type="button"
                          className={cn(
                            "rounded-full border px-3 py-2 text-xs uppercase tracking-[0.24em] backdrop-blur-xl",
                            folder.id === "all"
                              ? "border-cyan-200/18 bg-cyan-200/12 text-cyan-50"
                              : "border-white/10 bg-white/8 text-white/54"
                          )}
                          whileTap={{ scale: 0.96 }}
                          whileHover={{ y: -1 }}
                          transition={springTransition}
                        >
                          {folder.label} · {folder.count}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div className="premium-scrollbar flex-1 space-y-3 overflow-y-auto px-3 py-4">
                    {chatListItems.map((conversation, index) => (
                      <motion.button
                        key={conversation.id}
                        type="button"
                        className="w-full text-left"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...springTransition, delay: Math.min(index * 0.04, 0.16) }}
                      >
                        <GlassCard
                          accent={conversation.accent}
                          interactive={!conversation.active}
                          className={cn(
                            "px-4 py-4",
                            conversation.active ? "border-cyan-200/24 bg-cyan-200/10" : ""
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-white/12 font-display text-lg text-white">
                              {conversation.initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="truncate font-display text-xl text-white">
                                      {conversation.title}
                                    </p>
                                    {conversation.pinned ? (
                                      <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.24em] text-white/52">
                                        Pinned
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/58">
                                    {conversation.preview}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs uppercase tracking-[0.22em] text-white/40">
                                    {conversation.timestamp}
                                  </p>
                                  {conversation.unread > 0 ? (
                                    <div className="mt-3 flex justify-end">
                                      <span className="rounded-full border border-cyan-100/18 bg-cyan-100/90 px-2.5 py-1 text-xs font-medium text-slate-950">
                                        {conversation.unread}
                                      </span>
                                    </div>
                                  ) : null}
                                </div>
                              </div>

                              <div className="mt-4 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.24em] text-white/42">
                                <div className="flex items-center gap-2">
                                  <StatusDot className={conversation.active ? "bg-emerald-300" : "bg-white/28 shadow-none"} />
                                  <span>{conversation.status}</span>
                                </div>
                                <span>{conversation.kind}</span>
                              </div>
                            </div>
                          </div>
                        </GlassCard>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.aside>

          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springTransition, delay: 0.1 }}
          >
            <GlassCard padding="none" className="flex h-full min-h-[calc(100vh-6.5rem)] flex-col overflow-hidden">
              <div className="border-b border-white/10 px-5 py-5 md:px-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-cyan-200/18 bg-cyan-200/12 font-display text-xl text-white">
                      {activeConversation.initials}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="font-display text-3xl text-white">{activeConversation.title}</p>
                        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/54">
                          Protected
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/56">
                        <StatusDot className="bg-emerald-300" />
                        <span>{activeConversation.status}</span>
                        <span className="text-white/28">•</span>
                        <span>Forward secrecy active</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <GlassButton
                      variant="secondary"
                      size="sm"
                      icon={<PhoneCall className="h-4 w-4" />}
                      onClick={() => {
                        setIsCallModalOpen(true);
                        void startVoiceCall(callPeerUserId);
                      }}
                    >
                      Voice
                    </GlassButton>
                    <GlassButton
                      variant="secondary"
                      size="sm"
                      icon={<Camera className="h-4 w-4" />}
                      onClick={() => {
                        setIsCallModalOpen(true);
                        void startVideoCall(callPeerUserId);
                      }}
                    >
                      Video
                    </GlassButton>
                    <GlassButton
                      variant="secondary"
                      size="sm"
                      icon={<FolderUp className="h-4 w-4" />}
                      onClick={() => setIsFilesModalOpen(true)}
                    >
                      Files
                    </GlassButton>
                    <GlassButton variant="ghost" size="icon" icon={<LockKeyhole className="h-4 w-4" />} />
                  </div>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
                  <GlassCard accent="violet" className="px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.28em] text-white/42">
                      Infinite Timeline
                    </p>
                    <p className="mt-3 font-display text-2xl text-white">
                      Dense history, instant updates, and a calm chat header.
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/58">
                      Older history pages in above the viewport while live messages, file previews, voice notes, and
                      typing remain anchored to the bottom.
                    </p>
                  </GlassCard>

                  <div className="grid grid-cols-3 gap-3">
                    {sharedPreviewItems.map((item) => (
                      <GlassCard key={item.id} accent="slate" className="px-4 py-4 text-center">
                        <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">
                          {item.label}
                        </p>
                        <p className="mt-3 font-display text-xl text-white">{item.value}</p>
                      </GlassCard>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative flex-1 overflow-hidden">
                <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-24 bg-gradient-to-b from-slate-950/26 via-slate-950/8 to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 left-[14%] w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-[12%] w-px bg-gradient-to-b from-transparent via-cyan-100/8 to-transparent" />

                <div
                  ref={scrollViewportRef}
                  className="premium-scrollbar absolute inset-0 overflow-y-auto px-4 py-6 md:px-6"
                  onScroll={(event) => {
                    if (event.currentTarget.scrollTop < 120) {
                      loadOlderHistory();
                    }
                  }}
                >
                  <div className="mx-auto flex max-w-4xl flex-col gap-4">
                    {canLoadOlderHistory ? (
                      <div className="flex justify-center">
                        <div className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-white/52 backdrop-blur-xl">
                          {historyLoading ? "Loading earlier messages" : "Scroll up for earlier history"}
                        </div>
                      </div>
                    ) : null}

                    {historyItems.map((item) => renderHistoricalTimelineMessage({ item }))}
                    {messages.map((message) =>
                      renderLiveTimelineMessage({
                        message,
                        deliveryLabel,
                        onReact: reactToMessage,
                        onEdit: () => openEditModal(message)
                      })
                    )}
                    <ThreadTypingPresence label={typingLabel} />
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 px-4 py-4 md:px-6">
                <div className="mx-auto max-w-4xl">
                  {error ? (
                    <GlassCard accent="violet" className="mb-3 px-4 py-3">
                      <div className="flex items-center gap-3 text-sm text-white/86">
                        <CircleAlert className="h-4 w-4 text-amber-200" />
                        <span>{error}</span>
                      </div>
                    </GlassCard>
                  ) : null}

                  <MessageInput
                    value={draft}
                    onValueChange={setDraft}
                    onSubmit={sendMessage}
                    placeholder="Write a message..."
                    hint={typingLabel ?? "Client-side encryption active. The relay never sees plaintext."}
                    submitLabel="Send"
                    submitIcon={<SendHorizonal className="h-4 w-4" />}
                    topSlot={
                      <div className="flex flex-wrap gap-2">
                        {draftAttachments.map((attachment) => (
                          <motion.button
                            key={attachment.id}
                            type="button"
                            className={cn(
                              "flex items-center gap-2 rounded-full border px-3 py-2 text-sm backdrop-blur-xl",
                              tintClassName[attachment.tint]
                            )}
                            whileTap={{ scale: 0.97 }}
                            whileHover={{ y: -1 }}
                            transition={springTransition}
                            onClick={() => setIsFilesModalOpen(true)}
                          >
                            <FolderUp className="h-4 w-4" />
                            <span>{attachment.label}</span>
                            <span className="text-white/56">{attachment.size}</span>
                          </motion.button>
                        ))}
                      </div>
                    }
                    leftActions={
                      <>
                        <GlassButton
                          variant="ghost"
                          size="icon"
                          icon={<CirclePlus className="h-4 w-4" />}
                          onClick={() => setIsFilesModalOpen(true)}
                        />
                        <GlassButton variant="ghost" size="icon" icon={<SmilePlus className="h-4 w-4" />} />
                        <GlassButton variant="ghost" size="icon" icon={<Mic className="h-4 w-4" />} />
                      </>
                    }
                    rightActions={
                      <>
                        <GlassButton
                          variant="ghost"
                          size="icon"
                          icon={<Video className="h-4 w-4" />}
                          onClick={() => setIsCallModalOpen(true)}
                        />
                        <GlassButton variant="ghost" size="icon" icon={<Volume2 className="h-4 w-4" />} />
                      </>
                    }
                  />
                </div>
              </div>
            </GlassCard>
          </motion.section>
        </div>
      </div>

      <GlassModal
        open={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        title="Connect to remote backend"
        description="Register or log in against the remote messenger API. The current username is used for outgoing HTTP and Socket.io message payloads."
      >
        <div className="flex flex-wrap gap-2">
          <GlassButton
            variant={authMode === "login" ? "primary" : "ghost"}
            size="sm"
            onClick={() => setAuthMode("login")}
          >
            Login
          </GlassButton>
          <GlassButton
            variant={authMode === "register" ? "primary" : "ghost"}
            size="sm"
            onClick={() => setAuthMode("register")}
          >
            Register
          </GlassButton>
        </div>

        <div className="mt-4 grid gap-4">
          <label className="glass-input rounded-[24px] px-4 py-3">
            <span className="mb-2 block text-[11px] uppercase tracking-[0.24em] text-white/42">
              Username
            </span>
            <input
              value={credentials.username}
              onChange={(event) =>
                setCredentials((current) => ({
                  ...current,
                  username: event.target.value
                }))
              }
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
              placeholder="alice"
            />
          </label>

          <label className="glass-input rounded-[24px] px-4 py-3">
            <span className="mb-2 block text-[11px] uppercase tracking-[0.24em] text-white/42">
              Password
            </span>
            <input
              type="password"
              value={credentials.password}
              onChange={(event) =>
                setCredentials((current) => ({
                  ...current,
                  password: event.target.value
                }))
              }
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
              placeholder="••••••••"
            />
          </label>
        </div>

        {authError ? (
          <GlassCard accent="violet" className="mt-4 px-4 py-3">
            <div className="flex items-center gap-3 text-sm text-white/84">
              <CircleAlert className="h-4 w-4 text-amber-200" />
              <span>{authError}</span>
            </div>
          </GlassCard>
        ) : null}

        {session ? (
          <GlassCard accent="emerald" className="mt-4 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/42">
                  Connected User
                </p>
                <p className="mt-2 font-display text-xl text-white">
                  {session.username}
                </p>
              </div>
              <GlassButton
                variant="ghost"
                size="sm"
                icon={<LogOut className="h-4 w-4" />}
                onClick={logout}
              >
                Logout
              </GlassButton>
            </div>
          </GlassCard>
        ) : null}

        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <GlassButton variant="ghost" onClick={() => setIsAuthModalOpen(false)}>
            Close
          </GlassButton>
          <GlassButton
            variant="primary"
            icon={<UserRoundPlus className="h-4 w-4" />}
            disabled={isAuthSubmitting}
            onClick={() => {
              void submitAuth();
            }}
          >
            {isAuthSubmitting
              ? "Connecting..."
              : authMode === "login"
                ? "Login"
                : "Register"}
          </GlassButton>
        </div>
      </GlassModal>

      <GlassModal
        open={isFilesModalOpen}
        onClose={() => setIsFilesModalOpen(false)}
        title="Encrypted file vault"
        description="Chunked, resumable, parallel uploads stay one click away from the composer."
      >
        <EncryptedUploadPanel
          conversationId="vision-labs"
          authToken={session?.token}
          deviceId={currentDeviceId}
        />
      </GlassModal>

      <GlassModal
        open={isCallModalOpen}
        onClose={() => setIsCallModalOpen(false)}
        title="Call console"
        description="Voice, video, and screen share controls live in a focused surface so the thread stays uncluttered."
      >
        <CallConsole
          status={callStatus}
          remoteUserLabel={remoteUserLabel ?? "Nina"}
          incomingCallerLabel={incomingCallerLabel}
          callMedia={incomingCall?.media ?? callMedia}
          localStream={localStream}
          remoteStream={remoteStream}
          isMuted={isMuted}
          isCameraEnabled={isCameraEnabled}
          isScreenSharing={isScreenSharing}
          error={callError}
          onStartVoiceCall={() => {
            void startVoiceCall(callPeerUserId);
          }}
          onStartVideoCall={() => {
            void startVideoCall(callPeerUserId);
          }}
          onAnswer={answerIncomingCall}
          onDecline={declineIncomingCall}
          onEnd={() => void endCall()}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          onToggleScreenShare={() => void toggleScreenShare()}
        />
      </GlassModal>

      <GlassModal
        open={isNewThreadModalOpen}
        onClose={() => setIsNewThreadModalOpen(false)}
        title="Start a secure conversation"
        description="Create a private chat, team room, or broadcast surface with the same liquid glass system."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Private chat",
              body: "Fast, dense conversation with reactions, files, and voice notes.",
              accent: "cyan" as const
            },
            {
              title: "Team room",
              body: "Shared delivery, smooth history scroll, and structured media previews.",
              accent: "violet" as const
            },
            {
              title: "Broadcast",
              body: "Pinned updates and quiet reading mode with instant jump-back to replies.",
              accent: "emerald" as const
            }
          ].map((item) => (
            <GlassCard key={item.title} accent={item.accent} interactive className="p-4">
              <p className="font-display text-xl text-white">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-white/60">{item.body}</p>
            </GlassCard>
          ))}
        </div>
      </GlassModal>

      <GlassModal
        open={editingMessage !== null}
        onClose={() => {
          setEditingMessage(null);
          setEditingBody("");
        }}
        title="Edit message"
        description="Message edits fan out instantly while the server continues to store encrypted payloads only."
      >
        <label className="glass-input block rounded-[28px] p-4">
          <span className="sr-only">Edit message</span>
          <textarea
            value={editingBody}
            onChange={(event) => setEditingBody(event.target.value)}
            rows={5}
            className="w-full resize-none bg-transparent text-sm leading-7 text-white outline-none placeholder:text-white/32"
            placeholder="Update message body..."
          />
        </label>
        <div className="mt-4 flex flex-wrap justify-end gap-3">
          <GlassButton
            variant="ghost"
            onClick={() => {
              setEditingMessage(null);
              setEditingBody("");
            }}
          >
            Cancel
          </GlassButton>
          <GlassButton variant="primary" icon={<Sparkles className="h-4 w-4" />} onClick={submitEdit}>
            Save edit
          </GlassButton>
        </div>
      </GlassModal>
    </main>
  );
};
