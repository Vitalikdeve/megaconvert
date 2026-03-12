import React from 'react';
import { useTranslation } from 'react-i18next';
import { buildSocialConnectUrl } from '../lib/authApi.js';

const SOCIAL_AUTH_PROVIDERS = [
  { id: 'google', key: 'auth.oauthGoogle', fallback: 'Google' },
  { id: 'github', key: 'auth.oauthGithub', fallback: 'GitHub' },
  { id: 'facebook', key: 'auth.oauthFacebook', fallback: 'Facebook' },
  { id: 'x', key: 'auth.oauthX', fallback: 'X' }
];

function SocialIcon({ provider }) {
  if (provider === 'google') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
        <path
          fill="currentColor"
          d="M20.3 12.2c0-.7-.1-1.3-.2-1.8H12v3.4h4.7c-.2 1.1-.9 2.7-2.4 3.7v2.8h3.9c2.3-2.1 3.6-5.2 3.6-8.1ZM12 20.5a8.2 8.2 0 0 0 5.7-2.1l-3.9-2.8c-1 .7-2.3 1.2-3.9 1.2-3 0-5.5-2-6.4-4.6H-.5v2.9A12 12 0 0 0 12 20.5ZM5.6 12c0-.8.1-1.5.4-2.2V6.9H3A12 12 0 0 0 0 12c0 1.9.5 3.7 1.4 5.1l3-2.9a8 8 0 0 1-.4-2.2ZM12 3.8c1.7 0 3.2.6 4.4 1.7l3.2-3.2A12 12 0 0 0 0 8.9l3 2.9c.9-2.6 3.4-4.6 6.4-4.6Z"
        />
      </svg>
    );
  }
  if (provider === 'github') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
        <path
          fill="currentColor"
          d="M12 .6a12 12 0 0 0-3.8 23.4c.6.1.8-.2.8-.6v-2.2c-3.4.7-4.1-1.5-4.1-1.5-.6-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.4-5.5-6 0-1.4.5-2.6 1.3-3.5-.1-.3-.6-1.7.1-3.4 0 0 1.1-.3 3.6 1.3a12 12 0 0 1 6.5 0c2.5-1.6 3.6-1.3 3.6-1.3.7 1.7.2 3.1.1 3.4.8 1 1.3 2.1 1.3 3.5 0 4.7-2.8 5.8-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .4.2.7.8.6A12 12 0 0 0 12 .6Z"
        />
      </svg>
    );
  }
  if (provider === 'facebook') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
        <path
          fill="currentColor"
          d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9V24A12 12 0 0 0 24 12Z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        fill="currentColor"
        d="M18.24 2h3.37l-7.37 8.42L23 22h-6.76l-5.3-6.93L4.87 22H1.5l7.89-9.02L1 2h6.93l4.8 6.34L18.24 2Zm-1.18 18h1.87L6.9 3.9H4.9L17.06 20Z"
      />
    </svg>
  );
}

export default function AuthSocialButtons({ apiBase }) {
  const { t } = useTranslation();

  return (
    <div className="pt-1">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
        <span className="text-[11px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
          {t('auth.orContinueWith', 'Or continue with')}
        </span>
        <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {SOCIAL_AUTH_PROVIDERS.map((provider) => (
          <a
            key={provider.id}
            href={buildSocialConnectUrl(apiBase, provider.id)}
            className="auth-provider-tile"
          >
            <SocialIcon provider={provider.id} />
            <span>{t(provider.key, provider.fallback)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
