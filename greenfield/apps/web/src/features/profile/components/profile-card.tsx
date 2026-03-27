'use client';

/* eslint-disable @next/next/no-img-element */

import { Surface } from '@megaconvert/design-system';

import type { UserProfileCard } from '@megaconvert/contracts';

export interface ProfileCardProps {
  accentLabel?: string;
  profile: UserProfileCard;
  subtitle?: string;
}

export function ProfileCard({ accentLabel, profile, subtitle }: ProfileCardProps) {
  const initials = profile.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <Surface className="flex items-center gap-4 rounded-[1.4rem] p-4" tone="subtle">
      <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-[1.2rem] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--mc-color-accent)_32%,white),color-mix(in_srgb,var(--mc-color-highlight)_28%,transparent))] text-sm font-semibold tracking-[0.08em] text-ink">
        {profile.avatarUrl ? (
          <img
            alt={`${profile.displayName} avatar`}
            className="h-full w-full object-cover"
            src={profile.avatarUrl}
          />
        ) : (
          initials
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-[family-name:var(--font-display)] text-[1.05rem] font-semibold tracking-[-0.04em] text-ink">
            {profile.displayName}
          </p>
          {accentLabel ? (
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-accent">
              {accentLabel}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-ink-muted">@{profile.username}</p>
        {subtitle ? <p className="mt-2 text-sm leading-6 text-ink-subtle">{subtitle}</p> : null}
        {profile.statusText ? (
          <p className="mt-2 text-sm leading-6 text-ink-muted">{profile.statusText}</p>
        ) : null}
      </div>
    </Surface>
  );
}
