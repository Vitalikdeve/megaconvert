import React, { useEffect, useState } from 'react';
import { Fingerprint, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AuthSceneShell from '../components/AuthSceneShell.jsx';
import AuthSocialButtons from '../components/AuthSocialButtons.jsx';
import { buildAuthEndpoint, parsePayload } from '../lib/authApi.js';
import { beginPasskeyAuthentication, resolvePasskeyCapabilities } from '../lib/passkeys.js';

export default function LoginPage({ apiBase, onNavigate, onAuthSuccess }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [passkeyState, setPasskeyState] = useState({ supported: false, platformAuthenticator: false });
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    resolvePasskeyCapabilities().then((capabilities) => {
      if (!cancelled) setPasskeyState(capabilities);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const handlePasskeyLogin = async () => {
    if (passkeyLoading) return;
    setPasskeyLoading(true);
    setError('');

    try {
      const payload = await beginPasskeyAuthentication({
        apiBase,
        email
      });
      const sessionToken = String(payload?.token || payload?.access_token || '').trim();
      const sessionUser = payload?.user && typeof payload.user === 'object' ? payload.user : null;
      if (!sessionToken) {
        throw new Error(t('auth.passkeyFailed', 'Passkey authentication failed.'));
      }

      localStorage.setItem('mc_auth_token', sessionToken);
      if (sessionUser?.email) localStorage.setItem('mc_auth_email', String(sessionUser.email).trim().toLowerCase());
      if (sessionUser) localStorage.setItem('mc_auth_user', JSON.stringify(sessionUser));
      onAuthSuccess?.({
        token: sessionToken,
        email: sessionUser?.email || '',
        user: sessionUser
      });
      navigate('/');
    } catch (passkeyError) {
      setError(String(passkeyError?.message || t('auth.passkeyFailed', 'Passkey authentication failed.')));
    } finally {
      setPasskeyLoading(false);
    }
  };

  const footer = (
    <>
      <div className="flex items-center justify-between gap-3 text-sm">
        <button
          type="button"
          onClick={() => navigate('/forgot-password')}
          className="auth-inline-link"
        >
          {t('auth.forgotLink', 'Forgot password?')}
        </button>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="auth-inline-link auth-inline-link-muted"
        >
          {t('btnGoHome', 'Go home')}
        </button>
      </div>
      <div className="mt-5 text-sm text-slate-600 dark:text-slate-300 text-center">
        {t('auth.noAccount', "Don't have an account?")}{' '}
        <button
          type="button"
          onClick={() => navigate('/register')}
          className="auth-inline-link"
        >
          {t('auth.createAccount', 'Create one')}
        </button>
      </div>
    </>
  );

  return (
    <AuthSceneShell
      pageKey="auth-login-page"
      eyebrow={t('auth.loginEyebrow', 'MegaConvert Access')}
      title={t('auth.loginTitle', 'Welcome back')}
      subtitle={t('auth.loginSubtitle', 'Return to your private conversion workspace and continue exactly where you left off.')}
      sideLabel={t('auth.sideLabelSecurity', 'Private Session Layer')}
      sideTitle={t('auth.sideTitleLogin', 'Sign in without friction, keep every workflow in motion.')}
      sideCopy={t('auth.sideCopyLogin', 'Email, social login, recovery and session continuity are designed as one polished flow instead of four disconnected forms.')}
      sidePoints={[
        {
          title: t('auth.sidePointResumeTitle', 'Resume instantly'),
          copy: t('auth.sidePointResumeCopy', 'Jump back into pending conversions, MegaDrop transfers and AI jobs without losing context.')
        },
        {
          title: t('auth.sidePointPrivateTitle', 'Private by default'),
          copy: t('auth.sidePointPrivateCopy', 'Your auth session stays on your device and works with the same local-first product philosophy.')
        },
        {
          title: t('auth.sidePointSocialTitle', 'Social or classic'),
          copy: t('auth.sidePointSocialCopy', 'Use Google, GitHub, Facebook, X, or your email password depending on the fastest path.')
        }
      ]}
      footer={footer}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {passkeyState.supported ? (
          <button
            type="button"
            onClick={handlePasskeyLogin}
            disabled={passkeyLoading}
            className="auth-primary-btn w-full justify-center"
          >
            {passkeyLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t('auth.passkeyLoading', 'Checking passkey...')}
              </>
            ) : (
              <>
                <Fingerprint size={16} />
                {t('auth.passkeyLogin', passkeyState.platformAuthenticator ? 'Continue with Passkey' : 'Use a security key or passkey')}
              </>
            )}
          </button>
        ) : null}

        <label className="block">
          <span className="auth-field-label">{t('auth.emailLabel', 'Email')}</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t('auth.emailPlaceholder', 'you@example.com')}
            autoComplete="email"
            className="auth-input mt-2"
            required
          />
        </label>

        <label className="block">
          <span className="auth-field-label">{t('auth.passwordLabel', 'Password')}</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t('auth.passwordPlaceholder', 'Your secure password')}
            autoComplete="current-password"
            className="auth-input mt-2"
            required
          />
        </label>

        {error && <div className="auth-status-card auth-status-card-error">{error}</div>}

        <button
          type="submit"
          disabled={submitting}
          className="auth-primary-btn w-full justify-center"
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

        <AuthSocialButtons apiBase={apiBase} />
      </form>
    </AuthSceneShell>
  );
}
