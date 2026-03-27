# API Backend

Production-minded NestJS foundation for the messenger platform backend.

What exists now:
- strict typed bootstrap on Fastify
- modular infrastructure boundaries for config, logging, database, redis, auth-shell, realtime-shell, audit-shell, health, and app/system
- structured logging with request correlation IDs
- security headers baseline and global rate-limit hooks
- PostgreSQL and Redis infrastructure modules
- migration and seed runner hooks
- health and readiness endpoints
- test scaffolding for end-to-end bootstrap checks

What does not exist yet:
- real auth/session business logic
- messaging, meetings, media, notifications, search, users, settings, and security domain implementations

Primary docs:
- [Backend Conventions](./docs/backend-conventions.md)
- [Dependency Rules](./docs/dependency-rules.md)
- [Foundation Decisions](./docs/foundation-decisions.md)

Useful commands:
- `pnpm --filter @megaconvert/api dev`
- `pnpm --filter @megaconvert/api test`
- `pnpm db:migrate`
- `pnpm db:seed`
