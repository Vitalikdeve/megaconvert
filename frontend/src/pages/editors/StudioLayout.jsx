import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Image,
  Music,
  Sparkles,
  Video,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import MegaPhoto from './MegaPhoto.jsx';
import StudioWelcome from './StudioWelcome.jsx';

const MotionButton = motion.button;
const MotionDiv = motion.div;

function StudioWorkspacePlaceholder({ editor, onBack, t }) {
  const Icon = editor.icon;

  const moduleCards = [
    {
      title: t('studio.assetsTitle', 'Assets'),
      lines: [
        t('studio.assetsRaw', 'RAW imports'),
        t('studio.assetsLibrary', 'Shared library'),
        t('studio.assetsReferences', 'Linked references'),
      ],
    },
    {
      title: t('studio.timelineTitle', 'Timeline'),
      lines: [
        t('studio.timelineClips', 'Clips / layers / tracks'),
        t('studio.timelineAssist', 'Live AI assists'),
        t('studio.timelinePreview', 'Real-time previews'),
      ],
    },
    {
      title: t('studio.inspectorTitle', 'Inspector'),
      lines: [
        t('studio.inspectorProperties', 'Properties'),
        t('studio.inspectorFx', 'FX stacks'),
        t('studio.inspectorPrompts', 'Prompt controls'),
      ],
    },
  ];

  return (
    <AnimatePresence mode="wait">
      <MotionDiv
        key={editor.id}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
        className="grid h-full min-h-0 gap-4 xl:grid-cols-[280px,minmax(0,1fr),320px]"
      >
        <section className="overflow-hidden rounded-[30px] border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-xl">
          <div className="text-[11px] uppercase tracking-[0.3em] text-white/34">
            {t('studio.placeholderEyebrow', 'Studio surface')}
          </div>
          <div className="mt-5 space-y-3">
            {moduleCards[0].lines.map((line, index) => (
              <div
                key={line}
                className="rounded-[22px] border border-white/[0.06] bg-black/20 px-4 py-4"
              >
                <div className="text-xs uppercase tracking-[0.24em] text-white/28">
                  {moduleCards[0].title} {index + 1}
                </div>
                <div className="mt-2 text-sm text-white/72">{line}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[34px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(13,13,16,0.98),rgba(8,8,11,0.96))] p-6 shadow-[0_30px_120px_-60px_rgba(0,0,0,0.88)]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-100"
            style={{ background: editor.backgroundGlow }}
          />

          <div className="relative flex h-full flex-col">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-[11px] uppercase tracking-[0.3em] text-white/34">
                  {t('studio.placeholderEyebrow', 'Studio surface')}
                </div>
                <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white">
                  {t('studio.placeholderTitle', '{{name}} workspace', { name: editor.title })}
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-white/60">
                  {t('studio.placeholderBody', 'Timelines, inspector panels, asset browsers, and AI copilots will dock here next.')}
                </p>
              </div>

              <div className="inline-flex rounded-[28px] border border-white/[0.08] bg-black/25 p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                <Icon className="h-8 w-8" strokeWidth={1.7} />
              </div>
            </div>

            <div className="mt-8 grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr),260px]">
              <div className="rounded-[28px] border border-white/[0.08] bg-black/26 p-5">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div className="text-sm font-medium text-white/76">{moduleCards[1].title}</div>
                  <div className="rounded-full border border-emerald-300/18 bg-emerald-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-emerald-100/70">
                    {t('studio.placeholderStatus', 'UI shell active')}
                  </div>
                </div>
                <div className="grid h-[300px] gap-3 rounded-[24px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-4">
                  <div className="grid grid-cols-3 gap-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div
                        key={`preview-${index + 1}`}
                        className="rounded-[18px] border border-white/[0.06] bg-white/[0.03]"
                      />
                    ))}
                  </div>
                  <div className="grid flex-1 gap-3 rounded-[22px] border border-white/[0.06] bg-black/24 p-4">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div
                        key={`track-${index + 1}`}
                        className="flex items-center gap-3"
                      >
                        <div className="h-8 w-20 rounded-full border border-white/[0.06] bg-white/[0.04]" />
                        <div className="h-8 flex-1 rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/[0.08] bg-black/22 p-5">
                <div className="text-sm font-medium text-white/76">{moduleCards[2].title}</div>
                <div className="mt-4 space-y-3">
                  {moduleCards[2].lines.map((line) => (
                    <div
                      key={line}
                      className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] px-4 py-4"
                    >
                      <div className="text-xs uppercase tracking-[0.22em] text-white/28">
                        {t('studio.panelLabel', 'Panel')}
                      </div>
                      <div className="mt-2 text-sm text-white/72">{line}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <MotionButton
                type="button"
                onClick={onBack}
                whileHover={{ x: -2 }}
                className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/72 transition-colors duration-300 hover:bg-white/[0.08] hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.9} />
                {t('studio.placeholderAction', 'Back to all studios')}
              </MotionButton>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[30px] border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-xl">
          <div className="text-[11px] uppercase tracking-[0.3em] text-white/34">
            {t('studio.copilotTitle', 'Copilot')}
          </div>
          <div className="mt-5 space-y-3">
            {[
              t('studio.copilotLayout', 'Smart layout'),
              t('studio.copilotCleanup', 'AI cleanup'),
              t('studio.copilotGenerative', 'Generative fills'),
            ].map((line, index) => (
              <div
                key={line}
                className="rounded-[22px] border border-white/[0.06] bg-black/20 px-4 py-4"
              >
                <div className="text-xs uppercase tracking-[0.24em] text-white/28">
                  {t('studio.assistLabel', 'Assist')} {index + 1}
                </div>
                <div className="mt-2 text-sm text-white/72">{line}</div>
              </div>
            ))}
          </div>
        </section>
      </MotionDiv>
    </AnimatePresence>
  );
}

export default function StudioLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const editors = useMemo(() => ([
    {
      id: 'video',
      title: t('studio.videoName', 'MegaCut Pro'),
      description: t('studio.videoDescription', 'Advanced multi-track video editor with AI auto-captions and effects.'),
      icon: Video,
      badge: t('studio.badgeVideo', 'Video'),
      borderGradient: 'linear-gradient(145deg, rgba(96,165,250,0.6), rgba(56,189,248,0.18), rgba(129,140,248,0.36))',
      backgroundGlow: 'radial-gradient(circle at 18% 18%, rgba(56,189,248,0.22), transparent 26%), radial-gradient(circle at 80% 18%, rgba(96,165,250,0.16), transparent 24%), linear-gradient(180deg, rgba(11,14,20,0.94), rgba(8,8,11,0.96))',
      spotlight: 'rgba(56,189,248,0.2)',
      hoverShadow: '0 34px 100px -48px rgba(56,189,248,0.55)',
      route: '',
    },
    {
      id: 'photo',
      title: t('studio.photoName', 'MegaPhoto Studio'),
      description: t('studio.photoDescription', 'Professional layer-based image manipulation and retouching.'),
      icon: Image,
      badge: t('studio.badgePhoto', 'Photo'),
      borderGradient: 'linear-gradient(145deg, rgba(251,191,36,0.46), rgba(245,158,11,0.2), rgba(249,115,22,0.36))',
      backgroundGlow: 'radial-gradient(circle at 20% 20%, rgba(251,191,36,0.18), transparent 24%), radial-gradient(circle at 76% 18%, rgba(249,115,22,0.15), transparent 22%), linear-gradient(180deg, rgba(13,12,10,0.94), rgba(8,8,11,0.96))',
      spotlight: 'rgba(251,191,36,0.18)',
      hoverShadow: '0 34px 100px -48px rgba(251,191,36,0.48)',
      route: '/editors/photo',
    },
    {
      id: 'audio',
      title: t('studio.audioName', 'MegaBeat DAW'),
      description: t('studio.audioDescription', 'High-fidelity audio mixing, trimming, and mastering.'),
      icon: Music,
      badge: t('studio.badgeAudio', 'Audio'),
      borderGradient: 'linear-gradient(145deg, rgba(34,197,94,0.48), rgba(16,185,129,0.18), rgba(45,212,191,0.34))',
      backgroundGlow: 'radial-gradient(circle at 22% 22%, rgba(34,197,94,0.18), transparent 25%), radial-gradient(circle at 84% 16%, rgba(45,212,191,0.14), transparent 22%), linear-gradient(180deg, rgba(10,14,12,0.94), rgba(8,8,11,0.96))',
      spotlight: 'rgba(34,197,94,0.18)',
      hoverShadow: '0 34px 100px -48px rgba(34,197,94,0.45)',
      route: '',
    },
    {
      id: 'ai',
      title: t('studio.aiName', 'MegaGen AI'),
      description: t('studio.aiDescription', 'Transform text into hyper-realistic images using next-gen models.'),
      icon: Sparkles,
      badge: t('studio.badgeAi', 'AI Art'),
      borderGradient: 'linear-gradient(145deg, rgba(217,70,239,0.5), rgba(129,140,248,0.18), rgba(236,72,153,0.34))',
      backgroundGlow: 'radial-gradient(circle at 18% 20%, rgba(217,70,239,0.2), transparent 26%), radial-gradient(circle at 82% 16%, rgba(129,140,248,0.16), transparent 22%), linear-gradient(180deg, rgba(14,10,18,0.94), rgba(8,8,11,0.96))',
      spotlight: 'rgba(217,70,239,0.18)',
      hoverShadow: '0 34px 100px -48px rgba(217,70,239,0.46)',
      route: '',
    },
  ]), [t]);

  const locationStateEditorId = String(location.state?.studioEditor || '').trim();
  const routeEditorId = location.pathname === '/editors/photo' ? 'photo' : locationStateEditorId;
  const activeEditor = editors.find((editor) => editor.id === routeEditorId) || null;

  const handleSelectEditor = (editorId) => {
    if (!editorId) {
      navigate('/editors');
      return;
    }

    const editor = editors.find((item) => item.id === editorId);
    if (!editor) {
      return;
    }

    if (editor.route) {
      navigate(editor.route);
      return;
    }

    navigate('/editors', {
      state: { studioEditor: editor.id },
    });
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#0A0A0B] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 14% 18%, rgba(56,189,248,0.12), transparent 24%), radial-gradient(circle at 82% 16%, rgba(168,85,247,0.12), transparent 24%), radial-gradient(circle at 50% 100%, rgba(34,197,94,0.08), transparent 28%)',
        }}
      />

      <div className="relative flex h-full w-full">
        <aside className="flex h-full w-[84px] shrink-0 flex-col items-center justify-between border-r border-white/[0.06] bg-white/[0.03] px-3 py-4 backdrop-blur-3xl">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] text-sm font-semibold tracking-[0.18em] text-white/88 shadow-[0_18px_44px_-28px_rgba(56,189,248,0.5)]">
              MS
            </div>

            <div className="h-px w-10 bg-white/[0.08]" />

            <nav className="flex flex-col gap-3">
              {editors.map((editor) => {
                const Icon = editor.icon;
                const isActive = editor.id === activeEditor?.id;

                return (
                  <MotionButton
                    key={editor.id}
                    type="button"
                    onClick={() => handleSelectEditor(editor.id)}
                    whileHover={{ y: -2, scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    title={editor.title}
                    aria-label={editor.title}
                    className={[
                      'group relative flex h-14 w-14 items-center justify-center rounded-[22px] border transition-all duration-300',
                      isActive
                        ? 'border-white/[0.12] bg-white/[0.10] text-white shadow-[0_18px_54px_-28px_rgba(255,255,255,0.22)]'
                        : 'border-white/[0.06] bg-black/18 text-white/44 hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white/86',
                    ].join(' ')}
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-[22px] opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100"
                      style={{ background: editor.spotlight }}
                    />
                    <Icon className="relative h-5 w-5" strokeWidth={1.9} />
                  </MotionButton>
                );
              })}
            </nav>
          </div>

          <div className="rotate-180 text-[11px] uppercase tracking-[0.3em] text-white/22 [writing-mode:vertical-rl]">
            {t('studio.brand', 'Mega Studio')}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col p-3">
          <div className="flex h-[76px] shrink-0 items-center justify-between gap-4 rounded-[28px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.28em] text-white/28">
                  {t('studio.brand', 'Mega Studio')}
                </div>
                <div className="mt-1 text-sm font-medium text-white/76">
                  {activeEditor ? activeEditor.title : t('headerEditors', 'Editors')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {[
                t('studio.shellStatusPreview', 'Realtime preview'),
                t('studio.shellStatusGpu', 'GPU-ready shell'),
                t('studio.shellStatusAiDock', 'AI dock'),
              ].map((item) => (
                <div
                  key={item}
                  className="hidden rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-white/34 lg:block"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 pt-3">
            {activeEditor?.id === 'photo' ? (
              <MegaPhoto />
            ) : activeEditor ? (
              <StudioWorkspacePlaceholder
                editor={activeEditor}
                onBack={() => handleSelectEditor('')}
                t={t}
              />
            ) : (
              <StudioWelcome
                editors={editors}
                onSelect={handleSelectEditor}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
