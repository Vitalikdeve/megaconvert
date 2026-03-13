import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  FileText,
  Search,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ZenPortal from '../ZenPortal.jsx';
import GlassPanel from '../ui/GlassPanel.jsx';

const springTransition = {
  type: 'spring',
  stiffness: 180,
  damping: 18,
  mass: 0.9,
};

export default function HomeDashboard() {
  const { t } = useTranslation();
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
      className: 'lg:row-span-2',
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
  ], [t]);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[#030303] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(129,140,248,0.18),transparent_34%),radial-gradient(circle_at_82%_24%,rgba(56,189,248,0.14),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)]" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <section className="flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[11px] uppercase tracking-[0.32em] text-white/48"
          >
            {t('dashboardEyebrow')}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.52, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 max-w-5xl bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,255,255,0.62))] bg-clip-text text-5xl font-semibold tracking-[-0.04em] text-transparent sm:text-6xl lg:text-7xl"
          >
            {t('dashboardTitle')}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.48, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 max-w-3xl text-lg leading-8 text-white/50"
          >
            {t('dashboardSubtitle')}
          </motion.p>
        </section>

        <section
          id="zen-portal"
          className="scroll-mt-24"
        >
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.54, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="flex w-full flex-col items-center gap-5"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-white/42">
              {t('dashboardPortalBadge')}
            </div>

            <ZenPortal variant="embedded" />
          </motion.div>
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

          <div className="grid auto-rows-[minmax(220px,1fr)] grid-cols-1 gap-4 lg:grid-cols-3">
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
