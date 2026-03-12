import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AuthSceneShell from '../components/AuthSceneShell.jsx';
import { buildAuthEndpoint, parsePayload } from '../lib/authApi.js';

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
        credentials: 'include',
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

  const footer = (
    <div className="text-sm text-center">
      <button
        type="button"
        onClick={() => navigate('/login')}
        className="auth-inline-link"
      >
        {t('auth.backToLogin', 'Back to sign in')}
      </button>
    </div>
  );

  return (
    <AuthSceneShell
      pageKey="auth-forgot-page"
      eyebrow={t('auth.forgotEyebrow', 'Account recovery')}
      title={t('auth.forgotTitle', 'Forgot password')}
      subtitle={t('auth.forgotSubtitle', 'Tell us which email you used and we will send a secure reset link.')}
      sideLabel={t('auth.sideLabelRecovery', 'Recovery Route')}
      sideTitle={t('auth.sideTitleRecovery', 'Fast recovery, no support ticket maze.')}
      sideCopy={t('auth.sideCopyRecovery', 'The reset flow is simple on purpose: request a link, confirm your identity from your mailbox, and return to work.')}
      sidePoints={[
        {
          title: t('auth.sidePointMailTitle', 'One secure email'),
          copy: t('auth.sidePointMailCopy', 'A time-limited reset token is delivered to your inbox instead of exposing anything inside the app.')
        },
        {
          title: t('auth.sidePointSafeTitle', 'Quiet by design'),
          copy: t('auth.sidePointSafeCopy', 'The flow does not reveal whether an email exists, which keeps account enumeration risk low.')
        },
        {
          title: t('auth.sidePointReturnTitle', 'Back in seconds'),
          copy: t('auth.sidePointReturnCopy', 'Once the new password is set, your normal login path and social providers continue to work as before.')
        }
      ]}
      footer={footer}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
              {t('auth.forgotLoading', 'Sending...')}
            </>
          ) : (
            t('auth.forgotSubmit', 'Send reset link')
          )}
        </button>
      </form>
    </AuthSceneShell>
  );
}
