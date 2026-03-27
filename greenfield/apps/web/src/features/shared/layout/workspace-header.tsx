'use client';

import { Button, Kbd, StatusBadge } from '@megaconvert/design-system';
import { Menu, MoonStar, PanelRightOpen, Search, SunMedium } from 'lucide-react';
import Link from 'next/link';


import { useThemePreferences } from '@/providers/theme-provider';

import type { WorkspaceNavigationRoute } from './navigation-routes';

export interface WorkspaceHeaderProps {
  dockExpanded: boolean;
  onOpenMobileNavigation(): void;
  onToggleDock(): void;
  route: WorkspaceNavigationRoute;
}

export function WorkspaceHeader({
  dockExpanded,
  onOpenMobileNavigation,
  onToggleDock,
  route,
}: WorkspaceHeaderProps) {
  const { resolvedTheme, setThemeMode } = useThemePreferences();

  return (
    <header className="rounded-[2rem] border border-outline-soft bg-surface/80 p-4 shadow-panel backdrop-blur-3xl md:p-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <button
            aria-label="Open navigation"
            className="inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border border-outline-soft bg-panel/70 text-ink transition hover:text-accent lg:hidden"
            onClick={onOpenMobileNavigation}
            type="button"
          >
            <Menu className="h-5 w-5" strokeWidth={1.8} />
          </button>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label="Frontend foundation" tone="accent" />
              <StatusBadge label={route.label} tone="neutral" />
            </div>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-[1.9rem] font-semibold tracking-[-0.06em] text-ink sm:text-[2.35rem]">
              {route.label}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-ink-muted sm:text-[0.98rem]">
              {route.description}
            </p>
          </div>
        </div>

        <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Link className="min-w-0 flex-1 sm:flex-none" href="/search">
            <Button className="w-full sm:w-auto" size="md" tone="secondary">
              <Search className="h-4.5 w-4.5" strokeWidth={1.9} />
              <span>Search workspace</span>
              <Kbd className="hidden sm:inline-flex">/</Kbd>
            </Button>
          </Link>

          <Button
            aria-label="Toggle theme"
            onClick={() => {
              setThemeMode(resolvedTheme === 'dark' ? 'light' : 'dark');
            }}
            size="md"
            tone="secondary"
          >
            {resolvedTheme === 'dark' ? (
              <SunMedium className="h-4.5 w-4.5" strokeWidth={1.9} />
            ) : (
              <MoonStar className="h-4.5 w-4.5" strokeWidth={1.9} />
            )}
          </Button>

          <Button
            aria-label={dockExpanded ? 'Collapse dock' : 'Expand dock'}
            onClick={onToggleDock}
            size="md"
            tone="secondary"
          >
            <PanelRightOpen className="h-4.5 w-4.5" strokeWidth={1.9} />
          </Button>
        </div>
      </div>
    </header>
  );
}
