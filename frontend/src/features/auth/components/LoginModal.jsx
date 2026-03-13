import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import AuthModalShell, {
  authInlineLinkClassName,
  authInputClassName,
  authLabelClassName,
  authPrimaryButtonClassName,
} from './AuthModalShell.jsx';
import { buildAuthEndpoint, parsePayload } from '../lib/authApi.js';

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

export default function LoginModal({ apiBase, onClose, onSwitch }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) {
      return;
    }

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail || !password) {
      toast.error(t('auth.validationRequired', 'Please fill in all required fields.'));
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(buildAuthEndpoint(apiBase, 'login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          captchaToken: '',
          'cf-turnstile-response': '',
        }),
      });
      const payload = await parsePayload(response);
      const sessionToken = String(payload?.token || payload?.access_token || '').trim();
      const sessionUser = payload?.user && typeof payload.user === 'object' ? payload.user : null;

      if (!response.ok || !sessionToken) {
        throw new Error(payload?.message || t('auth.invalidCredentials', 'Invalid email or password.'));
      }

      persistAuthSession({
        token: sessionToken,
        email: normalizedEmail,
        user: sessionUser,
      });

      toast.success(payload?.message || t('toastLoginSuccess', 'Signed in successfully.'));
      onClose();
    } catch (submitError) {
      toast.error(String(submitError?.message || t('auth.loginFailed', 'Unable to sign in. Please try again.')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthModalShell
      eyebrow={t('auth.loginEyebrow', 'MegaConvert Access')}
      title={t('auth.loginSubmit', 'Sign in')}
      subtitle={t('auth.loginSubtitle', 'Return to your private conversion workspace and continue exactly where you left off.')}
      onClose={onClose}
      footer={(
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onSwitch('forgot-password')}
            className={authInlineLinkClassName}
          >
            {t('auth.forgotLink', 'Forgot password?')}
          </button>

          <button
            type="button"
            onClick={() => onSwitch('register')}
            className={authInlineLinkClassName}
          >
            {t('auth.createAccount', 'Create one')}
          </button>
        </div>
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
            autoComplete="current-password"
            placeholder={t('auth.passwordPlaceholder', 'Your secure password')}
            className={authInputClassName}
            required
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className={authPrimaryButtonClassName}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
              {t('auth.loginLoading', 'Signing in...')}
            </>
          ) : (
            t('auth.loginSubmit', 'Sign in')
          )}
        </button>
      </form>
    </AuthModalShell>
  );
}
