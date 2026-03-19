import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import AuthModalShell from './AuthModalShell.jsx';
import {
  authInlineLinkClassName,
  authInputClassName,
  authLabelClassName,
  authPrimaryButtonClassName,
} from './authModalStyles.js';
import { buildAuthEndpoint, parsePayload } from '../lib/authApi.js';

const TURNSTILE_SITE_KEY = String(
  import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA',
).trim();

function persistAuthSession({ token, email, user }) {
  if (!token) {
    return;
  }

  localStorage.setItem('mc_auth_token', token);

  if (email) {
    localStorage.setItem('mc_auth_email', String(email).trim().toLowerCase());
  }

  if (user && typeof user === 'object') {
    try {
      localStorage.setItem('mc_auth_user', JSON.stringify(user));
    } catch {
      // Ignore storage quota issues and keep the session flow moving.
    }
  }
}

export default function RegisterModal({ apiBase, onClose, onSwitch }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) {
      return;
    }

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!String(name || '').trim() || !normalizedEmail || !password) {
      toast.error(t('auth.validationRequired', 'Please fill in all required fields.'));
      return;
    }
    if (!turnstileToken) {
      toast.error(t('auth.captchaRequired', 'Please complete the captcha challenge.'));
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(buildAuthEndpoint(apiBase, 'register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: String(name || '').trim(),
          email: normalizedEmail,
          password,
          turnstileToken,
          captchaToken: turnstileToken,
          'cf-turnstile-response': turnstileToken,
        }),
      });
      const payload = await parsePayload(response);
      const sessionToken = String(payload?.token || payload?.access_token || '').trim();
      const sessionUser = payload?.user && typeof payload.user === 'object' ? payload.user : null;

      if (!response.ok) {
        throw new Error(payload?.message || t('auth.registerFailed', 'Unable to create account.'));
      }

      if (sessionToken) {
        persistAuthSession({
          token: sessionToken,
          email: normalizedEmail,
          user: sessionUser,
        });
        toast.success(payload?.message || t('toastRegisterSuccess', 'Account created successfully.'));
        onClose();
        return;
      }

      toast.success(payload?.message || t('toastRegisterReady', 'Account created. You can sign in now.'));
      onSwitch('login');
    } catch (submitError) {
      toast.error(String(submitError?.message || t('auth.registerFailed', 'Unable to create account.')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthModalShell
      eyebrow={t('auth.registerEyebrow', 'MegaConvert Access')}
      title={t('auth.registerSubmit', 'Create account')}
      subtitle={t('auth.registerSubtitle', 'Open a premium local-first workspace with privacy controls, AI tools and seamless device handoff.')}
      onClose={onClose}
      footer={(
        <div className="text-center">
          <button
            type="button"
            onClick={() => onSwitch('login')}
            className={authInlineLinkClassName}
          >
            {`${t('auth.hasAccount', 'Already have an account?')} ${t('auth.loginSubmit', 'Sign in')}`}
          </button>
        </div>
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className={authLabelClassName}>{t('auth.nameLabel', 'Name')}</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            placeholder={t('auth.namePlaceholder', 'Your name')}
            className={authInputClassName}
            required
          />
        </label>

        <label className="block">
          <span className={authLabelClassName}>{t('auth.emailLabel', 'Email')}</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder={t('auth.emailPlaceholder', 'you@example.com')}
            className={authInputClassName}
            required
          />
        </label>

        <label className="block">
          <span className={authLabelClassName}>{t('auth.passwordLabel', 'Password')}</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            placeholder={t('auth.passwordPlaceholder', 'Create a secure password')}
            className={authInputClassName}
            required
          />
        </label>

        <div className="auth-turnstile-wrap">
          <Turnstile
            siteKey={TURNSTILE_SITE_KEY}
            onSuccess={(token) => setTurnstileToken(String(token || '').trim())}
            onExpire={() => setTurnstileToken('')}
            onError={() => setTurnstileToken('')}
            options={{ theme: 'dark' }}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className={authPrimaryButtonClassName}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
              {t('auth.registerLoading', 'Creating account...')}
            </>
          ) : (
            t('auth.registerSubmit', 'Create account')
          )}
        </button>
      </form>
    </AuthModalShell>
  );
}
