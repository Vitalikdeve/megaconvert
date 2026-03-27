'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  getWorkspaceRoute,
  isWorkspaceRouteActive,
  mobileWorkspaceRoutes,
} from './navigation-routes';

export interface WorkspaceMobileNavigationBarProps {
  onNavigate?: () => void;
}

export function WorkspaceMobileNavigationBar({
  onNavigate,
}: WorkspaceMobileNavigationBarProps) {
  const pathname = usePathname();
  const currentRoute = getWorkspaceRoute(pathname);

  return (
    <nav
      aria-label={`Primary mobile navigation, current route ${currentRoute.label}`}
      className="grid grid-cols-5 gap-2 rounded-[1.5rem] border border-outline-soft bg-panel/75 p-2 shadow-panel backdrop-blur-2xl"
    >
      {mobileWorkspaceRoutes.map((route) => {
        const active = isWorkspaceRouteActive(pathname, route);
        const Icon = route.icon;

        return (
          <Link
            key={route.href}
            className={`flex min-h-[4.4rem] flex-col items-center justify-center gap-2 rounded-[1.2rem] px-2 text-center text-[0.72rem] font-semibold transition ${
              active
                ? 'bg-[var(--mc-color-accent-soft)] text-accent'
                : 'text-ink-muted hover:bg-panel/70 hover:text-ink'
            }`}
            href={route.href}
            onClick={onNavigate}
          >
            <Icon className="h-4.5 w-4.5" strokeWidth={1.9} />
            <span>{route.shortLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}
