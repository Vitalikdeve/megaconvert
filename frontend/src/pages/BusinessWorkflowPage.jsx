import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, FileDigit } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import GlassPanel from '../components/ui/GlassPanel.jsx';
import {
  BUSINESS_WORKFLOW_MAP,
  TOOLS_PORTAL_HANDOFF_KEY,
  formatToolsPortalBytes,
} from '../lib/businessWorkflowCatalog.js';
import { readTempMemory } from '../lib/osMemory.js';

const MotionDiv = motion.div;

const workflowBackdrop = [
  {
    className: 'left-[-4rem] top-[10%] h-[16rem] w-[16rem] bg-cyan-500/12',
    animate: { x: [0, 32, -18, 0], y: [0, -18, 22, 0], scale: [1, 1.08, 0.96, 1] },
  },
  {
    className: 'right-[-5rem] bottom-[6%] h-[20rem] w-[20rem] bg-violet-500/10',
    animate: { x: [0, -26, 18, 0], y: [0, 22, -14, 0], scale: [1, 0.94, 1.1, 1] },
  },
];

function getTypeTranslationKey(kind) {
  switch (kind) {
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

export default function BusinessWorkflowPage({ workflowId }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();

  const workflow = BUSINESS_WORKFLOW_MAP[workflowId];
  const handoff = useMemo(
    () => readTempMemory(location.state?.handoffKey || TOOLS_PORTAL_HANDOFF_KEY),
    [location.state],
  );

  const detectedKind = location.state?.kind || handoff?.kind || 'file';
  const fileName = location.state?.fileName || handoff?.name || null;
  const fileSize = location.state?.size || handoff?.size || 0;

  if (!workflow) {
    return null;
  }

  const WorkflowIcon = workflow.icon;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[#020202] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {workflowBackdrop.map((orb) => (
          <MotionDiv
            key={orb.className}
            className={`absolute rounded-full blur-[100px] ${orb.className}`}
            animate={orb.animate}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(2,2,2,0.92)_100%)]" />
      </div>

      <MotionDiv
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto flex w-full max-w-5xl flex-col gap-6"
      >
        <button
          type="button"
          onClick={() => navigate('/tools')}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/76 transition-colors duration-300 hover:bg-white/[0.1] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
          {t('businessWorkflowPage.back')}
        </button>

        <GlassPanel className="relative overflow-hidden rounded-[40px] border-white/[0.12] bg-white/[0.03] px-6 py-8 sm:px-8 lg:px-10">
          <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${workflow.accentClassName}`} />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-5">
              <div className="inline-flex rounded-full border border-white/[0.08] bg-black/18 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-white/46">
                {t('businessWorkflowPage.badge')}
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl font-medium tracking-[-0.04em] text-white/94 sm:text-5xl">
                  {t(`${workflow.translationBase}.title`)}
                </h1>
                <p className="text-base leading-8 text-white/58 sm:text-lg">
                  {t(`${workflow.translationBase}.description`)}
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/18 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100">
                <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />
                {t('businessWorkflowPage.handoffReady')}
              </div>
            </div>

            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[28px] border border-white/[0.08] bg-white/[0.06] text-white/84 shadow-[inset_0_0_34px_rgba(255,255,255,0.06)]">
              <WorkflowIcon className="h-9 w-9" strokeWidth={1.8} />
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="rounded-[32px] border-white/[0.1] bg-white/[0.03] px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11px] uppercase tracking-[0.24em] text-white/44">
                <FileDigit className="h-3.5 w-3.5" strokeWidth={1.8} />
                {t('businessWorkflowPage.fileLabel')}
              </div>
              {fileName ? (
                <div className="space-y-3">
                  <div className="text-2xl font-medium tracking-tight text-white/92">
                    {fileName}
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-white/56">
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
                      {t('businessWorkflowPage.fileTypeLabel')}
                      {' '}
                      {t(getTypeTranslationKey(detectedKind))}
                    </span>
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
                      {t('businessWorkflowPage.sizeLabel')}
                      {' '}
                      {formatToolsPortalBytes(fileSize, i18n.language)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="max-w-2xl text-sm leading-7 text-white/56">
                  {t('businessWorkflowPage.noFile')}
                </p>
              )}
            </div>

            <div className="max-w-md rounded-[24px] border border-white/[0.08] bg-black/20 px-5 py-4 text-sm leading-7 text-white/56">
              {t('businessWorkflowPage.note')}
            </div>
          </div>
        </GlassPanel>
      </MotionDiv>
    </div>
  );
}
