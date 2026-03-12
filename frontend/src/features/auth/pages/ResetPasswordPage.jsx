import React, { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AuthSceneShell from '../components/AuthSceneShell.jsx';
import { buildAuthEndpoint, parsePayload } from '../lib/authApi.js';

export default function ResetPasswordPage({ apiBase, onNavigate }) {
  const { t } = useTranslation();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const token = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return String(params.get('token') || '').trim();
  }, []);

  const navigate = (to) => {
    if (typeof onNavigate === 'function') onNavigate(to);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    if (!token) {
      setError(t('auth.resetTokenMissing', 'Reset token is missing.'));
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError(t('auth.validationRequired', 'Please fill in all required fields.'));
      return;
    }

    if (newPassword.length < 8) {
      setError(t('auth.passwordMinLength', 'Password must be at least 8 characters long.'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch', 'Passwords do not match.'));
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(buildAuthEndpoint(apiBase, 'reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          token,
          newPassword
        })
      });
      const payload = await parsePayload(response);
      if (!response.ok) {
        throw new Error(payload?.message || t('auth.resetFailed', 'Unable to reset password.'));
      }

      setSuccess(payload?.message || t('auth.resetSuccess', 'Password updated successfully.'));
      setTimeout(() => navigate('/login'), 900);
    } catch (submitError) {
      setError(String(submitError?.message || t('auth.resetFailed', 'Unable to reset password.')));
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
      pageKey="auth-reset-page"
      eyebrow={t('auth.resetEyebrow', 'Account recovery')}
      title={t('auth.resetTitle', 'Set a new password')}
      subtitle={t('auth.resetSubtitle', 'Create a fresh password and return to your workspace with a clean session.')}
      sideLabel={t('auth.sideLabelReset', 'Secure Reset')}
      sideTitle={t('auth.sideTitleReset', 'Finish recovery with one confident step.')}
      sideCopy={t('auth.sideCopyReset', 'This page accepts the short-lived token from your email and turns it into a new password without extra friction.')}
      sidePoints={[
        {
          title: t('auth.sidePointTokenTitle', 'Time-limited token'),
          copy: t('auth.sidePointTokenCopy', 'Reset access is temporary by design, which reduces the blast radius if a link is exposed.')
        },
        {
          title: t('auth.sidePointPasswordTitle', 'Fresh secret'),
          copy: t('auth.sidePointPasswordCopy', 'A new password replaces the old one immediately so you can continue with a clean auth state.')
        },
        {
          title: t('auth.sidePointContinueTitle', 'Continue smoothly'),
          copy: t('auth.sidePointContinueCopy', 'As soon as the password is updated, you can sign in again and resume conversions without extra setup.')
        }
      ]}
      footer={footer}
    >
      {!token && <div className="auth-status-card auth-status-card-error mb-4">{t('auth.resetTokenMissing', 'Reset token is missing.')}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="auth-field-label">{t('auth.newPasswordLabel', 'New password')}</span>
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
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

        {error && <div className="auth-status-card auth-status-card-error">{error}</div>}
        {success && <div className="auth-status-card auth-status-card-success">{success}</div>}

        <button
          type="submit"
          disabled={submitting || !token}
          className="auth-primary-btn w-full justify-center"
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {t('auth.resetLoading', 'Updating...')}
            </>
          ) : (
            t('auth.resetSubmit', 'Update password')
          )}
        </button>
      </form>
    </AuthSceneShell>
  );
}
