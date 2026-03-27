'use client';



import { AppFrame } from '@megaconvert/design-system';
import { usePathname } from 'next/navigation';
import { useEffect, useEffectEvent } from 'react';

import { AnimatedReveal } from '@/features/shared/motion/animated-reveal';
import { useNavigationUiStore } from '@/features/shared/state/navigation-ui-store';
import { useShellPreferencesStore } from '@/features/shared/state/preferences-store';

import { getWorkspaceRoute } from './navigation-routes';
import { WorkspaceDock } from './workspace-dock';
import { WorkspaceHeader } from './workspace-header';
import { WorkspaceMobileNavigationBar } from './workspace-mobile-navigation-bar';
import { WorkspaceMobileNavigationDrawer } from './workspace-mobile-navigation-drawer';
import { WorkspaceNavigation } from './workspace-navigation';

import type { PropsWithChildren } from 'react';

export function WorkspaceShell({ children }: PropsWithChildren) {
  const dockMode = useShellPreferencesStore((state) => state.dockMode);
  const toggleDockMode = useShellPreferencesStore((state) => state.toggleDockMode);
  const mobileNavigationOpen = useNavigationUiStore((state) => state.mobileNavigationOpen);
  const closeMobileNavigation = useNavigationUiStore((state) => state.closeMobileNavigation);
  const openMobileNavigation = useNavigationUiStore((state) => state.openMobileNavigation);
  const pathname = usePathname();
  const route = getWorkspaceRoute(pathname);
  const dockExpanded = dockMode === 'expanded';

  const collapseMobileNavigationOnRouteChange = useEffectEvent(() => {
    closeMobileNavigation();
  });

  useEffect(() => {
    collapseMobileNavigationOnRouteChange();
  }, [collapseMobileNavigationOnRouteChange, pathname]);

  return (
    <AppFrame>
      <div className="relative px-3 py-3 sm:px-4 lg:px-5 lg:py-5">
        <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1680px] gap-4">
          <aside className="hidden w-[19rem] shrink-0 lg:block">
            <WorkspaceNavigation />
          </aside>

          <div className="grid min-w-0 flex-1 gap-4">
            <WorkspaceHeader
              dockExpanded={dockExpanded}
              onOpenMobileNavigation={openMobileNavigation}
              onToggleDock={toggleDockMode}
              route={route}
            />

            <div
              className={`grid min-h-[calc(100vh-10rem)] gap-4 ${
                dockExpanded ? '2xl:grid-cols-[minmax(0,1fr)_23rem]' : 'grid-cols-1'
              }`}
            >
              <AnimatedReveal className="min-w-0 shell-page" delay={0.04}>
                <main className="min-w-0">{children}</main>
              </AnimatedReveal>

              {dockExpanded ? (
                <AnimatedReveal delay={0.08}>
                  <aside className="grid gap-4">
                    <WorkspaceDock compact />
                  </aside>
                </AnimatedReveal>
              ) : null}
            </div>
          </div>
        </div>

        <div
          className="fixed inset-x-3 bottom-3 z-20 lg:hidden"
          style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
        >
          <WorkspaceMobileNavigationBar />
        </div>

        <WorkspaceMobileNavigationDrawer
          onNavigate={closeMobileNavigation}
          onRequestClose={closeMobileNavigation}
          open={mobileNavigationOpen}
        />
      </div>
    </AppFrame>
  );
}
