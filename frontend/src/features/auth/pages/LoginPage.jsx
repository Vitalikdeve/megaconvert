import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PageTransition from '../../../components/PageTransition.jsx';

const parsePayload = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

const resolveApiBase = (value) => {
  const normalized = String(value || '').trim().replace(/\/+$/g, '');
  if (!normalized || !/^https?:\/\//i.test(normalized)) return normalized;
  try {
    const parsed = new URL(normalized);
    const host = String(parsed.hostname || '').trim().toLowerCase();
    const loopbackHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (!loopbackHost && String(parsed.port || '').trim() === '5000') {
      parsed.port = '';
    }
    if (!loopbackHost && typeof window !== 'undefined' && window.location.protocol === 'https:' && parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
    }
    parsed.pathname = parsed.pathname.replace(/\/+$/g, '');
    return parsed.toString().replace(/\/+$/g, '');
  } catch {
    return normalized;
  }
};
const buildAuthEndpoint = (apiBase, route) => {
  const base = resolveApiBase(apiBase);
  const normalizedRoute = String(route || '').replace(/^\/+/g, '');
  return /\/api$/i.test(base)
    ? `${base}/auth/${normalizedRoute}`
    : `${base}/api/auth/${normalizedRoute}`;
};

const SOCIAL_AUTH_PROVIDERS = [
  { id: 'google', key: 'auth.oauthGoogle', fallback: 'Google' },
  { id: 'github', key: 'auth.oauthGithub', fallback: 'GitHub' },
  { id: 'facebook', key: 'auth.oauthFacebook', fallback: 'Facebook' },
  { id: 'x', key: 'auth.oauthX', fallback: 'X' }
];

const SocialIcon = ({ provider }) => {
  if (provider === 'google') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
        <path
          fill="currentColor"
          d="M20.3 12.2c0-.7-.1-1.3-.2-1.8H12v3.4h4.7c-.2 1.1-.9 2.7-2.4 3.7v2.8h3.9c2.3-2.1 3.6-5.2 3.6-8.1ZM12 20.5a8.2 8.2 0 0 0 5.7-2.1l-3.9-2.8c-1 .7-2.3 1.2-3.9 1.2-3 0-5.5-2-6.4-4.6H-.5v2.9A12 12 0 0 0 12 20.5ZM5.6 12c0-.8.1-1.5.4-2.2V6.9H3A12 12 0 0 0 0 12c0 1.9.5 3.7 1.4 5.1l3-2.9a8 8 0 0 1-.4-2.2ZM12 3.8c1.7 0 3.2.6 4.4 1.7l3.2-3.2A12 12 0 0 0 0 8.9l3 2.9c.9-2.6 3.4-4.6 6.4-4.6Z"
        />
      </svg>
    );
  }
  if (provider === 'github') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
        <path
          fill="currentColor"
          d="M12 .6a12 12 0 0 0-3.8 23.4c.6.1.8-.2.8-.6v-2.2c-3.4.7-4.1-1.5-4.1-1.5-.6-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.4-5.5-6 0-1.4.5-2.6 1.3-3.5-.1-.3-.6-1.7.1-3.4 0 0 1.1-.3 3.6 1.3a12 12 0 0 1 6.5 0c2.5-1.6 3.6-1.3 3.6-1.3.7 1.7.2 3.1.1 3.4.8 1 1.3 2.1 1.3 3.5 0 4.7-2.8 5.8-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .4.2.7.8.6A12 12 0 0 0 12 .6Z"
        />
      </svg>
    );
  }
  if (provider === 'facebook') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
        <path
          fill="currentColor"
          d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9V24A12 12 0 0 0 24 12Z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        fill="currentColor"
        d="M18.24 2h3.37l-7.37 8.42L23 22h-6.76l-5.3-6.93L4.87 22H1.5l7.89-9.02L1 2h6.93l4.8 6.34L18.24 2Zm-1.18 18h1.87L6.9 3.9H4.9L17.06 20Z"
      />
    </svg>
  );
};

const buildSocialConnectUrl = (apiBase, provider) => (
  buildAuthEndpoint(apiBase || import.meta.env.VITE_API_BASE || '', `connect/${provider}`)
);

export default function LoginPage({ apiBase, onNavigate, onAuthSuccess }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const navigate = (to) => {
    if (typeof onNavigate === 'function') onNavigate(to);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError(t('auth.validationRequired', 'Please fill in all required fields.'));
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const captchaToken = '';
      const response = await fetch(buildAuthEndpoint(apiBase, 'login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          captchaToken,
          'cf-turnstile-response': captchaToken
        })
      });
      const payload = await parsePayload(response);
      const sessionToken = String(payload?.token || payload?.access_token || '').trim();
      const sessionUser = payload?.user && typeof payload.user === 'object' ? payload.user : null;
      if (!response.ok || !sessionToken) {
        throw new Error(payload?.message || t('auth.invalidCredentials', 'Invalid email or password.'));
      }

      localStorage.setItem('mc_auth_token', sessionToken);
      localStorage.setItem('mc_auth_email', normalizedEmail);
      if (sessionUser) {
        try {
          localStorage.setItem('mc_auth_user', JSON.stringify(sessionUser));
        } catch {
          // Ignore storage quota issues and continue login flow.
        }
      }
      if (typeof onAuthSuccess === 'function') {
        onAuthSuccess({
          token: sessionToken,
          email: normalizedEmail,
          user: sessionUser
        });
      }
      navigate('/');
    } catch (submitError) {
      setError(String(submitError?.message || t('auth.loginFailed', 'Unable to sign in. Please try again.')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageTransition pageKey="auth-login-page">
      <section className="min-h-[calc(100vh-5rem)] pt-28 pb-16 px-4">
        <div className="max-w-md mx-auto">
          <div className="rounded-3xl border border-white/40 dark:border-white/10 bg-white/60 dark:bg-white/10 backdrop-blur-2xl shadow-2xl p-6 md:p-8 text-slate-900 dark:text-slate-100">
            <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
              {t('auth.loginEyebrow', 'MegaConvert Auth')}
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {t('auth.loginTitle', 'Welcome back')}
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {t('auth.loginSubtitle', 'Sign in with your email and password.')}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  {t('auth.emailLabel', 'Email')}
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={t('auth.emailPlaceholder', 'you@example.com')}
                  autoComplete="email"
                  className="mt-2 w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-2.5 text-sm"
                  required
                />
              </label>

              <label className="block">
                <span className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  {t('auth.passwordLabel', 'Password')}
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t('auth.passwordPlaceholder', 'Your secure password')}
                  autoComplete="current-password"
                  className="mt-2 w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-2.5 text-sm"
                  required
                />
              </label>

              {error && (
                <div className="rounded-2xl border border-red-300/60 dark:border-red-400/20 bg-red-100/70 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-2xl px-5 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 ease-out hover:scale-[1.02] flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {t('auth.loginLoading', 'Signing in...')}
                  </>
                ) : (
                  t('auth.loginSubmit', 'Sign in')
                )}
              </button>

              <div className="pt-2">
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                  <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {t('auth.orContinueWith', 'Or continue with')}
                  </span>
                  <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {SOCIAL_AUTH_PROVIDERS.map((provider) => (
                    <a
                      key={provider.id}
                      href={buildSocialConnectUrl(apiBase, provider.id)}
                      className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                    >
                      <SocialIcon provider={provider.id} />
                      <span>{t(provider.key, provider.fallback)}</span>
                    </a>
                  ))}
                </div>
              </div>
            </form>

            <div className="mt-4 flex items-center justify-between gap-3 text-sm">
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-blue-600 dark:text-blue-300 hover:underline"
              >
                {t('auth.forgotLink', 'Forgot password?')}
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="text-slate-500 dark:text-slate-400 hover:underline"
              >
                {t('btnGoHome', 'Go home')}
              </button>
            </div>

            <div className="mt-6 text-sm text-slate-600 dark:text-slate-300 text-center">
              {t('auth.noAccount', "Don't have an account?")}{' '}
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="font-semibold text-blue-600 dark:text-blue-300 hover:underline"
              >
                {t('auth.createAccount', 'Create one')}
              </button>
            </div>
          </div>
        </div>
      </section>
    </PageTransition>
  );
}
