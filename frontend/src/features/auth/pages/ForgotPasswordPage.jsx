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

const resolveApiBase = (value) => String(value || '').replace(/\/+$/g, '');
const buildAuthEndpoint = (apiBase, route) => {
  const base = resolveApiBase(apiBase);
  const normalizedRoute = String(route || '').replace(/^\/+/g, '');
  return /\/api$/i.test(base)
    ? `${base}/auth/${normalizedRoute}`
    : `${base}/api/auth/${normalizedRoute}`;
};

export default function ForgotPasswordPage({ apiBase, onNavigate }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const navigate = (to) => {
    if (typeof onNavigate === 'function') onNavigate(to);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      setError(t('auth.validationRequired', 'Please fill in all required fields.'));
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(buildAuthEndpoint(apiBase, 'forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail })
      });
      const payload = await parsePayload(response);
      if (!response.ok) {
        throw new Error(payload?.message || t('auth.forgotFailed', 'Unable to process request.'));
      }

      setSuccess(
        payload?.message ||
        t('auth.forgotSuccess', 'If this email exists, we sent a password reset link.')
      );
    } catch (submitError) {
      setError(String(submitError?.message || t('auth.forgotFailed', 'Unable to process request.')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageTransition pageKey="auth-forgot-page">
      <section className="min-h-[calc(100vh-5rem)] pt-28 pb-16 px-4">
        <div className="max-w-md mx-auto">
          <div className="rounded-3xl border border-white/40 dark:border-white/10 bg-white/60 dark:bg-white/10 backdrop-blur-2xl shadow-2xl p-6 md:p-8 text-slate-900 dark:text-slate-100">
            <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
              {t('auth.forgotEyebrow', 'Account recovery')}
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {t('auth.forgotTitle', 'Forgot password')}
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {t('auth.forgotSubtitle', 'Enter your email and we will send a reset link.')}
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

              {error && (
                <div className="rounded-2xl border border-red-300/60 dark:border-red-400/20 bg-red-100/70 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-2xl border border-emerald-300/60 dark:border-emerald-400/20 bg-emerald-100/70 dark:bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">
                  {success}
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
                    {t('auth.forgotLoading', 'Sending...')}
                  </>
                ) : (
                  t('auth.forgotSubmit', 'Send reset link')
                )}
              </button>
            </form>

            <div className="mt-6 text-sm text-center">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="font-semibold text-blue-600 dark:text-blue-300 hover:underline"
              >
                {t('auth.backToLogin', 'Back to sign in')}
              </button>
            </div>
          </div>
        </div>
      </section>
    </PageTransition>
  );
}
