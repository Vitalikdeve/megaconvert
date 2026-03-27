# Repository Blueprint

## Principles

- Build as a modular monolith with extraction-ready seams, not a pretend microservice fleet.
- Keep runtime processes small in count and explicit in purpose.
- Share contracts deliberately, not by importing application internals across apps.
- Split domain logic from transport, persistence, and orchestration.
- Prefer stable naming that communicates ownership and lifecycle.

## Repository Layout

```text
apps/
  api/        HTTP, websocket edge, auth/session enforcement, domain orchestration
  web/        Next.js product surface, app shell, messaging UI, meetings UI, settings UI
  worker/     asynchronous processing, fanout, indexing, media pipelines, notifications
packages/
  config/     typed environment schemas and runtime configuration loaders
  contracts/  shared request/response/event schemas and domain-safe primitives
docs/
  architecture/
  adr/
```

## Responsibility Boundaries

### `apps/api`

- Owns synchronous commands and queries.
- Owns authenticated session boundary, rate limiting, request validation, and websocket authorization.
- Owns domain modules such as identity, conversations, messages, meetings, attachments, notifications, search, and settings.
- Must not contain browser UI code or storage-engine-specific logic inside controllers.

### `apps/web`

- Owns routing, rendering, input flows, optimistic client behavior, accessibility, and responsive interaction design.
- Consumes contracts from `@megaconvert/contracts`.
- Must not duplicate backend validation rules in ad hoc component code.
- Must not invent payload shapes that do not exist in shared contracts.

### `apps/worker`

- Owns asynchronous execution that should not live in request-response paths.
- Owns outbox processing, search indexing, media post-processing, notification delivery, and retention jobs.
- Must be safe to restart and must assume at-least-once delivery semantics.

### `packages/contracts`

- Owns identifiers, shared schemas, error envelopes, pagination primitives, realtime events, and public domain contracts.
- Must not depend on app code.
- Must remain transport-safe and free of side effects.

### `packages/config`

- Owns environment parsing, defaults, error messages, and runtime-safe configuration objects.
- Must fail fast on invalid configuration.
- Must not open network connections or own application state.

## Layering Rules Inside `apps/api`

Every bounded context must follow this dependency direction:

```text
interfaces -> application -> domain
interfaces -> application -> infrastructure
infrastructure -> domain
domain -> nothing outside domain
```

### `interfaces`

- HTTP controllers
- websocket gateways
- DTO adapters
- auth guards and transport-specific interceptors

### `application`

- commands
- queries
- use-case orchestration
- transaction boundaries
- event publication into the outbox

### `domain`

- aggregates
- entities
- value objects
- business policies
- domain services that do not depend on frameworks

### `infrastructure`

- repositories
- external adapter clients
- storage adapters
- queue and outbox publishers
- index writers

## Dependency Rules

- Apps may depend on packages.
- Packages may depend on smaller packages, never on apps.
- `apps/web` may not import from `apps/api`.
- `apps/worker` may not import Nest controllers or UI code.
- Domain modules may communicate through commands, queries, and domain events, not deep imports into another module's repositories.

## Naming Rules

- Use nouns for modules: `conversations`, `messages`, `meetings`, `attachments`, `presence`.
- Use verbs for use cases: `send-message`, `create-meeting`, `mark-conversation-read`.
- Use `*-schema.ts` for runtime validation, `*.types.ts` only when no runtime schema exists.
- Use `gateway` only for websocket edges, never for general services.
- Use `policy` for business constraints and `adapter` for external integration code.

## Extraction Rules

A bounded context may graduate to an independent service only when all conditions are true:

- It has a stable contract boundary.
- It has independent scaling or isolation pressure.
- Its data ownership is explicit.
- Cross-context interactions already flow through events or APIs rather than direct repository coupling.

Until then, it remains inside the modular monolith.

