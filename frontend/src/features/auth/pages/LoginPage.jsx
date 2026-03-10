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
      const response = await fetch(buildAuthEndpoint(apiBase, 'login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: normalizedEmail,
          password
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
