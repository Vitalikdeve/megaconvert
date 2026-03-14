import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  KeyRound,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import GlassPanel from '../components/ui/GlassPanel.jsx';

const MotionDiv = motion.div;
const MotionSection = motion.section;
const MotionArticle = motion.article;

const pageVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.08,
      staggerChildren: 0.12,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 34 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const readAuthState = () => {
  if (typeof window === 'undefined') {
    return { isAuthenticated: false, user: null };
  }

  const token = String(window.localStorage.getItem('mc_auth_token') || '').trim();
  const rawUser = window.localStorage.getItem('mc_auth_user');
  let user = null;

  if (rawUser) {
    try {
      user = JSON.parse(rawUser);
    } catch {
      user = null;
    }
  }

  return {
    isAuthenticated: Boolean(token),
    user,
  };
};

export default function PricingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [authState, setAuthState] = useState(() => readAuthState());
  const [isPromoOpen, setIsPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncAuthState = () => {
      setAuthState(readAuthState());
    };

    syncAuthState();
    window.addEventListener('storage', syncAuthState);
    window.addEventListener('focus', syncAuthState);

    return () => {
      window.removeEventListener('storage', syncAuthState);
      window.removeEventListener('focus', syncAuthState);
    };
  }, []);

  const plans = [
    {
      id: 'free',
      icon: Sparkles,
      name: t('pricingPage.plans.free.name'),
      price: t('pricingPage.plans.free.price'),
      description: t('pricingPage.plans.free.description'),
      features: [
        t('pricingPage.plans.free.features.fileSize'),
        t('pricingPage.plans.free.features.engine'),
        t('pricingPage.plans.free.features.priority'),
        t('pricingPage.plans.free.features.ads'),
      ],
      actionLabel: t('pricingPage.plans.free.cta'),
      actionClassName:
        'border border-white/14 bg-white/[0.03] text-white/92 hover:border-white/22 hover:bg-white/[0.06]',
      panelClassName:
        'border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]',
      glowClassName:
        'bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_58%)]',
      onClick: () => navigate('/register'),
    },
    {
      id: 'pro',
      icon: Zap,
      name: t('pricingPage.plans.pro.name'),
      price: t('pricingPage.plans.pro.price'),
      description: t('pricingPage.plans.pro.description'),
      features: [
        t('pricingPage.plans.pro.features.fileSize'),
        t('pricingPage.plans.pro.features.priority'),
        t('pricingPage.plans.pro.features.batch'),
        t('pricingPage.plans.pro.features.aiBackground'),
        t('pricingPage.plans.pro.features.smartHandoff'),
        t('pricingPage.plans.pro.features.adsFree'),
      ],
      badge: t('pricingPage.plans.pro.badge'),
      actionLabel: authState.isAuthenticated
        ? t('pricingPage.plans.pro.ctaAuth')
        : t('pricingPage.plans.pro.ctaGuest'),
      actionClassName:
        'border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(224,231,255,0.96))] text-slate-950 hover:scale-[1.01] hover:bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(199,210,254,0.98))]',
      panelClassName:
        'border-indigo-500 bg-[linear-gradient(180deg,rgba(79,70,229,0.16),rgba(10,10,14,0.94))] shadow-[0_0_30px_rgba(99,102,241,0.2)]',
      glowClassName:
        'bg-[radial-gradient(circle_at_top,rgba(129,140,248,0.28),transparent_58%)]',
      highlight: true,
      onClick: () => {
        navigate(authState.isAuthenticated ? '/account/billing' : '/login');
      },
    },
    {
      id: 'individual',
      icon: KeyRound,
      name: t('pricingPage.plans.individual.name'),
      price: t('pricingPage.plans.individual.price'),
      description: t('pricingPage.plans.individual.description'),
      features: [
        t('pricingPage.plans.individual.features.apiAccess'),
        t('pricingPage.plans.individual.features.customLimits'),
        t('pricingPage.plans.individual.features.dedicatedWorkers'),
        t('pricingPage.plans.individual.features.sla'),
      ],
      actionLabel: t('pricingPage.plans.individual.cta'),
      actionClassName:
        'border border-white/14 bg-white/[0.03] text-white/92 hover:border-white/22 hover:bg-white/[0.06]',
      panelClassName:
        'border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]',
      glowClassName:
        'bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.18),transparent_58%)]',
      onClick: () => {
        setPromoError('');
        setPromoCode('');
        setIsPromoOpen(true);
      },
    },
  ];

  const handlePromoContinue = (event) => {
    event.preventDefault();

    const normalizedCode = promoCode.trim().toUpperCase();
    if (!normalizedCode) {
      setPromoError(t('pricingPage.promoModal.empty'));
      return;
    }

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('mc_prefill_promo_code', normalizedCode);
    }

    setPromoError('');
    setIsPromoOpen(false);
    navigate(authState.isAuthenticated ? '/account/billing' : '/login', {
      state: { promoCode: normalizedCode },
    });
  };

  return (
    <>
      <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[#030303] px-4 py-12 text-white sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(99,102,241,0.24),transparent_24%),radial-gradient(circle_at_78%_18%,rgba(56,189,248,0.14),transparent_22%),radial-gradient(circle_at_50%_100%,rgba(129,140,248,0.16),transparent_28%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.2),rgba(3,3,3,0.92)_38%,rgba(3,3,3,1))]" />
        </div>

        <MotionDiv
          className="relative mx-auto flex w-full max-w-7xl flex-col gap-10"
          variants={pageVariants}
          initial="hidden"
          animate="visible"
        >
          <MotionSection
            variants={itemVariants}
            className="max-w-4xl pt-6 sm:pt-10"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-white/48">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
              {t('pricingPage.eyebrow')}
            </div>

            <h1 className="mt-6 max-w-4xl text-4xl font-medium tracking-[-0.06em] text-white sm:text-5xl lg:text-[4.75rem] lg:leading-[0.96]">
              <span className="bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent">
                {t('pricingPage.title')}
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-white/64 sm:text-lg">
              {t('pricingPage.subtitle')}
            </p>

            <div className="mt-6 inline-flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-white/38">
              <span>{t('pricingPage.footnote')}</span>
            </div>
          </MotionSection>

          <MotionSection
            variants={pageVariants}
            className="grid gap-6 xl:grid-cols-3"
          >
            {plans.map((plan) => {
              const Icon = plan.icon;

              return (
                <MotionArticle
                  key={plan.id}
                  variants={cardVariants}
                  className={plan.highlight ? 'xl:-mt-4' : ''}
                >
                  <GlassPanel
                    className={[
                      'group relative h-full overflow-hidden rounded-[34px] px-6 py-6 sm:px-7 sm:py-7',
                      plan.panelClassName,
                    ].join(' ')}
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className={`pointer-events-none absolute inset-0 ${plan.glowClassName}`} />

                    <div className="relative flex h-full flex-col">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.1] bg-white/[0.05] text-white/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                            <Icon className="h-5 w-5" strokeWidth={1.8} />
                          </div>
                          <div className="mt-5 text-[11px] uppercase tracking-[0.28em] text-white/32">
                            {t('pricingPage.planLabel')}
                          </div>
                          <h2 className="mt-3 text-3xl font-medium tracking-[-0.04em] text-white/96">
                            {plan.name}
                          </h2>
                        </div>

                        {plan.badge ? (
                          <span className="rounded-full border border-indigo-400/28 bg-indigo-400/12 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-indigo-100">
                            {plan.badge}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-8">
                        <div className="text-4xl font-medium tracking-[-0.05em] text-white">
                          {plan.price}
                        </div>
                        <p className="mt-4 text-sm leading-7 text-white/62 sm:text-[15px]">
                          {plan.description}
                        </p>
                      </div>

                      <div className="mt-8 space-y-3">
                        {plan.features.map((feature) => (
                          <div
                            key={feature}
                            className="flex items-start gap-3 text-sm leading-7 text-white/78"
                          >
                            <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/84">
                              <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
                            </span>
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={plan.onClick}
                        className={[
                          'mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all duration-300',
                          plan.actionClassName,
                        ].join(' ')}
                      >
                        <span>{plan.actionLabel}</span>
                        <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
                      </button>
                    </div>
                  </GlassPanel>
                </MotionArticle>
              );
            })}
          </MotionSection>
        </MotionDiv>
      </div>

      <AnimatePresence>
        {isPromoOpen ? (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label={t('pricingPage.promoModal.close')}
              className="absolute inset-0 bg-black/72 backdrop-blur-md"
              onClick={() => setIsPromoOpen(false)}
            />

            <GlassPanel
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-[81] w-full max-w-xl overflow-hidden rounded-[32px] border-white/[0.1] bg-[#07070a]/96 p-6 sm:p-7"
              role="dialog"
              aria-modal="true"
              aria-labelledby="pricing-promo-title"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(129,140,248,0.18),transparent_40%)]" />

              <button
                type="button"
                onClick={() => setIsPromoOpen(false)}
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/66 transition-colors hover:text-white"
              >
                <X className="h-4 w-4" strokeWidth={1.9} />
              </button>

              <div className="relative">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-indigo-100">
                  <KeyRound className="h-5 w-5" strokeWidth={1.9} />
                </div>

                <h2
                  id="pricing-promo-title"
                  className="mt-5 text-2xl font-medium tracking-[-0.04em] text-white"
                >
                  {t('pricingPage.promoModal.title')}
                </h2>
                <p className="mt-3 max-w-lg text-sm leading-7 text-white/62 sm:text-[15px]">
                  {t('pricingPage.promoModal.subtitle')}
                </p>

                <form className="mt-7 space-y-4" onSubmit={handlePromoContinue}>
                  <label className="block">
                    <span className="text-xs uppercase tracking-[0.22em] text-white/36">
                      {t('pricingPage.promoModal.label')}
                    </span>
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(event) => {
                        setPromoCode(event.target.value);
                        if (promoError) {
                          setPromoError('');
                        }
                      }}
                      placeholder={t('pricingPage.promoModal.placeholder')}
                      className="mt-3 h-14 w-full rounded-2xl border border-white/[0.1] bg-white/[0.04] px-4 text-base text-white outline-none transition-colors placeholder:text-white/26 focus:border-indigo-400/70"
                    />
                  </label>

                  <p className="text-sm leading-7 text-white/48">
                    {promoError || t('pricingPage.promoModal.hint')}
                  </p>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setIsPromoOpen(false)}
                      className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/88 transition-colors hover:bg-white/[0.06]"
                    >
                      {t('pricingPage.promoModal.cancel')}
                    </button>
                    <button
                      type="submit"
                      className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-white/70 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition-transform hover:scale-[1.01]"
                    >
                      <span>
                        {authState.isAuthenticated
                          ? t('pricingPage.promoModal.submit')
                          : t('pricingPage.promoModal.signIn')}
                      </span>
                      <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
                    </button>
                  </div>
                </form>
              </div>
            </GlassPanel>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
