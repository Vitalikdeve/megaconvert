'use client';

import { Button } from '@megaconvert/design-system';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { AppLogo } from './app-logo';
import {
  getWorkspaceRoute,
  isWorkspaceRouteActive,
  primaryWorkspaceRoutes,
  secondaryWorkspaceRoutes,
  type WorkspaceNavigationRoute,
} from './navigation-routes';

export interface WorkspaceNavigationProps {
  onNavigate?: () => void;
}

export function WorkspaceNavigation({ onNavigate }: WorkspaceNavigationProps) {
  const pathname = usePathname();
  const currentRoute = getWorkspaceRoute(pathname);

  return (
    <div className="flex h-full flex-col gap-6 rounded-[2rem] border border-outline-soft bg-panel/78 p-4 shadow-panel backdrop-blur-3xl">
      <AppLogo />

      <div className="rounded-[1.6rem] border border-outline-soft bg-[color:color-mix(in_srgb,var(--mc-color-surface-raised)_72%,transparent)] p-4">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.18em] text-ink-subtle">
          Active route
        </p>
        <p className="mt-3 font-[family-name:var(--font-display)] text-[1.25rem] font-semibold tracking-[-0.04em] text-ink">
          {currentRoute.label}
        </p>
        <p className="mt-2 text-sm leading-6 text-ink-muted">{currentRoute.description}</p>
      </div>

      <div className="grid gap-5">
        <NavigationGroup
          label="Workflow"
          onNavigate={onNavigate}
          pathname={pathname}
          routes={primaryWorkspaceRoutes}
        />
        <NavigationGroup
          label="Workspace"
          onNavigate={onNavigate}
          pathname={pathname}
          routes={secondaryWorkspaceRoutes}
        />
      </div>

      <div className="mt-auto rounded-[1.6rem] border border-outline-soft bg-[linear-gradient(160deg,color-mix(in_srgb,var(--mc-color-surface)_78%,transparent),color-mix(in_srgb,var(--mc-color-accent-soft)_68%,transparent))] p-4">
        <p className="text-sm font-semibold tracking-[-0.03em] text-ink">Foundation posture</p>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          The shell is responsive, theme-aware, motion-ready, and already wired to real health
          endpoints.
        </p>
        <div className="mt-4">
          <Link href="/settings" onClick={onNavigate}>
            <Button size="sm" tone="secondary">
              Open preferences
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

interface NavigationGroupProps {
  label: string;
  onNavigate?: () => void;
  pathname: string;
  routes: readonly WorkspaceNavigationRoute[];
}

function NavigationGroup({ label, onNavigate, pathname, routes }: NavigationGroupProps) {
  return (
    <section className="grid gap-2">
      <p className="px-2 text-[0.72rem] font-bold uppercase tracking-[0.18em] text-ink-subtle">
        {label}
      </p>
      {routes.map((route) => {
        const active = isWorkspaceRouteActive(pathname, route);
        const Icon = route.icon;

        return (
          <Link
            key={route.href}
            className={`group flex items-center gap-3 rounded-[1.35rem] px-3 py-3 transition ${
              active
                ? 'bg-[var(--mc-color-accent-soft)] text-accent'
                : 'text-ink-muted hover:bg-panel/65 hover:text-ink'
            }`}
            href={route.href}
            onClick={onNavigate}
          >
            <span
              className={`grid h-10 w-10 place-items-center rounded-[1rem] border ${
                active
                  ? 'border-[color:color-mix(in_srgb,var(--mc-color-accent)_24%,transparent)] bg-white/50'
                  : 'border-outline-soft bg-panel/70'
              }`}
            >
              <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
            </span>
            <span className="grid min-w-0 flex-1">
              <span className="font-semibold tracking-[-0.03em]">{route.label}</span>
              <span className="truncate text-xs text-ink-subtle transition group-hover:text-ink-muted">
                {route.description}
              </span>
            </span>
          </Link>
        );
      })}
    </section>
  );
}
