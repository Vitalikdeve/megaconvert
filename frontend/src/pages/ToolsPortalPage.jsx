import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, FileUp, RefreshCcw, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import GlassPanel from '../components/ui/GlassPanel.jsx';
import {
  BUSINESS_WORKFLOW_CATALOG,
  TOOLS_PORTAL_HANDOFF_KEY,
  detectToolsPortalFileGroup,
  detectToolsPortalFileKind,
  formatToolsPortalBytes,
  isWorkflowRecommendedForGroup,
} from '../lib/businessWorkflowCatalog.js';
import { writeTempMemory } from '../lib/osMemory.js';

const MotionGlassPanel = motion.create(GlassPanel);

const backgroundOrbs = [
  {
    className: 'left-[-6rem] top-[12%] h-[18rem] w-[18rem] bg-cyan-500/18',
    animate: { x: [0, 42, -18, 0], y: [0, -30, 24, 0], scale: [1, 1.14, 0.94, 1] },
    transition: { duration: 18, repeat: Infinity, ease: 'easeInOut' },
  },
  {
    className: 'right-[-8rem] top-[8%] h-[22rem] w-[22rem] bg-fuchsia-500/14',
    animate: { x: [0, -28, 20, 0], y: [0, 34, -18, 0], scale: [1, 0.92, 1.12, 1] },
    transition: { duration: 22, repeat: Infinity, ease: 'easeInOut' },
  },
  {
    className: 'bottom-[-7rem] left-1/2 h-[24rem] w-[24rem] -translate-x-1/2 bg-indigo-400/14',
    animate: { x: [0, 26, -24, 0], y: [0, -18, 22, 0], scale: [1, 1.12, 0.9, 1] },
    transition: { duration: 24, repeat: Infinity, ease: 'easeInOut' },
  },
];

const stageVariants = {
  hidden: { opacity: 0, y: 26 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
  },
  exit: { opacity: 0, y: -18, transition: { duration: 0.24 } },
};

const gridVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.05,
      staggerChildren: 0.08,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] },
  },
};

function getDetectedTypeLabelKey(fileKind) {
  switch (fileKind) {
    case 'document':
      return 'toolsPortal.types.document';
    case 'image':
      return 'toolsPortal.types.image';
    case 'video':
      return 'toolsPortal.types.video';
    case 'audio':
      return 'toolsPortal.types.audio';
    case 'media':
      return 'toolsPortal.types.media';
    default:
      return 'toolsPortal.types.file';
  }
}

export default function ToolsPortalPage() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const { t, i18n } = useTranslation();
  const [activeFile, setActiveFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const detectedKind = useMemo(
    () => detectToolsPortalFileKind(activeFile),
    [activeFile],
  );
  const detectedGroup = useMemo(
    () => detectToolsPortalFileGroup(activeFile),
    [activeFile],
  );
  const detectedTypeLabel = t(getDetectedTypeLabelKey(detectedKind));
  const formattedSize = formatToolsPortalBytes(activeFile?.size || 0, i18n.language);

  const fileSummary = useMemo(() => {
    if (detectedGroup === 'document') {
      return t('toolsPortal.fileMeta.documentSummary');
    }

    if (detectedGroup === 'media') {
      return t('toolsPortal.fileMeta.mediaSummary');
    }

    return t('toolsPortal.fileMeta.genericSummary');
  }, [detectedGroup, t]);

  const workflows = useMemo(
    () => BUSINESS_WORKFLOW_CATALOG
      .map((workflow) => ({
        ...workflow,
        isRecommended: isWorkflowRecommendedForGroup(workflow, detectedGroup),
      }))
      .sort((left, right) => Number(right.isRecommended) - Number(left.isRecommended)),
    [detectedGroup],
  );

  const handleFileSelection = (file) => {
    if (!file) {
      return;
    }

    setActiveFile(file);
    setDragActive(false);
  };

  const handleWorkflowOpen = (workflow) => {
    if (!activeFile || !workflow) {
      return;
    }

    writeTempMemory(TOOLS_PORTAL_HANDOFF_KEY, {
      file: activeFile,
      name: activeFile.name,
      size: activeFile.size,
      kind: detectedKind,
      group: detectedGroup,
      route: workflow.route,
    });

    navigate(workflow.route, {
      state: {
        handoffKey: TOOLS_PORTAL_HANDOFF_KEY,
        fileName: activeFile.name,
        size: activeFile.size,
        kind: detectedKind,
        group: detectedGroup,
      },
    });
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[#020202] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {backgroundOrbs.map((orb) => (
          <motion.div
            key={orb.className}
            className={`absolute rounded-full blur-[100px] ${orb.className}`}
            animate={orb.animate}
            transition={orb.transition}
          />
        ))}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(2,2,2,0)_24%,rgba(2,2,2,0.96)_100%)]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-8">
        <motion.div
          variants={stageVariants}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-3xl text-center"
        >
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-white/44">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
            {t('toolsPortal.eyebrow')}
          </div>
          <h1 className="mt-6 text-4xl font-medium tracking-[-0.04em] text-white/94 sm:text-5xl lg:text-6xl">
            {t('toolsPortal.title')}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/56 sm:text-lg">
            {t('toolsPortal.description')}
          </p>
        </motion.div>

        {!activeFile ? (
          <motion.div
            key="dropzone"
            variants={stageVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="mx-auto w-full max-w-4xl"
          >
            <MotionGlassPanel
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setDragActive(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragActive(false);
                handleFileSelection(event.dataTransfer.files?.[0] || null);
              }}
              className={[
                'group relative flex min-h-[420px] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[44px] border border-white/10 bg-white/[0.02] px-8 py-14 text-center backdrop-blur-3xl',
                'transition-transform duration-500 hover:shadow-[0_28px_120px_-48px_rgba(111,226,255,0.42)]',
                dragActive ? 'border-cyan-300/40 shadow-[0_0_0_1px_rgba(125,211,252,0.3),0_30px_140px_-52px_rgba(56,189,248,0.38)]' : '',
              ].join(' ')}
              onClick={() => inputRef.current?.click()}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.1),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.16),transparent_38%)] opacity-90" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.04] shadow-[inset_0_0_40px_rgba(255,255,255,0.06)]">
                <FileUp className="h-9 w-9 text-white/82" strokeWidth={1.8} />
              </div>

              <div className="relative mt-8 space-y-4">
                <div className="mx-auto inline-flex rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-white/44">
                  {t('toolsPortal.dropzone.badge')}
                </div>
                <h2 className="max-w-3xl text-3xl font-medium tracking-tight text-white/94 sm:text-4xl">
                  {t('toolsPortal.dropzone.title')}
                </h2>
                <p className="mx-auto max-w-2xl text-sm leading-7 text-white/58 sm:text-base">
                  {t('toolsPortal.dropzone.description')}
                </p>
              </div>

              <div className="relative mt-8 flex flex-col items-center gap-4">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-all duration-300 hover:scale-[1.02] hover:bg-white/90"
                >
                  {t('toolsPortal.dropzone.button')}
                </button>
                <p className="text-sm text-white/42">
                  {t('toolsPortal.dropzone.hint')}
                </p>
              </div>

              <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={(event) => handleFileSelection(event.target.files?.[0] || null)}
              />
            </MotionGlassPanel>
          </motion.div>
        ) : (
          <motion.div
            key="workflows"
            variants={stageVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-6"
          >
            <GlassPanel className="relative overflow-hidden rounded-[36px] border-white/[0.12] bg-white/[0.03] px-6 py-6 sm:px-8">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.12),transparent_34%)]" />
              <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/44">
                      {t('toolsPortal.fileMeta.ready')}
                    </span>
                    <span className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">
                      {t('toolsPortal.fileMeta.recognized')}
                      {' '}
                      {detectedTypeLabel}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-medium tracking-tight text-white/92 sm:text-3xl">
                      {activeFile.name}
                    </h2>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-white/58 sm:text-base">
                      {fileSummary}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-white/56">
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
                      {t('toolsPortal.fileMeta.size')}
                      {' '}
                      {formattedSize}
                    </span>
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
                      {t('toolsPortal.fileMeta.recognized')}
                      {' '}
                      {detectedTypeLabel}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="inline-flex items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05] px-5 py-3 text-sm font-medium text-white/78 transition-colors duration-300 hover:bg-white/[0.1] hover:text-white"
                  >
                    {t('toolsPortal.fileMeta.change')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFile(null)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/68 transition-colors duration-300 hover:bg-white/[0.08] hover:text-white"
                  >
                    <RefreshCcw className="h-4 w-4" strokeWidth={1.8} />
                    {t('toolsPortal.fileMeta.reset')}
                  </button>
                </div>
              </div>

              <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={(event) => handleFileSelection(event.target.files?.[0] || null)}
              />
            </GlassPanel>

            <motion.div
              variants={gridVariants}
              initial="hidden"
              animate="visible"
              className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
            >
              {workflows.map((workflow) => {
                const Icon = workflow.icon;
                const priorityLabel = workflow.isRecommended
                  ? t('toolsPortal.relevance.bestMatch')
                  : t('toolsPortal.relevance.complementary');
                const relevanceNote = workflow.recommendedGroup === 'document'
                  ? t('toolsPortal.relevance.documentPriority')
                  : t('toolsPortal.relevance.mediaPriority');

                return (
                  <motion.article
                    key={workflow.id}
                    variants={cardVariants}
                    whileHover={{ y: -8, scale: 1.015 }}
                    className={[
                      'group relative overflow-hidden rounded-[32px] border border-white/[0.1] bg-white/[0.03] p-6 backdrop-blur-3xl',
                      'shadow-[0_28px_90px_-54px_rgba(0,0,0,0.86)] transition-colors duration-300',
                      workflow.isRecommended ? 'border-white/[0.16] bg-white/[0.05]' : '',
                    ].join(' ')}
                  >
                    <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${workflow.accentClassName} opacity-100`} />
                    <div className="relative flex h-full flex-col gap-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="inline-flex rounded-full border border-white/[0.08] bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/44">
                          {t(`${workflow.translationBase}.badge`)}
                        </div>
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.05] text-white/80 shadow-[inset_0_0_24px_rgba(255,255,255,0.05)]">
                          <Icon className="h-5 w-5" strokeWidth={1.8} />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-2xl font-medium tracking-tight text-white/92">
                          {t(`${workflow.translationBase}.title`)}
                        </h3>
                        <p className="text-sm leading-7 text-white/58">
                          {t(`${workflow.translationBase}.description`)}
                        </p>
                      </div>

                      <div className="mt-auto flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-white/78">
                            {priorityLabel}
                          </div>
                          <div className="text-xs leading-6 text-white/44">
                            {relevanceNote}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleWorkflowOpen(workflow)}
                          className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.08] px-4 py-2.5 text-sm font-medium text-white transition-colors duration-300 hover:bg-white/[0.14]"
                        >
                          {t('toolsPortal.actions.openWorkflow')}
                          <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                        </button>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
