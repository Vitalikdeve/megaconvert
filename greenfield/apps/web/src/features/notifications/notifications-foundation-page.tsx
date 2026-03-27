import { SectionCard, StatusBadge } from '@megaconvert/design-system';
import { Bell, ShieldAlert, Zap } from 'lucide-react';


import { FoundationStageCard } from '@/features/shared/layout/foundation-stage-card';
import { WorkspacePageFrame } from '@/features/shared/layout/workspace-page-frame';

export function NotificationsFoundationPage() {
  return (
    <WorkspacePageFrame
      description="Notifications are a product domain with their own visual cadence, not a leftover badge system. This foundation preserves space for priority, delivery, and action context."
      eyebrow="Notifications"
      metadata={<StatusBadge label="Delivery shell" tone="warning" />}
      title="Inbox and alerting foundation"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <FoundationStageCard
          description={
            <p>
              In-app notifications, reminders, security warnings, and system-level prompts will
              flow into this stream once delivery jobs are wired.
            </p>
          }
          eyebrow="Notification inbox"
          icon={<Bell className="h-5 w-5" strokeWidth={1.8} />}
          title="Signal feed"
        />

        <SectionCard
          description="Every notification needs a clear reason to exist."
          eyebrow="Priority model"
          title="System rules"
        >
          <div className="grid gap-3 text-sm leading-6 text-ink-muted">
            <div className="flex items-start gap-3 rounded-[1.2rem] border border-outline-soft bg-panel/55 p-3">
              <Zap className="mt-0.5 h-4.5 w-4.5 text-accent" strokeWidth={1.8} />
              <span>Realtime nudges stay lightweight and disappear when state is already visible.</span>
            </div>
            <div className="flex items-start gap-3 rounded-[1.2rem] border border-outline-soft bg-panel/55 p-3">
              <ShieldAlert className="mt-0.5 h-4.5 w-4.5 text-accent" strokeWidth={1.8} />
              <span>Security and account alerts must remain distinct from social conversation noise.</span>
            </div>
          </div>
        </SectionCard>
      </div>
    </WorkspacePageFrame>
  );
}
