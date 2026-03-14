import React, { useMemo } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { blockedTimezones } from '../../lib/compliance.js';
import GlassPanel from '../ui/GlassPanel.jsx';

const BLOCKED_TIMEZONE_SET = new Set(blockedTimezones);

function readDeviceTimezone() {
  if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') {
    return '';
  }

  try {
    return String(Intl.DateTimeFormat().resolvedOptions().timeZone || '').trim();
  } catch {
    return '';
  }
}

export default function ComplianceGuard({ children }) {
  const { t } = useTranslation();
  const timezone = useMemo(() => readDeviceTimezone(), []);
  const isBlocked = BLOCKED_TIMEZONE_SET.has(timezone);

  if (!isBlocked) {
    return children;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020202] px-4 py-10 text-white sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-6rem] top-[8%] h-[18rem] w-[18rem] rounded-full bg-red-500/16 blur-[100px]" />
        <div className="absolute right-[-8rem] top-[14%] h-[22rem] w-[22rem] rounded-full bg-amber-400/12 blur-[100px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(2,2,2,0)_24%,rgba(2,2,2,0.96)_100%)]" />
      </div>

      <GlassPanel className="relative w-full max-w-3xl rounded-[36px] border-red-300/12 bg-[#070707]/86 px-8 py-10 text-center shadow-[0_42px_140px_-64px_rgba(0,0,0,0.92)] sm:px-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-red-300/18 bg-red-300/10 text-red-100">
          <ShieldAlert className="h-7 w-7" strokeWidth={1.8} />
        </div>

        <div className="mt-6 inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-white/42">
          {t('complianceGuard.code')}
        </div>

        <h1 className="mt-6 text-4xl font-medium tracking-[-0.05em] text-white/94 sm:text-5xl">
          {t('complianceGuard.title')}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-8 text-white/62 sm:text-base">
          {t('complianceGuard.description')}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] px-5 py-4 text-start">
            <div className="text-[10px] uppercase tracking-[0.26em] text-white/34">
              {t('complianceGuard.detectedTimezone')}
            </div>
            <div className="mt-3 font-mono text-sm text-white/86">
              {timezone || t('complianceGuard.unknownTimezone')}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] px-5 py-4 text-start">
            <div className="text-[10px] uppercase tracking-[0.26em] text-white/34">
              {t('complianceGuard.statusLabel')}
            </div>
            <div className="mt-3 text-sm font-medium text-red-100/90">
              {t('complianceGuard.statusValue')}
            </div>
          </div>
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-sm leading-7 text-white/46">
          {t('complianceGuard.explainer')}
        </p>
      </GlassPanel>
    </div>
  );
}
