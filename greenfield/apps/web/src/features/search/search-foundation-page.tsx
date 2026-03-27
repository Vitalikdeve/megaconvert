import { Kbd, StatusBadge, Surface } from '@megaconvert/design-system';
import { Command, ScanSearch, SlidersHorizontal } from 'lucide-react';


import { FoundationStageCard } from '@/features/shared/layout/foundation-stage-card';
import { WorkspacePageFrame } from '@/features/shared/layout/workspace-page-frame';

export function SearchFoundationPage() {
  return (
    <WorkspacePageFrame
      description="Search is treated as a first-class command surface, not a loose input dropped into a header. The layout already reserves result groupings and refinement controls."
      eyebrow="Search"
      metadata={<StatusBadge label="Command surface" tone="accent" />}
      title="Cross-domain search foundation"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <Surface className="grid gap-4 p-4 sm:p-5" tone="elevated">
          <div className="rounded-[1.7rem] border border-outline-soft bg-surface/80 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-[1rem] bg-[var(--mc-color-accent-soft)] text-accent">
                <ScanSearch className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <div className="flex-1">
                <p className="font-semibold tracking-[-0.03em] text-ink">Unified search entry</p>
                <p className="text-sm text-ink-muted">
                  Messages, people, meetings, files, and settings results will flow through one
                  command surface.
                </p>
              </div>
              <Kbd>/</Kbd>
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-[1.3rem] border border-dashed border-outline-strong bg-panel/40 px-4 py-3 text-sm text-ink-subtle">
              <Command className="h-4.5 w-4.5 text-accent" strokeWidth={1.8} />
              Type to search the workspace when the search domain is wired.
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-[1.4rem] border border-outline-soft bg-panel/50 p-4">
              <p className="font-semibold tracking-[-0.03em] text-ink">Result groups</p>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                Dedicated clusters for chats, messages, meetings, people, and files.
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-outline-soft bg-panel/50 p-4">
              <p className="font-semibold tracking-[-0.03em] text-ink">Keyboard-first flow</p>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                Search stays fast on desktop without breaking touch ergonomics on mobile.
              </p>
            </div>
          </div>
        </Surface>

        <FoundationStageCard
          description={
            <p>
              Filters, ranking cues, and recent queries will anchor in this companion panel once
              search indexing is implemented.
            </p>
          }
          eyebrow="Refinement"
          icon={<SlidersHorizontal className="h-5 w-5" strokeWidth={1.8} />}
          title="Search facets and recents"
        />
      </div>
    </WorkspacePageFrame>
  );
}
