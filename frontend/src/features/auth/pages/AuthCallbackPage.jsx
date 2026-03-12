import React, { useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import AuthSceneShell from '../components/AuthSceneShell.jsx';

export default function AuthCallbackPage({ onNavigate, onAuthSuccess }) {
  const params = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);

  const callbackState = useMemo(() => {
    const token = String(params.get('token') || params.get('access_token') || '').trim();
    const email = String(params.get('email') || '').trim().toLowerCase();
    const provider = String(params.get('provider') || '').trim().toLowerCase();
    const error = String(params.get('error') || '').trim();
    const message = String(params.get('message') || '').trim();

    if (error || !token) {
      return {
        status: 'error',
        token: '',
        email,
        provider,
        message: message || error || 'OAuth callback did not return a valid session.'
      };
    }

    return {
      status: 'success',
      token,
      email,
      provider,
      message: 'Completing secure sign-in...'
    };
  }, [params]);

  useEffect(() => {
    if (callbackState.status !== 'success') {
      return;
    }

    try {
      localStorage.setItem('mc_auth_token', callbackState.token);
      if (callbackState.email) localStorage.setItem('mc_auth_email', callbackState.email);
      const user = {
        email: callbackState.email,
        name: callbackState.email ? callbackState.email.split('@')[0] : 'User',
        provider: callbackState.provider
      };
      localStorage.setItem('mc_auth_user', JSON.stringify(user));
      onAuthSuccess?.({
        token: callbackState.token,
        email: callbackState.email,
        user
      });
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/auth/callback');
      }
      window.setTimeout(() => onNavigate?.('/'), 500);
    } catch {
      // If localStorage is unavailable, keep rendering the callback state and let the user retry.
    }
  }, [callbackState, onAuthSuccess, onNavigate]);

  return (
    <AuthSceneShell
      pageKey="auth-callback-page"
      eyebrow="Identity Callback"
      title={callbackState.status === 'error' ? 'Sign-in failed' : 'Finishing secure access'}
      subtitle={callbackState.status === 'error' ? callbackState.message : 'Signed in successfully. Redirecting to MegaConvert...'}
      sideLabel="Auth Bridge"
      sideTitle="We are reconnecting your identity to the workspace."
      sideCopy="This callback route finalizes social or external auth and restores the same local-first product session."
      sidePoints={[
        {
          title: 'Session continuity',
          copy: 'The callback writes your session locally, then returns you to the main product flow.'
        },
        {
          title: 'One secure handoff',
          copy: 'OAuth, passkeys and classic auth now converge into the same post-login experience.'
        }
      ]}
    >
      <div className="rounded-[1.5rem] border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/5 px-5 py-6">
        <div className="flex items-center gap-3 text-slate-900 dark:text-slate-100">
          {callbackState.status === 'error' ? (
            <span className="text-sm font-medium">{callbackState.message}</span>
          ) : (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm font-medium">Completing secure sign-in...</span>
            </>
          )}
        </div>
      </div>
    </AuthSceneShell>
  );
}
