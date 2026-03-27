'use client';

import { Button, SectionCard, StatusBadge } from '@megaconvert/design-system';

import { useThemePreferences } from '@/providers/theme-provider';

import type { MotionMode } from '@/features/shared/state/preferences-store';
import type { ThemeMode } from '@megaconvert/design-system';


const themeModes: readonly ThemeMode[] = ['system', 'light', 'dark'];
const motionModes: readonly MotionMode[] = ['system', 'full', 'reduced'];

export interface AppearanceControlsCardProps {
  compact?: boolean;
}

export function AppearanceControlsCard({ compact = false }: AppearanceControlsCardProps) {
  const {
    motionMode,
    resolvedMotionMode,
    resolvedTheme,
    setMotionMode,
    setThemeMode,
    themeMode,
  } = useThemePreferences();

  return (
    <SectionCard
      description="Global shell preferences that future inbox, chat, and meeting screens will inherit."
      eyebrow="Interface"
      title="Appearance system"
    >
      <div className="grid gap-4">
        <div className="rounded-[1.4rem] border border-outline-soft bg-panel/55 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold tracking-[-0.03em] text-ink">Theme mode</p>
              <p className="mt-1 text-xs text-ink-muted">
                Resolved to <span className="font-semibold text-ink">{resolvedTheme}</span>.
              </p>
            </div>
            <StatusBadge label={resolvedTheme} tone="accent" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {themeModes.map((option) => (
              <Button
                key={option}
                onClick={() => {
                  setThemeMode(option);
                }}
                size="sm"
                tone={themeMode === option ? 'primary' : 'secondary'}
              >
                {option}
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-[1.4rem] border border-outline-soft bg-panel/55 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold tracking-[-0.03em] text-ink">Motion profile</p>
              <p className="mt-1 text-xs text-ink-muted">
                Resolved to <span className="font-semibold text-ink">{resolvedMotionMode}</span>.
              </p>
            </div>
            <StatusBadge label={resolvedMotionMode} tone="neutral" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {motionModes.map((option) => (
              <Button
                key={option}
                onClick={() => {
                  setMotionMode(option);
                }}
                size="sm"
                tone={motionMode === option ? 'primary' : 'secondary'}
              >
                {option}
              </Button>
            ))}
          </div>
        </div>

        {!compact ? (
          <p className="px-1 text-xs leading-6 text-ink-subtle">
            Preferences persist locally so the frontend can stabilize UX decisions before account
            settings and sync arrive.
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}
