# Runtime Topology

## Runtime Units

### Web Runtime

- Next.js application server
- server-rendered app shell
- server actions only where they align with backend ownership
- PWA assets and push registration

### API Runtime

- NestJS HTTP edge
- websocket gateway
- request-scoped correlation metadata
- auth and session enforcement
- domain orchestration and transactional writes

### Worker Runtime

- outbox consumer
- fanout executor
- search projection builder
- notification dispatcher
- media post-processing executor

## Stateful Infrastructure

### PostgreSQL

- source of truth for transactional product data
- sequence-backed message ordering within each conversation
- outbox table for durable event publication
- audit tables for security-sensitive actions

### Redis

- presence and websocket fanout hints
- rate limiting
- short-lived idempotency and cursor caches
- ephemeral meeting coordination state

### Object Storage

- attachments
- avatars
- meeting artifacts
- upload staging and processed derivatives

### Media Plane

- LiveKit for SFU, participant media routing, and meeting tokens
- Coturn for relay traversal and network resilience

## Transaction and Event Flow

1. API validates command payloads using shared schemas.
2. API executes a transaction in PostgreSQL.
3. The same transaction writes a durable outbox event.
4. Worker consumes the committed event and performs asynchronous side effects.
5. Websocket fanout and notification delivery happen from committed state, not speculative writes.

## Safety Rules

- Every externally triggered command must be idempotency-aware where duplication is plausible.
- Every asynchronous job must be restart-safe.
- Every upload must have ownership, content-type, size, and scan state recorded before it becomes user-visible.
- Every realtime payload must be contract-validated before leaving the API process.

