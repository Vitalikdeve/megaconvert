'use client';

import { JsonClientError } from '@megaconvert/client-sdk';
import { SectionCard, SkeletonBlock, StatusBadge } from '@megaconvert/design-system';

import {
  useApiReadinessQuery,
  useRealtimeReadinessQuery,
  useSystemOverviewQuery,
  useWebLivenessQuery,
} from './foundation-queries';

import type { DependencyHealth, DependencyHealthStatus } from '@megaconvert/contracts';

export interface FoundationStatusPanelProps {
  compact?: boolean;
}

export function FoundationStatusPanel({ compact = false }: FoundationStatusPanelProps) {
  const apiReadinessQuery = useApiReadinessQuery();
  const realtimeReadinessQuery = useRealtimeReadinessQuery();
  const systemOverviewQuery = useSystemOverviewQuery();
  const webLivenessQuery = useWebLivenessQuery();
  const systemOverview = systemOverviewQuery.data;

  const serviceRows = [
    {
      description: 'Next.js product shell',
      name: 'Web',
      query: webLivenessQuery,
      status: webLivenessQuery.data?.status ?? null,
    },
    {
      description: 'HTTP command and query runtime',
      name: 'API',
      query: apiReadinessQuery,
      status: apiReadinessQuery.data?.status ?? null,
    },
    {
      description: 'Socket delivery runtime',
      name: 'Realtime',
      query: realtimeReadinessQuery,
      status: realtimeReadinessQuery.data?.status ?? null,
    },
  ] as const;

  return (
    <SectionCard
      description="Live integration signals from the current local or connected runtime."
      eyebrow="Runtime Fabric"
      title="Control plane health"
    >
      <div className="grid gap-3">
        {serviceRows.map((service) => (
          <div
            key={service.name}
            className="rounded-[1.4rem] border border-outline-soft bg-panel/60 px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold tracking-[-0.03em] text-ink">{service.name}</p>
                <p className="mt-1 text-xs text-ink-muted">{service.description}</p>
              </div>
              {service.query.isLoading ? (
                <SkeletonBlock className="h-8 w-20" />
              ) : (
                <StatusBadge
                  label={resolveStatusLabel(service.status, service.query.isError)}
                  tone={resolveStatusTone(service.status, service.query.isError)}
                />
              )}
            </div>
            {service.query.isError ? (
              <p className="mt-3 text-xs leading-5 text-ink-subtle">
                {describeQueryError(service.query.error)}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3">
        <div className="rounded-[1.4rem] border border-outline-soft bg-panel/55 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold tracking-[-0.03em] text-ink">
                Backend dependencies
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Postgres and Redis readiness reported by the API control plane.
              </p>
            </div>
            {apiReadinessQuery.isLoading ? (
              <SkeletonBlock className="h-8 w-24" />
            ) : (
              <StatusBadge
                label={resolveStatusLabel(apiReadinessQuery.data?.status ?? null, apiReadinessQuery.isError)}
                tone={resolveStatusTone(apiReadinessQuery.data?.status ?? null, apiReadinessQuery.isError)}
              />
            )}
          </div>

          {apiReadinessQuery.isLoading ? (
            <div className="mt-4 grid gap-2">
              <p className="text-sm leading-6 text-ink-muted">
                Collecting backend dependency readiness from the API runtime.
              </p>
              <SkeletonBlock className="h-12 rounded-[1.2rem]" />
              <SkeletonBlock className="h-12 rounded-[1.2rem]" />
            </div>
          ) : apiReadinessQuery.isError ? (
            <div className="mt-4 grid gap-2">
              <p className="text-sm leading-6 text-ink-muted">
                Backend dependency status could not be resolved from the API readiness endpoint.
              </p>
              <p className="text-xs leading-5 text-ink-subtle">
                {describeQueryError(apiReadinessQuery.error)}
              </p>
            </div>
          ) : apiReadinessQuery.data && apiReadinessQuery.data.dependencies.length > 0 ? (
            <div className="mt-4 grid gap-2">
              {apiReadinessQuery.data.dependencies.map((dependency) => (
                <div
                  key={dependency.name}
                  className="rounded-[1.2rem] border border-outline-soft bg-panel/45 px-3 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold tracking-[-0.03em] text-ink">
                        {dependency.name}
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {describeDependency(dependency)}
                      </p>
                    </div>
                    <StatusBadge
                      label={resolveDependencyLabel(dependency.status)}
                      tone={resolveDependencyTone(dependency.status)}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-ink-muted">
              The API reported no explicit dependency rows yet. The shell will render them as soon
              as the readiness contract provides them.
            </p>
          )}
        </div>

        <div className="rounded-[1.4rem] border border-outline-soft bg-panel/55 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold tracking-[-0.03em] text-ink">Module posture</p>
              <p className="mt-1 text-xs text-ink-muted">
                Backend shell signals exposed through the system overview contract.
              </p>
            </div>
            {systemOverviewQuery.isLoading ? (
              <SkeletonBlock className="h-8 w-20" />
            ) : (
              <StatusBadge
                label={systemOverviewQuery.isError ? 'Unavailable' : 'Connected'}
                tone={systemOverviewQuery.isError ? 'warning' : 'accent'}
              />
            )}
          </div>

          {systemOverviewQuery.isLoading ? (
            <div className="mt-4 grid gap-2">
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-[82%]" />
              <SkeletonBlock className="h-4 w-[68%]" />
            </div>
          ) : systemOverviewQuery.isError ? (
            <div className="mt-4 grid gap-2">
              <p className="text-sm leading-6 text-ink-muted">
                The API shell is reachable only partially or is still starting. The frontend keeps
                the shell usable and surfaces the failure without collapsing the workspace chrome.
              </p>
              <p className="text-xs leading-5 text-ink-subtle">
                {describeQueryError(systemOverviewQuery.error)}
              </p>
            </div>
          ) : !systemOverview ? (
            <p className="mt-4 text-sm leading-6 text-ink-muted">
              The overview contract returned no module data yet. The shell stays online and waits
              for the control plane to finish booting.
            </p>
          ) : (
            <div className="mt-4 grid gap-2">
              <div className="flex flex-wrap gap-2">
                <StatusBadge
                  label={
                    systemOverview.modules.logging.structured ? 'Structured logging' : 'Logging off'
                  }
                  tone="accent"
                />
                <StatusBadge
                  label={
                    systemOverview.modules.database.migrationsOnBoot
                      ? 'Migrations on boot'
                      : 'Manual migrations'
                  }
                  tone="neutral"
                />
                <StatusBadge
                  label={
                    systemOverview.modules.auditShell.persistenceEnabled
                      ? 'Audit persistence'
                      : 'Audit shell only'
                  }
                  tone={
                    systemOverview.modules.auditShell.persistenceEnabled ? 'success' : 'warning'
                  }
                />
              </div>
              <p className="text-sm leading-6 text-ink-muted">
                {systemOverview.runtime.environment} environment with{' '}
                {systemOverview.runtime.corsOrigins.length} trusted CORS origin
                {systemOverview.runtime.corsOrigins.length === 1 ? '' : 's'} and
                correlation header{' '}
                <span className="font-semibold text-ink">
                  {systemOverview.modules.logging.correlationHeader}
                </span>
                .
              </p>
            </div>
          )}
        </div>

        {!compact ? (
          <p className="px-1 text-xs leading-6 text-ink-subtle">
            This panel is intentionally wired to real runtime endpoints so the shell foundation can
            expose integration drift early, before domain features land.
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}

function resolveStatusLabel(status: string | null, isError: boolean): string {
  if (isError) {
    return 'Down';
  }

  if (!status) {
    return 'Loading';
  }

  return status === 'ok' ? 'Healthy' : status;
}

function resolveStatusTone(
  status: string | null,
  isError: boolean,
): 'accent' | 'danger' | 'neutral' | 'success' | 'warning' {
  if (isError) {
    return 'danger';
  }

  if (!status) {
    return 'neutral';
  }

  if (status === 'ok') {
    return 'success';
  }

  if (status === 'degraded') {
    return 'warning';
  }

  return 'danger';
}

function resolveDependencyLabel(status: DependencyHealthStatus): string {
  switch (status) {
    case 'up':
      return 'Available';
    case 'not-configured':
      return 'Not configured';
    case 'down':
    default:
      return 'Unavailable';
  }
}

function resolveDependencyTone(
  status: DependencyHealthStatus,
): 'accent' | 'danger' | 'neutral' | 'success' | 'warning' {
  switch (status) {
    case 'up':
      return 'success';
    case 'not-configured':
      return 'warning';
    case 'down':
    default:
      return 'danger';
  }
}

function describeDependency(dependency: DependencyHealth): string {
  const latencySegment =
    dependency.latencyMs === null ? '' : ` Responded in ${dependency.latencyMs} ms.`;
  const detailSegment = dependency.detail ? ` ${dependency.detail}` : '';

  return `${capitalizeDependencyKind(dependency.kind)} dependency.${latencySegment}${detailSegment}`;
}

function describeQueryError(error: unknown): string {
  if (!(error instanceof JsonClientError)) {
    return 'Unexpected client-side failure while resolving the runtime dependency.';
  }

  const requestIdSuffix = error.requestId ? ` Request ID: ${error.requestId}.` : '';

  switch (error.kind) {
    case 'timeout':
      return `The runtime did not answer before the frontend timeout window expired.${requestIdSuffix}`;
    case 'network':
      return `The browser could not reach ${error.url}.${requestIdSuffix}`;
    case 'schema_validation':
      return `The runtime answered, but the payload shape no longer matches the shared contract.${requestIdSuffix}`;
    case 'invalid_response':
      return `The runtime answered with a malformed JSON payload.${requestIdSuffix}`;
    case 'aborted':
      return `The request was interrupted before the response completed.${requestIdSuffix}`;
    case 'http':
      return `${error.message}${requestIdSuffix}`;
    default:
      return 'The runtime health check failed for an unknown reason.';
  }
}

function capitalizeDependencyKind(kind: DependencyHealth['kind']): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}
