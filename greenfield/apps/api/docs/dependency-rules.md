# Dependency Rules

## Allowed Imports

- `config` may be used by any module
- `logging` may be used by any module
- `database` may be used by health, audit-shell, and future durable business domains
- `redis` may be used by health, realtime integration, notifications, and future ephemeral-state domains
- `auth-shell` may be used by any HTTP-facing module that needs actor context
- `realtime-shell` may be used by future messaging, meetings, notifications, and presence domains
- `audit-shell` may be used by any mutation-heavy domain

## Disallowed Imports

- domain modules importing other modules' infrastructure
- controllers importing database repositories
- infrastructure code importing controllers
- shared helpers growing into unowned global utility bags

## Module Ownership

- `config`: environment loading and runtime configuration mapping
- `logging`: root logger, request context, correlation ID propagation
- `database`: PostgreSQL connection lifecycle, migrations, seeds
- `redis`: Redis connection lifecycle and ephemeral dependency health
- `auth-shell`: request actor abstraction and auth guard primitives
- `realtime-shell`: publish contract for future realtime fanout
- `audit-shell`: durable audit persistence boundary
- `health`: liveness and readiness aggregation
- `app`: root system overview endpoint and platform capability reporting

## Future Domain Rule

When messaging, meetings, media, notifications, search, users, or settings modules are added, they must depend only on the shell or infrastructure modules they truly need. No domain may become a transitive grab-bag for unrelated features.
