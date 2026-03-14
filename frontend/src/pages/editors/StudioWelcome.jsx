import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const MotionDiv = motion.div;
const MotionButton = motion.button;

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.48,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export default function StudioWelcome({ editors, onSelect }) {
  const { t } = useTranslation();

  return (
    <div className="flex h-full min-h-0 items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
      <div className="w-full max-w-7xl">
        <MotionDiv
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mb-10 max-w-3xl text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.03] px-4 py-2 text-[11px] uppercase tracking-[0.32em] text-cyan-100/78">
            <Sparkles className="h-4 w-4" strokeWidth={1.8} />
            {t('studio.welcomeEyebrow', 'Creative Studio')}
          </div>
          <h1 className="mt-6 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(167,243,208,0.7))] bg-clip-text text-4xl font-semibold tracking-[-0.045em] text-transparent sm:text-5xl lg:text-6xl">
            {t('studio.welcomeTitle', 'One desktop-grade space for video, photo, audio, and generative workflows.')}
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-white/56 sm:text-lg">
            {t('studio.welcomeSubtitle', 'Choose a studio to open. This premium shell is designed for timelines, layers, inspectors, and AI copilots.')}
          </p>
          <p className="mt-3 text-sm uppercase tracking-[0.24em] text-white/28">
            {t('studio.welcomeHint', 'Select a tool from the dock or jump into one of the four studios below.')}
          </p>
        </MotionDiv>

        <MotionDiv
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid gap-5 lg:grid-cols-2"
        >
          {editors.map((editor) => {
            const Icon = editor.icon;

            return (
              <MotionButton
                key={editor.id}
                type="button"
                variants={cardVariants}
                whileHover={{
                  y: -8,
                  scale: 1.01,
                  boxShadow: editor.hoverShadow,
                }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onSelect(editor.id)}
                className="group relative overflow-hidden rounded-[36px] p-px text-left"
                style={{
                  background: editor.borderGradient,
                }}
              >
                <div className="relative flex min-h-[270px] flex-col justify-between overflow-hidden rounded-[35px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(13,13,16,0.98),rgba(8,8,11,0.96))] px-7 py-7 sm:min-h-[310px] sm:px-8 sm:py-8">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-90 transition-transform duration-500 group-hover:scale-[1.03]"
                    style={{
                      background: editor.backgroundGlow,
                    }}
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-10 top-0 h-24 rounded-full blur-3xl"
                    style={{ background: editor.spotlight }}
                  />

                  <div className="relative flex items-start justify-between gap-4">
                    <div className="inline-flex rounded-[24px] border border-white/[0.1] bg-black/20 p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                      <Icon className="h-7 w-7" strokeWidth={1.7} />
                    </div>

                    <div className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white/42">
                      {editor.badge}
                    </div>
                  </div>

                  <div className="relative mt-10">
                    <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-[2rem]">
                      {editor.title}
                    </h2>
                    <p className="mt-4 max-w-xl text-sm leading-7 text-white/62 sm:text-base">
                      {editor.description}
                    </p>
                  </div>

                  <div className="relative mt-8 inline-flex items-center gap-2 text-sm font-medium text-white/84">
                    {t('studio.openStudio', 'Open studio')}
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={1.9} />
                  </div>
                </div>
              </MotionButton>
            );
          })}
        </MotionDiv>
      </div>
    </div>
  );
}
