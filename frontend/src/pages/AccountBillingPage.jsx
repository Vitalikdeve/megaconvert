import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import GlassPanel from '../components/ui/GlassPanel.jsx';

const MotionDiv = motion.div;

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

export default function AccountBillingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [authState, setAuthState] = useState(() => readAuthState());
  const [promoCode, setPromoCode] = useState(() => {
    const statePromoCode = String(location.state?.promoCode || '').trim();
    if (typeof window === 'undefined') {
      return statePromoCode;
    }

    const storedPromoCode = String(window.sessionStorage.getItem('mc_prefill_promo_code') || '').trim();
    return statePromoCode || storedPromoCode;
  });

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

  const handleCheckout = () => {
    toast.info(t('pricingPage.account.statusNote'));
  };

  const handlePromoSubmit = (event) => {
    event.preventDefault();

    const normalizedCode = promoCode.trim().toUpperCase();
    if (!normalizedCode) {
      toast.error(t('pricingPage.promoModal.empty'));
      return;
    }

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('mc_prefill_promo_code', normalizedCode);
    }

    setPromoCode(normalizedCode);
    toast.success(t('pricingPage.account.promoSaved'));
  };

  if (!authState.isAuthenticated) {
    return (
      <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[#030303] px-4 py-12 text-white sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.18),transparent_36%),linear-gradient(180deg,rgba(3,7,18,0.26),rgba(3,3,3,1)_70%)]" />
        <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-6 pt-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-white/44">
            <KeyRound className="h-3.5 w-3.5" strokeWidth={1.8} />
            {t('pricingPage.account.eyebrow')}
          </div>

          <h1 className="text-4xl font-medium tracking-[-0.05em] text-white sm:text-5xl">
            {t('pageAccountTitle')}
          </h1>
          <p className="max-w-2xl text-base leading-8 text-white/64 sm:text-lg">
            {t('pricingPage.account.guestCopy')}
          </p>

          <GlassPanel className="rounded-[32px] border-white/[0.1] bg-white/[0.03] p-6 sm:p-8">
            <div className="space-y-5">
              <div>
                <div className="text-sm uppercase tracking-[0.22em] text-white/34">
                  {t('accountSectionBilling')}
                </div>
                <h2 className="mt-3 text-2xl font-medium tracking-[-0.04em] text-white">
                  {t('accountSignInTitle')}
                </h2>
                <p className="mt-3 text-sm leading-7 text-white/60 sm:text-[15px]">
                  {t('accountSignInSubtitle')}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-white/70 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition-transform hover:scale-[1.01]"
                >
                  <span>{t('headerSignIn')}</span>
                  <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/88 transition-colors hover:bg-white/[0.06]"
                >
                  {t('pricingPage.plans.free.cta')}
                </button>
              </div>
            </div>
          </GlassPanel>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[#030303] px-4 py-12 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(99,102,241,0.2),transparent_24%),radial-gradient(circle_at_80%_12%,rgba(56,189,248,0.12),transparent_20%),linear-gradient(180deg,rgba(3,7,18,0.24),rgba(3,3,3,1)_72%)]" />

      <MotionDiv
        className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 pt-8"
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-white/44">
            <KeyRound className="h-3.5 w-3.5" strokeWidth={1.8} />
            {t('pricingPage.account.eyebrow')}
          </div>

          <h1 className="mt-5 text-4xl font-medium tracking-[-0.05em] text-white sm:text-5xl">
            {t('pageAccountTitle')}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-white/64 sm:text-lg">
            {t('pageAccountSubtitle')}
          </p>
          <p className="mt-4 text-sm text-white/42">
            {authState.user?.email}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <GlassPanel className="rounded-[32px] border-indigo-500 bg-[linear-gradient(180deg,rgba(79,70,229,0.16),rgba(10,10,14,0.94))] p-6 shadow-[0_0_30px_rgba(99,102,241,0.18)] sm:p-8">
            <div className="space-y-5">
              <div>
                <div className="text-sm uppercase tracking-[0.22em] text-white/34">
                  {t('accountSectionBilling')}
                </div>
                <h2 className="mt-3 text-3xl font-medium tracking-[-0.04em] text-white">
                  {t('pricingPage.account.manageTitle')}
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-white/68 sm:text-[15px]">
                  {t('pricingPage.account.manageCopy')}
                </p>
              </div>

              <div className="rounded-[28px] border border-white/[0.1] bg-black/16 p-5">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/84">
                    <Check className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <p className="text-sm leading-7 text-white/74">
                    {t('pricingPage.account.statusNote')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCheckout}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/70 bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition-transform hover:scale-[1.01]"
              >
                <span>{t('pricingPage.account.manageCta')}</span>
                <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
              </button>
            </div>
          </GlassPanel>

          <GlassPanel className="rounded-[32px] border-white/[0.1] bg-white/[0.03] p-6 sm:p-8">
            <div className="space-y-5">
              <div>
                <div className="text-sm uppercase tracking-[0.22em] text-white/34">
                  {t('accountSectionBilling')}
                </div>
                <h2 className="mt-3 text-2xl font-medium tracking-[-0.04em] text-white">
                  {t('accountPromoRedeemTitle')}
                </h2>
                <p className="mt-3 text-sm leading-7 text-white/60 sm:text-[15px]">
                  {t('accountPromoRedeemSubtitle')}
                </p>
              </div>

              <form className="space-y-4" onSubmit={handlePromoSubmit}>
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.22em] text-white/36">
                    {t('accountPromoCodeLabel')}
                  </span>
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(event) => setPromoCode(event.target.value)}
                    placeholder={t('pricingPage.promoModal.placeholder')}
                    className="mt-3 h-14 w-full rounded-2xl border border-white/[0.1] bg-white/[0.04] px-4 text-base text-white outline-none transition-colors placeholder:text-white/26 focus:border-indigo-400/70"
                  />
                </label>

                <p className="text-sm leading-7 text-white/48">
                  {t('pricingPage.promoModal.hint')}
                </p>

                <button
                  type="submit"
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/88 transition-colors hover:bg-white/[0.08]"
                >
                  {t('accountApply')}
                </button>
              </form>
            </div>
          </GlassPanel>
        </div>
      </MotionDiv>
    </div>
  );
}
