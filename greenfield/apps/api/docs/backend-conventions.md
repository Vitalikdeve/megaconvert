# Backend Conventions

## Module Shape

Every backend module follows the same four-layer vocabulary when the module needs it:

- `interfaces`: HTTP controllers, decorators, guards, and transport adapters
- `application`: use-case orchestration, ports, and module-facing services
- `domain`: pure business or shell types and invariants
- `infrastructure`: adapter implementations for databases, redis, logs, or external systems

Small infrastructure-only modules may omit unused layers. Do not create empty folders.

## Dependency Direction

- `interfaces -> application`
- `application -> domain`
- `application -> ports`
- `infrastructure -> application ports`
- `domain -> nothing Nest-specific`

Controllers never talk to repositories directly.
Infrastructure code never gets imported across module boundaries.

## DTO And Validation Rules

- HTTP request validation uses `zod`
- DTO classes come from `createZodDto(...)`
- route handlers validate input with `ZodValidationPipe`
- validation failures must return a normalized `validation_error` payload

Do not duplicate runtime schemas and TypeScript types by hand.

## Logging Rules

- use `ApplicationLogger` inside modules
- include domain-specific details as structured objects, not interpolated strings
- rely on request correlation IDs for cross-service tracing
- never use `console.log`

## Database Rules

- every table is owned by one module
- cross-module writes go through application services or events
- migrations live in `packages/database`
- seed hooks are explicit and opt-in

## Redis Rules

- Redis holds ephemeral or acceleration state only
- PostgreSQL remains the source of truth
- no critical business state may live only in Redis

## Shell Module Rules

- `auth-shell` provides actor resolution and guard primitives only
- `realtime-shell` provides outbound publish contracts only
- `audit-shell` provides audit persistence contracts only

Shell modules must stay honest about being shell boundaries until full domains land.
