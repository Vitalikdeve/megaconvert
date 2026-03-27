import { JsonClientError } from '@megaconvert/client-sdk';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';

import {
  useApiReadinessQuery,
  useRealtimeReadinessQuery,
  useSystemOverviewQuery,
  useWebLivenessQuery,
} from './foundation-queries';
import { FoundationStatusPanel } from './foundation-status-panel';

vi.mock('./foundation-queries', () => ({
  useApiReadinessQuery: vi.fn(),
  useRealtimeReadinessQuery: vi.fn(),
  useSystemOverviewQuery: vi.fn(),
  useWebLivenessQuery: vi.fn(),
}));

const mockedUseApiReadinessQuery = vi.mocked(useApiReadinessQuery);
const mockedUseRealtimeReadinessQuery = vi.mocked(useRealtimeReadinessQuery);
const mockedUseSystemOverviewQuery = vi.mocked(useSystemOverviewQuery);
const mockedUseWebLivenessQuery = vi.mocked(useWebLivenessQuery);

describe('FoundationStatusPanel', () => {
  beforeEach(() => {
    mockedUseWebLivenessQuery.mockReturnValue(
      asHookResult<typeof useWebLivenessQuery>(
        createSuccessQuery({
          service: {
            commitSha: null,
            displayName: 'Megaconvert Web',
            environment: 'development',
            name: 'web',
            startedAt: '2026-03-27T00:00:00.000Z',
            version: '0.1.0',
          },
          status: 'ok',
          timestamp: '2026-03-27T00:00:00.000Z',
        }),
      ),
    );
    mockedUseRealtimeReadinessQuery.mockReturnValue(
      asHookResult<typeof useRealtimeReadinessQuery>(
        createSuccessQuery({
          dependencies: [],
          service: {
            commitSha: null,
            displayName: 'Megaconvert Realtime',
            environment: 'development',
            name: 'realtime',
            startedAt: '2026-03-27T00:00:00.000Z',
            version: '0.1.0',
          },
          status: 'ok',
          timestamp: '2026-03-27T00:00:00.000Z',
        }),
      ),
    );
    mockedUseApiReadinessQuery.mockReturnValue(
      asHookResult<typeof useApiReadinessQuery>(
        createSuccessQuery({
          dependencies: [
            {
              detail: null,
              kind: 'database',
              latencyMs: 12,
              name: 'postgres',
              status: 'up',
            },
            {
              detail: 'REDIS_URL is not configured.',
              kind: 'cache',
              latencyMs: null,
              name: 'redis',
              status: 'not-configured',
            },
          ],
          service: {
            commitSha: null,
            displayName: 'Megaconvert API',
            environment: 'development',
            name: 'api',
            startedAt: '2026-03-27T00:00:00.000Z',
            version: '0.1.0',
          },
          status: 'degraded',
          timestamp: '2026-03-27T00:00:00.000Z',
        }),
      ),
    );
    mockedUseSystemOverviewQuery.mockReturnValue(
      asHookResult<typeof useSystemOverviewQuery>(
        createSuccessQuery({
          modules: {
            auditShell: {
              persistenceEnabled: false,
              storage: 'postgres',
            },
            authShell: {
              defaultActorKind: 'anonymous',
              guardAvailable: true,
              resolverMode: 'anonymous-shell',
            },
            database: {
              migrationsOnBoot: true,
              provider: 'drizzle-postgres',
              seedHooksEnabled: false,
            },
            logging: {
              correlationHeader: 'x-correlation-id',
              structured: true,
            },
            realtimeShell: {
              mode: 'log-only',
              transport: 'gateway-shell',
            },
            redis: {
              configured: false,
              keyPrefix: 'megaconvert:test:',
            },
          },
          runtime: {
            corsOrigins: ['http://localhost:3000'],
            environment: 'development',
            globalPrefix: null,
            publicOrigin: 'http://localhost:4000',
          },
          service: {
            commitSha: null,
            displayName: 'Megaconvert API',
            environment: 'development',
            name: 'api',
            startedAt: '2026-03-27T00:00:00.000Z',
            version: '0.1.0',
          },
        }),
      ),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders backend dependency rows from the API readiness contract', () => {
    render(<FoundationStatusPanel />);

    expect(screen.getByText('Backend dependencies')).toBeInTheDocument();
    expect(screen.getByText('postgres')).toBeInTheDocument();
    expect(screen.getByText('Database dependency. Responded in 12 ms.')).toBeInTheDocument();
    expect(screen.getByText('redis')).toBeInTheDocument();
    expect(
      screen.getByText('Cache dependency. REDIS_URL is not configured.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Not configured')).toBeInTheDocument();
  });

  it('renders an explicit loading message while dependency readiness is still resolving', () => {
    mockedUseApiReadinessQuery.mockReturnValue(
      asHookResult<typeof useApiReadinessQuery>(createLoadingQuery()),
    );

    render(<FoundationStatusPanel />);

    expect(
      screen.getByText('Collecting backend dependency readiness from the API runtime.'),
    ).toBeInTheDocument();
  });

  it('renders dependency-specific transport failures without collapsing the panel', () => {
    mockedUseApiReadinessQuery.mockReturnValue(
      asHookResult<typeof useApiReadinessQuery>(
        createErrorQuery(
          new JsonClientError({
            kind: 'timeout',
            message: 'Request timed out.',
            method: 'GET',
            statusCode: 408,
            url: 'http://localhost:4000/health/ready',
          }),
        ),
      ),
    );

    render(<FoundationStatusPanel />);

    expect(
      screen.getByText('Backend dependency status could not be resolved from the API readiness endpoint.'),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('The runtime did not answer before the frontend timeout window expired.'),
    ).toHaveLength(2);
  });
});

function createSuccessQuery<TData>(data: TData) {
  return {
    data,
    error: null,
    isError: false,
    isLoading: false,
  };
}

function createLoadingQuery() {
  return {
    data: undefined,
    error: null,
    isError: false,
    isLoading: true,
  };
}

function createErrorQuery(error: JsonClientError) {
  return {
    data: undefined,
    error,
    isError: true,
    isLoading: false,
  };
}

function asHookResult<THook extends (...args: never[]) => unknown>(value: unknown): ReturnType<THook> {
  return value as ReturnType<THook>;
}
