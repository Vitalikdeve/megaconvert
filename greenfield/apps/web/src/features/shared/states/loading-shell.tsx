import { SectionCard, SkeletonBlock } from '@megaconvert/design-system';

export function LoadingShell() {
  return (
    <div className="grid gap-4">
      <SectionCard
        description="Preparing the workspace shell."
        eyebrow="Loading"
        title="Composing interface"
      >
        <div className="grid gap-3">
          <SkeletonBlock className="h-12 w-[42%]" />
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-[84%]" />
          <div className="grid gap-3 pt-2 lg:grid-cols-2">
            <SkeletonBlock className="h-44 rounded-[1.6rem]" />
            <SkeletonBlock className="h-44 rounded-[1.6rem]" />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
