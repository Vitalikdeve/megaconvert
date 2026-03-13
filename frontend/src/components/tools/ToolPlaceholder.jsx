import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import GlassPanel from '../ui/GlassPanel.jsx';

const MotionToolScene = motion.div;

export default function ToolPlaceholder({
  badge,
  title,
  description,
  icon: Icon,
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <MotionToolScene
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="flex min-h-[calc(100vh-8rem)] w-full items-center justify-center bg-[#030303] px-4 text-white"
    >
      <GlassPanel className="relative flex w-[min(840px,calc(100vw-2rem))] flex-col gap-8 overflow-hidden px-8 py-10 text-center sm:px-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              'radial-gradient(circle at top, rgba(255,255,255,0.08), transparent 30%), radial-gradient(circle at bottom right, rgba(129,140,248,0.18), transparent 45%)',
          }}
        />

        <div className="relative mx-auto inline-flex rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[11px] uppercase tracking-[0.32em] text-white/44">
          {badge || t('toolPlaceholderBadge')}
        </div>

        <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/82 shadow-[inset_0_0_36px_rgba(255,255,255,0.06)]">
          <Icon className="h-9 w-9" strokeWidth={1.8} />
        </div>

        <div className="relative mx-auto max-w-2xl space-y-4">
          <h1 className="text-3xl font-medium tracking-tight text-white/92 sm:text-4xl">
            {title}
          </h1>
          <p className="text-sm leading-7 text-white/56 sm:text-base">
            {description}
          </p>
        </div>

        <div className="relative flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.05] px-5 py-3 text-sm font-medium text-white/76 transition-colors duration-300 hover:bg-white/[0.1] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
            {t('toolPlaceholderBack')}
          </button>
        </div>
      </GlassPanel>
    </MotionToolScene>
  );
}
