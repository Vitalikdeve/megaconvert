import React, { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Archive,
  ArrowRight,
  Copy,
  FileText,
  Film,
  Link2,
  Music,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stamp,
  Video,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import ZenPortal from '../ZenPortal.jsx';
import GlassPanel from '../ui/GlassPanel.jsx';

const springTransition = {
  type: 'spring',
  stiffness: 180,
  damping: 18,
  mass: 0.9,
};

const normalizeMeetRoomId = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9_-]+/g, '-')
  .replace(/-{2,}/g, '-')
  .replace(/^[-_]+|[-_]+$/g, '')
  .slice(0, 64);

const createMeetRoomId = () => {
  const entropy = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);

  return normalizeMeetRoomId(`room-${entropy}`);
};

const MotionDiv = motion.div;
const MotionHeading = motion.h1;
const MotionParagraph = motion.p;

export default function HomeDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [meetRoomId, setMeetRoomId] = useState('');
  const toolCards = useMemo(() => [
    {
      id: 'ai',
      title: `✨ ${t('dashboardCardAiTitle')}`,
      eyebrow: t('dashboardCardAiEyebrow'),
      description: t('dashboardCardAiDescription'),
      to: {
        pathname: '/',
        hash: '#zen-portal',
      },
      icon: Sparkles,
      cta: t('dashboardCardAiCta'),
      className: 'lg:col-span-2',
      glow: 'radial-gradient(circle at top right, rgba(129,140,248,0.28), transparent 58%), radial-gradient(circle at bottom left, rgba(56,189,248,0.18), transparent 52%)',
    },
    {
      id: 'pdf',
      title: `📄 ${t('dashboardCardPdfTitle')}`,
      eyebrow: t('dashboardCardPdfEyebrow'),
      description: t('dashboardCardPdfDescription'),
      to: '/tools/pdf-editor',
      icon: FileText,
      cta: t('dashboardCardPdfCta'),
      className: 'md:col-span-2 lg:col-span-1 lg:row-span-2',
      glow: 'radial-gradient(circle at top left, rgba(255,255,255,0.18), transparent 42%), radial-gradient(circle at bottom right, rgba(99,102,241,0.18), transparent 54%)',
    },
    {
      id: 'ocr',
      title: `🔍 ${t('dashboardCardOcrTitle')}`,
      eyebrow: t('dashboardCardOcrEyebrow'),
      description: t('dashboardCardOcrDescription'),
      to: '/tools/smart-ocr',
      icon: Search,
      cta: t('dashboardCardOcrCta'),
      glow: 'radial-gradient(circle at top right, rgba(56,189,248,0.24), transparent 48%), radial-gradient(circle at bottom left, rgba(255,255,255,0.14), transparent 58%)',
    },
    {
      id: 'megadrop',
      title: `⚡ ${t('dashboardCardMegaDropTitle')}`,
      eyebrow: t('dashboardCardMegaDropEyebrow'),
      description: t('dashboardCardMegaDropDescription'),
      to: {
        pathname: '/',
        hash: '#zen-portal',
      },
      icon: Smartphone,
      cta: t('dashboardCardMegaDropCta'),
      glow: 'radial-gradient(circle at top left, rgba(96,165,250,0.22), transparent 44%), radial-gradient(circle at bottom right, rgba(129,140,248,0.18), transparent 58%)',
    },
    {
      id: 'audio-converter',
      title: `🎵 ${t('dashboardCardAudioTitle')}`,
      eyebrow: t('dashboardCardAudioEyebrow'),
      description: t('dashboardCardAudioDescription'),
      to: '/tools/audio-converter',
      icon: Music,
      cta: t('dashboardCardAudioCta'),
      glow: 'radial-gradient(circle at top right, rgba(250,204,21,0.18), transparent 42%), radial-gradient(circle at bottom left, rgba(255,255,255,0.14), transparent 56%)',
    },
    {
      id: 'video-to-gif',
      title: `🎞️ ${t('dashboardCardGifTitle')}`,
      eyebrow: t('dashboardCardGifEyebrow'),
      description: t('dashboardCardGifDescription'),
      to: '/tools/video-to-gif',
      icon: Film,
      cta: t('dashboardCardGifCta'),
      className: 'md:col-span-2 lg:col-span-2',
      glow: 'radial-gradient(circle at top left, rgba(244,114,182,0.18), transparent 40%), radial-gradient(circle at bottom right, rgba(56,189,248,0.18), transparent 56%)',
    },
    {
      id: 'archive-manager',
      title: `🗃️ ${t('dashboardCardArchiveTitle')}`,
      eyebrow: t('dashboardCardArchiveEyebrow'),
      description: t('dashboardCardArchiveDescription'),
      to: '/tools/archive-manager',
      icon: Archive,
      cta: t('dashboardCardArchiveCta'),
      glow: 'radial-gradient(circle at top right, rgba(148,163,184,0.2), transparent 42%), radial-gradient(circle at bottom left, rgba(255,255,255,0.12), transparent 56%)',
    },
    {
      id: 'batch-watermark',
      title: `🌊 ${t('dashboardCardWatermarkTitle')}`,
      eyebrow: t('dashboardCardWatermarkEyebrow'),
      description: t('dashboardCardWatermarkDescription'),
      to: '/tools/batch-watermark',
      icon: Stamp,
      cta: t('dashboardCardWatermarkCta'),
      className: 'md:col-span-2 lg:col-span-2',
      glow: 'radial-gradient(circle at top left, rgba(45,212,191,0.18), transparent 42%), radial-gradient(circle at bottom right, rgba(129,140,248,0.18), transparent 58%)',
    },
  ], [t]);

  const inviteLink = useMemo(() => {
    if (!meetRoomId) {
      return '';
    }

    const origin = typeof window === 'undefined'
      ? 'https://megaconvert-web.vercel.app'
      : window.location.origin;
    return `${origin}/meet/${meetRoomId}`;
  }, [meetRoomId]);

  const handleCreateMeetRoom = useCallback(() => {
    const nextRoomId = createMeetRoomId();
    setMeetRoomId(nextRoomId);
    navigate(`/meet/${nextRoomId}`);
  }, [navigate]);

  const handleJoinMeetRoom = useCallback(() => {
    if (!meetRoomId) {
      toast.error(t('meetLauncher.roomRequired', 'Enter a room name first.'));
      return;
    }

    navigate(`/meet/${meetRoomId}`);
  }, [meetRoomId, navigate, t]);

  const handleCopyInvite = useCallback(async () => {
    const nextRoomId = meetRoomId || createMeetRoomId();
    const origin = typeof window === 'undefined'
      ? 'https://megaconvert-web.vercel.app'
      : window.location.origin;
    const nextInviteLink = `${origin}/meet/${nextRoomId}`;

    if (!meetRoomId) {
      setMeetRoomId(nextRoomId);
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(nextInviteLink);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = nextInviteLink;
        textArea.setAttribute('readonly', 'true');
        textArea.style.position = 'absolute';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      toast.success(t('meetLauncher.copySuccess', 'Invite link copied.'));
    } catch {
      toast.error(t('meetLauncher.copyFailed', 'Unable to copy invite link.'));
    }
  }, [meetRoomId, t]);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[#030303] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(129,140,248,0.18),transparent_34%),radial-gradient(circle_at_82%_24%,rgba(56,189,248,0.14),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)]" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <section className="flex flex-col items-center text-center">
          <MotionDiv
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[11px] uppercase tracking-[0.32em] text-white/48"
          >
            {t('dashboardEyebrow')}
          </MotionDiv>

          <MotionHeading
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.52, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 max-w-5xl bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,255,255,0.62))] bg-clip-text text-5xl font-semibold tracking-[-0.04em] text-transparent sm:text-6xl lg:text-7xl"
          >
            {t('dashboardTitle')}
          </MotionHeading>

          <MotionParagraph
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.48, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 max-w-3xl text-lg leading-8 text-white/50"
          >
            {t('dashboardSubtitle')}
          </MotionParagraph>
        </section>

        <section
          id="zen-portal"
          className="scroll-mt-24"
        >
          <MotionDiv
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.54, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="flex w-full flex-col items-center gap-5"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-white/42">
              {t('dashboardPortalBadge')}
            </div>

            <ZenPortal variant="embedded" />
          </MotionDiv>
        </section>

        <section
          id="meet-launcher"
          className="scroll-mt-24"
        >
          <GlassPanel
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden px-6 py-6 sm:px-8 sm:py-8"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background: 'radial-gradient(circle at 16% 18%, rgba(34,197,94,0.14), transparent 24%), radial-gradient(circle at 84% 22%, rgba(56,189,248,0.16), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0))',
              }}
            />

            <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.15fr),minmax(360px,0.85fr)] lg:items-end">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/16 bg-emerald-400/10 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-emerald-100/80">
                  <ShieldCheck className="h-4 w-4" strokeWidth={1.8} />
                  {t('meetLauncher.eyebrow', 'MegaMeet live rooms')}
                </div>

                <h2 className="mt-5 max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                  {t('meetLauncher.title', 'Start a secure room without typing URLs by hand.')}
                </h2>

                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/58 sm:text-base">
                  {t('meetLauncher.subtitle', 'Create a room, copy the invite link, and send the same link to anyone you want inside the encrypted video chat.')}
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  {[
                    t('meetLauncher.featureVideo', 'Video + voice'),
                    t('meetLauncher.featureChat', 'Secure sidebar chat'),
                    t('meetLauncher.featureInvite', 'Share one room link'),
                  ].map((feature) => (
                    <span
                      key={feature}
                      className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/68"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] border border-white/[0.08] bg-black/24 p-4 shadow-[0_24px_90px_-52px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:p-5">
                <div className="text-[11px] uppercase tracking-[0.3em] text-white/34">
                  {t('meetLauncher.formEyebrow', 'Room launcher')}
                </div>

                <label className="mt-4 block">
                  <div className="mb-2 text-sm font-medium text-white/74">
                    {t('meetLauncher.roomLabel', 'Room name or code')}
                  </div>
                  <div className="flex items-center gap-3 rounded-[22px] border border-white/[0.08] bg-white/[0.04] px-4 py-3">
                    <Link2 className="h-4 w-4 shrink-0 text-white/36" strokeWidth={1.8} />
                    <input
                      type="text"
                      value={meetRoomId}
                      onChange={(event) => setMeetRoomId(normalizeMeetRoomId(event.target.value))}
                      placeholder={t('meetLauncher.placeholder', 'team-sync or client-review')}
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/26"
                    />
                  </div>
                </label>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleCreateMeetRoom}
                    className="inline-flex items-center justify-center gap-2 rounded-[20px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(226,232,240,0.94))] px-4 py-3 text-sm font-semibold text-slate-950 transition-transform duration-300 hover:-translate-y-0.5"
                  >
                    <Video className="h-4 w-4" strokeWidth={1.9} />
                    {t('meetLauncher.createAction', 'Create room')}
                  </button>

                  <button
                    type="button"
                    onClick={handleJoinMeetRoom}
                    className="inline-flex items-center justify-center gap-2 rounded-[20px] border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition-colors duration-300 hover:bg-white/[0.08]"
                  >
                    <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
                    {t('meetLauncher.joinAction', 'Join room')}
                  </button>
                </div>

                <div className="mt-4 rounded-[22px] border border-white/[0.08] bg-white/[0.03] p-4">
                  <div className="text-[11px] uppercase tracking-[0.26em] text-white/34">
                    {t('meetLauncher.inviteLabel', 'Invite link')}
                  </div>

                  <div className="mt-3 break-all text-sm leading-7 text-white/62">
                    {inviteLink || t('meetLauncher.inviteHint', 'Choose a room name to preview a shareable link, or copy one instantly.')}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      void handleCopyInvite();
                    }}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/78 transition-colors duration-300 hover:bg-white/[0.08] hover:text-white"
                  >
                    <Copy className="h-4 w-4" strokeWidth={1.8} />
                    {t('meetLauncher.copyAction', 'Copy invite link')}
                  </button>
                </div>
              </div>
            </div>
          </GlassPanel>
        </section>

        <section className="space-y-5 pb-8">
          <div className="flex flex-col gap-2 text-left sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.32em] text-white/34">
                {t('dashboardSectionEyebrow')}
              </div>
              <h2 className="mt-2 text-2xl font-medium tracking-tight text-white/88">
                {t('dashboardSectionTitle')}
              </h2>
            </div>

            <p className="max-w-2xl text-sm leading-7 text-white/42">
              {t('dashboardSectionSubtitle')}
            </p>
          </div>

          <div className="grid auto-rows-[minmax(220px,1fr)] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {toolCards.map((card, index) => {
              const Icon = card.icon;

              return (
                <GlassPanel
                  key={card.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    ...springTransition,
                    delay: 0.22 + index * 0.05,
                  }}
                  whileHover={{
                    y: -6,
                    scale: 1.01,
                    boxShadow: '0 26px 90px -38px rgba(129, 140, 248, 0.72)',
                  }}
                  className={['group relative overflow-hidden', card.className || ''].join(' ')}
                >
                  <Link
                    to={card.to}
                    className="relative flex h-full flex-col justify-between gap-8 px-6 py-6 sm:px-7"
                  >
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 opacity-80 transition-opacity duration-500 group-hover:opacity-100"
                      style={{ background: card.glow }}
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                      style={{
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0))',
                      }}
                    />

                    <div className="relative flex items-start justify-between gap-4">
                      <div className="inline-flex rounded-full border border-white/[0.08] bg-black/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-white/44">
                        {card.eyebrow}
                      </div>

                      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/78 shadow-[inset_0_0_30px_rgba(255,255,255,0.04)]">
                        <Icon className="h-5 w-5" strokeWidth={1.8} />
                      </div>
                    </div>

                    <div className="relative space-y-4">
                      <h3 className="max-w-xl text-2xl font-medium tracking-tight text-white/90">
                        {card.title}
                      </h3>
                      <p className="max-w-xl text-sm leading-7 text-white/52">
                        {card.description}
                      </p>
                    </div>

                    <div className="relative inline-flex items-center gap-2 text-sm font-medium text-white/68 transition-colors duration-300 group-hover:text-white">
                      {card.cta}
                      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                    </div>
                  </Link>
                </GlassPanel>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
