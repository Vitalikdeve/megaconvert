import React, { useEffect, useState } from 'react';
import { Fingerprint, Loader2 } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import { useTranslation } from 'react-i18next';
import AuthSceneShell from '../components/AuthSceneShell.jsx';
import AuthSocialButtons from '../components/AuthSocialButtons.jsx';
import { buildAuthEndpoint, parsePayload } from '../lib/authApi.js';
import { beginPasskeyRegistration, resolvePasskeyCapabilities } from '../lib/passkeys.js';

const TURNSTILE_SITE_KEY = String(
  import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAACobtnPKcQ7ewkRH'
).trim();

export default function RegisterPage({ apiBase, onNavigate, onAuthSuccess }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
    if (!name.trim() || !normalizedEmail || !password || !confirmPassword) {
      setError(t('auth.validationRequired', 'Please fill in all required fields.'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch', 'Passwords do not match.'));
      return;
    }

    if (password.length < 8) {
      setError(t('auth.passwordMinLength', 'Password must be at least 8 characters long.'));
      return;
    }

    if (!turnstileToken) {
      setError(t('auth.captchaRequired', 'Please complete the captcha challenge.'));
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

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
          'cf-turnstile-response': turnstileToken
        })
      });
      const payload = await parsePayload(response);
      const sessionToken = String(payload?.token || payload?.access_token || '').trim();
      const sessionUser = payload?.user && typeof payload.user === 'object' ? payload.user : null;
      if (!response.ok || !sessionToken) {
        throw new Error(payload?.message || t('auth.registerFailed', 'Unable to create account.'));
      }

      localStorage.setItem('mc_auth_token', sessionToken);
      localStorage.setItem('mc_auth_email', normalizedEmail);
      if (sessionUser) {
        try {
          localStorage.setItem('mc_auth_user', JSON.stringify(sessionUser));
        } catch {
          // Ignore storage quota issues and continue registration flow.
        }
      }
      if (typeof onAuthSuccess === 'function') {
        onAuthSuccess({
          token: sessionToken,
          email: normalizedEmail,
          user: sessionUser
        });
      }
      setSuccess(t('auth.registerSuccess', 'Account created successfully.'));
      setTimeout(() => navigate('/'), 600);
    } catch (submitError) {
      setError(String(submitError?.message || t('auth.registerFailed', 'Unable to create account.')));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasskeyRegister = async () => {
    if (passkeyLoading) return;

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!name.trim() || !normalizedEmail) {
      setError(t('auth.validationRequired', 'Please fill in all required fields.'));
      return;
    }
    if (!turnstileToken) {
      setError(t('auth.captchaRequired', 'Please complete the captcha challenge.'));
      return;
    }

    setPasskeyLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = await beginPasskeyRegistration({
        apiBase,
        name: String(name || '').trim(),
        email: normalizedEmail,
        captchaToken: turnstileToken
      });
      const sessionToken = String(payload?.token || payload?.access_token || '').trim();
      const sessionUser = payload?.user && typeof payload.user === 'object' ? payload.user : null;
      if (!sessionToken) {
        throw new Error(t('auth.passkeyRegisterFailed', 'Unable to create passkey account.'));
      }

      localStorage.setItem('mc_auth_token', sessionToken);
      if (sessionUser?.email) localStorage.setItem('mc_auth_email', String(sessionUser.email).trim().toLowerCase());
      if (sessionUser) localStorage.setItem('mc_auth_user', JSON.stringify(sessionUser));
      onAuthSuccess?.({
        token: sessionToken,
        email: sessionUser?.email || normalizedEmail,
        user: sessionUser
      });
      setSuccess(t('auth.passkeyRegisterSuccess', 'Passkey account created successfully.'));
      setTimeout(() => navigate('/'), 500);
    } catch (passkeyError) {
      setError(String(passkeyError?.message || t('auth.passkeyRegisterFailed', 'Unable to create passkey account.')));
    } finally {
      setPasskeyLoading(false);
    }
  };

  const footer = (
    <div className="text-sm text-slate-600 dark:text-slate-300 text-center">
      {t('auth.hasAccount', 'Already have an account?')}{' '}
      <button
        type="button"
        onClick={() => navigate('/login')}
        className="auth-inline-link"
      >
        {t('auth.loginSubmit', 'Sign in')}
      </button>
    </div>
  );

  return (
    <AuthSceneShell
      pageKey="auth-register-page"
      eyebrow={t('auth.registerEyebrow', 'MegaConvert Access')}
      title={t('auth.registerTitle', 'Create your account')}
      subtitle={t('auth.registerSubtitle', 'Open a premium local-first workspace with privacy controls, AI tools and seamless device handoff.')}
      sideLabel={t('auth.sideLabelLaunch', 'Launch Protocol')}
      sideTitle={t('auth.sideTitleRegister', 'One account for conversion, sharing and AI workflows.')}
      sideCopy={t('auth.sideCopyRegister', 'Registration is protected with Cloudflare Turnstile and designed to feel as lightweight as the rest of the product.')}
      sidePoints={[
        {
          title: t('auth.sidePointCaptchaTitle', 'Protected signup'),
          copy: t('auth.sidePointCaptchaCopy', 'Turnstile filters abuse without turning your onboarding into a clunky enterprise form.')
        },
        {
          title: t('auth.sidePointCrossDeviceTitle', 'Cross-device ready'),
          copy: t('auth.sidePointCrossDeviceCopy', 'The same account unlocks MegaDrop sessions, billing later and your personal workspace history.')
        },
        {
          title: t('auth.sidePointFastTitle', 'Fast by default'),
          copy: t('auth.sidePointFastCopy', 'Most heavy processing stays in the browser, so account creation is about continuity, not dependence on servers.')
        }
      ]}
      footer={footer}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {passkeyState.supported ? (
          <button
            type="button"
            onClick={handlePasskeyRegister}
            disabled={passkeyLoading}
            className="auth-primary-btn w-full justify-center"
          >
            {passkeyLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t('auth.passkeyCreating', 'Creating passkey...')}
              </>
            ) : (
              <>
                <Fingerprint size={16} />
                {t('auth.passkeyRegister', passkeyState.platformAuthenticator ? 'Create with Passkey' : 'Register a passkey')}
              </>
            )}
          </button>
        ) : null}

        <label className="block">
          <span className="auth-field-label">{t('auth.nameLabel', 'Name')}</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('auth.namePlaceholder', 'Your name')}
            autoComplete="name"
            className="auth-input mt-2"
            required
          />
        </label>

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

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="auth-field-label">{t('auth.passwordLabel', 'Password')}</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t('auth.passwordPlaceholder', 'At least 8 characters')}
              autoComplete="new-password"
              className="auth-input mt-2"
              required
            />
          </label>

          <label className="block">
            <span className="auth-field-label">{t('auth.confirmPasswordLabel', 'Confirm password')}</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder={t('auth.confirmPasswordPlaceholder', 'Repeat your password')}
              autoComplete="new-password"
              className="auth-input mt-2"
              required
            />
          </label>
        </div>

        <div className="auth-turnstile-wrap">
          <Turnstile
            siteKey={TURNSTILE_SITE_KEY}
            options={{ theme: 'auto', size: 'flexible' }}
            onSuccess={(token) => {
              setTurnstileToken(String(token || '').trim());
              setError('');
            }}
            onExpire={() => setTurnstileToken('')}
            onError={() => setTurnstileToken('')}
          />
        </div>

        {error && <div className="auth-status-card auth-status-card-error">{error}</div>}
        {success && <div className="auth-status-card auth-status-card-success">{success}</div>}

        <button
          type="submit"
          disabled={submitting}
          className="auth-primary-btn w-full justify-center"
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {t('auth.registerLoading', 'Creating account...')}
            </>
          ) : (
            t('auth.registerSubmit', 'Create account')
          )}
        </button>

        <AuthSocialButtons apiBase={apiBase} />
      </form>
    </AuthSceneShell>
  );
}
