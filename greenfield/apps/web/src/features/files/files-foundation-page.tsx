import { SectionCard, StatusBadge, Surface } from '@megaconvert/design-system';
import { Film, FolderKanban, ShieldCheck } from 'lucide-react';


import { FoundationStageCard } from '@/features/shared/layout/foundation-stage-card';
import { WorkspacePageFrame } from '@/features/shared/layout/workspace-page-frame';

export function FilesFoundationPage() {
  return (
    <WorkspacePageFrame
      description="Shared files and media need a real browsing surface, not a download dump. This shell reserves gallery, list, and metadata zones for that domain."
      eyebrow="Files"
      metadata={<StatusBadge label="Media shell" tone="warning" />}
      title="Artifacts, previews, and shared media foundation"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <Surface className="grid gap-4 p-4 sm:p-5" tone="elevated">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-[1rem] bg-[var(--mc-color-accent-soft)] text-accent">
              <FolderKanban className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <div>
              <p className="font-semibold tracking-[-0.03em] text-ink">Shared media canvas</p>
              <p className="text-sm text-ink-muted">
                Gallery, list, and metadata layouts are already reserved for later file data.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="aspect-[1.02] rounded-[1.3rem] border border-outline-soft bg-[linear-gradient(145deg,color-mix(in_srgb,var(--mc-color-accent-soft)_72%,transparent),color-mix(in_srgb,var(--mc-color-surface)_78%,transparent))]"
              />
            ))}
          </div>
        </Surface>

        <FoundationStageCard
          description={
            <p>
              Preview metadata, scan state, upload provenance, and linked conversation context will
              sit in this detail rail.
            </p>
          }
          eyebrow="Metadata rail"
          icon={<Film className="h-5 w-5" strokeWidth={1.8} />}
          title="Asset detail surface"
        />
      </div>

      <SectionCard
        description="The file domain must stay honest about security and storage state."
        eyebrow="Integrity"
        title="Required metadata cues"
      >
        <div className="grid gap-3 text-sm leading-6 text-ink-muted lg:grid-cols-2">
          <div className="flex items-start gap-3 rounded-[1.2rem] border border-outline-soft bg-panel/55 p-3">
            <ShieldCheck className="mt-0.5 h-4.5 w-4.5 text-accent" strokeWidth={1.8} />
            <span>Scan, transcoding, and variant states should be visible without taking over the UI.</span>
          </div>
          <div className="flex items-start gap-3 rounded-[1.2rem] border border-outline-soft bg-panel/55 p-3">
            <ShieldCheck className="mt-0.5 h-4.5 w-4.5 text-accent" strokeWidth={1.8} />
            <span>Shared files need context back into the message or meeting that introduced them.</span>
          </div>
        </div>
      </SectionCard>
    </WorkspacePageFrame>
  );
}
