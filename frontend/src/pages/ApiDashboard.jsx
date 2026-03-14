import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Check,
  Code2,
  Copy,
  KeyRound,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import GlassPanel from '../components/ui/GlassPanel.jsx';

const API_KEYS_STORAGE_KEY = 'megaconvert.api.dashboard.keys';
const MOCK_PLAN_STORAGE_KEY = 'megaconvert.mock.plan';
const PLAN_VALUES = ['free', 'pro', 'enterprise'];
const USAGE_SERIES = [42, 58, 63, 49, 74, 68, 82];
const MotionDiv = motion.div;
const MotionSection = motion.section;

const backgroundOrbs = [
  {
    className: 'left-[-8rem] top-[-3rem] h-[22rem] w-[22rem] bg-cyan-500/14',
    animate: { x: [0, 28, -16, 0], y: [0, 18, -24, 0], scale: [1, 1.08, 0.94, 1] },
    transition: { duration: 24, repeat: Infinity, ease: 'easeInOut' },
  },
  {
    className: 'right-[-7rem] top-[10%] h-[20rem] w-[20rem] bg-indigo-400/12',
    animate: { x: [0, -22, 18, 0], y: [0, 26, -14, 0], scale: [1, 0.92, 1.12, 1] },
    transition: { duration: 26, repeat: Infinity, ease: 'easeInOut' },
  },
  {
    className: 'bottom-[-9rem] left-1/2 h-[26rem] w-[26rem] -translate-x-1/2 bg-emerald-400/10',
    animate: { x: [0, 18, -24, 0], y: [0, -18, 22, 0], scale: [1, 1.06, 0.9, 1] },
    transition: { duration: 28, repeat: Infinity, ease: 'easeInOut' },
  },
];

function readStoredApiKeys() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = localStorage.getItem(API_KEYS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readStoredPlan() {
  if (typeof window === 'undefined') {
    return 'free';
  }

  try {
    const raw = String(localStorage.getItem(MOCK_PLAN_STORAGE_KEY) || 'free').trim().toLowerCase();
    return PLAN_VALUES.includes(raw) ? raw : 'free';
  } catch {
    return 'free';
  }
}

function generateHex(length) {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  globalThis.crypto?.getRandomValues?.(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, length);
}

function buildApiKeyRecord() {
  const now = new Date().toISOString();
  return {
    id: globalThis.crypto?.randomUUID?.() || `api_${Date.now()}`,
    key: `mc_live_${generateHex(12)}.${generateHex(24)}`,
    scope: 'global',
    status: 'active',
    createdAt: now,
    lastUsedAt: null,
  };
}

function maskApiKey(value) {
  if (!value) {
    return '';
  }

  const visibleStart = value.slice(0, 10);
  const visibleEnd = value.slice(-6);
  return `${visibleStart}••••••••••${visibleEnd}`;
}

function formatDate(value, locale) {
  if (!value) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function buildWeekdayLabels(locale) {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const start = new Date(Date.UTC(2026, 2, 9));
  return USAGE_SERIES.map((_, index) => formatter.format(new Date(start.getTime() + index * 86400000)));
}

export default function ApiDashboard() {
  const { t, i18n } = useTranslation();
  const [apiKeys, setApiKeys] = useState(readStoredApiKeys);
  const [userPlan] = useState(readStoredPlan);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState(null);
  const isPaidPlan = userPlan === 'pro' || userPlan === 'enterprise';

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(apiKeys));
    } catch {
      // Ignore storage write failures in private mode or locked environments.
    }
  }, [apiKeys]);

  const weekdayLabels = useMemo(
    () => buildWeekdayLabels(i18n.language || 'en'),
    [i18n.language],
  );

  const usageMetrics = useMemo(() => ([
    {
      key: 'requests',
      label: t('apiDashboard.usage.metrics.requests'),
      value: '128k',
    },
    {
      key: 'successRate',
      label: t('apiDashboard.usage.metrics.successRate'),
      value: '99.94%',
    },
    {
      key: 'latency',
      label: t('apiDashboard.usage.metrics.avgLatency'),
      value: '214 ms',
    },
  ]), [t]);

  const handleGenerateNewKey = () => {
    if (!isPaidPlan) {
      setIsPaywallOpen(true);
      toast.info(t('apiDashboard.toasts.paywall'));
      return;
    }

    const nextKey = buildApiKeyRecord();
    setApiKeys((current) => [nextKey, ...current]);
    toast.success(t('apiDashboard.toasts.generated'));
  };

  const handleCopyKey = async (record) => {
    if (!record?.key) {
      return;
    }

    try {
      await navigator.clipboard.writeText(record.key);
      setCopiedKeyId(record.id);
      toast.success(t('apiDashboard.toasts.copied'));
      window.setTimeout(() => setCopiedKeyId((current) => (current === record.id ? null : current)), 1800);
    } catch {
      toast.error(t('apiDashboard.toasts.copyFailed'));
    }
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
        <MotionSection
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-white/42">
            <Code2 className="h-3.5 w-3.5" strokeWidth={1.8} />
            {t('apiDashboard.eyebrow')}
          </div>
          <h1 className="mt-6 text-4xl font-medium tracking-[-0.05em] text-white/94 sm:text-5xl lg:text-6xl">
            {t('apiDashboard.title')}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-white/58 sm:text-lg">
            {t('apiDashboard.description')}
          </p>
        </MotionSection>

        <div className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
          <MotionDiv
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
          >
            <GlassPanel className="relative overflow-hidden rounded-[36px] border-white/[0.1] bg-white/[0.025] px-6 py-6 sm:px-8">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.12),transparent_34%)]" />
              <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/16 bg-emerald-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-emerald-100/82">
                    <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
                    {t('apiDashboard.accessBadge')}
                  </div>
                  <div>
                    <h2 className="text-2xl font-medium tracking-tight text-white/94">
                      {t('apiDashboard.keys.title')}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-white/56 sm:text-base">
                      {t('apiDashboard.keys.subtitle')}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                  <div className="rounded-[24px] border border-white/[0.08] bg-[#050505]/80 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-white/32">
                      {t('apiDashboard.currentPlan')}
                    </div>
                    <div className="mt-1 font-mono text-sm uppercase tracking-[0.22em] text-white/84">
                      {t(`apiDashboard.plans.${userPlan}`)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateNewKey}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-all duration-300 hover:scale-[1.02] hover:bg-white/90"
                  >
                    <KeyRound className="h-4 w-4" strokeWidth={1.8} />
                    {t('apiDashboard.keys.generate')}
                  </button>
                </div>
              </div>

              {apiKeys.length === 0 ? (
                <div className="relative mt-8 rounded-[30px] border border-dashed border-white/[0.1] bg-[#050505]/65 px-6 py-10 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04]">
                    <KeyRound className="h-6 w-6 text-white/76" strokeWidth={1.8} />
                  </div>
                  <h3 className="mt-5 text-lg font-medium text-white/92">
                    {t('apiDashboard.keys.emptyTitle')}
                  </h3>
                  <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-white/48 sm:text-base">
                    {t('apiDashboard.keys.emptyBody')}
                  </p>
                </div>
              ) : (
                <div className="relative mt-8 overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#050505]/78">
                  <div className="hidden grid-cols-[1.8fr_0.8fr_0.9fr_0.9fr_auto] gap-4 border-b border-white/[0.08] px-5 py-4 text-[11px] uppercase tracking-[0.26em] text-white/34 md:grid">
                    <span>{t('apiDashboard.keys.columns.key')}</span>
                    <span>{t('apiDashboard.keys.columns.scope')}</span>
                    <span>{t('apiDashboard.keys.columns.created')}</span>
                    <span>{t('apiDashboard.keys.columns.lastUsed')}</span>
                    <span>{t('apiDashboard.keys.columns.status')}</span>
                  </div>

                  <div className="divide-y divide-white/[0.08]">
                    {apiKeys.map((record, index) => (
                      <MotionDiv
                        key={record.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, delay: index * 0.04 }}
                        className="grid gap-4 px-5 py-5 md:grid-cols-[1.8fr_0.8fr_0.9fr_0.9fr_auto] md:items-center"
                      >
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase tracking-[0.22em] text-white/28 md:hidden">
                            {t('apiDashboard.keys.columns.key')}
                          </div>
                          <div className="mt-1 flex items-center gap-3">
                            <code className="truncate font-mono text-sm text-white/88">
                              {maskApiKey(record.key)}
                            </code>
                            <button
                              type="button"
                              onClick={() => handleCopyKey(record)}
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/68 transition-colors duration-300 hover:bg-white/[0.08] hover:text-white"
                              aria-label={t('apiDashboard.keys.copy')}
                            >
                              {copiedKeyId === record.id ? (
                                <Check className="h-4 w-4" strokeWidth={1.8} />
                              ) : (
                                <Copy className="h-4 w-4" strokeWidth={1.8} />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="text-sm text-white/60">
                          <div className="text-[10px] uppercase tracking-[0.22em] text-white/28 md:hidden">
                            {t('apiDashboard.keys.columns.scope')}
                          </div>
                          <div className="mt-1 font-mono text-xs uppercase tracking-[0.2em] text-cyan-100/82">
                            {t('apiDashboard.keys.scopeGlobal')}
                          </div>
                        </div>

                        <div className="text-sm text-white/60">
                          <div className="text-[10px] uppercase tracking-[0.22em] text-white/28 md:hidden">
                            {t('apiDashboard.keys.columns.created')}
                          </div>
                          <div className="mt-1">{formatDate(record.createdAt, i18n.language || 'en')}</div>
                        </div>

                        <div className="text-sm text-white/60">
                          <div className="text-[10px] uppercase tracking-[0.22em] text-white/28 md:hidden">
                            {t('apiDashboard.keys.columns.lastUsed')}
                          </div>
                          <div className="mt-1">
                            {record.lastUsedAt
                              ? formatDate(record.lastUsedAt, i18n.language || 'en')
                              : t('apiDashboard.keys.neverUsed')}
                          </div>
                        </div>

                        <div className="flex items-center justify-start md:justify-end">
                          <span className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-emerald-100/84">
                            {t('apiDashboard.keys.active')}
                          </span>
                        </div>
                      </MotionDiv>
                    ))}
                  </div>
                </div>
              )}
            </GlassPanel>
          </MotionDiv>

          <div className="grid gap-6">
            <MotionDiv
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              <GlassPanel className="relative overflow-hidden rounded-[32px] border-white/[0.1] bg-white/[0.03] px-6 py-6">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_55%)]" />
                <div className="relative">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04]">
                      <ShieldCheck className="h-5 w-5 text-white/82" strokeWidth={1.8} />
                    </div>
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-white/40">
                      {t('apiDashboard.gatewayStatus')}
                    </span>
                  </div>

                  <h3 className="mt-5 text-xl font-medium tracking-tight text-white/94">
                    {t('apiDashboard.gatewayTitle')}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-white/56">
                    {t('apiDashboard.gatewayDescription')}
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[24px] border border-white/[0.08] bg-[#050505]/70 px-4 py-4">
                      <div className="text-[10px] uppercase tracking-[0.24em] text-white/30">
                        {t('apiDashboard.usageWindow')}
                      </div>
                      <div className="mt-2 font-mono text-2xl text-white/88">{t('apiDashboard.usageWindowValue')}</div>
                    </div>
                    <div className="rounded-[24px] border border-white/[0.08] bg-[#050505]/70 px-4 py-4">
                      <div className="text-[10px] uppercase tracking-[0.24em] text-white/30">
                        {t('apiDashboard.currentPlan')}
                      </div>
                      <div className="mt-2 font-mono text-2xl uppercase text-white/88">
                        {t(`apiDashboard.plans.${userPlan}`)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <Link
                      to="/pricing"
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition-all duration-300 hover:scale-[1.02] hover:bg-white/90"
                    >
                      {t('apiDashboard.actions.upgrade')}
                      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                    </Link>
                    <button
                      type="button"
                      onClick={handleGenerateNewKey}
                      className="inline-flex items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/72 transition-colors duration-300 hover:bg-white/[0.08] hover:text-white"
                    >
                      {t('apiDashboard.actions.generate')}
                    </button>
                  </div>
                </div>
              </GlassPanel>
            </MotionDiv>

            <MotionDiv
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
            >
              <GlassPanel className="rounded-[32px] border-white/[0.1] bg-white/[0.03] px-6 py-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.28em] text-white/34">
                      {t('apiDashboard.usage.eyebrow')}
                    </div>
                    <h3 className="mt-3 text-xl font-medium tracking-tight text-white/94">
                      {t('apiDashboard.usage.title')}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-white/54">
                      {t('apiDashboard.usage.subtitle')}
                    </p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04]">
                    <BarChart3 className="h-5 w-5 text-white/82" strokeWidth={1.8} />
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {usageMetrics.map((metric) => (
                    <div
                      key={metric.key}
                      className="rounded-[24px] border border-white/[0.08] bg-[#050505]/72 px-4 py-4"
                    >
                      <div className="text-[10px] uppercase tracking-[0.22em] text-white/30">
                        {metric.label}
                      </div>
                      <div className="mt-2 font-mono text-2xl text-white/88">
                        {metric.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-[28px] border border-white/[0.08] bg-[#050505]/72 px-4 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-white/34">
                      {t('apiDashboard.usage.chartLabel')}
                    </div>
                    <div className="font-mono text-xs uppercase tracking-[0.18em] text-white/44">
                      {t('apiDashboard.usage.chartHint')}
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-7 items-end gap-3">
                    {USAGE_SERIES.map((value, index) => (
                      <div key={`${weekdayLabels[index]}-${value}`} className="flex flex-col items-center gap-3">
                        <MotionDiv
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: `${value}%`, opacity: 1 }}
                          transition={{ duration: 0.5, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
                          className="w-full rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(94,234,212,0.36))]"
                          style={{ minHeight: '40px' }}
                        />
                        <span className="text-[10px] uppercase tracking-[0.18em] text-white/36">
                          {weekdayLabels[index]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </GlassPanel>
            </MotionDiv>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isPaywallOpen ? (
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 backdrop-blur-md"
            onClick={() => setIsPaywallOpen(false)}
          >
            <GlassPanel
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.95 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-xl rounded-[32px] border-white/[0.1] bg-[#080808]/92 p-8 shadow-[0_40px_120px_-48px_rgba(0,0,0,0.88)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04]">
                <Code2 className="h-6 w-6 text-white/82" strokeWidth={1.8} />
              </div>

              <h2 className="mt-6 text-3xl font-medium tracking-tight text-white/95">
                {t('apiDashboard.paywall.title')}
              </h2>
              <p className="mt-4 text-sm leading-7 text-white/58 sm:text-base">
                {t('apiDashboard.paywall.description')}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/pricing"
                  onClick={() => setIsPaywallOpen(false)}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-all duration-300 hover:scale-[1.02] hover:bg-white/90"
                >
                  {t('apiDashboard.paywall.cta')}
                  <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                </Link>
                <button
                  type="button"
                  onClick={() => setIsPaywallOpen(false)}
                  className="inline-flex items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] px-6 py-3 text-sm font-medium text-white/72 transition-colors duration-300 hover:bg-white/[0.08] hover:text-white"
                >
                  {t('apiDashboard.paywall.dismiss')}
                </button>
              </div>
            </GlassPanel>
          </MotionDiv>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
