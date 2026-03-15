import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Camera,
  CameraOff,
  LockKeyhole,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  SendHorizontal,
  ShieldCheck,
  VideoOff,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import useWebRTC from '../../hooks/useWebRTC.js';
import MegaMeetLobby from './MegaMeetLobby.jsx';

const MotionAside = motion.aside;
const PARTICIPANT_ACCENTS = [
  'from-sky-500/26 via-indigo-400/14 to-transparent',
  'from-emerald-400/22 via-cyan-400/10 to-transparent',
  'from-amber-300/24 via-orange-400/10 to-transparent',
  'from-fuchsia-400/24 via-pink-400/10 to-transparent',
  'from-violet-400/24 via-indigo-400/10 to-transparent',
];

function ControlButton({
  active = false,
  danger = false,
  icon,
  label,
  onClick,
}) {
  const Icon = icon;

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={[
        'inline-flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 snap-center items-center justify-center rounded-2xl border transition-all duration-300',
        danger
          ? 'border-red-400/28 bg-red-500 text-white shadow-[0_18px_40px_-22px_rgba(239,68,68,0.7)] hover:bg-red-400'
          : active
            ? 'border-sky-400/28 bg-sky-400/16 text-sky-100 shadow-[0_18px_40px_-22px_rgba(56,189,248,0.55)]'
            : 'border-white/[0.08] bg-white/[0.04] text-white/74 hover:border-white/[0.12] hover:bg-white/[0.08] hover:text-white',
      ].join(' ')}
    >
      <Icon className="h-5 w-5" strokeWidth={1.9} />
    </button>
  );
}

function VideoTile({ participant, t }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) {
      return;
    }

    if (element.srcObject !== participant.stream) {
      element.srcObject = participant.stream || null;
    }
  }, [participant.stream]);

  return (
    <article className="group relative min-h-[220px] overflow-hidden rounded-[30px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(15,15,18,0.96),rgba(7,7,10,0.98))] shadow-[0_24px_80px_-42px_rgba(0,0,0,0.96)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(255,255,255,0.06),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))]" />
      <div className={`absolute inset-0 bg-gradient-to-br ${participant.accent}`} />

      {participant.stream && participant.cameraOn ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.isLocal}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}

      <div className="relative flex h-full flex-col justify-between p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.05] text-lg font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            {participant.name.charAt(0).toUpperCase()}
          </div>

          <div className="rounded-full border border-white/[0.08] bg-black/24 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-white/46">
            {participant.isLocal ? t('megaMeet.youLabel', 'You') : t('megaMeet.participantLive', 'Live')}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center">
          {participant.stream && participant.cameraOn ? null : (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="rounded-full border border-white/[0.08] bg-white/[0.05] p-5">
                <VideoOff className="h-8 w-8 text-white/72" strokeWidth={1.7} />
              </div>
              <div className="text-sm text-white/56">
                {t('megaMeet.cameraOffState', 'Camera off')}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="truncate text-sm font-medium text-white">
            {participant.name}
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-black/24 px-3 py-1.5 text-xs text-white/56">
            {participant.muted ? <MicOff className="h-3.5 w-3.5" strokeWidth={2} /> : <Mic className="h-3.5 w-3.5" strokeWidth={2} />}
            {participant.muted ? t('megaMeet.participantMuted', 'Muted') : t('megaMeet.participantSpeaking', 'Audio on')}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function MegaMeetRoom() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { roomId = 'demo-room' } = useParams();
  const [joined, setJoined] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [chatOpen, setChatOpen] = useState(true);
  const [messageInput, setMessageInput] = useState('');

  const localParticipantName = displayName.trim() || t('megaMeet.guestFallback', 'Guest');
  const {
    localStream,
    peers,
    messages,
    audioEnabled,
    videoEnabled,
    screenSharing,
    toggleAudio,
    toggleVideo,
    shareScreen,
    sendSecureMessage,
    leaveRoom,
  } = useWebRTC({
    roomId,
    displayName: localParticipantName,
    enabled: joined,
  });

  const participants = useMemo(() => {
    const localParticipant = {
      id: 'self',
      name: localParticipantName,
      muted: !audioEnabled,
      cameraOn: videoEnabled,
      stream: localStream,
      isLocal: true,
      accent: PARTICIPANT_ACCENTS[0],
    };

    const remoteParticipants = peers.map((peer, index) => ({
      id: peer.socketId,
      name: peer.displayName || t('megaMeet.guestFallback', 'Guest'),
      muted: peer.audioEnabled === false,
      cameraOn: peer.videoEnabled !== false,
      stream: peer.stream || null,
      isLocal: false,
      accent: PARTICIPANT_ACCENTS[(index + 1) % PARTICIPANT_ACCENTS.length],
    }));

    return [localParticipant, ...remoteParticipants];
  }, [audioEnabled, localParticipantName, localStream, peers, t, videoEnabled]);

  const handleSendMessage = () => {
    const sent = sendSecureMessage(messageInput);
    if (!sent) {
      return;
    }

    setMessageInput('');
  };

  if (!joined) {
    return (
      <MegaMeetLobby
        roomId={roomId}
        displayName={displayName}
        onDisplayNameChange={setDisplayName}
        onJoin={() => setJoined(true)}
      />
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0A0A0B] text-white">
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 12% 14%, rgba(34,197,94,0.1), transparent 20%), radial-gradient(circle at 84% 14%, rgba(56,189,248,0.12), transparent 24%), radial-gradient(circle at 50% 100%, rgba(168,85,247,0.08), transparent 26%)',
          }}
        />

        <header className="relative z-[1] flex items-center justify-between gap-4 px-6 pt-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/16 bg-emerald-400/10 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-emerald-100/80">
              <ShieldCheck className="h-4 w-4" strokeWidth={1.9} />
              {t('megaMeet.roomBadge', 'Encrypted workspace')}
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
              {t('megaMeet.roomTitle', 'Room {{roomId}}', { roomId })}
            </h1>
            <p className="mt-2 text-sm text-white/54">
              {t('megaMeet.roomParticipants', '{{count}} participants live', { count: participants.length })}
            </p>
          </div>

          <div className="hidden items-center gap-3 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm text-white/66 backdrop-blur-xl lg:flex">
            <LockKeyhole className="h-4 w-4" strokeWidth={1.8} />
            {t('megaMeet.chatSecurityHint', 'End-to-end encrypted channel')}
          </div>
        </header>

        <div className="relative z-[1] flex-1 overflow-hidden px-3 pb-28 pt-4 sm:px-6 sm:pt-6">
          <div
          className="flex h-full flex-col gap-3 sm:gap-4"
          >
            <div
              className="grid flex-1 grid-cols-1 gap-3 sm:gap-4"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}
            >
              {participants.map((participant) => (
                <VideoTile
                  key={participant.id}
                  participant={participant}
                  t={t}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[2] flex justify-center px-3 sm:bottom-6 sm:px-6">
          <div className="pointer-events-auto inline-flex max-w-full items-center gap-2 overflow-x-auto rounded-[24px] border border-white/[0.08] bg-[#0f1014]/88 px-3 py-2 shadow-[0_30px_90px_-48px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:gap-3 sm:rounded-[28px] sm:px-4 sm:py-3 snap-x">
            <ControlButton
              icon={audioEnabled ? Mic : MicOff}
              active={!audioEnabled}
              label={audioEnabled ? t('megaMeet.controlMute', 'Mute') : t('megaMeet.controlUnmute', 'Unmute')}
              onClick={toggleAudio}
            />
            <ControlButton
              icon={videoEnabled ? Camera : CameraOff}
              active={!videoEnabled}
              label={videoEnabled ? t('megaMeet.controlCameraOff', 'Turn Camera Off') : t('megaMeet.controlCameraOn', 'Turn Camera On')}
              onClick={toggleVideo}
            />
            <ControlButton
              icon={MonitorUp}
              active={screenSharing}
              label={screenSharing ? t('megaMeet.controlStopSharing', 'Stop Sharing') : t('megaMeet.controlShareScreen', 'Share Screen')}
              onClick={() => {
                void shareScreen();
              }}
            />
            <ControlButton
              icon={MessageSquare}
              active={chatOpen}
              label={chatOpen ? t('megaMeet.controlHideChat', 'Hide Chat') : t('megaMeet.controlShowChat', 'Show Chat')}
              onClick={() => setChatOpen((current) => !current)}
            />
            <ControlButton
              icon={PhoneOff}
              danger
              label={t('megaMeet.controlEndCall', 'End Call')}
              onClick={() => {
                leaveRoom();
                navigate('/');
              }}
            />
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {chatOpen ? (
          <MotionAside
            initial={{ x: 32, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 32, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex h-full w-[320px] shrink-0 flex-col border-l border-white/[0.08] bg-[linear-gradient(180deg,rgba(14,14,18,0.96),rgba(10,10,12,0.98))] p-4 shadow-[-24px_0_90px_-54px_rgba(0,0,0,0.96)] backdrop-blur-2xl"
          >
            <div className="rounded-[26px] border border-white/[0.08] bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3">
                  <LockKeyhole className="h-5 w-5 text-white/80" strokeWidth={1.8} />
                </div>
                <div>
                  <div className="text-base font-semibold text-white">
                    {t('megaMeet.secureChatTitle', 'Secure Chat (E2EE)')}
                  </div>
                  <div className="text-xs uppercase tracking-[0.24em] text-white/34">
                    {t('megaMeet.chatSidebarHint', 'Messages stay inside this room')}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
              {messages.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-white/[0.08] bg-white/[0.03] px-4 py-4 text-sm text-white/46">
                  {t('megaMeet.chatSidebarHint', 'Messages stay inside this room')}
                </div>
              ) : null}

              {messages.map((message) => {
                const isOwn = message.side === 'right';

                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={[
                        'max-w-[88%] rounded-[24px] border px-4 py-3 text-sm leading-6 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.9)]',
                        isOwn
                          ? 'border-sky-400/18 bg-sky-400/12 text-white'
                          : 'border-white/[0.08] bg-white/[0.04] text-white/82',
                      ].join(' ')}
                    >
                      <div className="mb-1 text-[10px] uppercase tracking-[0.22em] text-white/38">
                        {message.author}
                      </div>
                      <div>{message.text}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <form
              className="mt-4 flex items-center gap-3 rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-3"
              onSubmit={(event) => {
                event.preventDefault();
                handleSendMessage();
              }}
            >
              <input
                type="text"
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
                placeholder={t('megaMeet.messagePlaceholder', 'Type a message...')}
                className="flex-1 bg-transparent px-2 text-sm text-white outline-none placeholder:text-white/30"
              />
              <button
                type="submit"
                aria-label={t('megaMeet.sendMessage', 'Send')}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.06] text-white transition-colors duration-300 hover:bg-white/[0.12]"
              >
                <SendHorizontal className="h-[18px] w-[18px]" strokeWidth={2} />
              </button>
            </form>
          </MotionAside>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
