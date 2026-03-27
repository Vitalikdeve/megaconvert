import { SectionCard, StatusBadge } from '@megaconvert/design-system';
import { CircleFadingPlus, UsersRound } from 'lucide-react';


import { FoundationStageCard } from '@/features/shared/layout/foundation-stage-card';
import { WorkspacePageFrame } from '@/features/shared/layout/workspace-page-frame';

export function ContactsFoundationPage() {
  return (
    <WorkspacePageFrame
      description="Contacts, people lookup, presence, and relationship actions need their own surface language. This page reserves the directory and detail rhythms without inventing user records."
      eyebrow="Contacts"
      metadata={<StatusBadge label="People surface" tone="warning" />}
      title="Directory and relationship shell"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <FoundationStageCard
          description={
            <p>
              People results, invite states, presence, and relationship actions will occupy this
              area. The structure is ready for both team directories and direct relationship
              management.
            </p>
          }
          eyebrow="Directory"
          icon={<UsersRound className="h-5 w-5" strokeWidth={1.8} />}
          title="People index"
        />

        <SectionCard
          description="This shell keeps relationship actions secondary to identity context."
          eyebrow="Principles"
          title="Interaction rules"
        >
          <div className="grid gap-3 text-sm leading-6 text-ink-muted">
            <div className="rounded-[1.2rem] border border-outline-soft bg-panel/55 p-3">
              Avatars, handles, and presence need clear hierarchy before actions appear.
            </div>
            <div className="rounded-[1.2rem] border border-outline-soft bg-panel/55 p-3">
              Invite, message, and meeting actions remain grouped rather than scattered across rows.
            </div>
            <div className="rounded-[1.2rem] border border-outline-soft bg-panel/55 p-3">
              Mobile keeps people details a distinct drill-in, not an awkward split-pane.
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        description="The eventual directory can layer richer semantics onto these reserved chips."
        eyebrow="Reserved states"
        title="People-specific surface cues"
      >
        <div className="flex flex-wrap gap-2">
          <StatusBadge label="Available" tone="success" />
          <StatusBadge label="Busy" tone="warning" />
          <StatusBadge label="Invite pending" tone="neutral" />
          <StatusBadge label="Blocked" tone="danger" />
          <StatusBadge label="New contact" tone="accent" />
          <StatusBadge label="Shared groups" tone="neutral" />
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-[1.35rem] border border-outline-soft bg-panel/45 p-4 text-sm leading-6 text-ink-muted">
          <CircleFadingPlus className="h-4.5 w-4.5 text-accent" strokeWidth={1.8} />
          Contacts are treated as a real domain, not a side list bolted onto messaging.
        </div>
      </SectionCard>
    </WorkspacePageFrame>
  );
}
