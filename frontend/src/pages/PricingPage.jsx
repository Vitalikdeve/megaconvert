import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check, ShieldCheck, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import GlassPanel from '../components/ui/GlassPanel.jsx';

const MotionDiv = motion.div;

const backgroundOrbs = [
  {
    className: 'left-[-8rem] top-[-3rem] h-[22rem] w-[22rem] bg-fuchsia-500/14',
    animate: { x: [0, 26, -18, 0], y: [0, 18, -24, 0], scale: [1, 1.08, 0.94, 1] },
    transition: { duration: 22, repeat: Infinity, ease: 'easeInOut' },
  },
  {
    className: 'right-[-7rem] top-[8%] h-[21rem] w-[21rem] bg-indigo-400/12',
    animate: { x: [0, -24, 16, 0], y: [0, 24, -16, 0], scale: [1, 0.94, 1.1, 1] },
    transition: { duration: 26, repeat: Infinity, ease: 'easeInOut' },
  },
  {
    className: 'bottom-[-10rem] left-1/2 h-[26rem] w-[26rem] -translate-x-1/2 bg-cyan-400/10',
    animate: { x: [0, 18, -22, 0], y: [0, -18, 20, 0], scale: [1, 1.1, 0.92, 1] },
    transition: { duration: 28, repeat: Infinity, ease: 'easeInOut' },
  },
];

const cardAccentById = {
  free: 'from-white/[0.08] via-white/[0.03] to-transparent',
  pro: 'from-cyan-400/16 via-indigo-400/10 to-transparent',
  individual: 'from-fuchsia-400/14 via-violet-400/10 to-transparent',
};

export default function PricingPage() {
  const { t } = useTranslation();

  const plans = useMemo(() => ([
    {
      id: 'free',
      name: t('planFreeName'),
      price: t('planFreePrice'),
      description: t('planFreeDesc'),
      features: [
        t('planFreeFeature1'),
        t('planFreeFeature2'),
        t('planFreeFeature3'),
        t('planFreeFeature4'),
      ],
      badge: null,
      note: null,
    },
    {
      id: 'pro',
      name: t('planProName'),
      price: t('planProPrice'),
      description: t('planProDesc'),
      features: [
        t('planProFeature1'),
        t('planProFeature2'),
        t('planProFeature3'),
        t('planProFeature4'),
      ],
      badge: t('pricingPage.popularBadge'),
      note: null,
    },
    {
      id: 'individual',
      name: t('planIndividualName'),
      price: t('planIndividualPrice'),
      description: t('planIndividualDesc'),
      features: [
        t('planIndividualFeature1'),
        t('planIndividualFeature2'),
        t('planIndividualFeature3'),
        t('planIndividualFeature4'),
      ],
      badge: null,
      note: t('pricingIndividualPromoOnlyNote'),
    },
  ]), [t]);

  const handleSheerIdVerification = async () => {
    toast.info(t('pricing.student.redirecting', 'Redirecting to SheerID verification...'));
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[#020202] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {backgroundOrbs.map((orb) => (
          <MotionDiv
            key={orb.className}
            className={`absolute rounded-full blur-[110px] ${orb.className}`}
            animate={orb.animate}
            transition={orb.transition}
          />
        ))}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(2,2,2,0)_24%,rgba(2,2,2,0.96)_100%)]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-8">
        <MotionDiv
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-white/42">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
            {t('pricingPage.eyebrow')}
          </div>
          <h1 className="mt-6 text-4xl font-medium tracking-[-0.05em] text-white/94 sm:text-5xl lg:text-6xl">
            {t('pagePricingTitle')}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-white/58 sm:text-lg">
            {t('pricingPage.subtitle')}
          </p>
        </MotionDiv>

        <div className="grid gap-6 xl:grid-cols-3">
          {plans.map((plan, index) => (
            <MotionDiv
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.04 * index, ease: [0.22, 1, 0.36, 1] }}
            >
              <GlassPanel className="relative h-full overflow-hidden rounded-[36px] border-white/[0.1] bg-white/[0.03] px-6 py-6 sm:px-8">
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${cardAccentById[plan.id] || cardAccentById.free}`} />
                <div className="relative flex h-full flex-col gap-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.28em] text-white/34">
                        {t('pricingTableFeature')}
                      </div>
                      <h2 className="mt-4 text-3xl font-medium tracking-tight text-white/94">
                        {plan.name}
                      </h2>
                    </div>
                    {plan.badge ? (
                      <span className="rounded-full border border-cyan-300/18 bg-cyan-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-cyan-100/86">
                        {plan.badge}
                      </span>
                    ) : null}
                  </div>

                  <div>
                    <div className="text-4xl font-medium tracking-[-0.04em] text-white/95">
                      {plan.price}
                    </div>
                    <p className="mt-4 text-sm leading-7 text-white/58 sm:text-base">
                      {plan.description}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-3 text-sm leading-7 text-white/72">
                        <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/80">
                          <Check className="h-3.5 w-3.5" strokeWidth={2} />
                        </span>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  {plan.note ? (
                    <div className="mt-auto rounded-[24px] border border-white/[0.08] bg-[#050505]/65 px-4 py-4 text-sm leading-7 text-white/52">
                      {plan.note}
                    </div>
                  ) : <div className="mt-auto" />}
                </div>
              </GlassPanel>
            </MotionDiv>
          ))}
        </div>

        <MotionDiv
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          <GlassPanel className="relative overflow-hidden rounded-[36px] border-white/[0.12] bg-gradient-to-r from-purple-900/20 to-indigo-900/20 px-6 py-7 sm:px-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.1),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(129,140,248,0.14),transparent_34%)]" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/42">
                  <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
                  SheerID
                </div>
                <h2 className="mt-4 text-2xl font-medium tracking-tight text-white/94 sm:text-3xl">
                  {t('pricing.student.title')}
                </h2>
                <p className="mt-3 text-sm leading-7 text-white/62 sm:text-base">
                  {t('pricing.student.description')}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  void handleSheerIdVerification();
                }}
                className="inline-flex min-w-[14rem] items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-all duration-300 hover:scale-[1.02] hover:bg-white/90"
              >
                <ShieldCheck className="h-4 w-4" strokeWidth={1.8} />
                {t('pricing.student.cta')}
              </button>
            </div>
          </GlassPanel>
        </MotionDiv>
      </div>
    </div>
  );
}
