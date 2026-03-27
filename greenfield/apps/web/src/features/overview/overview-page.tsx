import { Button, SectionCard, StatusBadge, Surface } from '@megaconvert/design-system';
import { ArrowRight, Layers2, MessageSquareText, Search, Video } from 'lucide-react';
import Link from 'next/link';

import { FoundationStatusPanel } from '@/features/shared/foundation/foundation-status-panel';
import { workspaceNavigationRoutes } from '@/features/shared/layout/navigation-routes';
import { WorkspacePageFrame } from '@/features/shared/layout/workspace-page-frame';
import { AnimatedReveal } from '@/features/shared/motion/animated-reveal';

const spotlightRoutes = workspaceNavigationRoutes.filter((route) =>
  ['/', '/inbox', '/chats/demo-thread', '/meetings', '/search'].includes(route.href),
);

export function OverviewPage() {
  return (
    <WorkspacePageFrame
      description="A premium collaboration shell with clear boundaries for messaging, meetings, search, files, notifications, and settings. The UX foundation is already responsive, theme-aware, motion-ready, and wired to live backend health contracts."
      eyebrow="Overview"
      metadata={<StatusBadge label="Shell ready" tone="success" />}
      title="Command surface for conversation-heavy work"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.9fr)]">
        <AnimatedReveal>
          <Surface className="overflow-hidden p-5 sm:p-6" tone="elevated">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(49,95,255,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(15,141,132,0.14),transparent_32%)]" />
            <div className="relative grid gap-6">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label="Design language" tone="accent" />
                <StatusBadge label="Responsive by default" tone="neutral" />
              </div>

              <div className="grid gap-4">
                <h3 className="max-w-[14ch] font-[family-name:var(--font-display)] text-[2.2rem] font-semibold tracking-[-0.07em] text-ink sm:text-[2.9rem]">
                  Quiet precision for messaging and meetings.
                </h3>
                <p className="max-w-3xl text-sm leading-8 text-ink-muted sm:text-base">
                  The visual system leans on porcelain surfaces, graphite contrast panels, cobalt
                  emphasis, and restrained motion so inbox, chat, meeting, and dashboard workflows
                  can all coexist without becoming template-like or noisy.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {spotlightRoutes.map((route, index) => {
                  const Icon = route.icon;

                  return (
                    <AnimatedReveal
                      key={route.href}
                      className="h-full"
                      delay={0.06 + index * 0.04}
                    >
                      <Link
                        className="group grid h-full gap-3 rounded-[1.6rem] border border-outline-soft bg-surface/75 p-4 transition hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--mc-color-accent)_24%,transparent)]"
                        href={route.href}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="grid h-11 w-11 place-items-center rounded-[1rem] bg-[var(--mc-color-accent-soft)] text-accent">
                            <Icon className="h-5 w-5" strokeWidth={1.8} />
                          </span>
                          <ArrowRight className="h-4.5 w-4.5 text-ink-subtle transition group-hover:text-accent" />
                        </div>
                        <div>
                          <p className="font-semibold tracking-[-0.03em] text-ink">{route.label}</p>
                          <p className="mt-1 text-sm leading-6 text-ink-muted">{route.description}</p>
                        </div>
                      </Link>
                    </AnimatedReveal>
                  );
                })}
              </div>
            </div>
          </Surface>
        </AnimatedReveal>

        <AnimatedReveal delay={0.08}>
          <FoundationStatusPanel />
        </AnimatedReveal>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          description="Three-pane desktop structure, single-column mobile flows, and a persistent mobile bottom nav establish the navigation contract for every domain."
          eyebrow="Layout"
          title="Responsive shell"
        >
          <div className="flex flex-wrap gap-2">
            <StatusBadge label="Desktop rail" tone="neutral" />
            <StatusBadge label="Mobile drawer" tone="neutral" />
            <StatusBadge label="Bottom nav" tone="neutral" />
          </div>
        </SectionCard>

        <SectionCard
          description="Theme tokens, spacing, radius, shadows, and typography are centralized in the design system so later product surfaces inherit the same language instead of reinventing it."
          eyebrow="System"
          title="Tokenized UI"
        >
          <div className="flex flex-wrap gap-2">
            <StatusBadge label="Porcelain + graphite" tone="accent" />
            <StatusBadge label="Sora + Manrope" tone="neutral" />
            <StatusBadge label="Motion-aware" tone="success" />
          </div>
        </SectionCard>

        <SectionCard
          description="The root shell already separates runtime config, client API access, query state, shell state, and layout composition so real features can plug in without rewiring the app."
          eyebrow="Architecture"
          title="Ready for domain growth"
        >
          <div className="grid gap-2 text-sm leading-6 text-ink-muted">
            <div className="flex items-center gap-2">
              <Layers2 className="h-4.5 w-4.5 text-accent" strokeWidth={1.8} />
              <span>Providers stay infrastructure-only.</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4.5 w-4.5 text-accent" strokeWidth={1.8} />
              <span>Messaging routes are already carved out.</span>
            </div>
            <div className="flex items-center gap-2">
              <Video className="h-4.5 w-4.5 text-accent" strokeWidth={1.8} />
              <span>Meeting control surfaces have a reserved shell.</span>
            </div>
          </div>
        </SectionCard>
      </div>

      <Surface className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6" tone="default">
        <div>
          <p className="text-sm font-semibold tracking-[-0.03em] text-ink">Next foundation step</p>
          <p className="mt-2 text-sm leading-7 text-ink-muted">
            Plug the upcoming auth, users, and session lifecycle modules into this shell so inbox
            and settings can switch from foundation states to real protected flows.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/inbox">
            <Button tone="primary">
              <MessageSquareText className="h-4.5 w-4.5" strokeWidth={1.9} />
              Explore inbox shell
            </Button>
          </Link>
          <Link href="/search">
            <Button tone="secondary">
              <Search className="h-4.5 w-4.5" strokeWidth={1.9} />
              Search surface
            </Button>
          </Link>
        </div>
      </Surface>
    </WorkspacePageFrame>
  );
}
