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

export default function ForgotPasswordModal({ apiBase, onClose, onSwitch }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) {
      return;
    }

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error(t('auth.validationRequired', 'Please fill in all required fields.'));
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(buildAuthEndpoint(apiBase, 'forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const payload = await parsePayload(response);

      if (!response.ok) {
        throw new Error(payload?.message || t('auth.forgotFailed', 'Unable to process request.'));
      }

      toast.success(
        payload?.message || t('toastForgotSuccess', 'If this email exists, we sent a password reset link.'),
      );
      onClose();
    } catch (submitError) {
      toast.error(String(submitError?.message || t('auth.forgotFailed', 'Unable to process request.')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthModalShell
      eyebrow={t('auth.forgotEyebrow', 'Account recovery')}
      title={t('auth.forgotTitle', 'Forgot password')}
      subtitle={t('auth.forgotSubtitle', 'Tell us which email you used and we will send a secure reset link.')}
      onClose={onClose}
      footer={(
        <div className="text-center">
          <button
            type="button"
            onClick={() => onSwitch('login')}
            className={authInlineLinkClassName}
          >
            {t('auth.backToLogin', 'Back to sign in')}
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

        <button
          type="submit"
          disabled={submitting}
          className={authPrimaryButtonClassName}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
              {t('auth.forgotLoading', 'Sending...')}
            </>
          ) : (
            t('auth.forgotSubmit', 'Send reset link')
          )}
        </button>
      </form>
    </AuthModalShell>
  );
}
