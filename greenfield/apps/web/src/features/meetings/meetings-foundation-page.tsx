import { Button, SectionCard, StatusBadge, Surface } from '@megaconvert/design-system';
import { Camera, LayoutPanelTop, ScreenShare } from 'lucide-react';
import Link from 'next/link';


import { FoundationStageCard } from '@/features/shared/layout/foundation-stage-card';
import { WorkspacePageFrame } from '@/features/shared/layout/workspace-page-frame';

export function MeetingsFoundationPage() {
  return (
    <WorkspacePageFrame
      actions={
        <Link href="/search">
          <Button tone="secondary">Search linked rooms</Button>
        </Link>
      }
      description="This route locks in how scheduled rooms, instant calls, prejoin flows, and active meeting controls will coexist inside the wider messenger shell."
      eyebrow="Meetings"
      metadata={<StatusBadge label="Meet shell" tone="warning" />}
      title="Meeting launch and call-stage foundation"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <FoundationStageCard
          description={
            <p>
              Device permissions, room grants, participant states, and active-call layouts will
              land here when the meeting control plane is wired. The stage size and visual balance
              are already set.
            </p>
          }
          eyebrow="Call stage"
          icon={<Camera className="h-5 w-5" strokeWidth={1.8} />}
          title="Prejoin to active-call transition"
        />

        <SectionCard
          description="Meetings need strong adjacency to conversation history without turning the UI into a dashboard mess."
          eyebrow="Design goals"
          title="Shell constraints"
        >
          <div className="grid gap-3 text-sm leading-6 text-ink-muted">
            <div className="rounded-[1.2rem] border border-outline-soft bg-panel/55 p-3">
              Join state, room context, and linked chat remain visible before media starts.
            </div>
            <div className="rounded-[1.2rem] border border-outline-soft bg-panel/55 p-3">
              Active-call controls stay reachable on touch devices without covering the stage.
            </div>
            <div className="rounded-[1.2rem] border border-outline-soft bg-panel/55 p-3">
              Realtime participant changes can surface beside, not on top of, the speaking layout.
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Surface className="grid gap-4 p-4 sm:p-5" tone="default">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-[1rem] bg-[var(--mc-color-accent-soft)] text-accent">
              <LayoutPanelTop className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <div>
              <p className="font-semibold tracking-[-0.03em] text-ink">Meeting orchestration rail</p>
              <p className="text-sm text-ink-muted">
                Scheduling, room details, recordings, and linked artifacts will live in this panel.
              </p>
            </div>
          </div>
          <div className="grid gap-2 rounded-[1.4rem] border border-dashed border-outline-strong bg-panel/40 p-4">
            <div className="h-22 rounded-[1.1rem] bg-panel/60" />
            <div className="grid grid-cols-3 gap-2">
              <div className="h-16 rounded-[1rem] bg-panel/60" />
              <div className="h-16 rounded-[1rem] bg-panel/60" />
              <div className="h-16 rounded-[1rem] bg-panel/60" />
            </div>
          </div>
        </Surface>

        <SectionCard
          description="Meeting UI cannot be treated like a generic grid of tiles."
          eyebrow="Interaction"
          title="Mobile-critical behavior"
        >
          <div className="grid gap-2 text-sm leading-6 text-ink-muted">
            <div className="flex items-start gap-3">
              <ScreenShare className="mt-0.5 h-4.5 w-4.5 text-accent" strokeWidth={1.8} />
              <span>Toolbar spacing already reserves touch-safe targets for mute, camera, and leave.</span>
            </div>
            <div className="flex items-start gap-3">
              <ScreenShare className="mt-0.5 h-4.5 w-4.5 text-accent" strokeWidth={1.8} />
              <span>Content and participant layouts are designed to degrade gracefully on tablets.</span>
            </div>
            <div className="flex items-start gap-3">
              <ScreenShare className="mt-0.5 h-4.5 w-4.5 text-accent" strokeWidth={1.8} />
              <span>Meeting-to-chat context remains one step away, never buried in overflow menus.</span>
            </div>
          </div>
        </SectionCard>
      </div>
    </WorkspacePageFrame>
  );
}
