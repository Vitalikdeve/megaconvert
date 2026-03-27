# Megaconvert Greenfield Monorepo

Production-minded Phase 0 and Phase 1 foundation for a premium messenger and meetings platform.

## Apps

- `apps/web` - Next.js workspace shell and frontend runtime.
- `apps/api` - NestJS HTTP API with health and system bootstrap.
- `apps/realtime` - NestJS realtime gateway foundation with Socket.IO transport.
- `apps/worker` - NestJS background runtime foundation with health endpoints.

## Shared Packages

- `packages/config` - Typed environment loading.
- `packages/contracts` - Runtime-safe shared contracts.
- `packages/shared-kernel` - Cross-domain primitives.
- `packages/server-kit` - Logging, health, and HTTP foundation utilities.
- `packages/client-sdk` - Typed HTTP client helpers.
- `packages/database` - Database client and readiness probes.
- `packages/design-system` - Design tokens and base UI primitives.
- `packages/testing` - Shared test fixtures and helpers.
- `packages/eslint-config` - Shared lint rules.
- `packages/tsconfig` - Shared TypeScript baselines.

## Local Development

1. Install dependencies with `pnpm install`.
2. Start local infrastructure with `pnpm dev:infra`.
3. Copy each app's `.env.example` to `.env` as needed.
4. Start the workspace with `pnpm dev`.

## Quality Gates

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

The repository intentionally excludes product domains such as auth, chat, meetings, and notifications at this phase. Only the reusable monorepo foundation, system bootstrap, health surfaces, and shared runtime contracts are implemented.
