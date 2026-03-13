import React, { useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AuthSceneShell from '../components/AuthSceneShell.jsx';

export default function AuthCallbackPage({ onNavigate, onAuthSuccess }) {
  const { t } = useTranslation();
  const params = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);

  const callbackState = useMemo(() => {
    const token = String(params.get('token') || params.get('access_token') || '').trim();
    const email = String(params.get('email') || '').trim().toLowerCase();
    const provider = String(params.get('provider') || '').trim().toLowerCase();
    const error = String(params.get('error') || '').trim();
    const message = String(params.get('message') || '').trim();

    if (error || !token) {
      return {
        status: 'error',
        token: '',
        email,
        provider,
        message: message || error || t('authCallback.defaultError')
      };
    }

    return {
      status: 'success',
      token,
      email,
      provider,
      message: t('authCallback.progress')
    };
  }, [params, t]);

  useEffect(() => {
    if (callbackState.status !== 'success') {
      return;
    }

    try {
      localStorage.setItem('mc_auth_token', callbackState.token);
      if (callbackState.email) localStorage.setItem('mc_auth_email', callbackState.email);
      const user = {
        email: callbackState.email,
        name: callbackState.email ? callbackState.email.split('@')[0] : t('userDefaultName'),
        provider: callbackState.provider
      };
      localStorage.setItem('mc_auth_user', JSON.stringify(user));
      onAuthSuccess?.({
        token: callbackState.token,
        email: callbackState.email,
        user
      });
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/auth/callback');
      }
      window.setTimeout(() => onNavigate?.('/'), 500);
    } catch {
      // If localStorage is unavailable, keep rendering the callback state and let the user retry.
    }
  }, [callbackState, onAuthSuccess, onNavigate, t]);

  return (
    <AuthSceneShell
      pageKey="auth-callback-page"
      eyebrow={t('authCallback.eyebrow')}
      title={callbackState.status === 'error' ? t('authCallback.errorTitle') : t('authCallback.successTitle')}
      subtitle={callbackState.status === 'error' ? callbackState.message : t('authCallback.successSubtitle')}
      sideLabel={t('authCallback.sideLabel')}
      sideTitle={t('authCallback.sideTitle')}
      sideCopy={t('authCallback.sideCopy')}
      sidePoints={[
        {
          title: t('authCallback.point1Title'),
          copy: t('authCallback.point1Copy')
        },
        {
          title: t('authCallback.point2Title'),
          copy: t('authCallback.point2Copy')
        }
      ]}
    >
      <div className="rounded-[1.5rem] border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/5 px-5 py-6">
        <div className="flex items-center gap-3 text-slate-900 dark:text-slate-100">
          {callbackState.status === 'error' ? (
            <span className="text-sm font-medium">{callbackState.message}</span>
          ) : (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm font-medium">{t('authCallback.progress')}</span>
            </>
          )}
        </div>
      </div>
    </AuthSceneShell>
  );
}
